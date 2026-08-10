import os
from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import psutil

from app.api import deps
from app.database.session import get_db
from app.models.user import User
from app.schemas.user import UserResponse

router = APIRouter()


@router.get("/users", response_model=List[UserResponse])
def get_all_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_admin_user),
) -> Any:
    """Retrieve list of all users registered on the platform (Admin exclusive)."""
    users = db.query(User).all()
    return users


@router.put("/users/{user_id}/role")
def update_user_role(
    user_id: int,
    role: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_admin_user),
) -> Any:
    """Change role of a user (admin or user)."""
    if role not in ("admin", "user"):
        raise HTTPException(status_code=400, detail="Invalid role. Must be 'admin' or 'user'.")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    user.role = role
    db.add(user)
    db.commit()
    return {"message": f"User role updated to '{role}'."}


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_admin_user),
) -> Any:
    """Deletes a user account from the system."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Admins cannot delete their own profiles.")

    db.delete(user)
    db.commit()
    return {"message": "User deleted successfully."}


@router.get("/system-health")
def get_system_health(
    current_user: User = Depends(deps.get_current_admin_user),
) -> Any:
    """Return backend machine compute stats (RAM, CPU, disk)."""
    cpu_percent = psutil.cpu_percent(interval=0.5)
    memory_info = psutil.virtual_memory()
    disk_info = psutil.disk_usage("/")
    
    # Process information
    process = psutil.Process(os.getpid())
    process_memory = process.memory_info().rss / (1024 * 1024)  # MB

    return {
        "status": "healthy",
        "cpu": {
            "cores": psutil.cpu_count(logical=True),
            "usage_percent": cpu_percent
        },
        "memory": {
            "total_gb": round(memory_info.total / (1024**3), 2),
            "available_gb": round(memory_info.available / (1024**3), 2),
            "usage_percent": memory_info.percent
        },
        "disk": {
            "total_gb": round(disk_info.total / (1024**3), 2),
            "free_gb": round(disk_info.free / (1024**3), 2),
            "usage_percent": disk_info.percent
        },
        "process": {
            "memory_usage_mb": round(process_memory, 2),
            "threads_active": len(process.threads())
        }
    }
