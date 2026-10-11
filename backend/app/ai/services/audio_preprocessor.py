import logging
import math
import os
import shutil
import struct
import subprocess
import wave
from typing import Any, Dict, Tuple

logger = logging.getLogger(__name__)


class AudioPreprocessor:
    """
    Lightweight audio validator, diagnostic analyzer, and preprocessor.
    Avoids heavy local computation; only converts when strictly necessary.
    Standardizes audio to 16 kHz mono PCM WAV if required by downstream models.
    """

    @staticmethod
    def inspect_audio(file_path: str) -> Tuple[int, int, float]:
        """
        Returns (sample_rate, channels, duration_seconds).
        Falls back gracefully if not a standard WAV file.
        """
        if not os.path.exists(file_path):
            return 16000, 1, 0.0

        try:
            with wave.open(file_path, "rb") as wf:
                sample_rate = wf.getframerate()
                channels = wf.getnchannels()
                frames = wf.getnframes()
                duration = frames / float(sample_rate) if sample_rate else 0.0
                return sample_rate, channels, round(duration, 2)
        except Exception:
            size_bytes = os.path.getsize(file_path)
            est_duration = round(size_bytes / (16 * 1024), 2)
            return 16000, 1, est_duration

    @classmethod
    def analyze_audio_quality(cls, file_path: str) -> Dict[str, Any]:
        """
        Calculates diagnostic audio quality metrics without external dependencies:
        - duration
        - sample rate
        - channels
        - RMS / volume
        - silence percentage
        - clipping percentage
        - audio quality rating ("Normal", "Low")
        """
        sample_rate, channels, duration = cls.inspect_audio(file_path)
        metrics: Dict[str, Any] = {
            "duration": duration,
            "sample_rate": sample_rate,
            "channels": channels,
            "rms": 0.0,
            "silence_percent": 0.0,
            "clipping_percent": 0.0,
            "audio_quality": "Normal",
        }

        if not os.path.exists(file_path):
            return metrics

        try:
            with wave.open(file_path, "rb") as wf:
                n_frames = wf.getnframes()
                sampwidth = wf.getsampwidth()
                framerate = wf.getframerate()
                
                # Sample up to 60 seconds
                max_frames_to_read = min(n_frames, framerate * 60)
                if max_frames_to_read > 0 and sampwidth == 2:
                    raw_data = wf.readframes(max_frames_to_read)
                    num_samples = len(raw_data) // 2
                    if num_samples > 0:
                        fmt = f"<{num_samples}h"
                        samples = struct.unpack(fmt, raw_data)
                        sum_sq = sum(s * s for s in samples)
                        rms = math.sqrt(sum_sq / num_samples)
                        clipping_count = sum(1 for s in samples if abs(s) > 32000)
                        silence_count = sum(1 for s in samples if abs(s) < 250)
                        
                        clipping_pct = round((clipping_count / num_samples) * 100, 2)
                        silence_pct = round((silence_count / num_samples) * 100, 2)
                        
                        metrics["rms"] = round(rms, 1)
                        metrics["clipping_percent"] = clipping_pct
                        metrics["silence_percent"] = silence_pct
                        
                        # Audio is rated Low if extremely quiet or high clipping
                        if (rms < 150.0 and silence_pct > 85.0) or clipping_pct > 5.0:
                            metrics["audio_quality"] = "Low"
                        else:
                            metrics["audio_quality"] = "Normal"
        except Exception as e:
            logger.debug(f"[AudioPreprocessor] Detailed quality analysis skipped: {e}")

        return metrics

    @classmethod
    def prepare_audio_for_transcription(cls, file_path: str) -> str:
        """
        Validates if audio needs normalization.
        Logs original audio specs and processed format per specifications.
        """
        orig_ext = os.path.splitext(file_path)[1].lower() or "unknown"
        sample_rate, channels, duration = cls.inspect_audio(file_path)

        logger.info(f"[AUDIO] Original format: {orig_ext}")
        logger.info(f"[AUDIO] Duration: {duration}s")
        logger.info(f"[AUDIO] Sample rate: {sample_rate} Hz")
        logger.info(f"[AUDIO] Channels: {channels}")

        groq_supported_exts = {".wav", ".mp3", ".m4a", ".ogg", ".webm", ".flac"}

        if orig_ext in groq_supported_exts:
            # Groq directly ingests these formats natively without any local re-encoding
            logger.info(f"[AUDIO] Processed format: {orig_ext} (direct native)")
            return file_path

        # If unfamiliar container, attempt lightweight ffmpeg normalization to 16kHz mono WAV
        ffmpeg_bin = shutil.which("ffmpeg")
        if not ffmpeg_bin:
            logger.warning("[AUDIO] FFmpeg not found on PATH; using original file.")
            logger.info(f"[AUDIO] Processed format: {orig_ext} (unconverted)")
            return file_path

        out_path = os.path.splitext(file_path)[0] + "_16k_mono.wav"
        try:
            cmd = [
                ffmpeg_bin, "-y", "-i", file_path,
                "-ac", "1", "-ar", "16000",
                "-c:a", "pcm_s16le",
                out_path
            ]
            subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
            logger.info(f"[AUDIO] Processed format: .wav (16kHz mono normalized)")
            return out_path
        except Exception as e:
            logger.warning(f"[AudioPreprocessor] FFmpeg conversion failed: {e}. Falling back to original.")
            logger.info(f"[AUDIO] Processed format: {orig_ext} (fallback)")
            return file_path
