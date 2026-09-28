import os
from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api import deps
from app.database.session import get_db
from app.models.user import User
from app.models.meeting import Meeting
from app.models.report import Report

router = APIRouter()


@router.get("/{meeting_id}/download")
@router.get("/pdf/{meeting_id}")
def download_meeting_report(
    meeting_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Download meeting's exported ReportLab PDF document."""
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    if meeting.host_id != current_user.id and not current_user.is_superuser:
        from app.models.meeting import Participant
        is_participant = db.query(Participant).filter(
            Participant.meeting_id == meeting_id, Participant.email == current_user.email
        ).first()
        if not is_participant:
            raise HTTPException(status_code=403, detail="You do not have permission to access this report.")

    report = db.query(Report).filter(Report.meeting_id == meeting_id).first()
    if not report or not os.path.exists(report.file_path):
        raise HTTPException(
            status_code=404,
            detail="Report file is missing or has not been compiled yet."
        )

    # Clean file name suggestion for download
    safe_title = "".join(c for c in meeting.title if c.isalnum() or c in (" ", "_", "-")).rstrip()
    download_filename = f"MeetingReport_{safe_title}_{meeting_id}.pdf"

    return FileResponse(
        path=report.file_path,
        media_type="application/pdf",
        filename=download_filename
    )
