from fastapi import APIRouter

from app.api.v1 import auth, meetings, analytics, reports, search, settings, admin

api_router = APIRouter()

# Register V1 Sub-Routers
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(meetings.router, prefix="/meetings", tags=["Meetings"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["Analytics"])
api_router.include_router(reports.router, prefix="/reports", tags=["Reports"])
api_router.include_router(search.router, prefix="/search", tags=["Search Assistant"])
api_router.include_router(settings.router, prefix="/settings", tags=["Settings"])
api_router.include_router(admin.router, prefix="/admin", tags=["Admin"])
