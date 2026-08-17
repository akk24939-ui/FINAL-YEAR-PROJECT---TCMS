"""DoctorRestriction model — clinician-issued purchase restrictions.

Separate from SelfRestriction (consumer-controlled cooling-off limits).
These restrictions are issued by a verified doctor and enforced at the
shop operator's purchase-verification endpoint.

Lifecycle:
  active   → cancelled (by issuing doctor OR any admin, with logged reason)
  active   → expired   (auto, by scheduler job when end_date passes)
  permanent restrictions never auto-expire — only cancellable.
"""
import uuid
import enum
from datetime import datetime
from typing import Optional

from sqlalchemy import String, DateTime, ForeignKey, func, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


class RestrictionCategory(str, enum.Enum):
    LIVER_DISEASE          = "liver_disease"
    ADDICTION_RISK         = "addiction_risk"
    MEDICATION_INTERACTION = "medication_interaction"
    PREGNANCY              = "pregnancy"
    OTHER                  = "other"


class RestrictionType(str, enum.Enum):
    TEMPORARY  = "temporary"
    PERMANENT  = "permanent"


class RestrictionStatus(str, enum.Enum):
    ACTIVE    = "active"
    CANCELLED = "cancelled"
    EXPIRED   = "expired"


class DoctorRestriction(Base):
    __tablename__ = "doctor_restrictions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # ── Parties ────────────────────────────────────────────────────────────────
    patient_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    doctor_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ── Clinical data ──────────────────────────────────────────────────────────
    # reason = doctor's full clinical note — NEVER exposed to operator/public
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    # reason_category = safe enum shown to consumer and operator (no clinical detail)
    reason_category: Mapped[str] = mapped_column(
        String(50), nullable=False, default=RestrictionCategory.OTHER.value
    )

    # ── Lifecycle ──────────────────────────────────────────────────────────────
    restriction_type: Mapped[str] = mapped_column(
        String(20), nullable=False, default=RestrictionType.TEMPORARY.value
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default=RestrictionStatus.ACTIVE.value, index=True
    )
    start_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    # end_date = NULL for permanent restrictions
    end_date: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )

    # ── Cancellation ──────────────────────────────────────────────────────────
    cancelled_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    cancelled_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    cancellation_reason: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True
    )

    # ── Timestamps ─────────────────────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # ── Relationships ──────────────────────────────────────────────────────────
    patient: Mapped["User"] = relationship(
        "User", foreign_keys=[patient_user_id], back_populates="doctor_restrictions_received"
    )
    doctor: Mapped["User"] = relationship(
        "User", foreign_keys=[doctor_user_id], back_populates="doctor_restrictions_issued"
    )
    canceller: Mapped[Optional["User"]] = relationship(
        "User", foreign_keys=[cancelled_by]
    )

    def __repr__(self) -> str:
        return (
            f"<DoctorRestriction patient={self.patient_user_id} "
            f"type={self.restriction_type} status={self.status}>"
        )
