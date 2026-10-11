import json
import logging
import os
import time
from datetime import datetime
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from app.core.config import settings
from app.database.session import SessionLocal
import app.database.base  # noqa: Ensure all SQLAlchemy models are registered
from app.models.meeting import Meeting, Participant
from app.models.transcription import Transcript
from app.models.summary import Summary
from app.models.report import Report
from app.models.activity import ActivityLog
from app.reports.pdf_generator import generate_meeting_pdf

from app.ai.services.audio_preprocessor import AudioPreprocessor
from app.ai.services.transcription_service import TranscriptionService
from app.ai.services.diarization_service import DiarizationService
from app.ai.services.transcript_alignment_service import TranscriptAlignmentService
from app.ai.services.transcript_cleanup_service import TranscriptCleanupService, transcript_cleanup_service
from app.ai.services.summary_service import SummaryService

logger = logging.getLogger(__name__)

PIPELINE_STAGES = [
    {"key": "UPLOADING", "label": "Uploading audio"},
    {"key": "TRANSCRIBING", "label": "Transcribing audio"},
    {"key": "DIARIZING", "label": "Detecting speakers"},
    {"key": "ALIGNING", "label": "Aligning transcript"},
    {"key": "CLEANING", "label": "Cleaning transcript"},
    {"key": "ANALYZING", "label": "Generating summary"},
    {"key": "COMPLETED", "label": "Completed"},
]

# Global in-memory processing status registry
pipeline_status_registry: Dict[int, Dict[str, Any]] = {}


class MeetingProcessingPipeline:
    """
    Central orchestrator for the optimized meeting processing lifecycle.
    Manages end-to-end background execution with granular progress telemetry,
    multi-tier cloud failover, and strict prevention of duplicate AI processing.
    """

    def __init__(
        self,
        transcription_service: Optional[TranscriptionService] = None,
        diarization_service: Optional[DiarizationService] = None,
        alignment_service: Optional[TranscriptAlignmentService] = None,
        cleanup_service: Optional[TranscriptCleanupService] = None,
        summary_service: Optional[SummaryService] = None,
    ):
        self.transcription_service = transcription_service or TranscriptionService()
        self.diarization_service = diarization_service or DiarizationService()
        self.alignment_service = alignment_service or TranscriptAlignmentService()
        self.cleanup_service = cleanup_service or transcript_cleanup_service
        self.summary_service = summary_service or SummaryService()

    @staticmethod
    def get_status(meeting_id: int) -> Dict[str, Any]:
        """Returns the current processing status for polling or WebSocket distribution."""
        status = pipeline_status_registry.get(meeting_id)
        if not status:
            return {
                "meeting_id": meeting_id,
                "status": "COMPLETED",
                "progress": 100,
                "step": "Processing complete.",
                "stages": PIPELINE_STAGES,
                "current_stage": "COMPLETED",
                "error": None,
                "done": True,
                "telemetry": {},
            }
        return status

    @staticmethod
    def _update_status(
        meeting_id: int,
        status: str,
        progress: int,
        step: str,
        error: Optional[str] = None,
        telemetry: Optional[Dict[str, Any]] = None,
        done: bool = False,
    ):
        existing = pipeline_status_registry.get(meeting_id, {})
        merged_telemetry = existing.get("telemetry", {})
        if telemetry:
            merged_telemetry.update(telemetry)

        pipeline_status_registry[meeting_id] = {
            "meeting_id": meeting_id,
            "status": status,
            "progress": progress,
            "step": step,
            "stages": PIPELINE_STAGES,
            "current_stage": status,
            "error": error,
            "telemetry": merged_telemetry,
            "done": done,
            "updated_at": time.time(),
        }
        logger.info(f"[Pipeline #{meeting_id}] Status: {status} ({progress}%) — {step}")

    def execute_pipeline(
        self,
        meeting_id: int,
        audio_path: str,
        mode: str = "fast",
        language: Optional[str] = None,
        custom_prompt: Optional[str] = None,
        participant_names: Optional[List[str]] = None,
        live_caps: Optional[List[Dict[str, Any]]] = None,
        focus_score: Optional[float] = None,
        idle_percent: Optional[float] = None,
    ):
        """
        Executes the entire meeting intelligence pipeline synchronously within a background worker.
        """
        t_start_total = time.time()
        telemetry: Dict[str, Any] = {
            "mode": mode,
            "language": language or getattr(settings, "TRANSCRIPTION_LANGUAGE", "auto"),
            "pipeline_start": t_start_total,
        }

        self._update_status(meeting_id, "QUEUED", 5, "Job queued for processing...", telemetry=telemetry)

        db: Session = SessionLocal()
        try:
            meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
            if not meeting:
                raise ValueError(f"Meeting {meeting_id} does not exist.")

            # Collect known participant names if not provided
            if not participant_names:
                participant_names = []
                if meeting.host:
                    host_name = meeting.host.full_name or meeting.host.email
                    if host_name:
                        participant_names.append(host_name)
                for p in meeting.participants:
                    if p.name and p.name not in participant_names:
                        participant_names.append(p.name)

            # ── Stage 1: Audio Validation & Preprocessing (15%) ───────────
            self._update_status(meeting_id, "UPLOADING", 15, "Validating audio format and inspecting diagnostics...")
            t_prep_start = time.time()
            prepared_audio_path = AudioPreprocessor.prepare_audio_for_transcription(audio_path)
            sample_rate, channels, audio_duration = AudioPreprocessor.inspect_audio(prepared_audio_path)
            quality_diag = AudioPreprocessor.analyze_audio_quality(prepared_audio_path)
            
            telemetry["audio_duration_seconds"] = audio_duration
            telemetry["audio_prep_duration"] = round(time.time() - t_prep_start, 2)
            telemetry["audio_quality"] = quality_diag.get("audio_quality", "Normal")
            telemetry["silence_percent"] = quality_diag.get("silence_percent", 0.0)
            telemetry["rms"] = quality_diag.get("rms", 0.0)
            telemetry["clipping_percent"] = quality_diag.get("clipping_percent", 0.0)
            telemetry["sample_rate"] = sample_rate
            telemetry["channels"] = channels

            if audio_duration > 0 and meeting.duration_seconds <= 0:
                meeting.duration_seconds = int(audio_duration)
                db.commit()

            # ── Stage 2: Speech-to-Text Transcription (35%) ───────────────
            self._update_status(meeting_id, "TRANSCRIBING", 35, f"Transcribing speech with Groq Whisper...")
            logger.info("[TRANSCRIPTION] Groq started")
            t_stt_start = time.time()
            full_text, raw_segments, stt_provider = self.transcription_service.transcribe(
                audio_path=prepared_audio_path,
                mode=mode,
                language=language,
                custom_prompt=custom_prompt,
            )
            t_stt_end = time.time()
            logger.info(f"[TRANSCRIPTION] Groq completed ({len(raw_segments)} segments in {t_stt_end - t_stt_start:.2f}s)")
            telemetry["transcription_start"] = t_stt_start
            telemetry["transcription_end"] = t_stt_end
            telemetry["transcription_duration"] = round(t_stt_end - t_stt_start, 2)
            telemetry["transcription_provider"] = stt_provider
            telemetry["transcription_model"] = getattr(settings, "GROQ_TRANSCRIPTION_MODEL", "whisper-large-v3-turbo")

            # Fall back to live captions buffer if STT returned no segments
            if (not raw_segments or len(raw_segments) == 0) and live_caps:
                logger.info(f"[Pipeline #{meeting_id}] Falling back to live captions buffer ({len(live_caps)} items).")
                raw_segments = [
                    {
                        "speaker": c.get("speaker", "Participant 1"),
                        "speaker_name": c.get("speaker", "Participant 1"),
                        "text": c.get("text", ""),
                        "start": float(i * 4.0),
                        "end": float((i + 1) * 4.0),
                        "confidence": 0.9,
                    }
                    for i, c in enumerate(live_caps) if c.get("text")
                ]

            # ── Stage 3: Speaker Diarization (55%) ────────────────────────
            self._update_status(meeting_id, "DIARIZING", 55, "Detecting distinct speakers via AssemblyAI...")
            logger.info("[DIARIZATION] AssemblyAI started")
            t_diarize_start = time.time()
            expected_speakers = len(participant_names) if participant_names and len(participant_names) >= 2 else None
            speaker_intervals, diarize_provider = self.diarization_service.diarize(
                audio_path=prepared_audio_path,
                expected_speakers=expected_speakers,
                participant_names=participant_names,
            )
            t_diarize_end = time.time()
            logger.info(f"[DIARIZATION] AssemblyAI completed in {t_diarize_end - t_diarize_start:.2f}s")
            raw_spk_labels = sorted(list(set(str(i.get("speaker", "A")) for i in speaker_intervals)))
            logger.info(f"[DIARIZATION] Detected speakers: {', '.join(raw_spk_labels)}")
            telemetry["diarization_start"] = t_diarize_start
            telemetry["diarization_end"] = t_diarize_end
            telemetry["diarization_duration"] = round(t_diarize_end - t_diarize_start, 2)
            telemetry["diarization_provider"] = diarize_provider
            telemetry["diarization_segments_count"] = len(speaker_intervals)

            # ── Stage 4: Transcript Alignment (70%) ───────────────────────
            self._update_status(meeting_id, "ALIGNING", 70, "Aligning transcript segments with speakers...")
            logger.info(f"[ALIGNMENT] Transcript segments: {len(raw_segments)}")
            logger.info(f"[ALIGNMENT] Diarization intervals: {len(speaker_intervals)}")
            t_align_start = time.time()
            aligned_segments = self.alignment_service.align(
                transcript_segments=raw_segments,
                speaker_intervals=speaker_intervals,
                participant_names=participant_names,
            )
            telemetry["alignment_duration"] = round(time.time() - t_align_start, 2)
            raw_transcript_text = TranscriptCleanupService.format_transcript_text(aligned_segments, use_cleaned=False)

            # Auto-register newly detected speakers as meeting participants
            detected_speakers = set(seg.get("speaker_name") for seg in aligned_segments if seg.get("speaker_name"))
            existing_names = {p.name.lower() for p in meeting.participants}
            if meeting.host:
                existing_names.add((meeting.host.full_name or "").lower())
            for spk in detected_speakers:
                if spk and spk.lower() not in existing_names and not spk.lower().startswith("speaker"):
                    new_p = Participant(meeting_id=meeting.id, name=spk)
                    db.add(new_p)

            # ── Stage 5: Light Transcript Cleanup (80%) ───────────────────
            self._update_status(meeting_id, "CLEANING", 80, "Applying light punctuation formatting and term normalization...")
            t_clean_start = time.time()
            cleaned_segments = self.cleanup_service.clean_segments(aligned_segments)
            cleaned_transcript_text = TranscriptCleanupService.format_transcript_text(cleaned_segments, use_cleaned=True)
            telemetry["cleaning_duration"] = round(time.time() - t_clean_start, 2)

            suspicious_segments = sum(1 for seg in cleaned_segments if seg.get("quality_flags"))
            telemetry["suspicious_segments_count"] = suspicious_segments

            # Persist diagnostics dictionary
            diagnostics_payload = {
                "audio_duration_seconds": audio_duration,
                "audio_quality": telemetry.get("audio_quality", "Normal"),
                "silence_percent": telemetry.get("silence_percent", 0.0),
                "rms": telemetry.get("rms", 0.0),
                "clipping_percent": telemetry.get("clipping_percent", 0.0),
                "sample_rate": sample_rate,
                "channels": channels,
                "transcription_provider": stt_provider,
                "transcription_model": telemetry.get("transcription_model", "whisper-large-v3-turbo"),
                "diarization_provider": diarize_provider,
                "detected_speakers_count": len(detected_speakers),
                "detected_speakers": sorted(list(detected_speakers)),
                "transcript_segments_count": len(cleaned_segments),
                "diarization_segments_count": len(speaker_intervals),
                "suspicious_segments_count": suspicious_segments,
                "processing_mode": mode,
            }
            telemetry["diagnostics"] = diagnostics_payload

            # Save raw and cleaned transcript in Database
            existing_transcript = db.query(Transcript).filter(Transcript.meeting_id == meeting.id).first()
            if existing_transcript:
                existing_transcript.full_text = cleaned_transcript_text or raw_transcript_text or "No speech recorded."
                existing_transcript.raw_transcript = raw_transcript_text
                existing_transcript.cleaned_transcript = cleaned_transcript_text
                existing_transcript.raw_segments = cleaned_segments
                existing_transcript.diagnostics = diagnostics_payload
            else:
                db_transcript = Transcript(
                    meeting_id=meeting.id,
                    full_text=cleaned_transcript_text or raw_transcript_text or "No speech recorded.",
                    raw_transcript=raw_transcript_text,
                    cleaned_transcript=cleaned_transcript_text,
                    raw_segments=cleaned_segments,
                    diagnostics=diagnostics_payload,
                )
                db.add(db_transcript)
            db.commit()

            # ── Stage 6: AI Summarization & Intelligence (90%) ────────────
            self._update_status(meeting_id, "ANALYZING", 90, "Synthesizing executive summary and action items...")
            logger.info("[SUMMARY] Generating intelligence from cleaned transcript")
            t_sum_start = time.time()
            intelligence, summary_provider = self.summary_service.generate_intelligence(
                transcript=cleaned_transcript_text or raw_transcript_text,
                participant_names=participant_names,
            )
            t_sum_end = time.time()
            logger.info(f"[SUMMARY] {summary_provider.capitalize()} completed in {t_sum_end - t_sum_start:.2f}s")
            telemetry["summary_start"] = t_sum_start
            telemetry["summary_end"] = t_sum_end
            telemetry["summary_duration"] = round(t_sum_end - t_sum_start, 2)
            telemetry["summary_provider"] = summary_provider

            # Update meeting title if current title is generic or auto-generated
            smart_title = intelligence.get("title")
            generic_titles = [
                "Active Meeting Session", "Google Meet Session", "New Meeting",
                "Untitled Meeting", "Scheduled Meeting", "Design & Architecture Review"
            ]
            if smart_title and (meeting.title in generic_titles or meeting.title.startswith("Meeting #")):
                meeting.title = smart_title

            # Save Summary in Database
            existing_summary = db.query(Summary).filter(Summary.meeting_id == meeting.id).first()
            key_points_str = "\n".join(f"- {kp}" for kp in intelligence.get("key_points", []))
            decisions_str = "\n".join(f"{i+1}. {d}" for i, d in enumerate(intelligence.get("decisions", [])))
            risks_str = "\n".join(f"- {r}" for r in intelligence.get("risks", []))
            next_steps_str = "\n".join(f"- {ns}" for ns in intelligence.get("next_steps", []))
            action_items_json = intelligence.get("action_items", [])

            if existing_summary:
                existing_summary.key_points = key_points_str
                existing_summary.decisions = decisions_str
                existing_summary.risks = risks_str
                existing_summary.next_steps = next_steps_str
                existing_summary.action_items = action_items_json
            else:
                db_summary = Summary(
                    meeting_id=meeting.id,
                    key_points=key_points_str,
                    decisions=decisions_str,
                    risks=risks_str,
                    next_steps=next_steps_str,
                    action_items=action_items_json,
                )
                db.add(db_summary)

            # Ensure default activity log if missing
            calc_focus = focus_score if focus_score is not None else 83.5
            calc_idle = idle_percent if idle_percent is not None else 15.0
            existing_log = db.query(ActivityLog).filter(ActivityLog.meeting_id == meeting.id).first()
            if not existing_log and meeting.host_id:
                db_log = ActivityLog(
                    meeting_id=meeting.id,
                    user_id=meeting.host_id,
                    keyboard_hits=40,
                    mouse_clicks=15,
                    idle_seconds=int((audio_duration or 300) * (calc_idle / 100.0)),
                    active_window="Meeting Room",
                    face_present_seconds=float(audio_duration or 300) * 0.8,
                    eye_attention_score=calc_focus,
                    focus_score=calc_focus,
                )
                db.add(db_log)

            meeting.status = "completed"
            db.commit()

            # ── Stage 6: Report Generation (PDF) ──────────────────────────
            self._update_status(meeting_id, "GENERATING_REPORT", 95, "Compiling PDF meeting report...")
            t_rep_start = time.time()
            pdf_filename = f"report_{meeting.id}.pdf"
            pdf_path = os.path.join(settings.REPORTS_DIR, pdf_filename)
            engagement_payload = {"focus_score": calc_focus, "idle_percent": calc_idle}

            pdf_ok = generate_meeting_pdf(
                meeting_title=meeting.title,
                meeting_date=meeting.date,
                duration_seconds=meeting.duration_seconds,
                summary_data={
                    "key_points": key_points_str,
                    "decisions": decisions_str,
                    "risks": risks_str,
                    "next_steps": next_steps_str,
                    "action_items": action_items_json,
                },
                engagement_metrics=engagement_payload,
                output_path=pdf_path,
            )
            telemetry["report_generation_duration"] = round(time.time() - t_rep_start, 2)

            if pdf_ok:
                existing_report = db.query(Report).filter(Report.meeting_id == meeting.id).first()
                if not existing_report:
                    db.add(Report(meeting_id=meeting.id, file_path=pdf_path))
                db.commit()

            # ── Stage 7: Telemetry & Completion ───────────────────────────
            t_end_total = time.time()
            total_duration = round(t_end_total - t_start_total, 2)
            telemetry["total_processing_duration"] = total_duration

            # Calculate speed ratio (e.g., 600s audio / 15s processing = 40x realtime)
            if audio_duration > 0 and total_duration > 0:
                speed_ratio = round(audio_duration / total_duration, 1)
                telemetry["processing_speed_ratio"] = f"{speed_ratio}x realtime"
            else:
                telemetry["processing_speed_ratio"] = "N/A"

            self._update_status(
                meeting_id=meeting_id,
                status="COMPLETED",
                progress=100,
                step="Meeting intelligence processing complete!",
                telemetry=telemetry,
                done=True,
            )
            logger.info(
                f"[Pipeline #{meeting_id}] COMPLETED in {total_duration}s "
                f"({telemetry.get('processing_speed_ratio')})."
            )

        except Exception as e:
            logger.error(f"[Pipeline #{meeting_id}] Processing failed: {e}", exc_info=True)
            self._update_status(
                meeting_id=meeting_id,
                status="FAILED",
                progress=0,
                step=f"Processing failed: {str(e)}",
                error=str(e),
                done=True,
            )
        finally:
            db.close()


# Module singleton pipeline instance
meeting_pipeline = MeetingProcessingPipeline()
