"""ConsumerLimits model — stores the consumer's self-set drink limits.

Separate from SelfRestriction (which handles lock/unlock logic).
This table stores the current *active* limit values in standard drinks,
plus the consumer's beverage preference as a JSON array.

Standard drink reference (PRD §6):
  Beer    330 ml = 1 standard drink
  Wine    150 ml = 1 standard drink
  Spirits  40 ml = 1 standard drink
"""
import uuid
from datetime import datetime
from typing import Optional, List

from sqlalchemy import Float, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB

from app.core.database import Base


class ConsumerLimits(Base):
    __tablename__ = "consumer_limits"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # FK → consumers(id) — one limits record per consumer profile
    consumer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("consumers.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )

    # ── Limits in standard drinks (0.0 = no limit set) ───────────────────────
    daily_limit_sd: Mapped[float] = mapped_column(
        Float, default=0.0, nullable=False, server_default="0"
    )
    weekly_limit_sd: Mapped[float] = mapped_column(
        Float, default=0.0, nullable=False, server_default="0"
    )
    monthly_limit_sd: Mapped[float] = mapped_column(
        Float, default=0.0, nullable=False, server_default="0"
    )

    # ── Beverage preference — stored as JSON array of strings ─────────────────
    # e.g. ["BEER", "WINE"] — drives ml-equivalent labels in the UI.
    # Using JSONB for efficient querying.
    beverage_preference: Mapped[Optional[List[str]]] = mapped_column(
        JSONB, nullable=True, server_default="'[]'::jsonb"
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # ── Relationship ───────────────────────────────────────────────────────────
    consumer: Mapped["ConsumerProfile"] = relationship(
        "ConsumerProfile", back_populates="limits"
    )

    def __repr__(self) -> str:
        return (
            f"<ConsumerLimits consumer={self.consumer_id} "
            f"daily={self.daily_limit_sd} weekly={self.weekly_limit_sd}>"
        )
