import os
from typing import Any, Dict, Optional
from pydantic import Field, validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "AI-Based Smart Meeting Assistant"
    DEBUG: bool = True
    API_V1_STR: str = "/api/v1"

    # Security & JWT Authentication
    SECRET_KEY: str = "local-development-secret-key-meeting-assistant-2026"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # Database
    DATABASE_URL: str = "sqlite:///./sql_app.db"

    # AI Integration
    GROQ_API_KEY: str = ""

    # Speech-to-Text Configurations
    WHISPER_MODEL_NAME: str = "tiny"
    WHISPER_DEVICE: str = "cpu"

    # Directory paths for storage
    UPLOAD_DIR: str = "./data/recordings"
    REPORTS_DIR: str = "./data/reports"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )

    @validator("UPLOAD_DIR", "REPORTS_DIR", pre=True)
    def ensure_directories_exist(cls, v: str) -> str:
        """Create target directories if they do not exist."""
        os.makedirs(v, exist_ok=True)
        return v


settings = Settings()
