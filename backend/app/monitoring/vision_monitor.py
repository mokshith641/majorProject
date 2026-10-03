import logging
import time
import threading
import os
import urllib.request
from typing import Tuple

try:
    import cv2
    import mediapipe as mp
    from mediapipe.tasks import python as mp_python
    from mediapipe.tasks.python.vision import FaceLandmarker, FaceLandmarkerOptions, RunningMode
    import numpy as np
    CV_LIBS_AVAILABLE = True
except ImportError:
    CV_LIBS_AVAILABLE = False

logger = logging.getLogger(__name__)

# Path to download the face landmarker model
_MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")
_MODEL_PATH = os.path.join(_MODEL_DIR, "face_landmarker.task")
_MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"


def _ensure_face_landmarker_model() -> bool:
    """Downloads the face landmarker model if not present. Returns True on success."""
    if os.path.exists(_MODEL_PATH):
        return True
    try:
        os.makedirs(_MODEL_DIR, exist_ok=True)
        logger.info(f"Downloading MediaPipe face landmarker model to {_MODEL_PATH} ...")
        urllib.request.urlretrieve(_MODEL_URL, _MODEL_PATH)
        logger.info("Face landmarker model downloaded successfully.")
        return True
    except Exception as e:
        logger.warning(f"Could not download face landmarker model: {e}. Vision monitoring will use simulation mode.")
        return False


class VisionEngagementMonitor:
    """Uses local webcam, OpenCV, and MediaPipe Tasks API to track user presence and eye gaze focus."""

    def __init__(self):
        global CV_LIBS_AVAILABLE
        self.is_monitoring = False
        self.face_present_seconds = 0.0
        self.attention_scores = []
        self._thread = None
        self._cap = None
        self.face_landmarker = None

        if CV_LIBS_AVAILABLE:
            try:
                if _ensure_face_landmarker_model():
                    options = FaceLandmarkerOptions(
                        base_options=mp_python.BaseOptions(model_asset_path=_MODEL_PATH),
                        running_mode=RunningMode.IMAGE,
                        num_faces=1,
                        min_face_detection_confidence=0.5,
                        min_face_presence_confidence=0.5,
                        min_tracking_confidence=0.5,
                        output_face_blendshapes=False,
                        output_facial_transformation_matrixes=False,
                    )
                    self.face_landmarker = FaceLandmarker.create_from_options(options)
                    logger.info("MediaPipe FaceLandmarker (Tasks API) initialized successfully.")
                else:
                    logger.warning("Face landmarker model unavailable. Vision monitor will use simulation mode.")
                    CV_LIBS_AVAILABLE = False
            except Exception as e:
                logger.error(f"Error initializing MediaPipe FaceLandmarker: {e}. Disabling vision monitor.")
                CV_LIBS_AVAILABLE = False
                self.face_landmarker = None

    def _monitor_loop(self):
        """Webcam capture and frame processing thread loop."""
        if not CV_LIBS_AVAILABLE or self.face_landmarker is None:
            # Simulation mode
            last_time = time.time()
            import random
            while self.is_monitoring:
                current_time = time.time()
                dt = current_time - last_time
                last_time = current_time
                self.face_present_seconds += dt
                self.attention_scores.append(random.uniform(0.75, 0.95))
                time.sleep(0.1)
            return

        self._cap = cv2.VideoCapture(0)
        if not self._cap.isOpened():
            logger.warning("Could not open system camera. Falling back to simulated gaze telemetry.")
            last_time = time.time()
            import random
            while self.is_monitoring:
                current_time = time.time()
                dt = current_time - last_time
                last_time = current_time
                self.face_present_seconds += dt
                self.attention_scores.append(random.uniform(0.75, 0.95))
                time.sleep(0.1)
            return

        logger.info("Local camera opened. Starting MediaPipe FaceLandmarker analysis...")
        last_time = time.time()

        while self.is_monitoring:
            ret, frame = self._cap.read()
            if not ret:
                time.sleep(0.05)
                continue

            current_time = time.time()
            dt = current_time - last_time
            last_time = current_time

            # Convert BGR to RGB and process with MediaPipe Tasks API
            frame_rgb = cv2.cvtColor(cv2.flip(frame, 1), cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=frame_rgb)

            try:
                result = self.face_landmarker.detect(mp_image)
            except Exception as e:
                logger.debug(f"Face landmark detection error: {e}")
                time.sleep(0.1)
                continue

            if result.face_landmarks and len(result.face_landmarks) > 0:
                self.face_present_seconds += dt
                landmarks = result.face_landmarks[0]
                attention_score = self._calculate_attention(landmarks)
                self.attention_scores.append(attention_score)
            else:
                self.attention_scores.append(0.0)

            time.sleep(0.1)

        self._cap.release()
        logger.info("Camera released and vision monitoring completed.")

    def _calculate_attention(self, landmarks) -> float:
        """
        Calculate gaze attention score based on head rotation and eye centers.
        Compatible with MediaPipe Tasks NormalizedLandmark list.
        Returns a float between 0.0 (unfocused) and 1.0 (highly focused).
        """
        try:
            # Landmark indices (same as old FaceMesh):
            # 4=NoseTip, 33=LeftEyeLeft, 133=LeftEyeRight, 362=RightEyeLeft, 263=RightEyeRight
            nose = landmarks[4]
            left_eye_l = landmarks[33]
            left_eye_r = landmarks[133]
            right_eye_l = landmarks[362]
            right_eye_r = landmarks[263]

            left_mid_x = (left_eye_l.x + left_eye_r.x) / 2.0
            left_mid_y = (left_eye_l.y + left_eye_r.y) / 2.0
            right_mid_x = (right_eye_l.x + right_eye_r.x) / 2.0
            right_mid_y = (right_eye_l.y + right_eye_r.y) / 2.0

            eyes_center_x = (left_mid_x + right_mid_x) / 2.0
            eyes_center_y = (left_mid_y + right_mid_y) / 2.0

            eye_span_x = right_mid_x - left_mid_x
            if eye_span_x == 0:
                return 0.5

            nose_offset_x = abs(nose.x - eyes_center_x) / eye_span_x
            horizontal_score = max(0.0, 1.0 - (nose_offset_x * 2.5))

            eye_nose_y = abs(right_mid_y - nose.y)
            if eye_nose_y == 0:
                vertical_score = 0.5
            else:
                nose_offset_y = abs(nose.y - eyes_center_y) / eye_nose_y
                vertical_score = max(0.0, 1.0 - (nose_offset_y * 1.5))

            score = (horizontal_score * 0.7) + (vertical_score * 0.3)
            return float(max(0.0, min(1.0, score)))
        except Exception:
            return 0.5

    def start(self):
        """Activate CV engagement tracking."""
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

        logger.info(
            f"Vision monitor stopped. Face present: {self.face_present_seconds:.1f}s, "
            f"Avg Gaze: {avg_attention * 100:.1f}%"
        )
        return round(self.face_present_seconds, 2), round(avg_attention * 100.0, 2)


# Global vision tracker instance
vision_monitor = VisionEngagementMonitor()
