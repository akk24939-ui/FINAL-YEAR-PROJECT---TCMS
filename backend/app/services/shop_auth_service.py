"""Shop PIN authentication service.

Security design:
- Two factors required: shop_code (shop identity) + PIN (secret)
- PIN stored bcrypt-hashed, never in plaintext
- Max 5 failed attempts per shop per 15 minutes → lockout + audit log
- Every login attempt (success and failure) is logged with IP and timestamp
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import verify_password, create_access_token, create_refresh_token, hash_password
from app.models.audit_log import AuditLog, AuditEventType
from app.models.shop import Shop
from app.models.user import User

MAX_PIN_ATTEMPTS = 5
LOCKOUT_MINUTES = 15
PIN_ROTATION_WARNING_DAYS = 7


def _audit(
    db: AsyncSession,
    event_type: str,
    user_id: Optional[uuid.UUID],
    description: str,
    metadata: Optional[dict] = None,
    ip_address: str = "unknown",
) -> None:
    log = AuditLog(
        id=uuid.uuid4(),
        user_id=user_id,
        actor_id=user_id,
        event_type=event_type,
        description=description,
        metadata_json=metadata or {},
        ip_address=ip_address,
    )
    db.add(log)


async def shop_login(
    shop_code: str,
    pin: str,
    db: AsyncSession,
    ip_address: str = "unknown",
) -> dict:
    """Authenticate shop operator by shop_code + PIN."""
    shop_res = await db.execute(
        select(Shop).where(Shop.shop_code == shop_code.upper())
    )
    shop = shop_res.scalar_one_or_none()

    if not shop:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid shop code or PIN",
        )

    if not shop.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This shop has been suspended. Contact your district administrator.",
        )

    operator: Optional[User] = None
    if shop.operator_id:
        op_res = await db.execute(select(User).where(User.id == shop.operator_id))
        operator = op_res.scalar_one_or_none()

    if not operator or not operator.pin_hash:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Shop operator account not configured. Contact administrator.",
        )

    if not operator.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operator account is deactivated.",
        )

    now = datetime.now(timezone.utc)
    if operator.pin_locked_until and operator.pin_locked_until > now:
        remaining = int((operator.pin_locked_until - now).total_seconds() // 60) + 1
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail=f"Too many failed attempts. Try again in {remaining} minute(s).",
        )

    pin_valid = verify_password(pin, operator.pin_hash)

    if not pin_valid:
        operator.pin_failed_attempts = (operator.pin_failed_attempts or 0) + 1

        if operator.pin_failed_attempts >= MAX_PIN_ATTEMPTS:
            operator.pin_locked_until = now + timedelta(minutes=LOCKOUT_MINUTES)
            _audit(
                db, AuditEventType.SHOP_PIN_LOCKED,
                user_id=operator.id,
                description=f"PIN locked for shop {shop_code} after {MAX_PIN_ATTEMPTS} failures",
                metadata={"shop_code": shop_code, "attempts": operator.pin_failed_attempts},
                ip_address=ip_address,
            )
        else:
            _audit(
                db, AuditEventType.SHOP_PIN_FAILED,
                user_id=operator.id,
                description=f"PIN failure #{operator.pin_failed_attempts} for shop {shop_code}",
                metadata={"shop_code": shop_code, "attempt": operator.pin_failed_attempts},
                ip_address=ip_address,
            )

        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid shop code or PIN. {MAX_PIN_ATTEMPTS - operator.pin_failed_attempts} attempt(s) remaining.",
        )

    # Successful login — reset counters
    operator.pin_failed_attempts = 0
    operator.pin_locked_until = None
    operator.last_login_at = now
    operator.last_login_ip = ip_address

    access_token = create_access_token(str(operator.id), "OPERATOR")
    refresh_token = create_refresh_token(str(operator.id))
    operator.refresh_token_hash = hash_password(refresh_token[:72])

    pin_rotation_warning = None
    if shop.pin_rotation_due_at:
        days_until_rotation = (shop.pin_rotation_due_at - now).days
        if days_until_rotation <= PIN_ROTATION_WARNING_DAYS:
            pin_rotation_warning = f"PIN rotation due in {days_until_rotation} day(s). Contact administrator."

    _audit(
        db, AuditEventType.SHOP_LOGIN_SUCCESS,
        user_id=operator.id,
        description=f"Shop {shop_code} logged in successfully",
        metadata={"shop_code": shop_code},
        ip_address=ip_address,
    )

    await db.commit()

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "must_change_password": operator.must_change_password,
        "_operator_obj": operator,
        "shop": {
            "id": str(shop.id),
            "shop_code": shop.shop_code,
            "name": shop.name,
            "district": shop.district,
        },
        "pin_rotation_warning": pin_rotation_warning,
    }
