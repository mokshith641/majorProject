import sys
import os

# Add backend directory to sys.path to resolve "app.*" modules
backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(backend_dir)

from app.transcription.whisper_runner import transcriber
from unittest.mock import MagicMock

# Mock the model's transcribe method to return pre-defined segments
mock_model = MagicMock()

# Setup segments mock: each segment has a .text, .start, .end
class MockSegment:
    def __init__(self, text, start, end):
        self.text = text
        self.start = start
        self.end = end

mock_segments = [
    MockSegment("we have configured sequel light and fast api", 0.0, 4.0),
    MockSegment("and also we are using next js on frontend", 4.0, 8.0),
    MockSegment("everything is uploaded to github", 8.0, 12.0)
]

mock_model.transcribe.return_value = (mock_segments, None)

# Force transcriber to use our mock model
transcriber.model = mock_model

# Create a dummy WAV file path (it must exist for path check, or we can mock os.path.exists)
import tempfile
with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
    tmp_path = tmp.name

try:
    print("Testing mock transcription integration...")
    full_text, segments = transcriber.transcribe(tmp_path)
    
    print(f"\nFull Text Output: {full_text}")
    print(f"Segments Output: {segments}")
    
    assert "SQLite" in full_text
    assert "FastAPI" in full_text
    assert "Next.js" in full_text
    assert "GitHub" in full_text
    
    print("\nTranscription pipeline integration verification successful!")
finally:
    if os.path.exists(tmp_path):
        os.remove(tmp_path)
