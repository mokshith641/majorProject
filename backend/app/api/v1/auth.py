from datetime import timedelta
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.api import deps
from app.core import security
from app.core.config import settings
from app.database.session import get_db
from app.models.user import User
from app.models.settings import UserSettings
from app.schemas.user import (
    ForgotPasswordRequest,
    ResetPasswordRequest,
    Token,
    UserCreate,
    UserResponse,
)

router = APIRouter()


@router.post("/register", response_model=UserResponse, status_code=201)
def register(
    *,
    db: Session = Depends(get_db),
    user_in: UserCreate,
) -> Any:
    """Create a new user profile and allocate default settings."""
    user = db.query(User).filter(User.email == user_in.email).first()
    if user:
        raise HTTPException(
            status_code=400,
            detail="The user with this email already exists in the system.",
        )
        
    hashed_password = security.get_password_hash(user_in.password)
    db_user = User(
        email=user_in.email,
        hashed_password=hashed_password,
        full_name=user_in.full_name,
        role=user_in.role or "user",
        is_active=True,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    # Initialize default settings for the user
    user_settings = UserSettings(user_id=db_user.id)
    db.add(user_settings)
    db.commit()
    
    return db_user


@router.post("/login", response_model=Token)
def login(
    db: Session = Depends(get_db),
    form_data: OAuth2PasswordRequestForm = Depends(),
) -> Any:
    """Login flow provisioning JWT token on success."""
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect email or password",
        )
    elif not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user account",
        )
        
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        subject=user.id, expires_delta=access_token_expires
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
    }


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(deps.get_current_active_user)) -> Any:
    """Fetch current session's authenticated user details."""
    return current_user


@router.post("/forgot-password")
def forgot_password(
    *,
    db: Session = Depends(get_db),
    payload: ForgotPasswordRequest,
) -> Any:
    """Send reset link or return temporary hash (Mocked for testing)."""
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(
            status_code=404,
            detail="User with this email does not exist.",
        )
    # Token mock: simple email check for client-side password reset mock
    temp_recovery_token = f"recovery-token-for-{user.id}"
    return {
        "message": "Password recovery instructions generated.",
        "token": temp_recovery_token
    }


@router.post("/reset-password")
def reset_password(
    *,
    db: Session = Depends(get_db),
    payload: ResetPasswordRequest,
) -> Any:
    """Update password if verification token matches."""
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )
        
    expected_token = f"recovery-token-for-{user.id}"
    if payload.token != expected_token:
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired reset token",
        )
        
    user.hashed_password = security.get_password_hash(payload.new_password)
    db.add(user)
    db.commit()
    return {"message": "Password updated successfully."}
