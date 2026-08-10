import logging
import time
import threading
from typing import Dict, Optional

try:
    from pynput import keyboard, mouse
    import pygetwindow as gw
    import psutil
    TELEMETRY_LIBS_AVAILABLE = True
except ImportError:
    TELEMETRY_LIBS_AVAILABLE = False

logger = logging.getLogger(__name__)


class UserActivityTracker:
    """Tracks mouse, keyboard, idle time, and focused window titles."""
    
    def __init__(self):
        self.keyboard_hits = 0
        self.mouse_clicks = 0
        self.last_input_time = time.time()
        self.is_tracking = False
        self._keyboard_listener = None
        self._mouse_listener = None
        self._tracker_thread = None
        self.active_window_log: Dict[str, float] = {}  # window title -> seconds active
        self.current_window = None
        self.window_check_interval = 2.0  # seconds

    def _on_press(self, key):
        self.keyboard_hits += 1
        self.last_input_time = time.time()

    def _on_click(self, x, y, button, pressed):
        if pressed:
            self.mouse_clicks += 1
            self.last_input_time = time.time()

    def _track_window_focus(self):
        """Periodically query active window titles."""
        last_check = time.time()
        while self.is_tracking:
            try:
                if TELEMETRY_LIBS_AVAILABLE:
                    active_win = gw.getActiveWindow()
                    if active_win and active_win.title:
                        title = active_win.title
                        elapsed = time.time() - last_check
                        self.active_window_log[title] = self.active_window_log.get(title, 0.0) + elapsed
                        self.current_window = title
            except Exception as e:
                logger.debug(f"Could not retrieve active window info: {e}")
            
            last_check = time.time()
            time.sleep(self.window_check_interval)

    def start_tracking(self):
        """Initialize and run telemetry listeners."""
        if not TELEMETRY_LIBS_AVAILABLE:
            logger.warning("Telemetry libraries (pynput, pygetwindow, psutil) are not installed or available.")
            return

        if self.is_tracking:
            logger.warning("Activity tracking is already active.")
            return

        self.keyboard_hits = 0
        self.mouse_clicks = 0
        self.last_input_time = time.time()
        self.active_window_log = {}
        self.current_window = None
        self.is_tracking = True

        try:
            # Start pynput listeners
            self._keyboard_listener = keyboard.Listener(on_press=self._on_press)
            self._keyboard_listener.start()

            self._mouse_listener = mouse.Listener(on_click=self._on_click)
            self._mouse_listener.start()

            # Start active window polling thread
            self._tracker_thread = threading.Thread(target=self._track_window_focus, daemon=True)
            self._tracker_thread.start()
            
            logger.info("Desktop inputs and window focus tracking started.")
        except Exception as e:
            logger.error(f"Failed to start desktop activity tracking listeners: {e}")
            self.is_tracking = False

    def get_current_metrics(self) -> dict:
        """Fetch ongoing session telemetry statistics."""
        idle_time = int(time.time() - self.last_input_time)
        return {
            "keyboard_hits": self.keyboard_hits,
            "mouse_clicks": self.mouse_clicks,
            "idle_seconds": idle_time,
            "current_window": self.current_window or "Unknown"
        }

    def stop_tracking(self) -> dict:
        """Stop tracking listeners and compile session aggregates."""
        if not self.is_tracking:
            return {"keyboard_hits": 0, "mouse_clicks": 0, "idle_seconds": 0, "windows": {}}

        self.is_tracking = False

        if self._keyboard_listener:
            try:
                self._keyboard_listener.stop()
            except Exception:
                pass
                
        if self._mouse_listener:
            try:
                self._mouse_listener.stop()
            except Exception:
                pass

        if self._tracker_thread:
            self._tracker_thread.join(timeout=3.0)

        # Get dominant focused window
        dominant_window = "Idle"
        if self.active_window_log:
            dominant_window = max(self.active_window_log, key=self.active_window_log.get)

        logger.info("Desktop activity tracking stopped.")
        return {
            "keyboard_hits": self.keyboard_hits,
            "mouse_clicks": self.mouse_clicks,
            "idle_seconds": int(time.time() - self.last_input_time),
            "dominant_window": dominant_window,
            "window_logs": self.active_window_log
        }


# Global activity tracker instance
activity_tracker = UserActivityTracker()
