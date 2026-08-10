import logging
import os
import threading
import wave
import sounddevice as sd

logger = logging.getLogger(__name__)


class LocalAudioRecorder:
    """Manages recording raw audio chunks from the server's local microphone."""
    
    def __init__(self, sample_rate: int = 16000, channels: int = 1):
        self.sample_rate = sample_rate
        self.channels = channels
        self.is_recording = False
        self.frames = []
        self._thread = None
        self.output_filepath = None

    def _record_loop(self):
        """Internal audio buffer fetch loop."""
        try:
            # Open the audio capture stream with 16-bit integers (int16)
            with sd.InputStream(
                samplerate=self.sample_rate,
                channels=self.channels,
                dtype="int16"
            ) as stream:
                while self.is_recording:
                    # Read 1024 frames of audio data
                    data, overflowed = stream.read(1024)
                    if overflowed:
                        logger.warning("Audio input overflowed.")
                    self.frames.append(data.tobytes())
        except Exception as e:
            logger.error(f"Error inside local audio recording loop: {e}")
            self.is_recording = False

    def start(self, filepath: str):
        """Start capturing audio into the target path."""
        if self.is_recording:
            logger.warning("Recording is already running.")
            return
            
        self.output_filepath = filepath
        self.frames = []
        self.is_recording = True
        
        # Ensure directory folder exists
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        
        # Start thread
        self._thread = threading.Thread(target=self._record_loop, daemon=True)
        self._thread.start()
        logger.info(f"Local audio recording started. Target: {filepath}")

    def stop(self) -> bool:
        """Stop capturing and write data to a WAV file."""
        if not self.is_recording:
            logger.warning("No active recording session to stop.")
            return False
            
        self.is_recording = False
        if self._thread:
            self._thread.join(timeout=5.0)
            
        if not self.frames:
            logger.error("No audio frames were captured.")
            return False
            
        try:
            with wave.open(self.output_filepath, "wb") as wf:
                wf.setnchannels(self.channels)
                wf.setsampwidth(2)  # 2 bytes per sample for 16-bit
                wf.setframerate(self.sample_rate)
                wf.writeframes(b"".join(self.frames))
            logger.info(f"WAV audio file successfully saved to {self.output_filepath}")
            return True
        except Exception as e:
            logger.error(f"Failed to write WAV file: {e}")
            return False
