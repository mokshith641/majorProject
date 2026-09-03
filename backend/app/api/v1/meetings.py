import json
import logging
import os
from datetime import datetime
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from app.api import deps
from app.core.config import settings
from app.database.session import get_db
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

logger = logging.getLogger(__name__)
router = APIRouter()

# Local recorders maps to track which active meetings are recording
active_recordings: dict[int, LocalAudioRecorder] = {}
meeting_start_times: dict[int, datetime] = {}
# Active live captions in-memory buffer per meeting ID
active_live_transcripts: dict[int, list[dict]] = {}


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
async def meeting_live_ws(websocket: WebSocket, id: int):
    """WebSocket endpoint for real-time live captions and participant coordination."""
    await manager.connect(websocket, id)
    try:
        # Send current live transcript history to newly connected participant
        history = active_live_transcripts.get(id, [])
        if history:
            await websocket.send_text(json.dumps({
                "type": "history",
                "captions": history
            }))

        while True:
            data_text = await websocket.receive_text()
            try:
                msg = json.loads(data_text)
                msg_type = msg.get("type")

                if msg_type == "caption":
                    caption_payload = {
                        "type": "caption",
                        "speaker": msg.get("speaker", "Speaker"),
                        "text": msg.get("text", "").strip(),
                        "is_final": bool(msg.get("is_final", False)),
                        "timestamp": msg.get("timestamp", datetime.utcnow().strftime("%H:%M:%S")),
                    }
                    # Save final captions to meeting live buffer
                    if caption_payload["is_final"] and caption_payload["text"]:
                        if id not in active_live_transcripts:
                            active_live_transcripts[id] = []
                        active_live_transcripts[id].append(caption_payload)

                    # Broadcast to all connected participants in this meeting room
                    await manager.broadcast_to_meeting(id, caption_payload)

                elif msg_type == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        manager.disconnect(websocket, id)
    except Exception as e:
        logger.error(f"WebSocket error in meeting {id}: {e}")
        manager.disconnect(websocket, id)


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


@router.post("/{id}/end", response_model=MeetingResponse)
def end_meeting(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Stop recording devices, process local WAV files, summarize, and commit report."""
    meeting = db.query(Meeting).filter(Meeting.id == id, Meeting.host_id == current_user.id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    if meeting.status != "ongoing":
        raise HTTPException(status_code=400, detail="Meeting is not currently active.")

    # 1. Stop local capture devices
    recorder = active_recordings.pop(meeting.id, None)
    if recorder:
        recorder.stop()

    input_data = activity_tracker.stop_tracking()
    face_seconds, avg_gaze = vision_monitor.stop()

    start_time = meeting_start_times.pop(meeting.id, meeting.date)
    duration = int((datetime.utcnow() - start_time).total_seconds())
    meeting.duration_seconds = max(1, duration)
    meeting.status = "completed"

    # Save telemetry logs in database
    idle_percent = round((input_data["idle_seconds"] / meeting.duration_seconds) * 100.0, 2)
    idle_percent = min(100.0, max(0.0, idle_percent))
    
    # Calculate aggregate focus index (gaze alignment + desktop key activity)
    active_percent = 100.0 - idle_percent
    base_focus = (avg_gaze * 0.7) + (active_percent * 0.3)
    focus_score = round(min(100.0, max(0.0, base_focus)), 2)

    db_log = ActivityLog(
        meeting_id=meeting.id,
        user_id=current_user.id,
        keyboard_hits=input_data["keyboard_hits"],
        mouse_clicks=input_data["mouse_clicks"],
        idle_seconds=input_data["idle_seconds"],
        active_window=input_data["dominant_window"],
        face_present_seconds=face_seconds,
        eye_attention_score=avg_gaze,
        focus_score=focus_score
    )
    db.add(db_log)

    # 2. Run speech-to-text
    wav_filename = f"meeting_{meeting.id}.wav"
    wav_path = os.path.join(settings.UPLOAD_DIR, wav_filename)
    
    # Fetch participant names for speaker diarization
    participant_names = []
    if meeting.host:
        participant_names.append(meeting.host.full_name or meeting.host.email)
    for p in meeting.participants:
        if p.name:
            participant_names.append(p.name)
            
    full_text, segments = transcriber.transcribe(wav_path, participant_names=participant_names)
    
    # Auto-detect speakers from segments and add them as participants if not already registered
    detected_speakers = set(seg["speaker"] for seg in segments if seg.get("speaker"))
    existing_participant_names = {p.name.lower() for p in meeting.participants}
    if meeting.host:
        existing_participant_names.add((meeting.host.full_name or "").lower())
        existing_participant_names.add(meeting.host.email.lower())
    for speaker in detected_speakers:
        if speaker.lower() not in existing_participant_names and speaker.lower() not in ["unknown", "time", "speaker"]:
            new_participant = Participant(
                meeting_id=meeting.id,
                name=speaker,
                email=None
            )
            db.add(new_participant)
            
    # Enhance transcript with live captions collected during meeting
    live_caps = active_live_transcripts.pop(meeting.id, [])
    if live_caps:
        caption_lines = [f"{c.get('speaker', 'Speaker')}: {c.get('text', '')}" for c in live_caps if c.get("text")]
        if not full_text or full_text.strip() == "No audio recorded." or len(full_text.split()) < 5:
            if caption_lines:
                full_text = "\n".join(caption_lines)
                segments = [
                    {"speaker": c.get("speaker", "Speaker"), "text": c.get("text", ""), "start": i * 4, "end": (i + 1) * 4}
                    for i, c in enumerate(live_caps) if c.get("text")
                ]
        elif caption_lines:
            full_text = full_text + "\n\n" + "\n".join(caption_lines)

    if not full_text:
        full_text = "No audio recorded."
        
    db_transcript = Transcript(
        meeting_id=meeting.id,
        full_text=full_text,
        raw_segments=segments
    )
    db.add(db_transcript)

    # 3. Generate summary and auto-detect smart title if generic
    summary_data = ai_client.generate_summary(full_text)
    
    # Auto-generate crisp title if meeting has generic title
    generic_titles = [
        "Active Meeting Session", "Google Meet Session", "New Meeting", 
        "Untitled Meeting", "Scheduled Meeting"
    ]
    if meeting.title in generic_titles or meeting.title.startswith("Meeting #"):
        smart_title = ai_client.generate_meeting_title(full_text)
        if smart_title:
            meeting.title = smart_title
            db.add(meeting)

    db_summary = Summary(
        meeting_id=meeting.id,
        key_points=summary_data.get("key_points"),
        decisions=summary_data.get("decisions"),
        risks=summary_data.get("risks"),
        next_steps=summary_data.get("next_steps"),
        action_items=summary_data.get("action_items", [])
    )
    db.add(db_summary)
    db.commit()

    # 4. Generate and save PDF report
    pdf_filename = f"report_{meeting.id}.pdf"
    pdf_path = os.path.join(settings.REPORTS_DIR, pdf_filename)
    engagement_payload = {
        "focus_score": focus_score,
        "idle_percent": idle_percent
    }
    
    pdf_success = generate_meeting_pdf(
        meeting_title=meeting.title,
        meeting_date=meeting.date,
        duration_seconds=meeting.duration_seconds,
        summary_data=summary_data,
        engagement_metrics=engagement_payload,
        output_path=pdf_path
    )
    
    if pdf_success:
        db_report = Report(
            meeting_id=meeting.id,
            file_path=pdf_path
        )
        db.add(db_report)
    
    db.commit()
    db.refresh(meeting)
    return meeting


@router.post("/{id}/upload-recording", response_model=MeetingResponse)
async def upload_meeting_recording(
    id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """Upload pre-recorded browser WAV file directly. Runs STT, AI Summarizer, and exports PDF."""
    meeting = db.query(Meeting).filter(Meeting.id == id, Meeting.host_id == current_user.id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    # Save upload file
    wav_filename = f"meeting_{meeting.id}.wav"
    wav_path = os.path.join(settings.UPLOAD_DIR, wav_filename)
    
    try:
        with open(wav_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
    except Exception as e:
        logger.error(f"Failed saving uploaded file: {e}")
        raise HTTPException(status_code=500, detail="Failed to save uploaded file.")

    # Populate dummy duration & telemetry for direct file uploads
    meeting.duration_seconds = 300  # Default to 5 minutes if unknown
    meeting.status = "completed"
    
    # Store default mock telemetry
    db_log = ActivityLog(
        meeting_id=meeting.id,
        user_id=current_user.id,
        keyboard_hits=45,
        mouse_clicks=20,
        idle_seconds=60,
        active_window="Browser (Chrome)",
        face_present_seconds=240.0,
        eye_attention_score=85.0,
        focus_score=82.5
    )
    db.add(db_log)

    # Speech to text
    # Fetch participant names for speaker diarization
    participant_names = []
    if meeting.host:
        participant_names.append(meeting.host.full_name or meeting.host.email)
    for p in meeting.participants:
        if p.name:
            participant_names.append(p.name)
            
    full_text, segments = transcriber.transcribe(wav_path, participant_names=participant_names)
    
    # Auto-detect speakers from segments and add them as participants if not already registered
    detected_speakers = set(seg["speaker"] for seg in segments if seg.get("speaker"))
    existing_participant_names = {p.name.lower() for p in meeting.participants}
    if meeting.host:
        existing_participant_names.add((meeting.host.full_name or "").lower())
        existing_participant_names.add(meeting.host.email.lower())
    for speaker in detected_speakers:
        if speaker.lower() not in existing_participant_names and speaker.lower() not in ["unknown", "time", "speaker"]:
            new_participant = Participant(
                meeting_id=meeting.id,
                name=speaker,
                email=None
            )
            db.add(new_participant)
            
    if not full_text:
        full_text = "No transcribable text captured."

    db_transcript = Transcript(
        meeting_id=meeting.id,
        full_text=full_text,
        raw_segments=segments
    )
    db.add(db_transcript)

    # Generate AI summary and smart title
    summary_data = ai_client.generate_summary(full_text)

    # Auto-generate descriptive title if current title is generic
    generic_titles = [
        "Active Meeting Session", "Google Meet Session", "New Meeting",
        "Untitled Meeting", "Scheduled Meeting"
    ]
    if meeting.title in generic_titles or meeting.title.startswith("Meeting #"):
        smart_title = ai_client.generate_meeting_title(full_text)
        if smart_title:
            meeting.title = smart_title
            db.add(meeting)

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
        "focus_score": 82.5,
        "idle_percent": 20.0
    }
    
    generate_meeting_pdf(
        meeting_title=meeting.title,
        meeting_date=meeting.date,
        duration_seconds=meeting.duration_seconds,
        summary_data=summary_data,
        engagement_metrics=engagement_payload,
        output_path=pdf_path
    )
    
    db_commit_success = True
    try:
        db.commit()
    except Exception as e:
        logger.error(f"Failed to commit database transaction: {e}")
        db_commit_success = False

    db.refresh(meeting)
    return meeting


@router.post("/{id}/submit-transcript", response_model=MeetingResponse)
def submit_meeting_transcript(
    id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """Submit raw text transcript directly. Skips STT, runs AI Summarizer, and exports PDF."""
    meeting = db.query(Meeting).filter(Meeting.id == id, Meeting.host_id == current_user.id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    full_text = payload.get("transcript", "").strip()
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

