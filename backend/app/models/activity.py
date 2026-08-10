from datetime import datetime
from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database.session import Base


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    meeting_id = Column(Integer, ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    keyboard_hits = Column(Integer, default=0)
    mouse_clicks = Column(Integer, default=0)
    idle_seconds = Column(Integer, default=0)
    active_window = Column(String, nullable=True)
    face_present_seconds = Column(Float, default=0.0)
    eye_attention_score = Column(Float, default=0.0)  # focus score from MediaPipe
    focus_score = Column(Float, default=0.0)  # calculated aggregate (0 to 100)

    # Relationships
    meeting = relationship("Meeting", back_populates="activity_logs")
