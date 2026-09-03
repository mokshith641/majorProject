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
            
        self._load_model()
        
        logger.info(f"Starting accelerated transcription of: {file_path}")
        start_time = time.time()
        
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
                    "speaker": "Speaker 1"
                })
                
            full_text = " ".join(full_text_list)
            
            # Apply speaker diarization clustering on segment audio clips
            try:
                from app.transcription.diarizer import speaker_diarizer
                segment_list = speaker_diarizer.diarize_segments(file_path, segment_list, participant_names)
            except Exception as e:
                logger.error(f"Failed to execute speaker diarization: {e}")
                
            duration = round(time.time() - start_time, 2)
            logger.info(f"Transcription complete in {duration} seconds. Transcribed {len(segment_list)} segments.")
            return full_text, segment_list
            
        except Exception as e:
            logger.error(f"Error during whisper transcription process: {e}")
            return "", []


# Global transcriber singleton instance
transcriber = WhisperTranscriber()
