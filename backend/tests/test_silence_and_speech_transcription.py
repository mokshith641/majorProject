import os
import unittest
from unittest.mock import MagicMock, patch

from app.database.session import Base, SessionLocal, engine
from app.models.meeting import Meeting
from app.models.transcription import Transcript
from app.models.summary import Summary
from app.models.user import User
from app.ai.services.meeting_pipeline import MeetingProcessingPipeline
from app.ai.services.summary_service import SummaryService
from app.ai.providers.local_provider import LocalProvider


class TestSilenceAndSpeechTranscription(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=engine)

    def setUp(self):
        self.db = SessionLocal()
        # Create test user
        self.user = self.db.query(User).filter(User.email == "test_silence@example.com").first()
        if not self.user:
            self.user = User(
                email="test_silence@example.com",
                hashed_password="hashed_test_password",
                full_name="Silence Tester",
                is_active=True,
            )
            self.db.add(self.user)
            self.db.commit()
            self.db.refresh(self.user)

    def tearDown(self):
        self.db.close()

    def test_summary_service_returns_clear_message_on_silence(self):
        """Verify summary_service never invokes LLMs on silence or empty transcripts."""
        summary_service = SummaryService()
        
        for silence_input in ["", "   ", "No speech detected. Please record again.", "No speech recorded."]:
            intelligence, provider = summary_service.generate_intelligence(transcript=silence_input)
            self.assertEqual(provider, "none")
            self.assertEqual(intelligence["executive_summary"], "No speech detected. Please record again.")
            self.assertEqual(intelligence["action_items"], [])
            self.assertEqual(intelligence["decisions"], [])
            self.assertEqual(intelligence["key_points"], [])

    def test_local_provider_returns_clean_empty_lists_on_silence(self):
        """Verify local provider returns no fake/placeholder discussion points on silence."""
        local_provider = LocalProvider()
        result = local_provider.summarize_text("No speech detected. Please record again.")
        self.assertEqual(result["executive_summary"], "No speech detected. Please record again.")
        self.assertEqual(result["key_points"], [])
        self.assertEqual(result["decisions"], [])
        self.assertEqual(result["action_items"], [])
        self.assertEqual(result["risks"], [])

    @patch("app.ai.services.meeting_pipeline.generate_meeting_pdf", return_value=True)
    def test_recording_with_silence_produces_no_speech_detected(self, mock_pdf):
        """
        Test Case 1: Recording with Silence.
        When Whisper returns 0 segments, the pipeline must:
        - NOT hallucinate any transcript.
        - NOT fall back to live captions buffer or fake dialogues.
        - Store full_text as 'No speech detected. Please record again.'.
        - Store raw_segments as empty list [].
        - Bypass speaker diarization and AI summarization.
        """
        meeting = Meeting(
            title="Silent Test Meeting",
            host_id=self.user.id,
            duration_seconds=30,
            status="ongoing",
        )
        self.db.add(meeting)
        self.db.commit()
        self.db.refresh(meeting)

        pipeline = MeetingProcessingPipeline()
        pipeline.transcription_service = MagicMock()
        pipeline.diarization_service = MagicMock()
        pipeline.summary_service = MagicMock()

        # Whisper returns empty speech
        pipeline.transcription_service.transcribe.return_value = ("", [], "groq")

        # Fake live caption buffer passed in (should be ignored and NOT used)
        fake_live_caps = [
            {"speaker": "Daniel", "text": "Welcome to the session everyone."},
            {"speaker": "Priya", "text": "Testing authentication."},
        ]

        dummy_audio = "dummy_silence.wav"
        with open(dummy_audio, "wb") as f:
            f.write(b"RIFF....WAVEfmt ....data....")

        try:
            pipeline.execute_pipeline(
                meeting_id=meeting.id,
                audio_path=dummy_audio,
                live_caps=fake_live_caps,
            )

            # Assert Diarization was NOT called on silent audio
            pipeline.diarization_service.diarize.assert_not_called()
            # Assert AI Summarizer was NOT called on silent audio
            pipeline.summary_service.generate_intelligence.assert_not_called()

            # Refresh meeting data from DB
            db_transcript = self.db.query(Transcript).filter(Transcript.meeting_id == meeting.id).first()
            self.assertIsNotNone(db_transcript)
            self.assertEqual(db_transcript.full_text, "No speech detected. Please record again.")
            self.assertEqual(db_transcript.raw_segments, [])

            db_summary = self.db.query(Summary).filter(Summary.meeting_id == meeting.id).first()
            self.assertIsNotNone(db_summary)
            self.assertEqual(db_summary.key_points, "No speech detected. Please record again.")
            self.assertEqual(db_summary.action_items, [])
            self.assertEqual(db_summary.decisions, "")

        finally:
            if os.path.exists(dummy_audio):
                os.remove(dummy_audio)

    @patch("app.ai.services.meeting_pipeline.generate_meeting_pdf", return_value=True)
    def test_recording_with_speech_produces_valid_transcript_and_summary(self, mock_pdf):
        """
        Test Case 2: Recording with Actual Speech.
        When genuine speech is spoken:
        - Transcribes speech correctly.
        - Diarizes speakers.
        - Generates summary intelligence from detected speech.
        """
        meeting = Meeting(
            title="Speech Test Meeting",
            host_id=self.user.id,
            duration_seconds=45,
            status="ongoing",
        )
        self.db.add(meeting)
        self.db.commit()
        self.db.refresh(meeting)

        pipeline = MeetingProcessingPipeline()
        pipeline.transcription_service = MagicMock()
        pipeline.diarization_service = MagicMock()
        pipeline.summary_service = MagicMock()

        # Whisper returns genuine speech segments
        sample_segments = [
            {"start": 0.0, "end": 4.0, "text": "Let us review our database pooling configuration.", "confidence": 0.98},
            {"start": 4.5, "end": 8.0, "text": "PostgreSQL connection pool is operating with zero dropouts.", "confidence": 0.96},
        ]
        pipeline.transcription_service.transcribe.return_value = (
            "Let us review our database pooling configuration. PostgreSQL connection pool is operating with zero dropouts.",
            sample_segments,
            "groq"
        )

        pipeline.diarization_service.diarize.return_value = (
            [
                {"speaker": "A", "start": 0.0, "end": 4.2, "confidence": 0.95},
                {"speaker": "B", "start": 4.3, "end": 8.2, "confidence": 0.94},
            ],
            "assemblyai"
        )

        pipeline.summary_service.generate_intelligence.return_value = (
            {
                "title": "Database Connection Review",
                "executive_summary": "Reviewed database pooling configuration with verified zero dropout rate.",
                "key_points": ["Database pooling configuration verified."],
                "decisions": ["Maintain current pool size."],
                "action_items": [{"task": "Monitor pool metrics", "assignee": "DevOps", "deadline": "Friday", "priority": "Medium"}],
                "risks": [],
                "next_steps": ["Review under peak load"],
            },
            "gemini"
        )

        dummy_audio = "dummy_speech.wav"
        with open(dummy_audio, "wb") as f:
            f.write(b"RIFF....WAVEfmt ....data....")

        try:
            pipeline.execute_pipeline(
                meeting_id=meeting.id,
                audio_path=dummy_audio,
            )

            # Assert Diarization WAS called
            pipeline.diarization_service.diarize.assert_called_once()
            # Assert Summary WAS called
            pipeline.summary_service.generate_intelligence.assert_called_once()

            db_transcript = self.db.query(Transcript).filter(Transcript.meeting_id == meeting.id).first()
            self.assertIsNotNone(db_transcript)
            self.assertIn("Participant 1", db_transcript.full_text)
            self.assertIn("Participant 2", db_transcript.full_text)
            self.assertEqual(len(db_transcript.raw_segments), 2)

            db_summary = self.db.query(Summary).filter(Summary.meeting_id == meeting.id).first()
            self.assertIsNotNone(db_summary)
            self.assertIn("Database pooling configuration verified.", db_summary.key_points)
            self.assertEqual(len(db_summary.action_items), 1)

        finally:
            if os.path.exists(dummy_audio):
                os.remove(dummy_audio)


if __name__ == "__main__":
    unittest.main()
