"""Admin overview endpoint — dashboard stats."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_admin
from app.models.user import User
from app.services import admin_service

router = APIRouter()


@router.get("/overview", summary="Admin dashboard overview stats")
def get_overview(
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    stats = admin_service.get_overview_stats(db)
    # Serialize audit logs
    recent_audit = [
        {
            "id": str(log.id),
            "event_type": log.event_type,
            "description": log.description,
            "ip_address": log.ip_address,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        }
        for log in stats["recent_audit"]
    ]
    return {
        "total_consumers": stats["total_consumers"],
        "total_operators": stats["total_operators"],
        "total_doctors": stats["total_doctors"],
        "total_shops": stats["total_shops"],
        "suspended_shops": stats["suspended_shops"],
        "today_purchases": stats["today_purchases"],
        "recent_audit": recent_audit,
    }
