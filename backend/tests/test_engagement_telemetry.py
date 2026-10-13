import unittest
from datetime import datetime
from app.database.session import SessionLocal
import app.database.base
from app.models.user import User
from app.models.meeting import Meeting, Participant
from app.models.activity import ActivityLog
from app.models.transcription import Transcript
from app.api.v1.analytics import get_meeting_analytics, record_meeting_telemetry, TelemetryUpdateSchema
from app.monitoring.input_monitor import UserActivityTracker


class TestEngagementTelemetry(unittest.TestCase):
    def setUp(self):
        self.db = SessionLocal()
        # Find or create a test user
        self.user = self.db.query(User).first()
        if not self.user:
            self.user = User(
                email="telemetry_test@example.com",
                hashed_password="hashedpassword",
                full_name="Telemetry Test User",
                is_active=True
            )
            self.db.add(self.user)
            self.db.commit()
            self.db.refresh(self.user)

        # Create a test meeting
        self.meeting = Meeting(
            title="Telemetry Regression Test Meeting",
            date=datetime.utcnow(),
            duration_seconds=120,
            host_id=self.user.id,
            status="completed"
        )
        self.db.add(self.meeting)
        self.db.commit()
        self.db.refresh(self.meeting)

    def tearDown(self):
        # Clean up created activity logs, transcripts, and meeting
        self.db.query(ActivityLog).filter(ActivityLog.meeting_id == self.meeting.id).delete()
        self.db.query(Transcript).filter(Transcript.meeting_id == self.meeting.id).delete()
        self.db.query(Meeting).filter(Meeting.id == self.meeting.id).delete()
        self.db.commit()
        self.db.close()

    def test_record_and_get_telemetry_flow(self):
        """Verify telemetry persistence, update on multiple interactions, and sanitized active_window."""
        # 1. Initially no telemetry: get_meeting_analytics returns available=False
        res_empty = get_meeting_analytics(id=self.meeting.id, db=self.db, current_user=self.user)
        self.assertFalse(res_empty.get("has_telemetry", False))

        # 2. Record first interaction (e.g. typing search query and clicking tabs)
        payload1 = TelemetryUpdateSchema(
            keyboard_hits=14,
            mouse_clicks=6,
            idle_seconds=2,
            active_window="Meet Assistant - Summary"
        )
        rec1 = record_meeting_telemetry(
            id=self.meeting.id,
            payload=payload1,
            db=self.db,
            current_user=self.user
        )
        self.assertEqual(rec1["status"], "success")
        self.assertEqual(rec1["keyboard_hits"], 14)
        self.assertEqual(rec1["mouse_clicks"], 6)
        self.assertEqual(rec1["idle_seconds"], 2)
        self.assertEqual(rec1["active_window"], "Meet Assistant - Summary")

        # 3. Fetch analytics: should return the recorded telemetry
        res1 = get_meeting_analytics(id=self.meeting.id, db=self.db, current_user=self.user)
        self.assertTrue(res1["available"])
        self.assertTrue(res1["has_telemetry"])
        self.assertEqual(res1["keyboard_hits"], 14)
        self.assertEqual(res1["mouse_clicks"], 6)
        self.assertEqual(res1["idle_seconds"], 2)
        self.assertEqual(res1["active_window"], "Meet Assistant - Summary")

        # 4. Record additional interactions without resetting previous counts (tab switching / continuous session)
        payload2 = TelemetryUpdateSchema(
            keyboard_hits=25,
            mouse_clicks=12,
            idle_seconds=1,
            active_window="Meet Assistant - Engagement"
        )
        rec2 = record_meeting_telemetry(
            id=self.meeting.id,
            payload=payload2,
            db=self.db,
            current_user=self.user
        )
        self.assertEqual(rec2["keyboard_hits"], 25)
        self.assertEqual(rec2["mouse_clicks"], 12)
        self.assertEqual(rec2["idle_seconds"], 1)

        # 5. Fetch again: updated values persist in database
        res2 = get_meeting_analytics(id=self.meeting.id, db=self.db, current_user=self.user)
        self.assertEqual(res2["keyboard_hits"], 25)
        self.assertEqual(res2["mouse_clicks"], 12)
        self.assertEqual(res2["idle_seconds"], 1)

    def test_dominant_window_sanitization(self):
        """Ensure dominant window never displays 'Idle' when window info is missing or Idle."""
        # Insert a log with active_window='Idle' (legacy/regression case)
        log = ActivityLog(
            meeting_id=self.meeting.id,
            user_id=self.user.id,
            keyboard_hits=0,
            mouse_clicks=0,
            idle_seconds=60,
            active_window="Idle",
            focus_score=60.0
        )
        self.db.add(log)
        self.db.commit()

        # get_meeting_analytics must sanitize "Idle" to "Not available"
        res = get_meeting_analytics(id=self.meeting.id, db=self.db, current_user=self.user)
        self.assertEqual(res["active_window"], "Not available")

    def test_input_monitor_fallback_to_not_available(self):
        """UserActivityTracker stop_tracking should return 'Not available' instead of 'Idle' if no windows tracked."""
        tracker = UserActivityTracker()
        tracker.is_tracking = True
        tracker.active_window_log = {}
        metrics = tracker.stop_tracking()
        self.assertEqual(metrics["dominant_window"], "Not available")


if __name__ == "__main__":
    unittest.main()
