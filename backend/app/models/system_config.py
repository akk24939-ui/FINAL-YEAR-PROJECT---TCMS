"""SystemConfig model — key/value store for system-wide configuration.

Used for admin-controlled global settings including:
  - global_daily_limit_sd   : max daily alcohol limit for ALL consumers (Standard Drinks)
  - global_weekly_limit_sd  : max weekly limit
  - global_monthly_limit_sd : max monthly limit

Consumer self-set limits are always CAPPED at these values.
Admin is the only role allowed to write to this table.
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, Text, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


class SystemConfig(Base):
    __tablename__ = "system_config"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # Unique config key — e.g. "global_daily_limit_sd"
    key: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)

    # JSON-serialisable string value — e.g. "4.0" for 4.0 SD
    value: Mapped[str] = mapped_column(Text, nullable=False)

    # Human-readable description shown in admin UI
    description: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Who last changed this setting
    updated_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    def __repr__(self) -> str:
        return f"<SystemConfig key={self.key} value={self.value}>"
