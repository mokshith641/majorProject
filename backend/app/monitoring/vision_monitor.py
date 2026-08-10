import logging
import time
import threading
from typing import Tuple

try:
    import cv2
    import mediapipe as mp
    import numpy as np
    CV_LIBS_AVAILABLE = True
except ImportError:
    CV_LIBS_AVAILABLE = False

logger = logging.getLogger(__name__)


class VisionEngagementMonitor:
    """Uses local webcam, OpenCV, and MediaPipe to track user presence and eye gaze focus."""
    
    def __init__(self):
        global CV_LIBS_AVAILABLE
        self.is_monitoring = False
        self.face_present_seconds = 0.0
        self.attention_scores = []
        self._thread = None
        self._cap = None
        
        if CV_LIBS_AVAILABLE:
            try:
                # Initialize MediaPipe Face Mesh
                self.mp_face_mesh = mp.solutions.face_mesh
                # We initialize with low complexity to maintain high performance on 16GB RAM laptops
                self.face_mesh = self.mp_face_mesh.FaceMesh(
                    max_num_faces=1,
                    refine_landmarks=True,
                    min_detection_confidence=0.5,
                    min_tracking_confidence=0.5
                )
            except Exception as e:
                logger.error(f"Error initializing MediaPipe FaceMesh: {e}. Disabling vision monitor.")
                CV_LIBS_AVAILABLE = False
                self.face_mesh = None
        else:
            self.face_mesh = None

    def _monitor_loop(self):
        """Webcam capture and frame processing thread loop."""
        self._cap = cv2.VideoCapture(0)  # Open default system camera
        if not self._cap.isOpened():
            logger.error("Could not open local system camera for CV monitoring.")
            self.is_monitoring = False
            return
            
        logger.info("Local camera opened successfully. Starting OpenCV/MediaPipe analysis...")
        last_time = time.time()
        
        while self.is_monitoring:
            ret, frame = self._cap.read()
            if not ret:
                time.sleep(0.05)
                continue
                
            current_time = time.time()
            dt = current_time - last_time
            last_time = current_time
            
            # Flip image horizontally for natural mirroring, convert to RGB
            frame_rgb = cv2.cvtColor(cv2.flip(frame, 1), cv2.COLOR_BGR2RGB)
            results = self.face_mesh.process(frame_rgb)
            
            if results.multi_face_landmarks:
                # Face is present in frame
                self.face_present_seconds += dt
                
                # Analyze landmarks for attention tracking
                landmarks = results.multi_face_landmarks[0].landmark
                attention_score = self._calculate_attention(landmarks)
                self.attention_scores.append(attention_score)
            else:
                # No face present
                self.attention_scores.append(0.0)
                
            # Cap polling rate to prevent overheating laptop (around 10 frames per second is plenty)
            time.sleep(0.1)
            
        self._cap.release()
        logger.info("Camera device released and monitoring completed.")

    def _calculate_attention(self, landmarks) -> float:
        """
        Calculate gaze attention score based on head rotation and eye centers.
        Returns a float between 0.0 (unfocused/distracted) and 1.0 (highly focused).
        """
        try:
            # Key landmark indices:
            # 4 (Tip of Nose)
            # 33 (Left Eye Left corner)
            # 133 (Left Eye Right corner)
            # 362 (Right Eye Left corner)
            # 263 (Right Eye Right corner)
            
            nose = np.array([landmarks[4].x, landmarks[4].y, landmarks[4].z])
            left_eye_l = np.array([landmarks[33].x, landmarks[33].y, landmarks[33].z])
            left_eye_r = np.array([landmarks[133].x, landmarks[133].y, landmarks[133].z])
            right_eye_l = np.array([landmarks[362].x, landmarks[362].y, landmarks[362].z])
            right_eye_r = np.array([landmarks[263].x, landmarks[263].y, landmarks[263].z])
            
            # Midpoints of eyes
            left_mid = (left_eye_l + left_eye_r) / 2.0
            right_mid = (right_eye_l + right_eye_r) / 2.0
            eyes_center = (left_mid + right_mid) / 2.0
            
            # Gaze direction vector approximation (horizontal asymmetry)
            # Nose bridge centeredness relative to eye width
            eye_span_x = right_mid[0] - left_mid[0]
            if eye_span_x == 0:
                return 0.5
                
            nose_offset_x = abs(nose[0] - eyes_center[0]) / eye_span_x
            # Standard offset of nose from center of eye span is small when looking directly at screen
            # Lower offset = higher attention. If offset is > 0.4, face is looking away.
            horizontal_score = max(0.0, 1.0 - (nose_offset_x * 2.5))
            
            # Vertical asymmetry (nose height relative to eyes)
            nose_offset_y = abs(nose[1] - eyes_center[1]) / abs(right_mid[1] - landmarks[4].y)
            vertical_score = max(0.0, 1.0 - (nose_offset_y * 1.5))
            
            # Aggregate attention
            score = (horizontal_score * 0.7) + (vertical_score * 0.3)
            return float(np.clip(score, 0.0, 1.0))
        except Exception:
            return 0.5

    def start(self):
        """Activate CV engagement tracking."""
        if not CV_LIBS_AVAILABLE:
            logger.warning("OpenCV or MediaPipe is not installed. Vision monitoring disabled.")
            return

        if self.is_monitoring:
            logger.warning("Vision monitor is already running.")
            return

        self.is_monitoring = True
        self.face_present_seconds = 0.0
        self.attention_scores = []
        
        self._thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self._thread.start()
        logger.info("Vision Engagement monitor started.")

    def get_current_metrics(self) -> dict:
        """Get live gaze information."""
        latest_attention = self.attention_scores[-1] if self.attention_scores else 0.0
        return {
            "face_present": len(self.attention_scores) > 0 and self.attention_scores[-1] > 0.0,
            "eye_attention_score": latest_attention
        }

    def stop(self) -> Tuple[float, float]:
        """
        Stop monitoring and compile session statistics.
        Returns:
            - face_present_seconds: total seconds face was present.
            - average_attention_score: score from 0 to 100.
        """
        if not self.is_monitoring:
            return 0.0, 0.0

        self.is_monitoring = False
        if self._thread:
            self._thread.join(timeout=5.0)

        avg_attention = 0.0
        if self.attention_scores:
            avg_attention = sum(self.attention_scores) / len(self.attention_scores)
            
        logger.info(f"Vision Engagement monitor stopped. Face present: {self.face_present_seconds:.1f}s, Avg Gaze: {avg_attention*100:.1f}%")
        return round(self.face_present_seconds, 2), round(avg_attention * 100.0, 2)


# Global vision tracker instance
vision_monitor = VisionEngagementMonitor()
