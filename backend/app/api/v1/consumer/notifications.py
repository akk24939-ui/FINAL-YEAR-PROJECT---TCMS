"""Consumer notifications endpoints."""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_consumer
from app.models.user import User
from app.services.notification_service import (
    get_all, get_unread, mark_read
)
from app.schemas.notification import NotificationResponse, UnreadCountResponse

router = APIRouter(prefix="/notifications", tags=["Consumer - Notifications"])


@router.get("/", response_model=list[NotificationResponse])
async def list_notifications(
    current_user: User = Depends(get_current_consumer),
    db: AsyncSession = Depends(get_db),
):
    return await get_all(current_user, db, skip=0, limit=50)


@router.get("/unread-count", response_model=UnreadCountResponse)
async def unread_count(
    current_user: User = Depends(get_current_consumer),
    db: AsyncSession = Depends(get_db),
):
    unread = await get_unread(current_user, db)
    return {"unread_count": len(unread)}


@router.patch("/{notification_id}/read", response_model=NotificationResponse)
async def mark_notification_read(
    notification_id: UUID,
    current_user: User = Depends(get_current_consumer),
    db: AsyncSession = Depends(get_db),
):
    """Mark a notification as read. IDOR-safe: verifies ownership."""
    n = await mark_read(current_user, notification_id, db)
    if not n:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Notification not found")
    return n


@router.post("/mark-all-read")
async def mark_all_read(
    current_user: User = Depends(get_current_consumer),
    db: AsyncSession = Depends(get_db),
):
    """Mark all notifications as read for the current user."""
    from sqlalchemy import select, update
    from datetime import datetime, timezone
    from app.models.notification import Notification
    await db.execute(
        update(Notification)
        .where(
            Notification.user_id == current_user.id,
            Notification.is_read == False,  # noqa: E712
        )
        .values(is_read=True, read_at=datetime.now(timezone.utc))
    )
    await db.commit()
    return {"message": "All notifications marked as read"}
