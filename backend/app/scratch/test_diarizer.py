import sys
import os
import numpy as np

# Add backend directory to sys.path to resolve "app.*" modules
backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(backend_dir)

from app.transcription.diarizer import kmeans_cluster, extract_voice_print, speaker_diarizer

def test_kmeans():
    print("Testing custom K-Means clustering algorithm...")
    
    # Create synthetic voice prints for 2 speakers (10 dimensions)
    # Speaker 1 voice print centers around high values in low frequencies
    speaker1_center = np.array([1.0, 1.0, 1.0, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1])
    # Speaker 2 voice print centers around high values in high frequencies
    speaker2_center = np.array([0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 1.0, 1.0, 1.0])
    
    # Normalize centers
    speaker1_center /= np.linalg.norm(speaker1_center)
    speaker2_center /= np.linalg.norm(speaker2_center)
    
    # Generate 5 sample segments per speaker with some random noise
    np.random.seed(42)
    s1_samples = speaker1_center + np.random.normal(0, 0.05, (5, 10))
    s2_samples = speaker2_center + np.random.normal(0, 0.05, (5, 10))
    
    # L2 normalize each sample
    s1_samples /= np.linalg.norm(s1_samples, axis=1, keepdims=True)
    s2_samples /= np.linalg.norm(s2_samples, axis=1, keepdims=True)
    
    X = np.vstack([s1_samples, s2_samples])
    
    # We expect 2 clusters
    labels = kmeans_cluster(X, k=2)
    
    print(f"Cluster labels assigned: {labels}")
    # Verify that the first 5 samples belong to one cluster and the next 5 belong to another
    assert len(np.unique(labels[:5])) == 1
    assert len(np.unique(labels[5:])) == 1
    assert labels[0] != labels[5]
    print("K-Means clustering algorithm verified successfully!")


def test_diarizer_mocks():
    print("\nTesting SpeakerDiarizer segment mapping with mock audio results...")
    
    # Setup mock segments
    segments = [
        {"start": 0.0, "end": 2.0, "text": "Hello this is the first speaker speaking.", "speaker": "Speaker 1"},
        {"start": 2.0, "end": 4.5, "text": "This is another speaker in the same room.", "speaker": "Speaker 1"},
        {"start": 4.5, "end": 5.0, "text": "Short.", "speaker": "Speaker 1"}, # Short segment
        {"start": 5.0, "end": 7.2, "text": "Back to the first voice speaking now.", "speaker": "Speaker 1"}
    ]
    
    # Mock extract_segment_audio and extract_voice_print
    import app.transcription.diarizer as diarizer
    
    # Save original functions
    orig_audio = diarizer.extract_segment_audio
    orig_vp = diarizer.extract_voice_print
    
    # Define mocks
    speaker1_vp = np.array([1.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0])
    speaker2_vp = np.array([0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 1.0])
    
    # Normalize
    speaker1_vp /= np.linalg.norm(speaker1_vp)
    speaker2_vp /= np.linalg.norm(speaker2_vp)
    
    mock_audio_calls = []
    
    def mock_extract_audio(wav, start, end):
        mock_audio_calls.append((start, end))
        return np.ones(1000), 16000 # Dummy non-empty array
        
    def mock_voice_print(audio, sr):
        last_call = mock_audio_calls[-1]
        start = last_call[0]
        if start == 0.0 or start == 5.0:
            return speaker1_vp
        else:
            return speaker2_vp
            
    diarizer.extract_segment_audio = mock_extract_audio
    diarizer.extract_voice_print = mock_voice_print
    
    try:
        # Run diarization mapping with names
        names = ["Moksh", "Developer"]
        result = speaker_diarizer.diarize_segments("mock.wav", segments, participant_names=names)
        
        for r in result:
            print(f"Segment [{r['start']}-{r['end']}]: {r['speaker']} -> \"{r['text']}\"")
            
        # Assertions (grouping relations):
        # 1. Segment 0 and Segment 3 must be assigned the same speaker
        assert result[0]["speaker"] == result[3]["speaker"]
        # 2. Segment 1 and Segment 2 must be assigned the same speaker
        assert result[1]["speaker"] == result[2]["speaker"]
        # 3. Segment 0 speaker must be different from Segment 1 speaker
        assert result[0]["speaker"] != result[1]["speaker"]
        # 4. Assigned speakers must be in the input names list
        assert result[0]["speaker"] in names
        assert result[1]["speaker"] in names
        
        print("SpeakerDiarizer segment mapping verified successfully!")
        
    finally:
        # Restore original functions
        diarizer.extract_segment_audio = orig_audio
        diarizer.extract_voice_print = orig_vp


if __name__ == "__main__":
    try:
        test_kmeans()
        test_diarizer_mocks()
        print("\nAll diarization verification tests passed successfully!")
    except AssertionError as e:
        print(f"\nAssertion Error occurred: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    except Exception as e:
        print(f"\nAn error occurred: {e}")
        sys.exit(1)
