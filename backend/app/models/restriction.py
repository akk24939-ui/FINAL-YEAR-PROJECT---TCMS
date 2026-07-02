"""SelfRestriction model — consumer-imposed purchase limits with cooling-off enforcement.

Business rules enforced at the DATA LAYER (not just UI):
1. Limits can be DECREASED instantly at any time.
2. Limits can be INCREASED only after a 24-hour cooling-off period:
   - Consumer calls POST /limits/request-increase → sets `pending_increase_*`
     and `lock_requested_at = now()`.
   - Consumer calls POST /limits/confirm-increase after 24h → applies new values.
   - If they cancel or the lock expires, pending values are discarded.
3. `is_locked` = True prevents the operator module (future) from overriding limits.
4. `locked_until` = when a self-restriction lock expires (e.g. consumer locked
   themselves for 30 days; cannot unlock early).

Standard drink reference (from PRD §6):
  Beer    330–355 ml = 1 standard drink
  Wine    140–150 ml = 1 standard drink
  Spirits  30–45  ml = 1 standard drink
  WHO max recommendation: 2/day, 14/week (stored here in ml equivalent)
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Float, Boolean, DateTime, ForeignKey, func, String
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base

# Defaults in STANDARD DRINKS (not ml) for clarity in the model
DEFAULT_DAILY_LIMIT_SD = 2.0
DEFAULT_WEEKLY_LIMIT_SD = 14.0
DEFAULT_MONTHLY_LIMIT_SD = 56.0  # ~4 weeks × 14


class SelfRestriction(Base):
    __tablename__ = "restrictions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # ── Foreign keys ───────────────────────────────────────────────────────────
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,   # one restriction record per user
        nullable=False,
        index=True,
    )
    consumer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("consumers.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )

    # ── Active limits (in standard drinks) ────────────────────────────────────
    daily_limit_sd: Mapped[float] = mapped_column(
        Float, default=DEFAULT_DAILY_LIMIT_SD, nullable=False
    )
    weekly_limit_sd: Mapped[float] = mapped_column(
        Float, default=DEFAULT_WEEKLY_LIMIT_SD, nullable=False
    )
    monthly_limit_sd: Mapped[float] = mapped_column(
        Float, default=DEFAULT_MONTHLY_LIMIT_SD, nullable=False
    )

    # ── Pending increase (waiting for 24h cooling-off) ────────────────────────
    # These fields hold the REQUESTED new values until confirmed.
    pending_daily_limit_sd: Mapped[Optional[float]] = mapped_column(
        Float, nullable=True
    )
    pending_weekly_limit_sd: Mapped[Optional[float]] = mapped_column(
        Float, nullable=True
    )
    pending_monthly_limit_sd: Mapped[Optional[float]] = mapped_column(
        Float, nullable=True
    )
    # Timestamp when the increase request was made — cooling-off starts here
    lock_requested_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # ── Self-restriction lock ──────────────────────────────────────────────────
    # Consumer can lock their limits until this datetime.
    # During lock, limits cannot be increased; only the consumer can unlock
    # after the lock expires.
    is_locked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    locked_until: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    lock_reason: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # ── Timestamps ─────────────────────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # ── Relationships ──────────────────────────────────────────────────────────
    user: Mapped["User"] = relationship("User", back_populates="restrictions")
    consumer: Mapped["ConsumerProfile"] = relationship(
        "ConsumerProfile", back_populates="restrictions"
    )

    def __repr__(self) -> str:
        return (
            f"<SelfRestriction user={self.user_id} "
            f"daily={self.daily_limit_sd} locked={self.is_locked}>"
        )
