import os
import logging
from typing import Dict, List, Optional, Tuple
import numpy as np
from scipy.io import wavfile

logger = logging.getLogger(__name__)

# Global cache to optimize file reading during diarization loops
_audio_cache = {}


def extract_segment_audio(wav_path: str, start_sec: float, end_sec: float) -> Tuple[np.ndarray, int]:
    """
    Reads a slice of the WAV audio corresponding to start_sec and end_sec.
    Converts stereo to mono and normalizes scale. Caches loaded audio to prevent redundant disk reads.
    """
    if not os.path.exists(wav_path):
        return np.array([], dtype=np.float32), 16000
        
    try:
        if wav_path not in _audio_cache:
            sample_rate, data = wavfile.read(wav_path)
            # Convert stereo to mono
            if len(data.shape) > 1:
                data = data.mean(axis=1)
                
            # Normalize to float32 between [-1.0, 1.0]
            if data.dtype == np.int16:
                data = data.astype(np.float32) / 32768.0
            elif data.dtype == np.int32:
                data = data.astype(np.float32) / 2147483648.0
            elif data.dtype == np.uint8:
                data = (data.astype(np.float32) - 128.0) / 128.0
            _audio_cache[wav_path] = (sample_rate, data)
        else:
            sample_rate, data = _audio_cache[wav_path]
            
        start_sample = int(start_sec * sample_rate)
        end_sample = int(end_sec * sample_rate)
        
        # Guard limits
        start_sample = max(0, min(start_sample, len(data)))
        end_sample = max(0, min(end_sample, len(data)))
        
        return data[start_sample:end_sample], sample_rate
    except Exception as e:
        logger.error(f"Error extracting WAV slice from {wav_path}: {e}")
        return np.array([], dtype=np.float32), 16000


def extract_voice_print(audio_data: np.ndarray, sample_rate: int) -> np.ndarray:
    """
    Computes a 10-dimensional Mel-spaced spectral energy voice print from audio data.
    """
    if len(audio_data) < 512:
        return np.zeros(10, dtype=np.float32)
        
    # Compute Fast Fourier Transform
    fft_data = np.abs(np.fft.rfft(audio_data))
    fft_freqs = np.fft.rfftfreq(len(audio_data), 1.0 / sample_rate)
    
    # Human voice range filter (100Hz to 4000Hz) spacing out logarithmically (Mel-spaced)
    min_mel = 1127.0 * np.log(1.0 + 100.0 / 700.0)
    max_mel = 1127.0 * np.log(1.0 + 4000.0 / 700.0)
    
    mel_points = np.linspace(min_mel, max_mel, 11)
    freq_bins = 700.0 * (np.exp(mel_points / 1127.0) - 1.0)
    
    feature_vector = []
    for i in range(10):
        low_f = freq_bins[i]
        high_f = freq_bins[i+1]
        
        mask = (fft_freqs >= low_f) & (fft_freqs < high_f)
        if np.any(mask):
            band_energy = np.mean(fft_data[mask])
        else:
            band_energy = 0.0
        feature_vector.append(band_energy)
        
    features = np.array(feature_vector, dtype=np.float32)
    
    # Normalize features using L2 norm
    norm = np.linalg.norm(features)
    if norm > 1e-6:
        features = features / norm
    else:
        features = np.zeros(10, dtype=np.float32)
        
    return features


def compute_silhouette_score(X: np.ndarray, labels: np.ndarray) -> float:
    """
    Computes the mean Silhouette Coefficient for the dataset X clustered into labels.
    """
    n = len(X)
    if n <= 1:
        return 0.0
        
    unique_labels = np.unique(labels)
    if len(unique_labels) <= 1:
        return 0.0
        
    silhouettes = []
    for i in range(n):
        c_idx = labels[i]
        same_cluster = X[labels == c_idx]
        if len(same_cluster) > 1:
            a_i = np.mean(np.linalg.norm(same_cluster - X[i], axis=1))
        else:
            a_i = 0.0
            
        b_i = float('inf')
        for other_c in unique_labels:
            if other_c == c_idx:
                continue
            other_cluster = X[labels == other_c]
            dist_to_other = np.mean(np.linalg.norm(other_cluster - X[i], axis=1))
            if dist_to_other < b_i:
                b_i = dist_to_other
                
        max_val = max(a_i, b_i)
        s_i = (b_i - a_i) / max_val if max_val > 0 else 0.0
        silhouettes.append(s_i)
        
    return float(np.mean(silhouettes))


def kmeans_cluster(X: np.ndarray, k: int, max_iters: int = 100) -> np.ndarray:
    """
    K-Means clustering implementation using pure NumPy.
    Returns:
        - labels: array of cluster indices (0 to k-1) for each row in X
    """
    n, d = X.shape
    if n == 0:
        return np.array([], dtype=np.int32)
    if k <= 1:
        return np.zeros(n, dtype=np.int32)
        
    # Prevent k from exceeding n
    k = min(k, n)
    
    # Random initialization (pick k unique rows)
    np.random.seed(42)  # For deterministic reproducibility
    idx = np.random.choice(n, k, replace=False)
    centroids = X[idx].copy()
    
    labels = np.zeros(n, dtype=np.int32)
    for _ in range(max_iters):
        # Compute pairwise Euclidean distances: (n, k)
        diff = X[:, np.newaxis, :] - centroids[np.newaxis, :, :]
        distances = np.linalg.norm(diff, axis=2)
        
        # Assign to nearest centroid
        new_labels = np.argmin(distances, axis=1)
        
        if np.array_equal(labels, new_labels):
            break
        labels = new_labels
        
        # Update centroids
        for i in range(k):
            members = X[labels == i]
            if len(members) > 0:
                centroids[i] = members.mean(axis=0)
                
    return labels


class SpeakerDiarizer:
    """
    Splits mono-speaker Whisper transcripts into distinct speaker categories
    using spectral voice print features and custom K-Means clustering.
    """
    
    def diarize_segments(
        self, 
        wav_path: str, 
        segments: List[Dict], 
        participant_names: Optional[List[str]] = None
    ) -> List[Dict]:
        """
        Processes segments, extracts spectral voice prints from the audio file,
        runs K-Means to identify speakers, and updates speaker tags.
        """
        if not segments:
            return []
            
        try:
            # Determine target number of clusters (speakers)
            # Default to 2 if not provided, or count of names in participant_names
            max_k = 2
            if participant_names:
                max_k = max(1, len(participant_names))
                
            logger.info(f"Diarizing {len(segments)} segments. Upper bound speakers: {max_k}")
            
            # Extract features for all segments
            embeddings = []
            valid_indices = [] # Indices of segments that are long/loud enough to cluster
            
            for idx, seg in enumerate(segments):
                start = seg.get("start", 0.0)
                end = seg.get("end", 0.0)
                duration = end - start
                
                # Skip very short segment clips to prevent noise fitting
                if duration < 0.4:
                    continue
                    
                audio_slice, sr = extract_segment_audio(wav_path, start, end)
                
                # Check for silence (low average amplitude)
                if len(audio_slice) == 0 or np.max(np.abs(audio_slice)) < 1e-4:
                    continue
                    
                features = extract_voice_print(audio_slice, sr)
                if np.any(features):
                    embeddings.append(features)
                    valid_indices.append(idx)
                    
            # If we didn't get enough valid segments to run clustering, return default speaker labels
            if len(embeddings) == 0:
                logger.warning("No audio segments met minimum criteria for voice print clustering. Using default speaker.")
                default_name = participant_names[0] if participant_names else "Speaker 1"
                for seg in segments:
                    seg["speaker"] = default_name
                return segments
                
            X = np.stack(embeddings)
            
            # Find optimal k using Silhouette Coefficient scoring (minimum 2 speakers if possible)
            k = max_k
            if len(embeddings) > 2 and max_k > 2:
                best_k = 2
                best_score = -1.0
                
                # Evaluate silhouette score for each k from 2 up to max_k
                for test_k in range(2, max_k + 1):
                    if test_k > len(embeddings):
                        break
                    labels = kmeans_cluster(X, k=test_k)
                    score = compute_silhouette_score(X, labels)
                    logger.info(f"Diarizer: Silhouette Score for K={test_k} is {score:.4f}")
                    
                    # We select the K that maximizes the clustering silhouette score
                    if score > best_score:
                        best_score = score
                        best_k = test_k
                k = best_k
                logger.info(f"Diarizer: Selected optimal speaker count K={k} with validation score {best_score:.4f}")
                
            # Run custom clustering
            cluster_labels = kmeans_cluster(X, k=k)
            
            # Map cluster IDs (0 to k-1) to names
            # Format: "Speaker A", "Speaker B" or actual participant names
            speaker_mapping = {}
            for i in range(k):
                if participant_names and i < len(participant_names):
                    speaker_mapping[i] = participant_names[i]
                else:
                    # Fallback Speaker letters (Speaker A, B, C...)
                    speaker_mapping[i] = f"Speaker {chr(65 + i)}"
                    
            # Map valid segments
            for idx, cluster_id in zip(valid_indices, cluster_labels):
                segments[idx]["speaker"] = speaker_mapping.get(cluster_id, f"Speaker {cluster_id}")
                
            # Map invalid (short/silent) segments to their nearest valid neighbor in time
            # This keeps the conversation turns continuous
            for idx in range(len(segments)):
                if idx not in valid_indices:
                    # Find closest index in valid_indices
                    if not valid_indices:
                        # Fallback
                        segments[idx]["speaker"] = speaker_mapping[0]
                        continue
                        
                    closest_valid_idx = min(valid_indices, key=lambda x: abs(x - idx))
                    segments[idx]["speaker"] = segments[closest_valid_idx]["speaker"]
                    
            return segments
        finally:
            # Clear the cached WAV file to prevent memory leak
            _audio_cache.pop(wav_path, None)


# Singleton instance
speaker_diarizer = SpeakerDiarizer()
