import logging
import os
import time
from typing import Dict, List, Tuple, Optional
from faster_whisper import WhisperModel

from app.core.config import settings
from app.transcription.corrector import phonetic_corrector

logger = logging.getLogger(__name__)


class WhisperTranscriber:
    """Manages loading and transcribing using local faster-whisper models."""
    
    def __init__(self):
        self.model: WhisperModel = None
        self.model_name = getattr(settings, "WHISPER_MODEL_NAME", "tiny.en")
        self.device = getattr(settings, "WHISPER_DEVICE", "cpu")

    def _load_model(self):
        """Load the Whisper model with multi-core CPU acceleration into RAM/VRAM."""
        if self.model is not None:
            return
            
        logger.info(f"Loading faster-whisper model '{self.model_name}' on '{self.device}'...")
        start_time = time.time()
        
        compute_type = getattr(settings, "WHISPER_COMPUTE_TYPE", "int8") if self.device == "cpu" else "float16"
        download_root = "./whisper_models"
        os.makedirs(download_root, exist_ok=True)
        
        # Parallelize across available CPU threads
        num_threads = min(8, max(2, (os.cpu_count() or 4) - 1))
        
        try:
            self.model = WhisperModel(
                self.model_name,
                device=self.device,
                compute_type=compute_type,
                cpu_threads=num_threads,
                num_workers=2,
                download_root=download_root
            )
            logger.info(f"Whisper model loaded in {time.time() - start_time:.2f} seconds.")
        except Exception as e:
            logger.error(f"Error loading faster-whisper model: {e}")
            raise e

    def transcribe(self, file_path: str, participant_names: Optional[List[str]] = None) -> Tuple[str, List[Dict]]:
        """
        Transcribe audio with accelerated greedy decoding and VAD filtering.
        Returns:
            - Full consolidated string transcript.
            - List of segments containing {"start", "end", "text", "speaker"}
        """
        if not os.path.exists(file_path):
            logger.error(f"Audio file not found for transcription: {file_path}")
            return "", []
            
        logger.info(f"Starting accelerated transcription of: {file_path}")
        start_time = time.time()

        # ── 1. Groq Cloud Whisper Large V3 Turbo Acceleration ─────────────
        groq_key = getattr(settings, "GROQ_API_KEY", "") or os.environ.get("GROQ_API_KEY", "")
        if groq_key:
            try:
                from groq import Groq
                from app.ai.providers.groq_provider import DEFAULT_DOMAIN_VOCABULARY
                groq_client = Groq(api_key=groq_key)
                prompt_ctx = ", ".join(DEFAULT_DOMAIN_VOCABULARY)[:800]
                logger.info(f"Transcribing '{file_path}' via Groq Cloud whisper-large-v3-turbo (fast acceleration)...")
                with open(file_path, "rb") as af:
                    transcription = groq_client.audio.transcriptions.create(
                        file=(os.path.basename(file_path), af),
                        model="whisper-large-v3-turbo",
                        response_format="verbose_json",
                        temperature=0.0,
                        prompt=prompt_ctx,
                    )
                raw_segments = getattr(transcription, "segments", []) or []
                segment_list = []
                full_text_list = []
                for s in raw_segments:
                    s_start = getattr(s, "start", None) if not isinstance(s, dict) else s.get("start")
                    s_end = getattr(s, "end", None) if not isinstance(s, dict) else s.get("end")
                    s_text = (getattr(s, "text", "") if not isinstance(s, dict) else s.get("text", "")).strip()
                    if not s_text:
                        continue
                    corrected = phonetic_corrector.correct_text(s_text)
                    full_text_list.append(corrected)
                    segment_list.append({
                        "start": round(float(s_start or 0.0), 2),
                        "end": round(float(s_end or 0.0), 2),
                        "text": corrected,
                        "speaker": "Speaker A"
                    })
                full_text = getattr(transcription, "text", " ".join(full_text_list)).strip()
                if segment_list:
                    # Diarize with AssemblyAI
                    try:
                        from app.transcription.diarizer import speaker_diarizer
                        segment_list = speaker_diarizer.diarize_segments(
                            file_path, segment_list, participant_names
                        )
                        if segment_list and "__aai_full_text__" in segment_list[0]:
                            aai_text = segment_list[0].pop("__aai_full_text__")
                            if aai_text and aai_text.strip():
                                full_text = aai_text.strip()
                    except Exception as e:
                        logger.warning(f"Speaker diarization notice: {e}")
                    duration = round(time.time() - start_time, 2)
                    n_speakers = len(set(s.get("speaker", "") for s in segment_list))
                    logger.info(f"Groq Cloud transcription complete in {duration}s — {len(segment_list)} segments, {n_speakers} speaker(s).")
                    return full_text, segment_list
            except Exception as e:
                logger.warning(f"Groq Cloud transcription error: {e}. Falling back to local faster-whisper.")

        self._load_model()
        
        try:
            segments, info = self.model.transcribe(
                file_path,
                beam_size=1,                         # 1 = Greedy decoding (4x-6x faster than beam_size=5)
                best_of=1,                           # Single candidate pass
                temperature=0.0,                     # Zero retry loops on background noise
                condition_on_previous_text=False,    # Prevents quadratic attention latency & loops
                compression_ratio_threshold=2.4,
                log_prob_threshold=-1.0,
                no_speech_threshold=0.6,
                vad_filter=True,                     # High-performance voice activity detection
                vad_parameters=dict(
                    min_silence_duration_ms=300,
                    speech_pad_ms=150
                ),
                language="en"
            )
            
            full_text_list = []
            segment_list = []
            
            for segment in segments:
                text_clean = segment.text.strip()
                if not text_clean:
                    continue
                
                # Apply phonetic term correction to the transcribed segment
                corrected_text = phonetic_corrector.correct_text(text_clean)
                    
                full_text_list.append(corrected_text)
                segment_list.append({
                    "start": round(segment.start, 2),
                    "end": round(segment.end, 2),
                    "text": corrected_text,
                    "speaker": "Speaker A"
                })
                
            full_text = " ".join(full_text_list)
            
            # ── Speaker Diarization via AssemblyAI ───────────────────────────
            # The diarizer uploads the WAV to AssemblyAI, returns per-utterance
            # speaker labels merged onto Whisper time-segments.
            # If AssemblyAI also returns a better-punctuated full transcript it
            # is stored in segment_list[0]["__aai_full_text__"] and used below.
            try:
                from app.transcription.diarizer import speaker_diarizer
                segment_list = speaker_diarizer.diarize_segments(
                    file_path, segment_list, participant_names
                )
                # Extract AssemblyAI full-text if the diarizer attached it
                if segment_list and "__aai_full_text__" in segment_list[0]:
                    aai_text = segment_list[0].pop("__aai_full_text__")
                    if aai_text and aai_text.strip():
                        logger.info("Using AssemblyAI full-text (better punctuation).")
                        full_text = aai_text.strip()
            except Exception as e:
                logger.error(f"Speaker diarization failed: {e}")
                
            duration = round(time.time() - start_time, 2)
            n_speakers = len(set(s.get("speaker", "") for s in segment_list))
            logger.info(
                f"Transcription complete in {duration}s — "
                f"{len(segment_list)} segments, {n_speakers} speaker(s)."
            )
            return full_text, segment_list
            
        except Exception as e:
            logger.error(f"Error during whisper transcription process: {e}")
            return "", []


# Global transcriber singleton instance
transcriber = WhisperTranscriber()
