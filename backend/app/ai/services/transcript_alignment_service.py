import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class TranscriptAlignmentService:
    """
    Aligns Groq timestamped transcript segments with AssemblyAI speaker intervals.
    Matches segments, resolves overlapping intervals, merges consecutive segments
    from the same speaker, and maps speaker IDs to known participant names if provided.
    """

    @staticmethod
    def _map_speaker_name(
        speaker_id: str,
        participant_names: Optional[List[str]],
        speaker_name_cache: Dict[str, str],
    ) -> str:
        """
        Maps a generic speaker ID (e.g. 'A', 'B', 'SPEAKER_00', '0') to canonical 'Participant X'.
        Voice-based speaker diarization distinguishes speakers without assuming the authenticated
        user / meeting creator is the speaker.
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
            text = (seg.get("text") or "").strip()
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
        Aligns transcript segments with speaker intervals.
        Returns a list of structured segments:
        [
            {
                "speaker_id": "A",
                "speaker_name": "Participant 1",
                "speaker": "Participant 1",
                "text": "...",
                "start": 0.0,
                "end": 3.5,
                "start_time": 0.0,
                "end_time": 3.5,
                "confidence": 0.95
            },
            ...
        ]
        """
        if not transcript_segments:
            return []

        # If no speaker intervals, attribute to default Participant 1
        if not speaker_intervals:
            default_name = "Participant 1"
            for seg in transcript_segments:
                seg["speaker_id"] = "A"
                seg["speaker_name"] = default_name
                seg["speaker"] = default_name
                seg["start_time"] = seg.get("start", 0.0)
                seg["end_time"] = seg.get("end", 0.0)
                seg.setdefault("confidence", 0.9)
            return transcript_segments

        speaker_name_cache: Dict[str, str] = {}
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

            aligned_raw.append({
                "speaker_id": best_speaker_id,
                "speaker_name": speaker_name,
                "speaker": speaker_name,  # Backwards compatibility with existing frontend
                "text": seg_text,
                "start": seg_start,
                "end": seg_end,
                "start_time": seg_start,
                "end_time": seg_end,
                "confidence": combined_conf,
                "overlap": overlapping_count > 1,
            })

        # Log speaker mapping
        mapping_str = ", ".join(f"{k}→{v}" for k, v in sorted(speaker_name_cache.items()))
        logger.info(f"[ALIGNMENT] Speaker mapping: {mapping_str}")

        # Merge consecutive segments from the exact same speaker within a short pause (< 2.0s)
        merged: List[Dict[str, Any]] = []
        for seg in aligned_raw:
            if not merged:
                merged.append(dict(seg))
                continue

            last = merged[-1]
            if (
                last["speaker_name"] == seg["speaker_name"]
                and (seg["start"] - last["end"]) <= 2.0
            ):
                # Merge text and extend end timestamp
                last["text"] = f"{last['text']} {seg['text']}".strip()
                last["end"] = seg["end"]
                last["end_time"] = seg["end"]
                last["confidence"] = round((last["confidence"] + seg["confidence"]) / 2.0, 2)
                last["overlap"] = last.get("overlap", False) or seg.get("overlap", False)
            else:
                merged.append(dict(seg))

        return merged
