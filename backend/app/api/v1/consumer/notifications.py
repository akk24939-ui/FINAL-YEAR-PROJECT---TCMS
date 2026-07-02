"""Consumer notifications endpoints."""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_consumer
from app.models.user import User
from app.services.notification_service import (
    get_all, get_unread, mark_read
)
from app.schemas.notification import NotificationResponse, UnreadCountResponse

router = APIRouter(prefix="/notifications", tags=["Consumer - Notifications"])


@router.get("/", response_model=list[NotificationResponse])
def list_notifications(
    current_user: User = Depends(get_current_consumer),
    db: Session = Depends(get_db),
):
    return get_all(current_user, db, skip=0, limit=50)


@router.get("/unread-count", response_model=UnreadCountResponse)
def unread_count(
    current_user: User = Depends(get_current_consumer),
    db: Session = Depends(get_db),
):
    unread = get_unread(current_user, db)
    return {"unread_count": len(unread)}


@router.patch("/{notification_id}/read", response_model=NotificationResponse)
def mark_notification_read(
    notification_id: UUID,
    current_user: User = Depends(get_current_consumer),
    db: Session = Depends(get_db),
):
    """Mark a notification as read. IDOR-safe: verifies ownership."""
    n = mark_read(current_user, notification_id, db)
    if not n:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Notification not found")
    return n
