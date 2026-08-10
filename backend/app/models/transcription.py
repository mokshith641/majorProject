from datetime import datetime
from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, Text
from sqlalchemy.orm import relationship

from app.database.session import Base


class Transcript(Base):
    __tablename__ = "transcripts"

    id = Column(Integer, primary_key=True, index=True)
    meeting_id = Column(Integer, ForeignKey("meetings.id", ondelete="CASCADE"), unique=True, nullable=False)
    full_text = Column(Text, nullable=False)
    raw_segments = Column(JSON, default=list)  # List of dicts: {"start": float, "end": float, "text": str, "speaker": str}
    generated_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    meeting = relationship("Meeting", back_populates="transcript")
