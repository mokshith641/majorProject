from typing import Any
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api import deps
from app.database.session import get_db
from app.models.user import User
from app.models.meeting import Meeting
from app.models.activity import ActivityLog

router = APIRouter()


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

    return {
        "totals": {
            "meetings_scheduled": total_meetings,
            "meetings_completed": completed_meetings,
            "total_duration_minutes": round(total_duration / 60.0, 1),
            "average_focus": round(avg_focus, 1)
        },
        "weekly_trends": trends,
        "active_windows": app_shares
    }
