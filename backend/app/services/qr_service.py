"""
QR service: issue signed tokens and verify them.

Security Notes:
  - Signed token = HMAC-SHA256 — opaque, never contains raw consumer data.
  - 15-minute TTL enforced server-side.
  - Only one active QR per user at a time.
"""
from __future__ import annotations

import json
import uuid
import hashlib
import hmac
import time
from datetime import datetime, timedelta, timezone
import io
import base64

import qrcode
from fastapi import HTTPException, status
from sqlalchemy import update, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.qr_code import QrCode
from app.models.user import User


QR_TTL_MINUTES = 15


class QRService:

    def _build_payload(self, user_id: str) -> tuple[str, datetime, datetime]:
        """Build an HMAC-signed payload. Returns (hmac_payload_json, issued_at, expires_at)."""
        now_utc = datetime.now(timezone.utc)
        expires_at = now_utc + timedelta(minutes=QR_TTL_MINUTES)

        # Build the data object to sign
        data = {
            "uid": user_id,
            "iat": int(now_utc.timestamp()),
            "exp": int(expires_at.timestamp()),
        }
        data_str = json.dumps(data, sort_keys=True)

        # HMAC-SHA256 signature
        secret = settings.qr_hmac_secret.encode()
        sig = hmac.new(secret, data_str.encode(), hashlib.sha256).hexdigest()
        data["sig"] = sig

        return json.dumps(data), now_utc, expires_at

    async def issue(self, db: AsyncSession, user: User) -> dict:
        """Invalidate old tokens and issue a fresh signed QR."""
        # Deactivate all previous QRs for this user
        await db.execute(
            update(QrCode)
            .where(QrCode.user_id == user.id, QrCode.is_active == True)  # noqa
            .values(is_active=False)
        )

        hmac_payload, issued_at, expires_at = self._build_payload(str(user.id))

        qr_record = QrCode(
            user_id=user.id,
            hmac_payload=hmac_payload,
            issued_at=issued_at,
            expires_at=expires_at,
            is_active=True,
        )
        db.add(qr_record)
        await db.flush()

        # Generate QR image as base64 PNG
        qr_img = qrcode.make(hmac_payload)
        buf = io.BytesIO()
        qr_img.save(buf, format="PNG")
        qr_b64 = base64.b64encode(buf.getvalue()).decode()

        return {
            "id": qr_record.id,
            "hmac_payload": hmac_payload,
            "issued_at": issued_at,
            "expires_at": expires_at,
            "qr_image_base64": qr_b64,
        }

    async def verify(self, db: AsyncSession, hmac_payload: str) -> User:
        """Verify QR payload and return the user. Marks QR as inactive."""
        bad = HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid or expired QR code",
        )

        try:
            data = json.loads(hmac_payload)
            provided_sig = data.pop("sig", None)
            if not provided_sig:
                raise bad
            data_str = json.dumps(data, sort_keys=True)
            secret = settings.qr_hmac_secret.encode()
            expected_sig = hmac.new(secret, data_str.encode(), hashlib.sha256).hexdigest()
            if not hmac.compare_digest(expected_sig, provided_sig):
                raise bad
        except (json.JSONDecodeError, Exception):
            raise bad

        # Check expiry
        if data.get("exp", 0) < time.time():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="QR code expired",
            )

        # Fetch from DB
        result = await db.execute(
            select(QrCode).where(QrCode.hmac_payload == hmac_payload, QrCode.is_active == True)  # noqa
        )
        record = result.scalar_one_or_none()
        if not record:
            raise bad

        record.is_active = False
        await db.flush()

        from app.models.user import User
        user_result = await db.execute(
            select(User).where(User.id == record.user_id)
        )
        return user_result.scalar_one()
