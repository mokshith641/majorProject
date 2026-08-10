from datetime import datetime
from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, Text
from sqlalchemy.orm import relationship

from app.database.session import Base


class Summary(Base):
    __tablename__ = "summaries"

    id = Column(Integer, primary_key=True, index=True)
    meeting_id = Column(Integer, ForeignKey("meetings.id", ondelete="CASCADE"), unique=True, nullable=False)
    key_points = Column(Text, nullable=True)
    decisions = Column(Text, nullable=True)
    risks = Column(Text, nullable=True)
    next_steps = Column(Text, nullable=True)
    action_items = Column(JSON, default=list)  # List of dicts: {"task": str, "assignee": str, "due_date": str, "status": str}
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    meeting = relationship("Meeting", back_populates="summary")
