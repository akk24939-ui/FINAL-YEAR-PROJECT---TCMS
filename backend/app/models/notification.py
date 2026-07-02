"""Notification model — in-app alerts for consumers.

Used for:
- 80% limit reached  → WARN
- 100% limit reached → DANGER
- Teetotaler mode activated/deactivated → INFO
- Self-restriction lock applied/expired → INFO
- Pending increase confirmed → INFO
"""
import uuid
import enum
from datetime import datetime
from typing import Optional

from sqlalchemy import String, Text, Boolean, DateTime, Enum as SAEnum, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


class NotificationType(str, enum.Enum):
    INFO = "INFO"
    WARN = "WARN"
    DANGER = "DANGER"
    SUCCESS = "SUCCESS"


class NotificationCategory(str, enum.Enum):
    LIMIT_WARNING = "LIMIT_WARNING"        # approaching limit
    LIMIT_EXCEEDED = "LIMIT_EXCEEDED"      # at or over limit
    TEETOTALER = "TEETOTALER"              # mode change
    SELF_RESTRICTION = "SELF_RESTRICTION"  # lock/unlock/increase
    SYSTEM = "SYSTEM"                      # generic platform notices


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    notification_type: Mapped[NotificationType] = mapped_column(
        SAEnum(NotificationType), nullable=False, default=NotificationType.INFO
    )
    category: Mapped[NotificationCategory] = mapped_column(
        SAEnum(NotificationCategory),
        nullable=False,
        default=NotificationCategory.SYSTEM,
    )

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)

    # Marks when the user dismissed/read the notification
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    read_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )

    # Relationship
    user: Mapped["User"] = relationship("User", back_populates="notifications")

    def __repr__(self) -> str:
        return (
            f"<Notification user={self.user_id} "
            f"type={self.notification_type} read={self.is_read}>"
        )
