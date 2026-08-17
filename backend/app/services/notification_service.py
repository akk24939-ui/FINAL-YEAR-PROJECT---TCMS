"""Notification service — create, list, and mark in-app notifications.

IDOR protection: all queries filter on user.id from the JWT-validated User object.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import (
    Notification,
    NotificationCategory,
    NotificationType,
)
from app.models.user import User


async def create_notification(
    user_id: UUID,
    title: str,
    message: str,
    ntype: NotificationType,
    category: NotificationCategory,
    db: AsyncSession,
) -> Notification:
    """Create and persist a new notification for *user_id*."""
    notification = Notification(
        user_id=user_id,
        title=title,
        message=message,
        notification_type=ntype,
        category=category,
    )
    db.add(notification)
    await db.commit()
    await db.refresh(notification)
    return notification


async def get_unread(user: User, db: AsyncSession) -> list[Notification]:
    """Return all unread notifications for *user* (newest first)."""
    result = await db.execute(
        select(Notification)
        .where(
            Notification.user_id == user.id,
            Notification.is_read == False,  # noqa: E712
        )
        .order_by(Notification.created_at.desc())
    )
    return result.scalars().all()


async def get_all(
    user: User,
    db: AsyncSession,
    skip: int = 0,
    limit: int = 50,
) -> list[Notification]:
    """Return paginated notifications for *user* (newest first)."""
    result = await db.execute(
        select(Notification)
        .where(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()


async def mark_read(
    user: User,
    notification_id: UUID,
    db: AsyncSession,
) -> Notification:
    """Mark a single notification as read. IDOR-safe."""
    result = await db.execute(
        select(Notification).where(Notification.id == notification_id)
    )
    notification: Optional[Notification] = result.scalar_one_or_none()
    if notification is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )
    # IDOR check — must belong to the requesting user
    if notification.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )
    notification.is_read = True
    notification.read_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(notification)
    return notification


async def get_unread_count(user: User, db: AsyncSession) -> int:
    """Return the count of unread notifications for *user*."""
    result = await db.execute(
        select(Notification)
        .where(
            Notification.user_id == user.id,
            Notification.is_read == False,  # noqa: E712
        )
    )
    return len(result.scalars().all())
