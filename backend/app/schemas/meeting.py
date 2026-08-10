from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


# Participant schemas
class ParticipantBase(BaseModel):
    name: str
    email: Optional[str] = None


class ParticipantCreate(ParticipantBase):
    pass


class ParticipantResponse(ParticipantBase):
    id: int
    join_time: datetime
    leave_time: Optional[datetime] = None

    class Config:
        from_attributes = True


# Meeting schemas
class MeetingBase(BaseModel):
    title: str


class MeetingCreate(MeetingBase):
    participants: Optional[List[ParticipantCreate]] = Field(default_factory=list)


class MeetingUpdate(BaseModel):
    title: Optional[str] = None
    duration_seconds: Optional[int] = None
    status: Optional[str] = None


# Embedded elements
class TranscriptResponseSchema(BaseModel):
    id: int
    full_text: str
    raw_segments: List[Dict[str, Any]]
    generated_at: datetime

    class Config:
        from_attributes = True


class SummaryResponseSchema(BaseModel):
    id: int
    key_points: Optional[str] = None
    decisions: Optional[str] = None
    risks: Optional[str] = None
    next_steps: Optional[str] = None
    action_items: List[Dict[str, Any]] = []
    created_at: datetime

    class Config:
        from_attributes = True


class ActivityLogResponseSchema(BaseModel):
    id: int
    timestamp: datetime
    keyboard_hits: int
    mouse_clicks: int
    idle_seconds: int
    active_window: Optional[str] = None
    face_present_seconds: float
    eye_attention_score: float
    focus_score: float

    class Config:
        from_attributes = True


# Full meeting response detail schema
class MeetingResponse(MeetingBase):
    id: int
    date: datetime
    duration_seconds: int
    host_id: int
    status: str
    created_at: datetime
    participants: List[ParticipantResponse] = []
    transcript: Optional[TranscriptResponseSchema] = None
    summary: Optional[SummaryResponseSchema] = None

    class Config:
        from_attributes = True


# Metrics schema for live status
class LiveMetricsUpdate(BaseModel):
    keyboard_hits: int
    mouse_clicks: int
    idle_seconds: int
    active_window: str
    face_present: bool
    eye_attention_score: float
