from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api import deps
from app.core.config import settings as app_settings
from app.database.session import get_db
from app.models.user import User
from app.models.settings import UserSettings
from app.ai.ai_client import ai_client

router = APIRouter()


@router.get("/")
def get_user_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Fetch current user configurations settings."""
    user_settings = db.query(UserSettings).filter(UserSettings.user_id == current_user.id).first()
    if not user_settings:
        # Lazy initialize if missing
        user_settings = UserSettings(user_id=current_user.id)
        db.add(user_settings)
        db.commit()
        db.refresh(user_settings)
        
    return {
        "theme": user_settings.theme,
        "audio_device": user_settings.audio_device,
        "video_device": user_settings.video_device,
        "notification_thresholds": user_settings.notification_thresholds,
        # Hide keys values in response, return present status flag
        "api_keys": {k: "***" for k in user_settings.api_keys.keys()}
    }


@router.put("/")
def update_user_settings(
    *,
    db: Session = Depends(get_db),
    payload: dict,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Update settings (handles themes, devices, and Groq Developer Key)."""
    user_settings = db.query(UserSettings).filter(UserSettings.user_id == current_user.id).first()
    if not user_settings:
        raise HTTPException(status_code=404, detail="Settings registry not found.")

    if "theme" in payload:
        user_settings.theme = payload["theme"]
    if "audio_device" in payload:
        user_settings.audio_device = payload["audio_device"]
    if "video_device" in payload:
        user_settings.video_device = payload["video_device"]
    if "notification_thresholds" in payload:
        user_settings.notification_thresholds = payload["notification_thresholds"]
        
    if "api_keys" in payload:
        # Merge updated keys
        current_keys = dict(user_settings.api_keys or {})
        for k, v in payload["api_keys"].items():
            if v == "***":
                continue  # keep current key
            current_keys[k] = v
            
            # If Groq Key is updated, propagate to application setting context
            if k == "groq_api_key" and v:
                app_settings.GROQ_API_KEY = v
                ai_client.api_key = v
                ai_client._client = None  # Force client reinitialization
                
        user_settings.api_keys = current_keys

    db.add(user_settings)
    db.commit()
    db.refresh(user_settings)

    return {"message": "Settings updated successfully."}
