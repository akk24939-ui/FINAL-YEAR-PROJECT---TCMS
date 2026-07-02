"""AuditLog model — immutable append-only security audit trail.

Writes one row per security-relevant event. This table is NEVER updated or
deleted programmatically (no CASCADE deletes, no UPDATE queries).

Events logged (event_type values):
  consumer_registered  — new account created
  login_success        — successful authentication
  login_failed         — wrong password / OTP fail
  otp_sent             — OTP generated and dispatched
  otp_verified         — OTP successfully verified
  account_locked       — too many failed attempts
  logout               — explicit sign-out
  limit_changed        — daily/weekly/monthly limits updated
  limit_increase_requested — cooling-off period started
  limit_increase_confirmed — cooling-off passed, limits raised
  teetotaler_enabled   — teetotaler mode turned on
  teetotaler_disabled  — teetotaler mode turned off
  self_restriction_locked   — lock applied
  self_restriction_unlocked — lock lifted
  qr_generated         — QR code generated
  pdf_downloaded       — PDF report downloaded
  photo_uploaded       — profile photo updated
  profile_updated      — other profile field changed

Security notes:
- No PII in `metadata_json` — only structural data (e.g. limit old/new value).
- IP is stored for intrusion detection; hashed if GDPR-strict mode required.
- user_id is nullable for pre-auth events (e.g. failed login with unknown email).
"""
import uuid
import enum
from datetime import datetime
from typing import Optional

from sqlalchemy import String, Text, DateTime, ForeignKey, func, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB

from app.core.database import Base


class AuditEventType(str, enum.Enum):
    CONSUMER_REGISTERED = "consumer_registered"
    LOGIN_SUCCESS = "login_success"
    LOGIN_FAILED = "login_failed"
    OTP_SENT = "otp_sent"
    OTP_VERIFIED = "otp_verified"
    ACCOUNT_LOCKED = "account_locked"
    LOGOUT = "logout"
    LIMIT_CHANGED = "limit_changed"
    LIMIT_INCREASE_REQUESTED = "limit_increase_requested"
    LIMIT_INCREASE_CONFIRMED = "limit_increase_confirmed"
    TEETOTALER_ENABLED = "teetotaler_enabled"
    TEETOTALER_DISABLED = "teetotaler_disabled"
    SELF_RESTRICTION_LOCKED = "self_restriction_locked"
    SELF_RESTRICTION_UNLOCKED = "self_restriction_unlocked"
    QR_GENERATED = "qr_generated"
    PDF_DOWNLOADED = "pdf_downloaded"
    PHOTO_UPLOADED = "photo_uploaded"
    PROFILE_UPDATED = "profile_updated"
    TOKEN_REFRESHED = "token_refreshed"


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # Nullable so pre-auth failures (wrong email) can still be logged.
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    event_type: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )

    # Human-readable summary (no PII)
    description: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Structured metadata — structural data only, never PII.
    # Example: {"old_daily": 2.0, "new_daily": 3.0}
    metadata_json: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    # Network / session context (for intrusion detection)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    session_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)

    # Immutable timestamp — server-side only, cannot be set by client
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )

    # Relationship (no cascade delete — audit records are permanent)
    user: Mapped[Optional["User"]] = relationship("User", back_populates="audit_logs")

    def __repr__(self) -> str:
        return (
            f"<AuditLog event={self.event_type} "
            f"user={self.user_id} at={self.created_at}>"
        )
