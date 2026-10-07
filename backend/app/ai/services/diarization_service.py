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

    def __init__(self, provider: Optional[SpeakerDiarizationProvider] = None):
        self.provider = provider or AssemblyAIDiarizationProvider()
        # Keep aai_provider alias for backward compatibility
        self.aai_provider = self.provider

    def diarize(
        self,
        audio_path: str,
        expected_speakers: Optional[int] = None,
        participant_names: Optional[List[str]] = None,
    ) -> Tuple[List[Dict[str, Any]], str]:
        """
        Extracts speaker timeline intervals.
        Returns:
            (speaker_intervals, provider_name)
        """
        if getattr(self.provider, "is_available", lambda: True)() and os.path.exists(audio_path):
            try:
                intervals = self.provider.diarize(
                    audio_path=audio_path,
                    expected_speakers=expected_speakers,
                )
                logger.info(
                    f"[DiarizationService] AssemblyAI identified {len(intervals)} speaker intervals."
                )
                return intervals, "assemblyai"
            except Exception as e:
                logger.warning(
                    f"[DiarizationService] AssemblyAI diarization failed ({e}). "
                    f"Falling back to local heuristic speaker labeling."
                )

        # ── Fallback: Single-speaker Participant 1 attribution ─
        default_label = "A"
        fallback_intervals = [{
            "speaker": default_label,
            "start": 0.0,
            "end": 99999.0,
            "text": "",
            "confidence": 0.5,
        }]
        return fallback_intervals, "local_fallback"
