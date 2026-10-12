import unittest
from typing import List, Dict, Any

from app.ai.services.transcript_alignment_service import TranscriptAlignmentService
from app.ai.services.transcript_cleanup_service import TranscriptCleanupService


class TestSpeakerDiarizationRegression(unittest.TestCase):
    """
    Automated regression tests covering all requirements from Section 9:
    Tests A through H.
    """

    def test_case_a_two_speakers(self):
        """
        Test A — Two speakers
        Input diarization labels: A, B.
        Expected output: Participant 1, Participant 2.
        """
        transcript_segments = [
            {"start": 0.0, "end": 2.5, "text": "Hello, how are you?", "confidence": 0.95},
            {"start": 2.8, "end": 5.0, "text": "I am doing well, thank you.", "confidence": 0.94},
        ]
        diarization_intervals = [
            {"speaker": "A", "start": 0.0, "end": 2.6, "confidence": 0.95},
            {"speaker": "B", "start": 2.7, "end": 5.1, "confidence": 0.93},
        ]

        aligned = TranscriptAlignmentService.align(
            transcript_segments=transcript_segments,
            speaker_intervals=diarization_intervals,
        )

        self.assertEqual(len(aligned), 2)
        self.assertEqual(aligned[0]["speaker_name"], "Participant 1")
        self.assertEqual(aligned[0]["speaker_id"], "A")
        self.assertEqual(aligned[1]["speaker_name"], "Participant 2")
        self.assertEqual(aligned[1]["speaker_id"], "B")

    def test_case_b_three_speakers(self):
        """
        Test B — Three speakers
        Input labels: A, B, C.
        Expected output: Participant 1, Participant 2, Participant 3.
        """
        transcript_segments = [
            {"start": 0.0, "end": 2.5, "text": "Let us begin the discussion.", "confidence": 0.95},
            {"start": 2.8, "end": 5.0, "text": "I have the architecture plan.", "confidence": 0.94},
            {"start": 5.5, "end": 8.0, "text": "And I will handle deployment.", "confidence": 0.96},
        ]
        diarization_intervals = [
            {"speaker": "A", "start": 0.0, "end": 2.6, "confidence": 0.95},
            {"speaker": "B", "start": 2.7, "end": 5.1, "confidence": 0.93},
            {"speaker": "C", "start": 5.4, "end": 8.1, "confidence": 0.94},
        ]

        aligned = TranscriptAlignmentService.align(
            transcript_segments=transcript_segments,
            speaker_intervals=diarization_intervals,
        )

        self.assertEqual(len(aligned), 3)
        self.assertEqual(aligned[0]["speaker_name"], "Participant 1")
        self.assertEqual(aligned[1]["speaker_name"], "Participant 2")
        self.assertEqual(aligned[2]["speaker_name"], "Participant 3")
        self.assertEqual(aligned[2]["speaker_id"], "C")

    def test_case_c_four_speakers(self):
        """
        Test C — Four speakers
        Input labels: A, B, C, D.
        Expected output: Participant 1, Participant 2, Participant 3, Participant 4.
        """
        transcript_segments = [
            {"start": 0.0, "end": 2.0, "text": "Speaker one check.", "confidence": 0.95},
            {"start": 2.5, "end": 4.5, "text": "Speaker two check.", "confidence": 0.95},
            {"start": 5.0, "end": 7.0, "text": "Speaker three check.", "confidence": 0.95},
            {"start": 7.5, "end": 9.5, "text": "Speaker four check.", "confidence": 0.95},
        ]
        diarization_intervals = [
            {"speaker": "A", "start": 0.0, "end": 2.1, "confidence": 0.95},
            {"speaker": "B", "start": 2.4, "end": 4.6, "confidence": 0.95},
            {"speaker": "C", "start": 4.9, "end": 7.1, "confidence": 0.95},
            {"speaker": "D", "start": 7.4, "end": 9.6, "confidence": 0.95},
        ]

        aligned = TranscriptAlignmentService.align(
            transcript_segments=transcript_segments,
            speaker_intervals=diarization_intervals,
        )

        self.assertEqual(len(aligned), 4)
        self.assertEqual(aligned[0]["speaker_name"], "Participant 1")
        self.assertEqual(aligned[1]["speaker_name"], "Participant 2")
        self.assertEqual(aligned[2]["speaker_name"], "Participant 3")
        self.assertEqual(aligned[3]["speaker_name"], "Participant 4")

    def test_case_d_nonconsecutive_labels(self):
        """
        Test D — Nonconsecutive labels
        Input labels: A, B, E.
        Expected output: three distinct participants, with a stable mapping for the meeting.
        """
        transcript_segments = [
            {"start": 0.0, "end": 2.0, "text": "First voice speaking.", "confidence": 0.95},
            {"start": 2.5, "end": 4.5, "text": "Second voice speaking.", "confidence": 0.95},
            {"start": 5.0, "end": 7.0, "text": "Third voice speaking with label E.", "confidence": 0.95},
            {"start": 7.5, "end": 9.5, "text": "First voice speaks again.", "confidence": 0.95},
        ]
        diarization_intervals = [
            {"speaker": "A", "start": 0.0, "end": 2.1, "confidence": 0.95},
            {"speaker": "B", "start": 2.4, "end": 4.6, "confidence": 0.95},
            {"speaker": "E", "start": 4.9, "end": 7.1, "confidence": 0.95},
            {"speaker": "A", "start": 7.4, "end": 9.6, "confidence": 0.95},
        ]

        aligned = TranscriptAlignmentService.align(
            transcript_segments=transcript_segments,
            speaker_intervals=diarization_intervals,
        )

        self.assertEqual(len(aligned), 4)
        # Distinct participants mapping:
        self.assertEqual(aligned[0]["speaker_name"], "Participant 1")
        self.assertEqual(aligned[1]["speaker_name"], "Participant 2")
        self.assertEqual(aligned[2]["speaker_name"], "Participant 3")
        # Stable mapping across subsequent segments:
        self.assertEqual(aligned[3]["speaker_name"], "Participant 1")

        unique_speakers = list(dict.fromkeys(s["speaker_name"] for s in aligned))
        self.assertEqual(len(unique_speakers), 3)

    def test_case_e_third_speaker_single_short_utterance(self):
        """
        Test E — Third speaker has only one short utterance.
        Ensure the short utterance is not lost or incorrectly assigned to Participant 1 or Participant 2.
        """
        transcript_segments = [
            {"start": 0.0, "end": 5.0, "text": "Long monologue from speaker A discussing project roadmaps.", "confidence": 0.95},
            {"start": 5.5, "end": 10.0, "text": "Detailed response from speaker B regarding backend architecture.", "confidence": 0.95},
            {"start": 10.5, "end": 11.2, "text": "Yes, next Friday.", "confidence": 0.92},  # Very short utterance
            {"start": 12.0, "end": 16.0, "text": "Speaker A resumes speaking and concludes the meeting.", "confidence": 0.95},
        ]
        diarization_intervals = [
            {"speaker": "A", "start": 0.0, "end": 5.1, "confidence": 0.95},
            {"speaker": "B", "start": 5.4, "end": 10.1, "confidence": 0.95},
            {"speaker": "C", "start": 10.4, "end": 11.4, "confidence": 0.91},  # Speaker C only speaks here
            {"speaker": "A", "start": 11.9, "end": 16.2, "confidence": 0.95},
        ]

        aligned = TranscriptAlignmentService.align(
            transcript_segments=transcript_segments,
            speaker_intervals=diarization_intervals,
        )

        self.assertEqual(len(aligned), 4)
        self.assertEqual(aligned[0]["speaker_name"], "Participant 1")
        self.assertEqual(aligned[1]["speaker_name"], "Participant 2")
        self.assertEqual(aligned[2]["speaker_name"], "Participant 3")
        self.assertEqual(aligned[2]["speaker_id"], "C")
        self.assertEqual(aligned[2]["text"], "Yes, next Friday.")
        self.assertEqual(aligned[3]["speaker_name"], "Participant 1")

    def test_case_f_missing_speaker_attribution(self):
        """
        Test F — Missing speaker attribution.
        Ensure the segment becomes Unknown Speaker or is otherwise explicitly marked as unassigned,
        rather than being assigned arbitrarily to Participant 1 or Participant 2.
        """
        transcript_segments = [
            {"start": 0.0, "end": 3.0, "text": "Known speech from participant 1.", "confidence": 0.95},
            {"start": 30.0, "end": 33.0, "text": "Speech with no overlapping diarization interval anywhere near.", "confidence": 0.90},
        ]
        diarization_intervals = [
            {"speaker": "A", "start": 0.0, "end": 3.1, "confidence": 0.95},
            # No interval for timestamp 30.0 - 33.0
        ]

        aligned = TranscriptAlignmentService.align(
            transcript_segments=transcript_segments,
            speaker_intervals=diarization_intervals,
        )

        self.assertEqual(len(aligned), 2)
        self.assertEqual(aligned[0]["speaker_name"], "Participant 1")
        # Segment far from any diarization segment must NOT be arbitrarily mapped to Participant 1:
        self.assertEqual(aligned[1]["speaker_name"], "Unknown Speaker")
        self.assertEqual(aligned[1]["speaker_id"], "UNKNOWN")
        self.assertIn("unassigned_speaker", aligned[1]["quality_flags"])

    def test_case_g_cleaned_transcript(self):
        """
        Test G — Cleaned transcript.
        Ensure cleanup does not remove Participant 3 or change the speaker mapping.
        """
        segments = [
            {
                "speaker_id": "A",
                "speaker_name": "Participant 1",
                "text": "we are testing fast api endpoints.",
                "raw_text": "we are testing fast api endpoints.",
                "start": 0.0,
                "end": 2.5,
                "confidence": 0.95,
            },
            {
                "speaker_id": "B",
                "speaker_name": "Participant 2",
                "text": "and react components with type script.",
                "raw_text": "and react components with type script.",
                "start": 3.0,
                "end": 5.5,
                "confidence": 0.95,
            },
            {
                "speaker_id": "C",
                "speaker_name": "Participant 3",
                "text": "i will deploy to sequel light database.",
                "raw_text": "i will deploy to sequel light database.",
                "start": 6.0,
                "end": 8.5,
                "confidence": 0.95,
            },
        ]

        cleanup_service = TranscriptCleanupService()
        cleaned = cleanup_service.clean_segments(segments)

        self.assertEqual(len(cleaned), 3)
        # Verify speaker names and IDs are completely preserved
        self.assertEqual(cleaned[0]["speaker_name"], "Participant 1")
        self.assertEqual(cleaned[0]["speaker_id"], "A")
        self.assertEqual(cleaned[1]["speaker_name"], "Participant 2")
        self.assertEqual(cleaned[1]["speaker_id"], "B")
        self.assertEqual(cleaned[2]["speaker_name"], "Participant 3")
        self.assertEqual(cleaned[2]["speaker_id"], "C")

        # Verify technical casing normalization worked without deleting words or speakers
        self.assertIn("FastAPI", cleaned[0]["cleaned_text"])
        self.assertIn("TypeScript", cleaned[1]["cleaned_text"])
        self.assertIn("SQLite", cleaned[2]["cleaned_text"])

        # Verify format_transcript_text retains all 3 speakers
        full_cleaned = TranscriptCleanupService.format_transcript_text(cleaned, use_cleaned=True)
        self.assertIn("Participant 1:", full_cleaned)
        self.assertIn("Participant 2:", full_cleaned)
        self.assertIn("Participant 3:", full_cleaned)

    def test_case_h_frontend_rendering_simulation(self):
        """
        Test H — Frontend rendering data simulation.
        Mock an API response containing four speakers and verify that all four participant
        labels are present and distinguishable.
        """
        mock_api_transcript_response = {
            "id": 101,
            "full_text": "Participant 1: Hi\nParticipant 2: Hello\nParticipant 3: Welcome\nParticipant 4: Thank you",
            "raw_segments": [
                {"speaker_id": "A", "speaker_name": "Participant 1", "speaker": "Participant 1", "text": "Hi", "start": 0.0, "end": 1.0},
                {"speaker_id": "B", "speaker_name": "Participant 2", "speaker": "Participant 2", "text": "Hello", "start": 1.5, "end": 2.5},
                {"speaker_id": "C", "speaker_name": "Participant 3", "speaker": "Participant 3", "text": "Welcome", "start": 3.0, "end": 4.0},
                {"speaker_id": "D", "speaker_name": "Participant 4", "speaker": "Participant 4", "text": "Thank you", "start": 4.5, "end": 5.5},
            ],
            "diagnostics": {
                "detected_speakers_count": 4,
                "detected_speakers": ["Participant 1", "Participant 2", "Participant 3", "Participant 4"],
                "raw_speaker_ids": ["A", "B", "C", "D"],
                "speaker_mapping": {
                    "A": "Participant 1",
                    "B": "Participant 2",
                    "C": "Participant 3",
                    "D": "Participant 4",
                },
            },
        }

        raw_segments = mock_api_transcript_response["raw_segments"]
        rendered_speakers = [seg.get("speaker_name") or seg.get("speaker") for seg in raw_segments]

        self.assertEqual(len(rendered_speakers), 4)
        self.assertEqual(rendered_speakers[0], "Participant 1")
        self.assertEqual(rendered_speakers[1], "Participant 2")
        self.assertEqual(rendered_speakers[2], "Participant 3")
        self.assertEqual(rendered_speakers[3], "Participant 4")

        unique_speakers = sorted(list(set(rendered_speakers)))
        self.assertEqual(unique_speakers, ["Participant 1", "Participant 2", "Participant 3", "Participant 4"])


if __name__ == "__main__":
    unittest.main()
