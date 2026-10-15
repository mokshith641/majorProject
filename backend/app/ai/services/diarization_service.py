import logging
import os
from typing import Any, Dict, List, Optional, Tuple

from app.ai.providers.assemblyai_provider import (
    SpeakerDiarizationProvider,
    AssemblyAIDiarizationProvider,
    AssemblyAIProvider,
)

logger = logging.getLogger(__name__)


class DiarizationService:
    """
    Manages speaker diarization.
    Primary: AssemblyAI cloud speaker diarization.
    Fallback: Graceful heuristic speaker attribution without crashing.
    """

    def __init__(
        self,
        provider: Optional[SpeakerDiarizationProvider] = None,
        local_provider: Optional[Any] = None,
    ):
        self.provider = provider or AssemblyAIDiarizationProvider()
        # Keep aai_provider alias for backward compatibility
        self.aai_provider = self.provider
        from app.ai.providers.local_provider import LocalProvider
        self.local_provider = local_provider or LocalProvider()

    def diarize(
        self,
        audio_path: str,
        expected_speakers: Optional[int] = None,
        min_speakers: Optional[int] = None,
        max_speakers: Optional[int] = None,
        participant_names: Optional[List[str]] = None,
    ) -> Tuple[List[Dict[str, Any]], str]:
        """
        Extracts speaker timeline intervals.
        Primary: AssemblyAI (if configured)
        Secondary: Local PyAnnote neural diarization (if HF_TOKEN is configured)
        Fallback: Single-speaker Participant 1 attribution
        """
        # ── 1. Cloud: AssemblyAI ──────────────────────────────────────────
        if getattr(self.provider, "is_available", lambda: False)() and os.path.exists(audio_path):
            try:
                intervals = self.provider.diarize(
                    audio_path=audio_path,
                    expected_speakers=expected_speakers,
                    min_speakers=min_speakers,
                    max_speakers=max_speakers,
                )
                logger.info(
                    f"[DiarizationService] AssemblyAI identified {len(intervals)} speaker intervals."
                )
                return intervals, "assemblyai"
            except Exception as e:
                logger.warning(
                    f"[DiarizationService] AssemblyAI diarization failed ({e}). "
                    f"Falling back to local diarization."
                )

        # ── 2. Local Neural Diarization: PyAnnote ──────────────────────────
        if os.path.exists(audio_path):
            try:
                logger.info("[DiarizationService] Attempting local PyAnnote speaker diarization...")
                intervals = self.local_provider.diarize_audio(
                    audio_path=audio_path,
                    num_speakers=expected_speakers,
                    min_speakers=min_speakers,
                    max_speakers=max_speakers,
                )
                if intervals and len(intervals) > 0 and intervals[0]["end"] < 99990.0:
                    logger.info(f"[DiarizationService] Local PyAnnote identified {len(intervals)} intervals.")
                    return intervals, "local_pyannote"
            except Exception as e:
                logger.warning(f"[DiarizationService] Local PyAnnote diarization failed ({e}). Using single-speaker fallback.")

        # ── 3. Final Fallback: Single-speaker Participant 1 attribution ───
        default_label = "A"
        fallback_intervals = [{
            "speaker": default_label,
            "start": 0.0,
            "end": 99999.0,
            "text": "",
            "confidence": 0.5,
        }]
        return fallback_intervals, "local_fallback"
