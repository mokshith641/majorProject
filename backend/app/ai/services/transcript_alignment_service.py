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
        speaker_id: str,
        participant_names: Optional[List[str]],
        speaker_name_cache: Dict[str, str],
    ) -> str:
        """
        Maps a generic speaker ID (e.g. 'A', 'B', 'C') strictly to canonical 'Participant X'.
        Voice-based speaker diarization distinguishes speakers without assuming the authenticated
        user account / host name (like 'Test User') is the speaker.
        """
        if speaker_id in speaker_name_cache:
            return speaker_name_cache[speaker_id]

        clean_id = str(speaker_id).strip().upper()
        if clean_id.startswith("PARTICIPANT "):
            speaker_name_cache[speaker_id] = clean_id
            return clean_id

        num = None
        if len(clean_id) == 1 and "A" <= clean_id <= "Z":
            num = ord(clean_id) - ord("A") + 1
        elif clean_id.isdigit():
            num = int(clean_id) + 1
        elif "SPEAKER_" in clean_id:
            try:
                num = int(clean_id.split("_")[-1]) + 1
            except Exception:
                num = None

        if num is None:
            num = len(speaker_name_cache) + 1

        assigned = f"Participant {num}"
        speaker_name_cache[speaker_id] = assigned
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
            speaker = seg.get("speaker_name") or seg.get("speaker") or "Participant 1"
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
        Preserves original raw transcript text and attaches quality diagnostics.
        """
        if not transcript_segments:
            return []

        speaker_name_cache: Dict[str, str] = {}

        # If no speaker intervals from diarizer, attribute to default Participant 1
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
            return aligned_fallback

        aligned_raw: List[Dict[str, Any]] = []

        for seg in transcript_segments:
            seg_start = float(seg.get("start", 0.0))
            seg_end = float(seg.get("end", 0.0))
            seg_text = (seg.get("text") or "").strip()
            seg_conf = float(seg.get("confidence", 0.95))

            if not seg_text:
                continue

            # Find speaker interval with maximum temporal overlap
            best_speaker_id = "A"
            best_overlap = 0.0
            best_speaker_conf = 0.9

            overlapping_count = 0
            for interval in speaker_intervals:
                int_start = float(interval.get("start", 0.0))
                int_end = float(interval.get("end", 0.0))
                int_speaker = str(interval.get("speaker", "A"))
                int_conf = float(interval.get("confidence", 0.9))

                overlap_start = max(seg_start, int_start)
                overlap_end = min(seg_end, int_end)
                overlap = max(0.0, overlap_end - overlap_start)

                if overlap > 0.0:
                    overlapping_count += 1
                if overlap > best_overlap:
                    best_overlap = overlap
                    best_speaker_id = int_speaker
                    best_speaker_conf = int_conf

            # If no direct overlap, pick closest interval by midpoint
            if best_overlap <= 0.0:
                seg_mid = (seg_start + seg_end) / 2.0
                min_dist = float("inf")
                for interval in speaker_intervals:
                    int_mid = (float(interval.get("start", 0.0)) + float(interval.get("end", 0.0))) / 2.0
                    dist = abs(seg_mid - int_mid)
                    if dist < min_dist:
                        min_dist = dist
                        best_speaker_id = str(interval.get("speaker", "A"))
                        best_speaker_conf = float(interval.get("confidence", 0.8))

            speaker_name = cls._map_speaker_name(best_speaker_id, participant_names, speaker_name_cache)
            combined_conf = round(seg_conf * 0.7 + best_speaker_conf * 0.3, 2)
            quality_flags = cls.detect_quality_flags(seg_text)

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
                "overlap": overlapping_count > 1,
            })

        mapping_str = ", ".join(f"{k}→{v}" for k, v in sorted(speaker_name_cache.items()))
        logger.info(f"[ALIGNMENT] Speaker mapping: {mapping_str}")

        # Conservative merge: merge short consecutive phrases from same speaker
        # only if gap <= 1.5s AND combined text length < 250 characters (prevents giant unreadable blobs)
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
