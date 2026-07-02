"""QrCode model — signed QR payload for shop verification.

Security design:
- The QR payload is an HMAC-signed JSON blob: { user_id, issued_at, expires_at, sig }.
- RAW PERSONAL DATA (name, Aadhaar, phone) is NEVER embedded in the QR.
- The shop operator module (future) will POST the payload to /api/qr/verify,
  which re-computes the HMAC and checks expiry server-side.
- A new QR is generated on demand; old ones are invalidated by `is_active=False`.
- Expiry: configurable, default 30 minutes (QR_TTL_SECONDS in settings).
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

    # The HMAC-signed payload stored as a JSON string.
    # Shape: {"uid": "<uuid>", "iat": <unix_ts>, "exp": <unix_ts>, "sig": "<hex>"}
    # This is what gets encoded into the QR image.
    hmac_payload: Mapped[str] = mapped_column(Text, nullable=False)

    # Convenience columns derived from the payload (for server-side expiry checks)
    issued_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )

    # Only one active QR per user at a time.
    # Generating a new QR deactivates all previous ones for this user.
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

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
