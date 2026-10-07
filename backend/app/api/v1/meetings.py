import json
import logging
import os
import time
from datetime import datetime
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from app.api import deps
from app.core.config import settings
from app.database.session import get_db, SessionLocal
from app.models.user import User
from app.models.meeting import Meeting, Participant
from app.models.transcription import Transcript
from app.models.summary import Summary
from app.models.activity import ActivityLog
from app.models.report import Report
from app.schemas.meeting import MeetingCreate, MeetingResponse
from app.recording.audio_recorder import LocalAudioRecorder
from app.transcription.whisper_runner import transcriber
from app.ai.ai_client import ai_client
from app.reports.pdf_generator import generate_meeting_pdf
from app.monitoring.input_monitor import activity_tracker
from app.monitoring.vision_monitor import vision_monitor
from app.websocket.connection_manager import manager
from app.ai.services.meeting_pipeline import meeting_pipeline, pipeline_status_registry
from app.ai.services.audio_preprocessor import AudioPreprocessor

logger = logging.getLogger(__name__)
router = APIRouter()

# Local recorders maps to track which active meetings are recording
active_recordings: dict[int, LocalAudioRecorder] = {}
meeting_start_times: dict[int, datetime] = {}
# Active live captions in-memory buffer per meeting ID
active_live_transcripts: dict[int, list[dict]] = {}
# Processing status tracker: meeting_id -> {"status": str, "step": str, "done": bool}
processing_status: dict[int, dict] = {}


@router.post("/", response_model=MeetingResponse)
def create_meeting(
    *,
    db: Session = Depends(get_db),
    meeting_in: MeetingCreate,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Create a new meeting entry."""
    meeting = Meeting(
        title=meeting_in.title,
        host_id=current_user.id,
        status="scheduled"
    )
    db.add(meeting)
    db.commit()
    db.refresh(meeting)

    # Insert participants
    for part in meeting_in.participants:
        db_part = Participant(
            meeting_id=meeting.id,
            name=part.name,
            email=part.email,
            join_time=datetime.utcnow()
        )
        db.add(db_part)
    
    db.commit()
    db.refresh(meeting)
    return meeting


@router.get("/", response_model=List[MeetingResponse])
def read_meetings(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Retrieve meetings list for current authenticated user."""
    meetings = (
        db.query(Meeting)
        .filter(Meeting.host_id == current_user.id)
        .order_by(Meeting.date.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return meetings


@router.get("/{id}", response_model=MeetingResponse)
def read_meeting(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Fetch detail specifications of a specific meeting."""
    meeting = db.query(Meeting).filter(Meeting.id == id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    if meeting.host_id != current_user.id:
        # Check if participant
        participant = db.query(Participant).filter(
            Participant.meeting_id == id, Participant.email == current_user.email
        ).first()
        if not participant:
            raise HTTPException(status_code=403, detail="You do not have permission to access this meeting.")
            
    return meeting


@router.post("/{id}/join", response_model=MeetingResponse)
def join_meeting(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Join an active/scheduled meeting as a participant."""
    meeting = db.query(Meeting).filter(Meeting.id == id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    # Check if user is already the host or a participant
    is_host = meeting.host_id == current_user.id
    existing_participant = (
        db.query(Participant)
        .filter(Participant.meeting_id == id, Participant.email == current_user.email)
        .first()
    )
    
    if not is_host and not existing_participant:
        # Create a new participant entry for the current user
        new_participant = Participant(
            meeting_id=meeting.id,
            email=current_user.email,
            name=current_user.full_name or current_user.email.split("@")[0],
            join_time=datetime.utcnow()
        )
        db.add(new_participant)
        db.commit()
        db.refresh(meeting)
        
    return meeting



@router.post("/{id}/start")
def start_meeting(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Start tracking meeting (local mic, webcam eye gaze, desktop input telemetry)."""
    meeting = db.query(Meeting).filter(Meeting.id == id, Meeting.host_id == current_user.id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    if meeting.status == "ongoing":
        return {"message": "Meeting is already running."}

    # Start audio recorder
    wav_filename = f"meeting_{meeting.id}.wav"
    wav_path = os.path.join(settings.UPLOAD_DIR, wav_filename)
    
    recorder = LocalAudioRecorder()
    recorder.start(wav_path)
    active_recordings[meeting.id] = recorder
    meeting_start_times[meeting.id] = datetime.utcnow()

    # Start user tracking
    activity_tracker.start_tracking()
    vision_monitor.start()

    # Update DB state
    meeting.status = "ongoing"
    meeting.date = datetime.utcnow()
    db.add(meeting)
    db.commit()

    return {"message": "Meeting initialized. Local telemetry active."}


@router.websocket("/{id}/ws")
async def meeting_live_ws(
    websocket: WebSocket,
    id: int,
    token: Optional[str] = None
):
    """
    WebSocket endpoint for real-time multi-user live captions and participant coordination.
    Authentication via ?token=<jwt> query parameter.
    Messages broadcast include: caption, participant_joined, participant_left, participants_list, ping/pong.
    """
    from app.core.security import decode_access_token
    from app.database.session import SessionLocal

    # Authenticate the connecting user via token query param
    user_id: int = 0
    user_name: str = "Guest"
    user_color: str = "#8ab4f8"

    if token:
        try:
            payload = decode_access_token(token)
            if payload:
                uid = payload.get("sub")
                if uid:
                    db_temp = SessionLocal()
                    try:
                        from app.models.user import User as UserModel
                        db_user = db_temp.query(UserModel).filter(UserModel.id == int(uid)).first()
                        if db_user and db_user.is_active:
                            user_id = db_user.id
                            user_name = db_user.full_name or db_user.email.split("@")[0]
                    finally:
                        db_temp.close()
        except Exception as e:
            logger.warning(f"WS auth token parse error: {e}")

    # If unauthenticated, still allow guest access with anonymous identity
    if user_id == 0:
        import random
        user_id = -random.randint(1000, 9999)
        user_name = f"Guest-{abs(user_id) % 1000}"

    # Connect and get assigned color
    participant = await manager.connect(websocket, id, user_id, user_name)
    user_color = participant.color

    try:
        # 1. Send current participants list to newly connected user
        participants_snapshot = manager.get_participants(id)
        await websocket.send_text(json.dumps({
            "type": "participants_list",
            "participants": participants_snapshot,
            "your_color": user_color,
            "your_user_id": user_id,
        }))

        # 2. Send live caption history to newly connected participant
        history = active_live_transcripts.get(id, [])
        if history:
            await websocket.send_text(json.dumps({
                "type": "history",
                "captions": history
            }))

        # 3. Broadcast join event to everyone else
        await manager.broadcast_to_meeting(id, {
            "type": "participant_joined",
            "user_id": user_id,
            "name": user_name,
            "color": user_color,
            "participant_count": manager.get_participant_count(id),
            "participants": manager.get_participants(id),
        }, exclude_ws=websocket)

        while True:
            data_text = await websocket.receive_text()
            try:
                msg = json.loads(data_text)
                msg_type = msg.get("type")

                if msg_type == "caption":
                    # Enrich caption with authenticated speaker info and assigned color
                    caption_payload = {
                        "type": "caption",
                        "speaker": user_name,
                        "user_id": user_id,
                        "color": user_color,
                        "text": msg.get("text", "").strip(),
                        "is_final": bool(msg.get("is_final", False)),
                        "timestamp": msg.get("timestamp", datetime.utcnow().strftime("%H:%M:%S")),
                    }
                    # Save final captions to meeting live buffer with AI punctuation & cleanup
                    if caption_payload["is_final"] and caption_payload["text"]:
                        try:
                            caption_payload["text"] = ai_client.clean_live_caption(caption_payload["text"])
                        except Exception as e:
                            logger.debug(f"Live caption polish notice: {e}")

                        if id not in active_live_transcripts:
                            active_live_transcripts[id] = []
                        active_live_transcripts[id].append(caption_payload)

                    # Broadcast to all connected participants in this meeting room
                    await manager.broadcast_to_meeting(id, caption_payload)

                elif msg_type == "hand_raise":
                    # Broadcast hand-raise state to all participants
                    await manager.broadcast_to_meeting(id, {
                        "type": "hand_raise",
                        "user_id": user_id,
                        "name": user_name,
                        "raised": bool(msg.get("raised", False)),
                    })

                elif msg_type == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))

                elif msg_type == "get_participants":
                    await websocket.send_text(json.dumps({
                        "type": "participants_list",
                        "participants": manager.get_participants(id),
                        "participant_count": manager.get_participant_count(id),
                    }))

            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        removed = manager.disconnect(websocket, id)
        if removed:
            # Broadcast leave event to remaining participants
            await manager.broadcast_to_meeting(id, {
                "type": "participant_left",
                "user_id": removed.user_id,
                "name": removed.name,
                "participant_count": manager.get_participant_count(id),
                "participants": manager.get_participants(id),
            })
    except Exception as e:
        logger.error(f"WebSocket error in meeting {id}: {e}")
        removed = manager.disconnect(websocket, id)
        if removed:
            await manager.broadcast_to_meeting(id, {
                "type": "participant_left",
                "user_id": removed.user_id,
                "name": removed.name,
                "participant_count": manager.get_participant_count(id),
                "participants": manager.get_participants(id),
            })


@router.get("/{id}/live-participants")
def get_live_participants(
    id: int,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Return the current list of live WebSocket-connected participants for a meeting."""
    return {
        "meeting_id": id,
        "participant_count": manager.get_participant_count(id),
        "participants": manager.get_participants(id),
    }


@router.get("/{id}/live-captions")
def get_live_captions(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Retrieve in-memory live caption segments collected during ongoing session."""
    return active_live_transcripts.get(id, [])


@router.post("/{id}/catchup")
def get_meeting_catchup(
    id: int,
    payload: dict = None,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Real-time catch-up summary of in-progress meeting using live captions."""
    live_caps = active_live_transcripts.get(id, [])
    transcript_lines = [f"{c.get('speaker', 'Speaker')}: {c.get('text', '')}" for c in live_caps if c.get("text")]
    query = (payload or {}).get("query")
    catchup_data = ai_client.generate_live_catchup(transcript_lines, question=query)
    return catchup_data


def _process_meeting_background(
    meeting_id: int,
    wav_path: str,
    participant_names: list,
    live_caps: list,
    telemetry_payload: dict,
    focus_score: float,
    idle_percent: float,
):
    """
    Background task: delegates post-meeting STT, AssemblyAI speaker diarization,
    summarization, and PDF generation to the unified MeetingProcessingPipeline.
    """
    processing_status[meeting_id] = {"status": "processing", "step": "Transcribing audio…", "done": False}
    try:
        meeting_pipeline.execute_pipeline(
            meeting_id=meeting_id,
            audio_path=wav_path,
            mode="fast",
            participant_names=participant_names,
            live_caps=live_caps,
            focus_score=focus_score,
            idle_percent=idle_percent,
        )
        p_status = meeting_pipeline.get_status(meeting_id)
        processing_status[meeting_id] = {
            "status": "done" if p_status.get("done") else "processing",
            "step": p_status.get("step", "Complete"),
            "done": p_status.get("done", True),
            "telemetry": p_status.get("telemetry", {}),
        }
        logger.info(f"Background processing for meeting {meeting_id} complete.")
    except Exception as e:
        logger.error(f"Background meeting processing error for meeting {meeting_id}: {e}", exc_info=True)
        processing_status[meeting_id] = {"status": "error", "step": f"Error: {str(e)[:120]}", "done": True}


@router.post("/{id}/end", response_model=MeetingResponse)
def end_meeting(
    id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Stop recording/monitoring devices and kick off async post-processing (STT, summary, PDF)."""
    meeting = db.query(Meeting).filter(Meeting.id == id, Meeting.host_id == current_user.id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    if meeting.status != "ongoing":
        raise HTTPException(status_code=400, detail="Meeting is not currently active.")

    # 1. Stop local capture devices immediately
    recorder = active_recordings.pop(meeting.id, None)
    if recorder:
        recorder.stop()

    input_data = activity_tracker.stop_tracking()
    face_seconds, avg_gaze = vision_monitor.stop()

    start_time = meeting_start_times.pop(meeting.id, meeting.date)
    duration = int((datetime.utcnow() - start_time).total_seconds())
    meeting.duration_seconds = max(1, duration)
    meeting.status = "completed"

    # 2. Calculate focus score and persist telemetry immediately
    idle_percent = round((input_data["idle_seconds"] / meeting.duration_seconds) * 100.0, 2)
    idle_percent = min(100.0, max(0.0, idle_percent))
    active_percent = 100.0 - idle_percent
    base_focus = (avg_gaze * 0.7) + (active_percent * 0.3)
    focus_score = round(min(100.0, max(0.0, base_focus)), 2)

    db.add(ActivityLog(
        meeting_id=meeting.id,
        user_id=current_user.id,
        keyboard_hits=input_data["keyboard_hits"],
        mouse_clicks=input_data["mouse_clicks"],
        idle_seconds=input_data["idle_seconds"],
        active_window=input_data["dominant_window"],
        face_present_seconds=face_seconds,
        eye_attention_score=avg_gaze,
        focus_score=focus_score
    ))
    db.commit()
    db.refresh(meeting)

    # 3. Collect live captions buffer and clear from memory
    live_caps = active_live_transcripts.pop(meeting.id, [])

    # 4. Prepare audio path
    wav_filename = f"meeting_{meeting.id}.wav"
    wav_path = os.path.join(settings.UPLOAD_DIR, wav_filename)

    # 5. Fetch participant names for speaker diarization
    participant_names = []
    if meeting.host:
        participant_names.append(meeting.host.full_name or meeting.host.email)
    for p in meeting.participants:
        if p.name:
            participant_names.append(p.name)

    # 6. Dispatch heavy post-processing to background (returns immediately)
    processing_status[meeting.id] = {"status": "processing", "step": "Initializing…", "done": False}
    background_tasks.add_task(
        _process_meeting_background,
        meeting_id=meeting.id,
        wav_path=wav_path,
        participant_names=participant_names,
        live_caps=live_caps,
        telemetry_payload=input_data,
        focus_score=focus_score,
        idle_percent=idle_percent,
    )

    return meeting


@router.get("/{id}/processing-status")
def get_processing_status(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Poll the background processing status for an uploaded or ended meeting.
    Returns granular lifecycle state: QUEUED, UPLOADING, TRANSCRIBING,
    DIARIZING, ALIGNING, ANALYZING, GENERATING_REPORT, COMPLETED, FAILED.
    """
    # Check master pipeline registry
    status = meeting_pipeline.get_status(id)
    if status.get("status") == "COMPLETED" or status.get("done") is True:
        return status

    # Check local end_meeting status map for backwards compatibility
    legacy_status = processing_status.get(id)
    if legacy_status:
        return legacy_status

    # Check database state if server restarted mid-task
    meeting = db.query(Meeting).filter(Meeting.id == id).first()
    if meeting:
        if meeting.status == "completed":
            return {
                "meeting_id": id,
                "status": "COMPLETED",
                "progress": 100,
                "step": "Meeting intelligence processing complete!",
                "done": True,
                "error": None,
                "telemetry": {},
            }
        elif meeting.status == "failed":
            return {
                "meeting_id": id,
                "status": "FAILED",
                "progress": 0,
                "step": "Processing failed.",
                "done": True,
                "error": "Meeting processing failed.",
                "telemetry": {},
            }

    return status


@router.get("/{id}/debug/diarization")
def debug_meeting_diarization(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Debug endpoint to inspect real AssemblyAI speaker diarization output,
    transcript segment alignment, speaker counts, and raw audio metrics.
    """
    meeting = db.query(Meeting).filter(Meeting.id == id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    candidate_exts = [".wav", ".mp3", ".m4a", ".ogg", ".webm", ".flac"]
    audio_path = None
    for ext in candidate_exts:
        p = os.path.join(settings.UPLOAD_DIR, f"meeting_{id}{ext}")
        if os.path.exists(p):
            audio_path = p
            break

    transcript = db.query(Transcript).filter(Transcript.meeting_id == id).first()
    segments = transcript.raw_segments if transcript and transcript.raw_segments else []

    detected_speakers_map = {}
    for seg in segments:
        spk_id = seg.get("speaker_id") or "A"
        spk_name = seg.get("speaker_name") or seg.get("speaker") or "Participant 1"
        if spk_id not in detected_speakers_map:
            detected_speakers_map[spk_id] = {
                "speaker_id": spk_id,
                "speaker_name": spk_name,
            }
    detected_speakers = list(detected_speakers_map.values())

    unique_speakers = list(dict.fromkeys(
        seg.get("speaker_name") or seg.get("speaker") or "Unknown"
        for seg in segments
    ))

    pipeline_status = meeting_pipeline.get_status(id)

    from app.ai.providers.assemblyai_provider import AssemblyAIProvider
    from app.ai.providers.groq_provider import GroqProvider

    aai = AssemblyAIProvider()
    groq = GroqProvider()

    audio_exists = audio_path is not None and os.path.exists(audio_path)
    audio_size = os.path.getsize(audio_path) if audio_exists else 0

    return {
        "detected_speakers": detected_speakers,
        "segments": segments,
        "meeting_id": id,
        "meeting_title": meeting.title,
        "meeting_status": meeting.status,
        "duration_seconds": meeting.duration_seconds,
        "audio": {
            "found": audio_exists,
            "path": audio_path,
            "size_bytes": audio_size,
        },
        "providers": {
            "assemblyai_available": aai.is_available(),
            "assemblyai_key_configured": bool(getattr(settings, "ASSEMBLYAI_API_KEY", None)),
            "groq_available": groq.is_available(),
            "groq_key_configured": bool(getattr(settings, "GROQ_API_KEY", None)),
        },
        "diarization": {
            "total_segments": len(segments),
            "unique_speakers": unique_speakers,
            "speaker_count": len(unique_speakers),
            "sample_segments": segments[:10],
        },
        "full_transcript_preview": transcript.full_text[:500] if transcript and transcript.full_text else None,
        "pipeline_status": pipeline_status,
    }


@router.post("/{id}/process")
def trigger_meeting_processing(
    id: int,
    background_tasks: BackgroundTasks,
    mode: str = "fast",
    language: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Phase 12: Dedicated non-blocking endpoint to trigger or re-run processing on a meeting recording.
    Returns immediately with {"meeting_id": id, "status": "queued"}.
    """
    meeting = db.query(Meeting).filter(Meeting.id == id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    # Locate meeting audio file
    candidate_exts = [".wav", ".mp3", ".m4a", ".ogg", ".webm", ".flac"]
    audio_path = None
    for ext in candidate_exts:
        p = os.path.join(settings.UPLOAD_DIR, f"meeting_{id}{ext}")
        if os.path.exists(p):
            audio_path = p
            break

    if not audio_path:
        raise HTTPException(status_code=400, detail="No recorded audio file found for this meeting.")

    meeting.status = "processing"
    db.commit()

    participant_names = []
    if meeting.host:
        participant_names.append(meeting.host.full_name or meeting.host.email)
    for p in meeting.participants:
        if p.name:
            participant_names.append(p.name)

    background_tasks.add_task(
        meeting_pipeline.execute_pipeline,
        meeting_id=meeting.id,
        audio_path=audio_path,
        mode=mode,
        language=language,
        participant_names=participant_names,
    )

    return {"meeting_id": meeting.id, "status": "queued"}


@router.post("/{id}/upload-recording", response_model=MeetingResponse)
@router.post("/{id}/upload-audio", response_model=MeetingResponse)
async def upload_meeting_recording(
    id: int,
    background_tasks: BackgroundTasks,
    file: Optional[UploadFile] = File(None),
    audio: Optional[UploadFile] = File(None),
    mode: str = "fast",
    language: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Upload pre-recorded WAV or MP3 file directly.
    Non-blocking: saves the audio file and dispatches processing to the background.
    Returns immediately with meeting metadata while cloud AI processes in background.
    """
    meeting = db.query(Meeting).filter(Meeting.id == id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    if meeting.host_id != current_user.id and not current_user.is_superuser:
        is_participant = db.query(Participant).filter(
            Participant.meeting_id == id, Participant.email == current_user.email
        ).first()
        if not is_participant:
            raise HTTPException(status_code=403, detail="You do not have permission to modify this meeting.")

    target_file = file or audio
    if not target_file:
        raise HTTPException(status_code=400, detail="Audio file is required. Please upload an audio file.")

    # Save uploaded audio file to disk
    orig_ext = os.path.splitext(target_file.filename or "")[1].lower()
    if orig_ext not in [".wav", ".mp3", ".m4a", ".ogg", ".webm", ".flac"]:
        orig_ext = ".wav"
    wav_filename = f"meeting_{meeting.id}{orig_ext}"
    wav_path = os.path.join(settings.UPLOAD_DIR, wav_filename)

    try:
        with open(wav_path, "wb") as buffer:
            content = await target_file.read()
            buffer.write(content)
    except Exception as e:
        logger.error(f"Failed saving uploaded file: {e}")
        raise HTTPException(status_code=500, detail="Failed to save uploaded file.")

    # Calculate initial duration estimate
    _, _, initial_duration = AudioPreprocessor.inspect_audio(wav_path)
    meeting.duration_seconds = int(initial_duration) if initial_duration > 0 else 300
    meeting.status = "processing"

    participant_names = []
    if meeting.host:
        participant_names.append(meeting.host.full_name or meeting.host.email)
    for p in meeting.participants:
        if p.name:
            participant_names.append(p.name)

    db.commit()
    db.refresh(meeting)

    # Initialize queue status
    pipeline_status_registry[meeting.id] = {
        "meeting_id": meeting.id,
        "status": "QUEUED",
        "progress": 10,
        "step": "Audio uploaded successfully. Queued for AI processing...",
        "error": None,
        "telemetry": {"audio_duration_seconds": initial_duration},
        "done": False,
        "updated_at": time.time(),
    }

    # Dispatch to background task worker
    background_tasks.add_task(
        meeting_pipeline.execute_pipeline,
        meeting_id=meeting.id,
        audio_path=wav_path,
        mode=mode,
        language=language,
        participant_names=participant_names,
    )

    return meeting


@router.post("/{id}/submit-transcript", response_model=MeetingResponse)
@router.post("/{id}/transcript", response_model=MeetingResponse)
def submit_meeting_transcript(
    id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """Submit raw text transcript directly. Skips STT, runs AI Summarizer, and exports PDF."""
    meeting = db.query(Meeting).filter(Meeting.id == id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    if meeting.host_id != current_user.id and not current_user.is_superuser:
        is_participant = db.query(Participant).filter(
            Participant.meeting_id == id, Participant.email == current_user.email
        ).first()
        if not is_participant:
            raise HTTPException(status_code=403, detail="You do not have permission to modify this meeting.")

    full_text = (payload.get("transcript") or payload.get("transcript_text") or "").strip()
    if not full_text:
        raise HTTPException(status_code=400, detail="Transcript text cannot be empty.")

    # Populate dummy duration & telemetry for direct text uploads
    meeting.duration_seconds = 300  # Default to 5 minutes
    meeting.status = "completed"
    
    # Store default mock telemetry
    db_log = ActivityLog(
        meeting_id=meeting.id,
        user_id=current_user.id,
        keyboard_hits=0,
        mouse_clicks=0,
        idle_seconds=0,
        active_window="Direct Transcript Import",
        face_present_seconds=0,
        eye_attention_score=0,
        focus_score=100.0
    )
    db.add(db_log)

    # Auto-detect speakers from raw transcript text and add them as participants
    import re
    speaker_pattern = re.compile(r'(?:\[\d{2}:\d{2}:\d{2}\]\s+)?([a-zA-Z0-9\s_]+):')
    detected_speakers = set()
    for line in full_text.split('\n'):
        match = speaker_pattern.match(line.strip())
        if match:
            sp_name = match.group(1).strip()
            if sp_name and len(sp_name) < 50:
                detected_speakers.add(sp_name)

    existing_participant_names = {p.name.lower() for p in meeting.participants}
    if meeting.host:
        existing_participant_names.add((meeting.host.full_name or "").lower())
        existing_participant_names.add(meeting.host.email.lower())
    for speaker in detected_speakers:
        if speaker.lower() not in existing_participant_names and speaker.lower() not in ["unknown", "time"]:
            new_participant = Participant(
                meeting_id=meeting.id,
                name=speaker,
                email=None
            )
            db.add(new_participant)

    db_transcript = Transcript(
        meeting_id=meeting.id,
        full_text=full_text,
        raw_segments=[]
    )
    db.add(db_transcript)

    # Groq (T5) summary
    summary_data = ai_client.generate_summary(full_text)
    db_summary = Summary(
        meeting_id=meeting.id,
        key_points=summary_data.get("key_points"),
        decisions=summary_data.get("decisions"),
        risks=summary_data.get("risks"),
        next_steps=summary_data.get("next_steps"),
        action_items=summary_data.get("action_items", [])
    )
    db.add(db_summary)
    
    # Report compilation
    pdf_filename = f"report_{meeting.id}.pdf"
    pdf_path = os.path.join(settings.REPORTS_DIR, pdf_filename)
    engagement_payload = {
        "focus_score": 100.0,
        "idle_percent": 0.0
    }
    
    generate_meeting_pdf(
        meeting_title=meeting.title,
        meeting_date=meeting.date,
        duration_seconds=meeting.duration_seconds,
        summary_data=summary_data,
        engagement_metrics=engagement_payload,
        output_path=pdf_path
    )
    
    db_report = Report(
        meeting_id=meeting.id,
        file_path=pdf_path
    )
    db.add(db_report)
    
    db.commit()
    db.refresh(meeting)
    return meeting

