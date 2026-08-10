from sqlalchemy import Column, ForeignKey, Integer, JSON, String
from sqlalchemy.orm import relationship

from app.database.session import Base


class UserSettings(Base):
    __tablename__ = "user_settings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    theme = Column(String, default="dark")  # "light" or "dark"
    audio_device = Column(String, nullable=True)
    video_device = Column(String, nullable=True)
    notification_thresholds = Column(JSON, default=lambda: {
        "idle_warning_minutes": 5,
        "attention_alert_threshold": 0.5
    })
    api_keys = Column(JSON, default=lambda: {})

    # Relationships
    user = relationship("User", back_populates="settings")
