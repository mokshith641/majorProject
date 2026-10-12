from abc import ABC, abstractmethod
import logging
import os
import time
from typing import Any, Dict, List, Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


class SpeakerDiarizationProvider(ABC):
    """
    Abstract interface for speaker diarization providers.
    Allows swappable diarization engines (AssemblyAI, PyAnnote, etc.)
    without modifying downstream pipeline code.
    """

    @abstractmethod
    def diarize(
        self,
        audio_path: str,
        expected_speakers: Optional[int] = None,
        min_speakers: Optional[int] = None,
        max_speakers: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """
        Diarizes the audio file and returns a list of canonical speaker intervals:
        [
            {"speaker": "A", "start": 2.31, "end": 4.69, "text": "...", "confidence": 0.95},
            ...
        ]
        """
        pass


class AssemblyAIDiarizationProvider(SpeakerDiarizationProvider):
    """
    AssemblyAI Cloud Provider for Voice Speaker Diarization.
    Submits audio with speaker_labels=True and parses raw utterances
    into canonical speaker intervals.
    """

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = (
            api_key
            or getattr(settings, "ASSEMBLYAI_API_KEY", "")
            or os.environ.get("ASSEMBLYAI_API_KEY", "")
        )
        self._ready = False
        self._init_sdk()

    def _init_sdk(self):
        if not self.api_key or not self.api_key.strip():
            logger.warning("[AssemblyAIProvider] ASSEMBLYAI_API_KEY not configured.")
            return
        try:
            import assemblyai as aai
            aai.settings.api_key = self.api_key.strip()
            self._ready = True
            logger.info("[AssemblyAIProvider] AssemblyAI SDK ready.")
        except ImportError:
            logger.warning("[AssemblyAIProvider] assemblyai package not installed.")
        except Exception as e:
            logger.error(f"[AssemblyAIProvider] Error initializing SDK: {e}")

    def is_available(self) -> bool:
        return self._ready

    def diarize(
        self,
        audio_path: str,
        expected_speakers: Optional[int] = None,
        min_speakers: Optional[int] = None,
        max_speakers: Optional[int] = None,
        retries: int = 2,
    ) -> List[Dict[str, Any]]:
        """
        Submits audio to AssemblyAI with speaker_labels=True.
        Returns a list of speaker intervals:
        [
            {"speaker": "A", "start": 2.31, "end": 4.69, "text": "...", "confidence": 0.95},
            ...
        ]
        """
        if not self.is_available():
            raise RuntimeError("AssemblyAI provider is not configured.")

        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        import assemblyai as aai

        logger.info(f"[DIARIZATION] Expected speakers: {expected_speakers}")
        logger.info(
            f"[DIARIZATION] AssemblyAI started for '{os.path.basename(audio_path)}' "
            f"(expected_speakers={expected_speakers}, min={min_speakers}, max={max_speakers})..."
        )

        configured_lang = getattr(settings, "TRANSCRIPTION_LANGUAGE", "en")
        config_kwargs: Dict[str, Any] = {
            "speaker_labels": True,
        }
        if configured_lang and configured_lang.lower() not in ["auto", "", "none"]:
            config_kwargs["language_code"] = configured_lang.lower()
        if expected_speakers and expected_speakers >= 2:
            config_kwargs["speakers_expected"] = int(expected_speakers)

        # Configure speaker_options if min/max bounds are supplied
        speaker_opt_kwargs: Dict[str, Any] = {}
        if min_speakers is not None and min_speakers >= 1:
            speaker_opt_kwargs["min_speakers_expected"] = int(min_speakers)
        if max_speakers is not None and max_speakers >= 1:
            speaker_opt_kwargs["max_speakers_expected"] = int(max_speakers)
        if speaker_opt_kwargs and hasattr(aai, "types") and hasattr(aai.types, "SpeakerOptions"):
            try:
                config_kwargs["speaker_options"] = aai.types.SpeakerOptions(**speaker_opt_kwargs)
            except Exception as opt_err:
                logger.warning(f"[DIARIZATION] Could not set SpeakerOptions: {opt_err}")

        config = aai.TranscriptionConfig(**config_kwargs)
        transcriber = aai.Transcriber(config=config)
        logger.info("[DIARIZATION] AssemblyAI request submitted")
        last_error = None

        for attempt in range(retries + 1):
            try:
                start_t = time.time()
                transcript = transcriber.transcribe(audio_path)
                if transcript.status == aai.TranscriptStatus.error:
                    raise RuntimeError(f"AssemblyAI API error: {transcript.error}")

                duration = time.time() - start_t
                utterances = transcript.utterances or []
                logger.info(
                    f"[DIARIZATION] AssemblyAI completed in {duration:.2f}s "
                    f"({len(utterances)} speaker utterances)."
                )

                intervals: List[Dict[str, Any]] = []
                for u in utterances:
                    # u.start and u.end are in milliseconds, convert to seconds
                    start_sec = round(float(u.start) / 1000.0, 2)
                    end_sec = round(float(u.end) / 1000.0, 2)
                    speaker_label = getattr(u, "speaker", "A") or "A"
                    text = getattr(u, "text", "") or ""
                    confidence = getattr(u, "confidence", 0.9) or 0.9

                    intervals.append({
                        "speaker": str(speaker_label).upper(),
                        "start": start_sec,
                        "end": end_sec,
                        "text": text,
                        "confidence": round(float(confidence), 2),
                    })

                detected_speakers = sorted(list(set(i["speaker"] for i in intervals)))
                logger.info(f"[DIARIZATION] Raw speaker IDs detected: {', '.join(detected_speakers)}")
                logger.info(f"[DIARIZATION] Unique detected speakers: {len(detected_speakers)}")
                if intervals:
                    logger.info(f"[DIARIZATION] Raw AssemblyAI sample: {intervals[:2]}")

                return intervals

            except Exception as e:
                last_error = e
                err_msg = str(e).lower()
                if "authentication" in err_msg or "unauthorized" in err_msg or "invalid api key" in err_msg:
                    logger.error(f"[DIARIZATION] AssemblyAI permanent auth failure: {e}")
                    raise e
                if attempt < retries:
                    wait_sec = (attempt + 1) * 3
                    logger.warning(f"[DIARIZATION] Attempt {attempt + 1} failed: {e}. Retrying in {wait_sec}s...")
                    time.sleep(wait_sec)
                else:
                    logger.error(f"[DIARIZATION] Diarization failed after {retries + 1} attempts: {e}")
                    raise last_error

        raise last_error or RuntimeError("AssemblyAI diarization failed.")

    # Compatibility alias
    diarize_audio = diarize


# Backward compatibility aliases
AssemblyAIProvider = AssemblyAIDiarizationProvider

