"""Admin audit log endpoint — filterable, paginated audit trail viewer."""
from typing import Optional
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_admin
from app.models.user import User
from app.services import admin_service

router = APIRouter()


@router.get("/audit", summary="View audit log (filterable)")
def get_audit_log(
    event_type: Optional[str] = Query(None),
    actor_id: Optional[str] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    logs, total = admin_service.get_audit_logs(
        db,
        event_type=event_type,
        actor_id=actor_id,
        date_from=date_from,
        date_to=date_to,
        skip=skip,
        limit=limit,
    )
    return {
        "total": total,
        "logs": [
            {
                "id": str(log.id),
                "event_type": log.event_type,
                "description": log.description,
                "user_id": str(log.user_id) if log.user_id else None,
                "actor_id": str(log.actor_id) if log.actor_id else None,
                "ip_address": log.ip_address,
                "metadata": log.metadata_json,
                "created_at": log.created_at.isoformat() if log.created_at else None,
            }
            for log in logs
        ],
    }
