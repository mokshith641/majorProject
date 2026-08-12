import sys
import os
import numpy as np

# Add backend directory to sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(backend_dir)

from app.transcription.whisper_runner import transcriber
from unittest.mock import MagicMock

# 1. Mock the Whisper Model transcribe to return dummy segments
mock_model = MagicMock()

class MockSegment:
    def __init__(self, text, start, end):
        self.text = text
        self.start = start
        self.end = end

mock_segments = [
    MockSegment("This is segment one from the first person.", 0.0, 3.0),
    MockSegment("This is segment two from the second person.", 3.0, 6.0),
    MockSegment("This is segment three from the first person again.", 6.0, 9.0)
]

mock_model.transcribe.return_value = (mock_segments, None)
transcriber.model = mock_model

# 2. Mock audio extraction and voice print calculations in diarizer
import app.transcription.diarizer as diarizer

# Target mock voice prints
voice1 = np.array([1.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]) # low frequency speaker
voice2 = np.array([0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 1.0]) # high frequency speaker

voice1 /= np.linalg.norm(voice1)
voice2 /= np.linalg.norm(voice2)

audio_calls = []

def mock_audio_read(wav, start, end):
    audio_calls.append((start, end))
    return np.ones(1000), 16000

def mock_voice_print(audio, sr):
    last_start = audio_calls[-1][0]
    if last_start == 0.0 or last_start == 6.0:
        return voice1
    else:
        return voice2

diarizer.extract_segment_audio = mock_audio_read
diarizer.extract_voice_print = mock_voice_print

# 3. Create dummy file
import tempfile
with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
    tmp_path = tmp.name

try:
    print("Running integration diarization pipeline test...")
    names = ["Alice", "Bob"]
    full_text, segments = transcriber.transcribe(tmp_path, participant_names=names)
    
    print(f"\nConsolidated Transcript: {full_text}")
    print("\nSegments:")
    for s in segments:
        print(f"[{s['start']}-{s['end']}] {s['speaker']}: \"{s['text']}\"")
        
    # Assertions
    # We expect segment 0 and 2 to have the same speaker, and segment 1 to have a different speaker
    assert segments[0]["speaker"] == segments[2]["speaker"]
    assert segments[0]["speaker"] != segments[1]["speaker"]
    assert segments[0]["speaker"] in names
    assert segments[1]["speaker"] in names
    
    print("\nDiarization pipeline integration verification successful!")
finally:
    if os.path.exists(tmp_path):
        os.remove(tmp_path)
