import logging
from typing import Any, List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api import deps
from app.database.session import get_db
from app.models.user import User
from app.models.meeting import Meeting
from app.models.transcription import Transcript
from app.ai.ai_client import ai_client

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/")
def search_meeting_history(
    *,
    db: Session = Depends(get_db),
    q: str = Query(..., min_length=2, description="Search query string"),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    RAG search assistant that scans past transcripts for matches,
    compiles matching context, and prompts Groq to extract answers.
    """
    
    # 1. Retrieve all completed meetings and transcripts for the host
    transcripts = (
        db.query(Transcript)
        .join(Meeting, Meeting.id == Transcript.meeting_id)
        .filter(Meeting.host_id == current_user.id)
        .all()
    )

    if not transcripts:
        return {
            "query": q,
            "answer": "No historical meetings or transcripts found to search from.",
            "citations": []
        }

    # 2. Simple keyword-matching relevance filter (RAG Retrieval step)
    # We loop through transcripts and rank them based on keyword presence
    keywords = q.lower().split()
    matched_fragments = []
    citations = []

    for item in transcripts:
        full_txt_lower = item.full_text.lower()
        score = sum(1 for kw in keywords if kw in full_txt_lower)
        
        if score > 0:
            meeting = item.meeting
            citations.append({
                "meeting_id": meeting.id,
                "title": meeting.title,
                "date": meeting.date.strftime("%Y-%m-%d")
            })
            
            # Extract matching segments
            fragment_lines = []
            for seg in item.raw_segments:
                seg_text = seg.get("text", "")
                if any(kw in seg_text.lower() for kw in keywords):
                    fragment_lines.append(f"[{seg.get('start', 0.0)}s - {seg.get('end', 0.0)}s]: {seg_text}")
            
            # Combine the lines as context
            context_text = "\n".join(fragment_lines[:5])  # Cap fragments to avoid blowup
            if not context_text:
                # Fallback to a slice of text if segments match didn't resolve cleanly
                context_text = item.full_text[:400]

            matched_fragments.append({
                "id": meeting.id,
                "title": meeting.title,
                "date": meeting.date.strftime("%Y-%m-%d"),
                "transcript": context_text
            })

    # Limit search scope context to top 3 meetings
    matched_fragments = matched_fragments[:3]

    if not matched_fragments:
        # If no strict keyword matches, fallback to returning the 2 most recent transcripts as context
        sorted_transcripts = sorted(transcripts, key=lambda t: t.meeting.date, reverse=True)[:2]
        for item in sorted_transcripts:
            meeting = item.meeting
            matched_fragments.append({
                "id": meeting.id,
                "title": meeting.title,
                "date": meeting.date.strftime("%Y-%m-%d"),
                "transcript": item.full_text[:400]
            })

    # 3. Generate answer via LLM
    answer = ai_client.answer_transcript_question(q, matched_fragments)

    return {
        "query": q,
        "answer": answer,
        "citations": citations
    }
