import logging
import os
import shutil
import subprocess
import wave
from typing import Tuple

logger = logging.getLogger(__name__)


class AudioPreprocessor:
    """
    Lightweight audio validator and preprocessor.
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
            # Not a standard WAV or compressed audio; estimate duration from file size
            # e.g., standard 128kbps MP3 is ~16 KB/sec
            size_bytes = os.path.getsize(file_path)
            est_duration = round(size_bytes / (16 * 1024), 2)
            return 16000, 1, est_duration

    @classmethod
    def prepare_audio_for_transcription(cls, file_path: str) -> str:
        """
        Validates if audio needs normalization.
        If already a standard format supported directly by Groq (wav, mp3, m4a, webm, ogg),
        returns file_path directly without copying or converting!
        """
        ext = os.path.splitext(file_path)[1].lower()
        groq_supported_exts = {".wav", ".mp3", ".m4a", ".ogg", ".webm", ".flac"}

        if ext in groq_supported_exts:
            # Groq directly ingests these formats natively without any local re-encoding
            return file_path

        # If unfamiliar container, attempt lightweight ffmpeg normalization to 16kHz mono WAV
        ffmpeg_bin = shutil.which("ffmpeg")
        if not ffmpeg_bin:
            logger.warning("[AudioPreprocessor] FFmpeg not found on PATH; using original file.")
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
            logger.info(f"[AudioPreprocessor] Normalized '{file_path}' to '{out_path}' (16kHz mono).")
            return out_path
        except Exception as e:
            logger.warning(f"[AudioPreprocessor] FFmpeg conversion failed: {e}. Falling back to original.")
            return file_path
