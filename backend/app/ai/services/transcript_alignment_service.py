import logging
import re
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class TranscriptAlignmentService:
    """
    Aligns Groq timestamped transcript segments with AssemblyAI speaker intervals.
    Matches segments, resolves overlapping intervals, detects hallucinations/repetitions,
    and maps speaker IDs strictly to canonical 'Participant 1', 'Participant 2', etc.
    Never uses user account names (e.g. 'Test User') as voice-attributed speaker labels.
    """

    @staticmethod
    def detect_quality_flags(text: str) -> List[str]:
        """
        Conservative hallucination and excessive repetition detector.
        Identifies repeated hallucinated phrases (e.g., 'the reality is the reality it is the reality'
        or 'Adil in India Adil in India Adil in India') without deleting legitimate speech.
        """
        flags: List[str] = []
        if not text or len(text.strip()) < 10:
            return flags

        words = re.findall(r"\b\w+\b", text.lower())
        if len(words) >= 4:
            # 1. Check for single word repeated 3+ times consecutively
            for i in range(len(words) - 2):
                if words[i] == words[i + 1] == words[i + 2]:
                    flags.append("possible_repetition")
                    return flags

            # 2. Check for multi-word phrases (2-4 words) repeated 3+ times
            for n in [2, 3, 4]:
                if len(words) >= n * 3:
                    ngrams = [" ".join(words[i : i + n]) for i in range(len(words) - n + 1)]
                    counts: Dict[str, int] = {}
                    for ng in ngrams:
                        counts[ng] = counts.get(ng, 0) + 1
                        if counts[ng] >= 3:
                            flags.append("possible_repetition")
                            return flags

        # 3. Check for repeated longer sub-phrases via regex
        pattern = r"(.{4,35}?)(?:\s*\1){2,}"
        if re.search(pattern, text, re.IGNORECASE):
            flags.append("possible_repetition")

        return flags

    @staticmethod
    def _map_speaker_name(
        speaker_id: Optional[str],
        participant_names: Optional[List[str]],
        speaker_name_cache: Dict[str, str],
    ) -> str:
        """
        Maps a generic speaker ID (e.g. 'A', 'B', 'C', 'E') dynamically to canonical 'Participant X'.
        Voice-based speaker diarization distinguishes speakers without assuming the authenticated
        user account / host name (like 'Test User') is the speaker.
        """
        if not speaker_id or str(speaker_id).strip().upper() in ["UNKNOWN", "NONE", "UNASSIGNED", ""]:
            return "Unknown Speaker"

        clean_id = str(speaker_id).strip().upper()
        if clean_id in speaker_name_cache:
            return speaker_name_cache[clean_id]

        if clean_id.startswith("PARTICIPANT "):
            speaker_name_cache[clean_id] = clean_id
            return clean_id

        # Allocate next sequential Participant N dynamically
        next_idx = len([v for v in speaker_name_cache.values() if v.startswith("Participant ")]) + 1
        assigned = f"Participant {next_idx}"
        speaker_name_cache[clean_id] = assigned
        return assigned

    @classmethod
    def format_full_transcript(cls, aligned_segments: List[Dict[str, Any]]) -> str:
        """
        Formats segments into readable canonical speaker format:
        Participant 1: Hello everyone.
        Participant 2: Thanks for having me.
        """
        lines = []
        for seg in aligned_segments:
            speaker = seg.get("speaker_name") or seg.get("speaker") or "Unknown Speaker"
            text = (seg.get("cleaned_text") or seg.get("text") or "").strip()
            if text:
                lines.append(f"{speaker}: {text}")
        return "\n".join(lines)

    @classmethod
    def align(
        cls,
        transcript_segments: List[Dict[str, Any]],
        speaker_intervals: List[Dict[str, Any]],
        participant_names: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Aligns transcript segments with speaker intervals via maximum temporal overlap.
        Preserves all detected speaker IDs dynamically (A, B, C, D, ... -> Participant 1, 2, 3, 4, ...).
        Preserves original raw transcript text and flags ambiguous / unassigned utterances.
        """
        if not transcript_segments:
            return []

        # 1. Discover all unique speaker labels returned by AssemblyAI dynamically
        discovered_labels: List[str] = []
        for intv in (speaker_intervals or []):
            spk = str(intv.get("speaker", "")).strip().upper()
            if spk and spk not in ["UNKNOWN", "NONE", "UNASSIGNED", ""] and spk not in discovered_labels:
                discovered_labels.append(spk)

        # Sort labels naturally (A, B, C, ...) while preserving arbitrary IDs
        try:
            discovered_labels = sorted(discovered_labels)
        except Exception:
            pass

        # Build initial dynamic stable mapping for this meeting
        speaker_name_cache: Dict[str, str] = {}
        for idx, lbl in enumerate(discovered_labels, start=1):
            speaker_name_cache[lbl] = f"Participant {idx}"

        # If no speaker intervals provided from diarizer
        if not speaker_intervals:
            default_name = "Participant 1"
            aligned_fallback = []
            for seg in transcript_segments:
                seg_text = (seg.get("text") or "").strip()
                if not seg_text:
                    continue
                flags = cls.detect_quality_flags(seg_text)
                aligned_fallback.append({
                    "speaker_id": "A",
                    "speaker_name": default_name,
                    "speaker": default_name,
                    "raw_text": seg_text,
                    "text": seg_text,
                    "cleaned_text": seg_text,
                    "start": round(float(seg.get("start", 0.0)), 2),
                    "end": round(float(seg.get("end", 0.0)), 2),
                    "start_time": round(float(seg.get("start", 0.0)), 2),
                    "end_time": round(float(seg.get("end", 0.0)), 2),
                    "confidence": float(seg.get("confidence", 0.9)),
                    "quality_flags": flags,
                    "overlap": False,
                })
            logger.info(f"[TRANSCRIPTION] Transcript segments: {len(transcript_segments)}")
            logger.info(f"[ALIGNMENT] Segments aligned: {len(aligned_fallback)}")
            logger.info("[ALIGNMENT] Segments without a speaker: 0")
            logger.info("[ALIGNMENT] Speaker mapping: A→Participant 1 (no diarization intervals)")
            return aligned_fallback

        aligned_raw: List[Dict[str, Any]] = []

        for seg in transcript_segments:
            seg_start = float(seg.get("start", 0.0))
            seg_end = float(seg.get("end", 0.0))
            seg_text = (seg.get("text") or "").strip()
            seg_conf = float(seg.get("confidence", 0.95))

            if not seg_text:
                continue

            # Calculate total overlap duration for each speaker
            overlap_by_speaker: Dict[str, float] = {}
            conf_by_speaker: Dict[str, float] = {}
            overlapping_intervals_count = 0

            for interval in speaker_intervals:
                int_start = float(interval.get("start", 0.0))
                int_end = float(interval.get("end", 0.0))
                int_speaker = str(interval.get("speaker", "")).strip().upper()
                if not int_speaker or int_speaker in ["UNKNOWN", "NONE", "UNASSIGNED", ""]:
                    continue
                int_conf = float(interval.get("confidence", 0.9))

                overlap_start = max(seg_start, int_start)
                overlap_end = min(seg_end, int_end)
                overlap = max(0.0, overlap_end - overlap_start)

                if overlap > 0.0:
                    overlapping_intervals_count += 1
                    overlap_by_speaker[int_speaker] = overlap_by_speaker.get(int_speaker, 0.0) + overlap
                    conf_by_speaker[int_speaker] = max(conf_by_speaker.get(int_speaker, 0.0), int_conf)

            quality_flags = cls.detect_quality_flags(seg_text)
            has_overlap_conflict = False

            if overlap_by_speaker:
                # Assign speaker with maximum overlap duration
                best_speaker_id = max(overlap_by_speaker.items(), key=lambda x: x[1])[0]
                best_speaker_conf = conf_by_speaker.get(best_speaker_id, 0.9)
                speaker_name = cls._map_speaker_name(best_speaker_id, participant_names, speaker_name_cache)
                combined_conf = round(seg_conf * 0.7 + best_speaker_conf * 0.3, 2)

                # Check if multiple speakers overlapped significantly
                if len(overlap_by_speaker) > 1:
                    sorted_overlaps = sorted(overlap_by_speaker.values(), reverse=True)
                    if sorted_overlaps[1] >= 0.35 * sorted_overlaps[0]:
                        has_overlap_conflict = True
                        quality_flags.append("overlapping_speech")
            else:
                # No direct overlap: calculate true interval boundary gap (silence between intervals)
                min_gap = float("inf")
                closest_speaker = None
                closest_conf = 0.8

                for interval in speaker_intervals:
                    int_speaker = str(interval.get("speaker", "")).strip().upper()
                    if not int_speaker or int_speaker in ["UNKNOWN", "NONE", "UNASSIGNED", ""]:
                        continue
                    int_start = float(interval.get("start", 0.0))
                    int_end = float(interval.get("end", 0.0))
                    
                    if int_start > seg_end:
                        gap = int_start - seg_end
                    elif seg_start > int_end:
                        gap = seg_start - int_end
                    else:
                        gap = 0.0

                    if gap < min_gap:
                        min_gap = gap
                        closest_speaker = int_speaker
                        closest_conf = float(interval.get("confidence", 0.8))

                # If within conversational boundary gap (<= 3.5s), attribute to closest speaker
                if min_gap <= 3.5 and closest_speaker is not None:
                    best_speaker_id = closest_speaker
                    best_speaker_conf = closest_conf * 0.85
                    speaker_name = cls._map_speaker_name(best_speaker_id, participant_names, speaker_name_cache)
                    combined_conf = round(seg_conf * 0.65 + best_speaker_conf * 0.35, 2)
                    quality_flags.append("approximate_alignment")
                else:
                    # Attribution genuinely unavailable (isolated utterance > 3.5s from any speaker interval)
                    best_speaker_id = "UNKNOWN"
                    speaker_name = "Unknown Speaker"
                    combined_conf = 0.5
                    quality_flags.append("unassigned_speaker")

            aligned_raw.append({
                "speaker_id": best_speaker_id,
                "speaker_name": speaker_name,
                "speaker": speaker_name,  # Backwards compatibility
                "raw_text": seg_text,
                "text": seg_text,
                "cleaned_text": seg_text,
                "start": round(seg_start, 2),
                "end": round(seg_end, 2),
                "start_time": round(seg_start, 2),
                "end_time": round(seg_end, 2),
                "confidence": combined_conf,
                "quality_flags": quality_flags,
                "overlap": overlapping_intervals_count > 1 or has_overlap_conflict,
            })

        aligned_count = sum(1 for s in aligned_raw if s.get("speaker_id") != "UNKNOWN")
        unassigned_count = sum(1 for s in aligned_raw if s.get("speaker_id") == "UNKNOWN")
        mapping_str = ", ".join(f"{k}→{v}" for k, v in sorted(speaker_name_cache.items()))
        logger.info(f"[TRANSCRIPTION] Transcript segments: {len(transcript_segments)}")
        logger.info(f"[ALIGNMENT] Segments aligned: {aligned_count}")
        logger.info(f"[ALIGNMENT] Segments without a speaker: {unassigned_count}")
        logger.info(f"[ALIGNMENT] Speaker mapping: {mapping_str}")

        # Conservative merge: merge short consecutive phrases from same speaker
        # only if same speaker, gap <= 1.5s, combined length < 250 characters, and neither is Unknown Speaker
        merged: List[Dict[str, Any]] = []
        for seg in aligned_raw:
            if not merged:
                merged.append(dict(seg))
                continue

            last = merged[-1]
            time_gap = seg["start"] - last["end"]
            combined_len = len(last["text"]) + len(seg["text"])

            if (
                last["speaker_name"] == seg["speaker_name"]
                and last["speaker_id"] != "UNKNOWN"
                and seg["speaker_id"] != "UNKNOWN"
                and time_gap <= 1.5
                and combined_len < 250
            ):
                last["text"] = f"{last['text']} {seg['text']}".strip()
                last["raw_text"] = f"{last['raw_text']} {seg['raw_text']}".strip()
                last["cleaned_text"] = f"{last['cleaned_text']} {seg['cleaned_text']}".strip()
                last["end"] = seg["end"]
                last["end_time"] = seg["end"]
                last["confidence"] = round((last["confidence"] + seg["confidence"]) / 2.0, 2)
                last["overlap"] = last.get("overlap", False) or seg.get("overlap", False)
                # Combine quality flags
                existing_flags = set(last.get("quality_flags", []))
                for f in seg.get("quality_flags", []):
                    existing_flags.add(f)
                last["quality_flags"] = list(existing_flags)
            else:
                merged.append(dict(seg))

        return merged
