"""User model — enhanced for Consumer Module.

Changes from v1:
- Added OTP fields (hashed, single-use, time-boxed, lockout)
- Added refresh_token_hash for server-side rotation validation
- Added last_login_ip for audit trail
- Removed inline UserRole enum (moved to role.py / user_role.py for RBAC table)
- Kept backward-compat `role` column as a denormalised fast-read field
"""
import uuid
import enum
from datetime import datetime
from typing import Optional

from sqlalchemy import String, Boolean, DateTime, Enum as SAEnum, Integer, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


class UserRole(str, enum.Enum):
    """Denormalised role — also stored in user_roles join table for RBAC."""
    CONSUMER = "CONSUMER"
    OPERATOR = "OPERATOR"
    ADMIN = "ADMIN"
    DOCTOR = "DOCTOR"
    CARETAKER = "CARETAKER"


class User(Base):
    __tablename__ = "users"

    # ── Primary key ────────────────────────────────────────────────────────────
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # ── Identity fields ────────────────────────────────────────────────────────
    email: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )
    # mobile used as a login identifier (optional — consumer may use it)
    mobile_number: Mapped[Optional[str]] = mapped_column(
        String(15), unique=True, nullable=True, index=True
    )
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)

    # ── Role (denormalised for fast JWT validation) ────────────────────────────
    role: Mapped[UserRole] = mapped_column(
        SAEnum(UserRole), default=UserRole.CONSUMER, nullable=False
    )

    # ── Status ─────────────────────────────────────────────────────────────────
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)

    # ── OTP fields (hashed at rest, single-use) ────────────────────────────────
    otp_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    otp_expires_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    otp_attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    otp_used: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # ── Account lockout (after N failed OTP/login attempts) ───────────────────
    locked_until: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    failed_login_attempts: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False
    )

    # ── Refresh token (hashed for server-side rotation) ───────────────────────
    # We store only a bcrypt hash of the refresh token so even DB access can't
    # replay a stolen refresh token.
    refresh_token_hash: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True
    )

    # ── Audit helpers ──────────────────────────────────────────────────────────
    last_login_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_login_ip: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)

    # ── Timestamps ─────────────────────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # ── Relationships ──────────────────────────────────────────────────────────
    consumer_profile: Mapped[Optional["ConsumerProfile"]] = relationship(
        "ConsumerProfile", back_populates="user", uselist=False,
        cascade="all, delete-orphan"
    )
    user_roles: Mapped[list["UserRole_"]] = relationship(
        "UserRole_", back_populates="user", cascade="all, delete-orphan"
    )
    restrictions: Mapped[list["SelfRestriction"]] = relationship(
        "SelfRestriction", back_populates="user", cascade="all, delete-orphan"
    )
    notifications: Mapped[list["Notification"]] = relationship(
        "Notification", back_populates="user", cascade="all, delete-orphan"
    )
    qr_codes: Mapped[list["QrCode"]] = relationship(
        "QrCode", back_populates="user", cascade="all, delete-orphan"
    )
    audit_logs: Mapped[list["AuditLog"]] = relationship(
        "AuditLog", back_populates="user"
    )
    # Legacy relationships — kept for other modules
    purchases: Mapped[list["Purchase"]] = relationship(
        "Purchase", back_populates="consumer", foreign_keys="Purchase.consumer_id"
    )
    operated_shops: Mapped[list["Shop"]] = relationship(
        "Shop", back_populates="operator", foreign_keys="Shop.operator_id"
    )
    alerts: Mapped[list["Alert"]] = relationship(
        "Alert", back_populates="consumer"
    )
    caretaker_links_as_caretaker: Mapped[list["CaretakerLink"]] = relationship(
        "CaretakerLink", back_populates="caretaker",
        foreign_keys="CaretakerLink.caretaker_id"
    )
    caretaker_links_as_consumer: Mapped[list["CaretakerLink"]] = relationship(
        "CaretakerLink", back_populates="consumer",
        foreign_keys="CaretakerLink.consumer_id"
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email} role={self.role}>"
