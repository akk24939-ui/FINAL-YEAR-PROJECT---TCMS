"""QR service — signed QR code generation.

Security design:
- QR payload is an HMAC-SHA256-signed JSON blob.
- RAW personal data (name, Aadhaar, phone) is NEVER embedded in the QR.
- Only one active QR per user at a time; previous ones are deactivated on each request.
- The QR image is returned as a base64-encoded PNG string so nothing is written to disk.
"""
from __future__ import annotations

import base64
import io
from datetime import datetime, timedelta, timezone
from typing import Optional

import qrcode  # type: ignore[import]
from fastapi import Request
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import create_qr_payload
from app.models.audit_log import AuditEventType, AuditLog
from app.models.qr_code import QrCode
from app.models.user import User


def _write_audit(
    db: Session,
    event_type: AuditEventType,
    *,
    user_id,
    description: Optional[str] = None,
    ip_address: Optional[str] = None,
) -> None:
    try:
        log = AuditLog(
            user_id=user_id,
            event_type=event_type,
            description=description,
            ip_address=ip_address,
        )
        db.add(log)
        db.flush()
    except Exception:
        pass


def _qr_to_base64_png(payload_str: str) -> str:
    """Generate a QR code image from *payload_str* and return as base64 PNG."""
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=4,
    )
    qr.add_data(payload_str)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return base64.b64encode(buf.read()).decode("utf-8")


def generate_qr(
    user: User,
    request: Request,
    db: Session,
) -> tuple[str, QrCode]:
    """Deactivate old QR codes, generate a new signed QR, persist record.

    Returns:
        (base64_png_image_string, qr_code_db_record)
    """
    client_ip = (
        request.client.host if request.client else "unknown"
    )

    # Deactivate all existing active QR codes for this user
    db.query(QrCode).filter(
        QrCode.user_id == user.id,
        QrCode.is_active == True,  # noqa: E712
    ).update({"is_active": False})
    db.flush()

    # Compute expiry
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(seconds=settings.QR_TTL_SECONDS)

    # Build HMAC-signed payload
    payload_str = create_qr_payload(str(user.id), expires_at)

    # Generate QR image in memory
    base64_image = _qr_to_base64_png(payload_str)

    # Persist QR record
    qr_record = QrCode(
        user_id=user.id,
        hmac_payload=payload_str,
        issued_at=now,
        expires_at=expires_at,
        is_active=True,
        requested_from_ip=client_ip,
    )
    db.add(qr_record)

    _write_audit(
        db,
        AuditEventType.QR_GENERATED,
        user_id=user.id,
        description="QR code generated",
        ip_address=client_ip,
    )

    db.commit()
    db.refresh(qr_record)
    return base64_image, qr_record
