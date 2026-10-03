"""
assemblyai_diarizer.py  —  AssemblyAI-powered Speaker Diarization
===================================================================
Uses AssemblyAI's cloud Speech-to-Text + Speaker Diarization API to
identify *who spoke what* inside a recorded meeting WAV file.

Key behaviours
--------------
* When ASSEMBLYAI_API_KEY is set (and non-empty) in settings:
    → Upload the WAV file to AssemblyAI.
    → Request transcription with speaker_labels=True (diarization).
    → Return segments enriched with "speaker" labels
      (e.g. "Speaker A", "Speaker B") mapped to participant names if provided.
    → Also return a corrected full-text string.

* When the key is absent or the call fails:
    → Fall back silently to a lightweight single-speaker label pass so
      the rest of the pipeline never crashes.

Public interface (unchanged from previous diarizer)
----------------------------------------------------
    speaker_diarizer.diarize_segments(wav_path, segments, participant_names)
    
    Returns the same segments list with "speaker" field populated.
    
    NOTE: When called from whisper_runner the segments already contain
    {start, end, text}.  AssemblyAI diarization results are *merged* onto
    those time-aligned Whisper segments so we keep Whisper's fine-grained
    text while using AssemblyAI's superior speaker labels.
"""

import logging
import os
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _map_speaker_label(aai_label: str, participant_names: Optional[List[str]]) -> str:
    """
    Convert AssemblyAI's generic label (e.g. "A", "B") to a participant name
    if enough participant names were provided, otherwise return "Speaker A".
    """
    if not aai_label:
        return "Speaker A"

    # AssemblyAI returns uppercase letters: "A", "B", "C" …
    label = aai_label.strip().upper()
    index = ord(label) - ord("A")  # A→0, B→1, …

    if participant_names and 0 <= index < len(participant_names):
        return participant_names[index]

    return f"Speaker {label}"


def _merge_aai_speakers_into_segments(
    whisper_segments: List[Dict],
    aai_utterances: list,          # assemblyai.Utterance list
    participant_names: Optional[List[str]],
) -> List[Dict]:
    """
    Align AssemblyAI utterances (which carry speaker labels) onto Whisper
    segments using time overlap.  Each Whisper segment gets the label of
    whichever AssemblyAI utterance it overlaps the most.

    Args:
        whisper_segments : list of {start, end, text, speaker}  (seconds)
        aai_utterances   : list of assemblyai.Utterance objects
                           each has .start (ms), .end (ms), .speaker ("A"/"B"…)
        participant_names: optional list used to map labels to real names

    Returns:
        whisper_segments with "speaker" field updated in-place.
    """
    if not aai_utterances:
        return whisper_segments

    for seg in whisper_segments:
        seg_start_ms = seg.get("start", 0.0) * 1000.0
        seg_end_ms   = seg.get("end",   0.0) * 1000.0

        best_speaker = None
        best_overlap = 0.0

        for utt in aai_utterances:
            utt_start = float(utt.start)  # already in ms
            utt_end   = float(utt.end)

            # Compute overlap duration
            overlap_start = max(seg_start_ms, utt_start)
            overlap_end   = min(seg_end_ms,   utt_end)
            overlap       = max(0.0, overlap_end - overlap_start)

            if overlap > best_overlap:
                best_overlap = overlap
                best_speaker = utt.speaker

        if best_speaker is not None:
            seg["speaker"] = _map_speaker_label(best_speaker, participant_names)
        elif "speaker" not in seg:
            seg["speaker"] = _map_speaker_label("A", participant_names)

    return whisper_segments


# ---------------------------------------------------------------------------
# AssemblyAI Diarizer
# ---------------------------------------------------------------------------

class AssemblyAIDiarizer:
    """
    Speaker diarizer backed by AssemblyAI's cloud API.

    Workflow
    --------
    1. Configure the SDK with the API key from settings.
    2. Upload the local WAV file.
    3. Submit a transcription job with speaker_labels=True.
    4. Poll until done (blocking — called inside a background task / thread).
    5. Merge returned utterances onto the Whisper segment list.
    """

    def __init__(self):
        self._api_key: Optional[str] = None
        self._ready: bool = False
        self._init()

    def _init(self):
        """Lazy-initialise AssemblyAI SDK with the API key from app settings."""
        try:
            from app.core.config import settings
            key = getattr(settings, "ASSEMBLYAI_API_KEY", "").strip()
            if not key:
                logger.warning(
                    "ASSEMBLYAI_API_KEY is not set. "
                    "Speaker diarization will fall back to single-speaker labels."
                )
                return

            import assemblyai as aai
            aai.settings.api_key = key
            self._api_key = key
            self._ready = True
            logger.info("AssemblyAI SDK initialised successfully.")
        except ImportError:
            logger.warning(
                "assemblyai package not installed. "
                "Run: pip install assemblyai. "
                "Falling back to single-speaker labels."
            )
        except Exception as e:
            logger.error(f"AssemblyAI init error: {e}")

    # ------------------------------------------------------------------
    # Public method (matches the old diarizer interface)
    # ------------------------------------------------------------------

    def diarize_segments(
        self,
        wav_path: str,
        segments: List[Dict],
        participant_names: Optional[List[str]] = None,
    ) -> List[Dict]:
        """
        Enrich *segments* with speaker labels using AssemblyAI diarization.

        Parameters
        ----------
        wav_path          : Absolute path to the recorded WAV file.
        segments          : Whisper segments [{start, end, text, speaker}, …].
        participant_names : Optional real names for Speaker A, B, C …

        Returns
        -------
        Same list with "speaker" fields filled in.
        """
        if not segments:
            return []

        # Fast path: single participant
        if participant_names and len(participant_names) == 1:
            for seg in segments:
                seg["speaker"] = participant_names[0]
            return segments

        if not self._ready:
            return self._fallback_label(segments, participant_names)

        if not wav_path or not os.path.exists(wav_path):
            logger.warning(f"WAV file not found for diarization: {wav_path}")
            return self._fallback_label(segments, participant_names)

        try:
            return self._run_assemblyai(wav_path, segments, participant_names)
        except Exception as e:
            logger.error(f"AssemblyAI diarization failed: {e}. Using fallback.")
            return self._fallback_label(segments, participant_names)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _run_assemblyai(
        self,
        wav_path: str,
        segments: List[Dict],
        participant_names: Optional[List[str]],
    ) -> List[Dict]:
        """Upload the file to AssemblyAI and retrieve diarized utterances."""
        import assemblyai as aai

        logger.info(f"Uploading '{wav_path}' to AssemblyAI for speaker diarization …")

        config = aai.TranscriptionConfig(
            speaker_labels=True,           # ← enables diarization
            speakers_expected=(            # hint: improves accuracy
                len(participant_names)
                if participant_names and len(participant_names) >= 2
                else None
            ),
            language_code="en",
        )

        transcriber = aai.Transcriber(config=config)

        # Retry up to 3 attempts with exponential backoff (H4 fix for transient upload failures)
        import time as _time
        transcript = None
        last_err = None
        for attempt in range(3):
            try:
                transcript = transcriber.transcribe(wav_path)
                if transcript.status == aai.TranscriptStatus.error:
                    raise RuntimeError(f"AssemblyAI error: {transcript.error}")
                break
            except Exception as e:
                last_err = e
                if attempt < 2:
                    wait_sec = 2 ** attempt * 2  # 2s, 4s
                    logger.warning(f"AssemblyAI attempt {attempt + 1} failed: {e}. Retrying in {wait_sec}s...")
                    _time.sleep(wait_sec)
                else:
                    raise last_err

        utterances = transcript.utterances or []
        logger.info(
            f"AssemblyAI diarization complete. "
            f"{len(utterances)} utterances, "
            f"{len(set(u.speaker for u in utterances))} unique speakers."
        )

        # Merge AssemblyAI speaker labels onto Whisper segments
        enriched = _merge_aai_speakers_into_segments(
            segments, utterances, participant_names
        )

        # Also build a clean full-text from AssemblyAI's own transcript
        # (better punctuation than Whisper's greedy decode) and attach it
        # as a metadata key so whisper_runner can use it if desired.
        if transcript.text:
            enriched[0]["__aai_full_text__"] = transcript.text

        return enriched

    @staticmethod
    def _fallback_label(
        segments: List[Dict],
        participant_names: Optional[List[str]],
    ) -> List[Dict]:
        """
        When AssemblyAI is unavailable: assign all segments to the first
        participant name, or "Speaker A" if no names are available.
        This ensures downstream code always has a non-null speaker field.
        """
        label = (participant_names[0] if participant_names else "Speaker A")
        for seg in segments:
            seg.setdefault("speaker", label)
        return segments


# ---------------------------------------------------------------------------
# Module-level singleton  (matches old interface: speaker_diarizer)
# ---------------------------------------------------------------------------
speaker_diarizer = AssemblyAIDiarizer()
