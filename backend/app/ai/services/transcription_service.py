import logging
import os
import time
from typing import Any, Dict, List, Optional, Tuple

from app.ai.providers.groq_provider import GroqProvider
from app.ai.providers.local_provider import LocalProvider

logger = logging.getLogger(__name__)


class TranscriptionService:
    """
    Manages speech-to-text transcription.
    Primary: Groq Cloud (whisper-large-v3-turbo / whisper-large-v3).
    Fallback: Local faster-whisper on CPU.
    """

    def __init__(
        self,
        groq_provider: Optional[GroqProvider] = None,
        local_provider: Optional[LocalProvider] = None,
    ):
        self.groq_provider = groq_provider or GroqProvider()
        self.local_provider = local_provider or LocalProvider()

    def transcribe(
        self,
        audio_path: str,
        mode: str = "fast",  # "fast" or "accurate"
        language: Optional[str] = None,
        custom_prompt: Optional[str] = None,
    ) -> Tuple[str, List[Dict[str, Any]], str]:
        """
        Transcribes audio with failover support.
        Returns:
            (full_text, segments, provider_used)
        """
        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        # ── 1. Primary: Groq Cloud Speech-to-Text ─────────────────────────
        if self.groq_provider.is_available():
            try:
                full_text, segments = self.groq_provider.transcribe_audio(
                    audio_path=audio_path,
                    mode=mode,
                    language=language,
                    custom_prompt=custom_prompt,
                    retries=2,
                )
                logger.info(
                    f"[TranscriptionService] Groq transcription succeeded: "
                    f"{len(segments)} segments, {len(full_text.split())} words."
                )
                return full_text, segments, "groq"
            except Exception as e:
                logger.warning(
                    f"[TranscriptionService] Groq transcription failed ({e}). "
                    f"Falling back to local faster-whisper..."
                )

        # ── 2. Fallback: Local faster-whisper on CPU ──────────────────────
        try:
            full_text, segments = self.local_provider.transcribe_audio(
                audio_path=audio_path,
                language=language,
            )
            logger.info(
                f"[TranscriptionService] Local fallback transcription succeeded: "
                f"{len(segments)} segments."
            )
            return full_text, segments, "local_whisper"
        except Exception as e:
            logger.error(f"[TranscriptionService] Both Groq and local transcription failed: {e}")
            raise RuntimeError(f"Transcription failed completely: {e}")
