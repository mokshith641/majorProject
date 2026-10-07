import unittest
from app.ai.services.transcript_alignment_service import TranscriptAlignmentService
from app.ai.services.diarization_service import DiarizationService
from app.ai.providers.assemblyai_provider import (
    SpeakerDiarizationProvider,
    AssemblyAIDiarizationProvider,
    AssemblyAIProvider,
)
from app.core.config import settings


class TestDiarizationPipeline(unittest.TestCase):
    def test_transcript_alignment_speaker_attribution(self):
        """
        Verify timestamp-based alignment between Groq STT segments and AssemblyAI intervals.
        Ensure speakers are strictly mapped to Participant 1, Participant 2, Participant 3,
        and NEVER default to 'Test User' or authenticated user account names.
        """
        groq_segments = [
            {"start": 0.0, "end": 3.4, "text": "Hello everyone, welcome to the sprint review.", "confidence": 0.98},
            {"start": 3.6, "end": 6.8, "text": "Thanks for organizing this. I have finished the frontend updates.", "confidence": 0.95},
            {"start": 7.0, "end": 9.5, "text": "Great, how is the database migration going?", "confidence": 0.97},
            {"start": 9.8, "end": 12.5, "text": "Migration is complete and running smoothly.", "confidence": 0.96},
        ]

        assemblyai_intervals = [
            {"speaker": "A", "start": 0.0, "end": 3.5, "confidence": 0.96},
            {"speaker": "B", "start": 3.5, "end": 6.9, "confidence": 0.94},
            {"speaker": "A", "start": 6.9, "end": 9.6, "confidence": 0.97},
            {"speaker": "C", "start": 9.7, "end": 13.0, "confidence": 0.95},
        ]

        # Deliberately pass host 'Test User' to verify it is NOT mistakenly used as a voice label
        participant_names = ["Test User", "Second Person"]

        aligned = TranscriptAlignmentService.align(
            transcript_segments=groq_segments,
            speaker_intervals=assemblyai_intervals,
            participant_names=participant_names,
        )

        self.assertEqual(len(aligned), 4)

        # Assert correct canonical participant assignments
        self.assertEqual(aligned[0]["speaker_name"], "Participant 1")
        self.assertEqual(aligned[1]["speaker_name"], "Participant 2")
        self.assertEqual(aligned[2]["speaker_name"], "Participant 1")
        self.assertEqual(aligned[3]["speaker_name"], "Participant 3")

        # Strict check: "Test User" must never be present
        for seg in aligned:
            self.assertNotEqual(seg["speaker_name"], "Test User")
            self.assertNotEqual(seg["speaker"], "Test User")

        # Test full transcript formatting
        formatted = TranscriptAlignmentService.format_full_transcript(aligned)
        expected_lines = [
            "Participant 1: Hello everyone, welcome to the sprint review.",
            "Participant 2: Thanks for organizing this. I have finished the frontend updates.",
            "Participant 1: Great, how is the database migration going?",
            "Participant 3: Migration is complete and running smoothly.",
        ]
        self.assertEqual(formatted, "\n".join(expected_lines))

    def test_transcript_alignment_consecutive_merge(self):
        """
        Verify consecutive segments from the same speaker within 2 seconds are merged cleanly.
        """
        groq_segments = [
            {"start": 0.0, "end": 2.0, "text": "First part of statement.", "confidence": 0.95},
            {"start": 2.5, "end": 4.5, "text": "Second part of statement.", "confidence": 0.95},
            {"start": 5.0, "end": 7.0, "text": "Response from second speaker.", "confidence": 0.90},
        ]

        assemblyai_intervals = [
            {"speaker": "A", "start": 0.0, "end": 4.8, "confidence": 0.95},
            {"speaker": "B", "start": 4.9, "end": 7.5, "confidence": 0.90},
        ]

        aligned = TranscriptAlignmentService.align(
            transcript_segments=groq_segments,
            speaker_intervals=assemblyai_intervals,
        )

        self.assertEqual(len(aligned), 2)
        self.assertEqual(aligned[0]["speaker_name"], "Participant 1")
        self.assertEqual(aligned[0]["text"], "First part of statement. Second part of statement.")
        self.assertEqual(aligned[0]["start"], 0.0)
        self.assertEqual(aligned[0]["end"], 4.5)

        self.assertEqual(aligned[1]["speaker_name"], "Participant 2")
        self.assertEqual(aligned[1]["text"], "Response from second speaker.")

    def test_assemblyai_provider_initialization(self):
        """
        Verify AssemblyAI provider correctly reads API key, adheres to SpeakerDiarizationProvider,
        and reports readiness.
        """
        provider = AssemblyAIDiarizationProvider()
        self.assertIsInstance(provider, SpeakerDiarizationProvider)
        has_key = bool(getattr(settings, "ASSEMBLYAI_API_KEY", None))
        self.assertEqual(provider.is_available(), has_key)


if __name__ == "__main__":
    unittest.main()
