from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel

from app.models.notification import NotificationType, NotificationCategory


class NotificationResponse(BaseModel):
    """Notification returned to the client."""
    id: UUID
    notification_type: NotificationType
    category: NotificationCategory
    title: str
    message: str
    is_read: bool
    read_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class UnreadCountResponse(BaseModel):
    unread_count: int
