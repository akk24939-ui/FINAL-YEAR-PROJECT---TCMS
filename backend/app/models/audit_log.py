"""AuditLog model — immutable append-only security audit trail.

Extended for Admin Module with:
- actor_id: the admin who performed an action on another user (target = user_id)
- New event types for all admin operations
"""
import uuid
import enum
from datetime import datetime
from typing import Optional

from sqlalchemy import String, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB

from app.core.database import Base


class AuditEventType(str, enum.Enum):
    # Consumer events
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
    # Admin — shop management
    ADMIN_CREATED_SHOP = "admin_created_shop"
    ADMIN_RESET_PIN = "admin_reset_pin"
    ADMIN_SUSPENDED_SHOP = "admin_suspended_shop"
    ADMIN_REACTIVATED_SHOP = "admin_reactivated_shop"
    SHOP_PIN_FAILED = "shop_pin_failed"
    SHOP_PIN_LOCKED = "shop_pin_locked"
    SHOP_LOGIN_SUCCESS = "shop_login_success"
    # Admin — doctor management
    ADMIN_CREATED_DOCTOR = "admin_created_doctor"
    ADMIN_ACTIVATED_DOCTOR = "admin_activated_doctor"
    ADMIN_DEACTIVATED_DOCTOR = "admin_deactivated_doctor"
    ADMIN_REVOKED_DOCTOR = "admin_revoked_doctor"
    DOCTOR_LOGIN_SUCCESS = "doctor_login_success"
    # Admin — global config
    ADMIN_UPDATED_GLOBAL_LIMITS = "admin_updated_global_limits"
    ADMIN_UPDATED_CONFIG = "admin_updated_config"
    # Admin — operator password management
    ADMIN_TEMP_PASSWORD_ISSUED = "admin_temp_password_issued"
    OPERATOR_PASSWORD_CHANGED = "operator_password_changed"
    SHOP_LOGIN_MUST_CHANGE = "shop_login_must_change"
    # Token
    TOKEN_REVOKED = "token_revoked"


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # Target user (who this event is about). Nullable for pre-auth failures.
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Actor — the admin who performed an action on the target user.
    # Same as user_id for self-actions (consumer changing own limits etc.)
    actor_id: Mapped[Optional[uuid.UUID]] = mapped_column(
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

    # Structural metadata — never PII.
    # Example: {"old_daily": 2.0, "new_daily": 3.0} or {"shop_code": "TSM-CHE-001"}
    metadata_json: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    # Network context
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    session_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)

    # Immutable timestamp
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )

    # Relationships
    user: Mapped[Optional["User"]] = relationship(
        "User", back_populates="audit_logs", foreign_keys=[user_id]
    )
    actor: Mapped[Optional["User"]] = relationship(
        "User", back_populates="acted_audit_logs", foreign_keys=[actor_id]
    )

    def __repr__(self) -> str:
        return (
            f"<AuditLog event={self.event_type} "
            f"user={self.user_id} actor={self.actor_id} at={self.created_at}>"
        )
