import logging
import os
import time
from typing import Dict, List, Tuple
from faster_whisper import WhisperModel

from app.core.config import settings

logger = logging.getLogger(__name__)


class WhisperTranscriber:
    """Manages loading and transcribing using local faster-whisper models."""
    
    def __init__(self):
        self.model: WhisperModel = None
        self.model_name = settings.WHISPER_MODEL_NAME
        self.device = settings.WHISPER_DEVICE

    def _load_model(self):
        """Lazy load the Whisper model into RAM/VRAM."""
        if self.model is not None:
            return
            
        logger.info(f"Loading faster-whisper model '{self.model_name}' on '{self.device}'...")
        start_time = time.time()
        
        # Determine correct compute type based on device
        # For CPU: int8 or float32. For CUDA: float16 or int8_float16
        compute_type = "int8" if self.device == "cpu" else "float16"
        
        # Download cache directory path inside workspace
        download_root = "./whisper_models"
        os.makedirs(download_root, exist_ok=True)
        
        try:
            self.model = WhisperModel(
                self.model_name,
                device=self.device,
                compute_type=compute_type,
                download_root=download_root
            )
            logger.info(f"Whisper model loaded in {time.time() - start_time:.2f} seconds.")
        except Exception as e:
            logger.error(f"Error loading faster-whisper model: {e}")
            raise e

    def transcribe(self, file_path: str) -> Tuple[str, List[Dict]]:
        """
        Transcribe a WAV file.
        Returns:
            - Full consolidated string transcript.
            - List of segments containing {"start", "end", "text", "speaker"}
        """
        if not os.path.exists(file_path):
            logger.error(f"Audio file not found for transcription: {file_path}")
            return "", []
            
        self._load_model()
        
        logger.info(f"Starting transcription of: {file_path}")
        start_time = time.time()
        
        try:
            segments, info = self.model.transcribe(
                file_path,
                beam_size=5,
                language="en",  # Defaulting to English, can be auto-detected
                vad_filter=True,  # Voice Activity Detection to filter background noise
                vad_parameters=dict(min_silence_duration_ms=500)
            )
            
            full_text_list = []
            segment_list = []
            
            for segment in segments:
                text_clean = segment.text.strip()
                if not text_clean:
                    continue
                    
                full_text_list.append(text_clean)
                segment_list.append({
                    "start": round(segment.start, 2),
                    "end": round(segment.end, 2),
                    "text": text_clean,
                    "speaker": "Speaker 1"  # Default speaker mapping
                })
                
            full_text = " ".join(full_text_list)
            duration = round(time.time() - start_time, 2)
            logger.info(f"Transcription complete in {duration} seconds. Transcribed {len(segment_list)} segments.")
            return full_text, segment_list
            
        except Exception as e:
            logger.error(f"Error during whisper transcription process: {e}")
            return "", []


# Global transcriber singleton instance
transcriber = WhisperTranscriber()
