"""Notification service — create, list, and mark in-app notifications.

IDOR protection: all queries filter on user.id from the JWT-validated User object.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.notification import (
    Notification,
    NotificationCategory,
    NotificationType,
)
from app.models.user import User


def create_notification(
    user_id: UUID,
    title: str,
    message: str,
    ntype: NotificationType,
    category: NotificationCategory,
    db: Session,
) -> Notification:
    """Create and persist a new notification for *user_id*.

    Returns the created Notification object.
    """
    notification = Notification(
        user_id=user_id,
        title=title,
        message=message,
        notification_type=ntype,
        category=category,
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return notification


def get_unread(user: User, db: Session) -> list[Notification]:
    """Return all unread notifications for *user* (newest first)."""
    return (
        db.query(Notification)
        .filter(
            Notification.user_id == user.id,
            Notification.is_read == False,  # noqa: E712
        )
        .order_by(Notification.created_at.desc())
        .all()
    )


def get_all(
    user: User,
    db: Session,
    skip: int = 0,
    limit: int = 50,
) -> list[Notification]:
    """Return paginated notifications for *user* (newest first)."""
    return (
        db.query(Notification)
        .filter(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def mark_read(
    user: User,
    notification_id: UUID,
    db: Session,
) -> Notification:
    """Mark a single notification as read.

    Raises 404 if not found; raises 403 if the notification belongs to a
    different user (IDOR protection).
    """
    notification: Optional[Notification] = (
        db.query(Notification)
        .filter(Notification.id == notification_id)
        .first()
    )
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
    db.commit()
    db.refresh(notification)
    return notification


def get_unread_count(user: User, db: Session) -> int:
    """Return the count of unread notifications for *user*."""
    return (
        db.query(Notification)
        .filter(
            Notification.user_id == user.id,
            Notification.is_read == False,  # noqa: E712
        )
        .count()
    )
