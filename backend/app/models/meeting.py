from datetime import datetime
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database.session import Base


class Meeting(Base):
    __tablename__ = "meetings"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    date = Column(DateTime, default=datetime.utcnow)
    duration_seconds = Column(Integer, default=0)
    host_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status = Column(String, default="scheduled")  # "scheduled", "ongoing", "completed"
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    host = relationship("User", back_populates="meetings")
    participants = relationship("Participant", back_populates="meeting", cascade="all, delete-orphan")
    transcript = relationship("Transcript", back_populates="meeting", uselist=False, cascade="all, delete-orphan")
    summary = relationship("Summary", back_populates="meeting", uselist=False, cascade="all, delete-orphan")
    activity_logs = relationship("ActivityLog", back_populates="meeting", cascade="all, delete-orphan")
    reports = relationship("Report", back_populates="meeting", cascade="all, delete-orphan")


class Participant(Base):
    __tablename__ = "participants"

    id = Column(Integer, primary_key=True, index=True)
    meeting_id = Column(Integer, ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False)
    email = Column(String, nullable=True)
    name = Column(String, nullable=False)
    join_time = Column(DateTime, default=datetime.utcnow)
    leave_time = Column(DateTime, nullable=True)

    # Relationships
    meeting = relationship("Meeting", back_populates="participants")
