"""ConsumerProfile model.

Security notes:
- aadhaar_encrypted: Fernet-encrypted blob. The raw 12-digit number is NEVER
  stored in plaintext. Only the last 4 digits are returned in API responses.
- photo_path: only a file system path is stored, not the binary.
  The image is validated (MIME + size) and EXIF-stripped before saving.
- dob: stored as Date; age is re-verified server-side on registration.
- teetotaler_flag: when True, the purchase endpoint rejects at DB/service level,
  not just at the UI level — the UI cannot bypass this.
"""
import uuid
import enum
from datetime import date, datetime
from typing import Optional

from sqlalchemy import (
    String, Boolean, Date, DateTime, Enum as SAEnum,
    ForeignKey, Text, func
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


class Gender(str, enum.Enum):
    MALE = "MALE"
    FEMALE = "FEMALE"
    OTHER = "OTHER"
    PREFER_NOT_TO_SAY = "PREFER_NOT_TO_SAY"


class BeveragePreference(str, enum.Enum):
    BEER = "BEER"
    WINE = "WINE"
    SPIRITS = "SPIRITS"
    MIXED = "MIXED"
    NONE = "NONE"


class ConsumerProfile(Base):
    __tablename__ = "consumers"

    # ── Primary key ────────────────────────────────────────────────────────────
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # ── Foreign key → users ────────────────────────────────────────────────────
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,   # one profile per user
        nullable=False,
        index=True,
    )

    # ── Aadhaar reference (HMAC-SHA256, permanent, non-reversible) ──────────────
    # HMAC-SHA256(aadhaar_number, SERVER_SECRET) — stored instead of raw Aadhaar.
    # Deterministic: same Aadhaar → same cid. Non-reversible: DB breach can’t recover Aadhaar.
    # Used as the QR payload 'cid' and as the primary consumer lookup key.
    # Per DPDP Act 2023 / Aadhaar Act 2016 data-minimization requirements.
    aadhaar_reference_id: Mapped[Optional[str]] = mapped_column(
        String(64), nullable=True, unique=True, index=True
    )

    # Last 4 digits of Aadhaar — for display/support purposes only (e.g. XXXX-XXXX-1234).
    # NEVER the full 12-digit number.
    aadhaar_last4: Mapped[Optional[str]] = mapped_column(String(4), nullable=True)

    # ── Mock Aadhaar (Fernet-encrypted at rest) — kept for login-by-Aadhaar lookup ──
    # NEVER store raw number; NEVER return more than last 4 digits via API.
    aadhaar_encrypted: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True
    )

    # ── Personal details ───────────────────────────────────────────────────────
    dob: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    gender: Mapped[Optional[Gender]] = mapped_column(
        SAEnum(Gender), nullable=True
    )
    district: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # ── Extended profile ───────────────────────────────────────────────────────
    blood_group: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)  # A+, B-, O+, etc.
    emergency_contact_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    emergency_contact_phone: Mapped[Optional[str]] = mapped_column(String(15), nullable=True)

    # ── Profile photo ──────────────────────────────────────────────────────────
    # Relative path within the upload directory. EXIF stripped before save.
    photo_path: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)

    # ── Drinking preferences ───────────────────────────────────────────────────
    beverage_preference: Mapped[BeveragePreference] = mapped_column(
        SAEnum(BeveragePreference),
        default=BeveragePreference.NONE,
        nullable=False,
    )

    # ── Teetotaler flag — enforced at API/service level ───────────────────────
    is_teetotaler: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    teetotaler_set_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # ── Timestamps ─────────────────────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # ── Relationships ───────────────────────────────────────────────────────
    user: Mapped["User"] = relationship("User", back_populates="consumer_profile")
    restrictions: Mapped[list["SelfRestriction"]] = relationship(
        "SelfRestriction", back_populates="consumer", cascade="all, delete-orphan"
    )
    limits: Mapped["ConsumerLimits | None"] = relationship(
        "ConsumerLimits", back_populates="consumer", uselist=False, cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<ConsumerProfile user_id={self.user_id} teetotaler={self.is_teetotaler}>"
