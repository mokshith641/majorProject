from typing import Any, List, Dict
import time
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api import deps
from app.database.session import get_db
from app.models.user import User
from app.models.meeting import Meeting, Participant
from app.models.activity import ActivityLog
from app.models.summary import Summary
from app.models.transcription import Transcript
from app.ai.ai_client import ai_client

router = APIRouter()

# Simple TTL cache for AI analytics insights (keyed by user_id)
_insights_cache: Dict[int, Dict] = {}  # {user_id: {"data": ..., "expires": float}}
_INSIGHTS_CACHE_TTL = 300  # 5 minutes


@router.get("/summary")
def get_analytics_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Retrieve aggregate statistics for user dashboard visual charts."""
    
    # 1. Total meetings hosted
    total_meetings = db.query(Meeting).filter(Meeting.host_id == current_user.id).count()
    completed_meetings = db.query(Meeting).filter(Meeting.host_id == current_user.id, Meeting.status == "completed").count()

    # 2. Total duration
    total_duration = db.query(func.sum(Meeting.duration_seconds)).filter(
        Meeting.host_id == current_user.id, Meeting.status == "completed"
    ).scalar() or 0

    # 3. Calculate global average focus score across all completed logs
    avg_focus = db.query(func.avg(ActivityLog.focus_score)).join(
        Meeting, Meeting.id == ActivityLog.meeting_id
    ).filter(Meeting.host_id == current_user.id).scalar() or 0.0

    # 4. Weekly Trend aggregation
    # Group meetings by date (day of week/date)
    # Since sqlite has different date functions than postgres, we do a simple day parsing or return dummy historical chart logs if DB is clean
    weekly_meetings_db = (
        db.query(
            func.date(Meeting.date).label("day_date"),
            func.count(Meeting.id).label("meeting_count"),
            func.avg(ActivityLog.focus_score).label("avg_engagement")
        )
        .outerjoin(ActivityLog, Meeting.id == ActivityLog.meeting_id)
        .filter(Meeting.host_id == current_user.id)
        .group_by(func.date(Meeting.date))
        .order_by("day_date")
        .limit(7)
        .all()
    )

    trends = []
    for day in weekly_meetings_db:
        if day.day_date:
            trends.append({
                "date": day.day_date,
                "meetings": day.meeting_count,
                "focus": round(day.avg_engagement or 0.0, 1)
            })

    # Fallback to realistic demo trend if empty (to ensure visual experience is rich at start)
    if not trends:
        trends = [
            {"date": "Mon", "meetings": 2, "focus": 82.0},
            {"date": "Tue", "meetings": 1, "focus": 78.5},
            {"date": "Wed", "meetings": 3, "focus": 88.0},
            {"date": "Thu", "meetings": 2, "focus": 75.0},
            {"date": "Fri", "meetings": 4, "focus": 84.5},
            {"date": "Sat", "meetings": 0, "focus": 0.0},
            {"date": "Sun", "meetings": 1, "focus": 90.0}
        ]

    # 5. Dominant focused applications
    window_stats = (
        db.query(
            ActivityLog.active_window,
            func.count(ActivityLog.id)
        )
        .join(Meeting, Meeting.id == ActivityLog.meeting_id)
        .filter(Meeting.host_id == current_user.id, ActivityLog.active_window != None)
        .group_by(ActivityLog.active_window)
        .all()
    )
    
    app_shares = []
    for app_win, count in window_stats:
        app_shares.append({
            "name": app_win.split(" - ")[-1] if " - " in app_win else app_win,
            "value": count
        })
        
    if not app_shares:
        app_shares = [
            {"name": "VS Code", "value": 45},
            {"name": "Chrome (Docs)", "value": 30},
            {"name": "Zoom Client", "value": 15},
            {"name": "Slack", "value": 10}
        ]

    # 6. Synthesize AI Executive Insights across recent meetings
    # Check TTL cache first to avoid calling Gemini/Groq on every dashboard load
    cached = _insights_cache.get(current_user.id)
    if cached and cached.get("expires", 0) > time.time():
        ai_insights = cached["data"]
    else:
        recent_meetings = (
            db.query(Meeting)
            .filter(Meeting.host_id == current_user.id, Meeting.status == "completed")
            .order_by(Meeting.date.desc())
            .limit(10)
            .all()
        )

        history_payload = []
        for m in recent_meetings:
            summary_text = m.summary.key_points if m.summary else ""
            focus = m.activity_logs[0].focus_score if m.activity_logs else 85.0
            history_payload.append({
                "title": m.title,
                "date": m.date.strftime("%Y-%m-%d") if m.date else "",
                "duration_seconds": m.duration_seconds or 0,
                "focus_score": focus,
                "summary": summary_text
            })

        ai_insights = ai_client.generate_analytics_insights(history_payload)
        _insights_cache[current_user.id] = {"data": ai_insights, "expires": time.time() + _INSIGHTS_CACHE_TTL}

    return {
        "totals": {
            "meetings_scheduled": total_meetings,
            "meetings_completed": completed_meetings,
            "total_duration_minutes": round(total_duration / 60.0, 1),
            "average_focus": round(avg_focus, 1)
        },
        "weekly_trends": trends,
        "active_windows": app_shares,
        "ai_insights": ai_insights
    }


@router.get("/insights")
def get_ai_insights_endpoint(
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Dedicated endpoint returning deep AI productivity insights and recommendations."""
    recent_meetings = (
        db.query(Meeting)
        .filter(Meeting.host_id == current_user.id, Meeting.status == "completed")
        .order_by(Meeting.date.desc())
        .limit(10)
        .all()
    )

    history_payload = []
    for m in recent_meetings:
        summary_text = m.summary.key_points if m.summary else ""
        focus = m.activity_logs[0].focus_score if m.activity_logs else 85.0
        history_payload.append({
            "title": m.title,
            "date": m.date.strftime("%Y-%m-%d") if m.date else "",
            "duration_seconds": m.duration_seconds or 0,
            "focus_score": focus,
            "summary": summary_text
        })

    return ai_client.generate_analytics_insights(history_payload)


@router.get("/meeting/{id}")
def get_meeting_analytics(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Retrieve meeting-specific engagement metrics, activity telemetry,
    and real participant speaking statistics.
    """
    meeting = db.query(Meeting).filter(Meeting.id == id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    # Access check: user must be host or participant or admin
    is_admin = getattr(current_user, "role", "") == "admin"
    if meeting.host_id != current_user.id and not is_admin:
        is_participant = db.query(Participant).filter(
            Participant.meeting_id == id, Participant.email == current_user.email
        ).first()
        if not is_participant:
            raise HTTPException(status_code=403, detail="You do not have permission to view analytics for this meeting.")

    activity_log = (
        db.query(ActivityLog)
        .filter(ActivityLog.meeting_id == id)
        .order_by(ActivityLog.timestamp.desc())
        .first()
    )

    transcript = db.query(Transcript).filter(Transcript.meeting_id == id).first()
    segments = transcript.raw_segments if transcript and transcript.raw_segments else []

    # If neither activity telemetry nor transcript speech segments exist
    if not activity_log and not segments:
        return {
            "available": False,
            "message": "Engagement data is not available for this meeting."
        }

    # Compute real participant-wise speaking statistics from actual meeting segments
    participant_stats_map: Dict[str, Dict[str, Any]] = {}
    total_spoken_time = 0.0

    for seg in segments:
        spk = seg.get("speaker_name") or seg.get("speaker") or "Unknown Speaker"
        start = float(seg.get("start", 0.0))
        end = float(seg.get("end", 0.0))
        duration = max(0.0, end - start)
        text = (seg.get("cleaned_text") or seg.get("text") or "").strip()
        words = len(text.split()) if text else 0

        total_spoken_time += duration
        if spk not in participant_stats_map:
            participant_stats_map[spk] = {
                "speaker": spk,
                "speaker_id": seg.get("speaker_id", ""),
                "utterance_count": 0,
                "total_speaking_seconds": 0.0,
                "word_count": 0,
            }
        participant_stats_map[spk]["utterance_count"] += 1
        participant_stats_map[spk]["total_speaking_seconds"] = round(
            participant_stats_map[spk]["total_speaking_seconds"] + duration, 2
        )
        participant_stats_map[spk]["word_count"] += words

    participant_stats = []
    for spk, stats in participant_stats_map.items():
        pct = (
            round((stats["total_speaking_seconds"] / total_spoken_time * 100.0), 1)
            if total_spoken_time > 0
            else 0.0
        )
        stats["speaking_percentage"] = pct
        participant_stats.append(stats)

    participant_stats.sort(key=lambda x: x["total_speaking_seconds"], reverse=True)

    return {
        "available": True,
        "focus_score": round(activity_log.focus_score if activity_log else 85.0, 1),
        "eye_attention_score": round(activity_log.eye_attention_score if activity_log else 85.0, 1),
        "keyboard_hits": activity_log.keyboard_hits if activity_log else 0,
        "mouse_clicks": activity_log.mouse_clicks if activity_log else 0,
        "idle_seconds": activity_log.idle_seconds if activity_log else 0,
        "active_window": activity_log.active_window if activity_log else "Meeting Room",
        "face_present_seconds": round(activity_log.face_present_seconds if activity_log else 0.0, 1),
        "total_spoken_seconds": round(total_spoken_time, 2),
        "participant_stats": participant_stats,
    }
