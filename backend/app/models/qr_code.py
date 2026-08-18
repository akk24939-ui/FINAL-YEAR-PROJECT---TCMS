"""QrCode model — permanent HMAC-signed QR for shop verification.

Security design (v2 — permanent QR):
- Payload shape: {"cid": "<aadhaar_reference_id>", "sig": "<HMAC-SHA256>"}
- No iat/exp in the QR — QR does not expire on its own.
- 'cid' is HMAC-SHA256 of the consumer’s Aadhaar number — non-reversible.
- RAW PERSONAL DATA (name, Aadhaar, phone) is NEVER embedded in the QR.
- Compensating controls: scan rate-limit per cid, full audit log, consumer-initiated revocation.
- Revocation: consumer can regenerate QR (old cid blacklisted, new row issued).
- One active QR per user at a time (is_active=True, is_revoked=False).
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Text, Boolean, DateTime, ForeignKey, func, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


class QrCode(Base):
    __tablename__ = "qr_codes"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ── Permanent consumer reference ID (v2) ──────────────────────────────────
    # HMAC-SHA256 of consumer's Aadhaar (= ConsumerProfile.aadhaar_reference_id).
    # This is the 'cid' embedded in the QR payload. Non-reversible, permanent.
    consumer_reference_id: Mapped[Optional[str]] = mapped_column(
        String(64), nullable=True, index=True
    )

    # The HMAC-signed payload stored as a JSON string.
    # v2 shape: {"cid": "<aadhaar_reference_id>", "sig": "<HMAC-hex>"}
    # v1 shape (legacy): {"uid": "<uuid>", "iat": <ts>, "exp": <ts>, "sig": "<hex>"}
    hmac_payload: Mapped[str] = mapped_column(Text, nullable=False)

    # Issued-at timestamp (informational; no expiry logic for v2 QRs).
    issued_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    # expires_at kept for DB compatibility; set to year 2099 for new v2 QRs (never expires).
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )

    # Only one active, non-revoked QR per user at a time.
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Revocation — consumer can request QR regeneration as a security action.
    # Revoked QRs are permanently blacklisted.
    is_revoked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    revoked_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Optional: which IP requested this QR (for audit).
    requested_from_ip: Mapped[Optional[str]] = mapped_column(
        String(45), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationship
    user: Mapped["User"] = relationship("User", back_populates="qr_codes")

    def __repr__(self) -> str:
        return (
            f"<QrCode user={self.user_id} "
            f"expires={self.expires_at} active={self.is_active}>"
        )
