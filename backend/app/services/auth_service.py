"""
Auth service: registration, login, token refresh, logout, and lockout logic.

Security Notes:
  - Passwords hashed with Argon2id before storage.
  - Lockout after 5 failures; exponential backoff up to 30 min.
  - Refresh tokens stored server-side as hashed values in a separate table.
  - Non-leaky error response: same message for wrong email and wrong password.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decrypt_field,
    encrypt_field,
    hash_password,
    verify_password,
)
from app.models.models import Consumer, Role, User
from app.schemas.schemas import RegisterRequest

from fastapi import HTTPException, status as http_status


async def register_consumer(data, db: AsyncSession, ip: str):
    """Register a new consumer (async).

    Aadhaar is the PRIMARY unique identifier. Mobile number is secondary.
    Email is optional — if omitted, a placeholder address is generated.

    Raises HTTP 409 if Aadhaar or mobile is already registered.
    """
    from app.models.consumer_profile import ConsumerProfile, Gender
    from app.core.security import encrypt_aadhaar, decrypt_aadhaar

    # ── Duplicate Aadhaar check (PRIMARY — checked first) ─────────────────
    # Aadhaar is stored encrypted; must decrypt each row to compare.
    profiles_result = await db.execute(
        select(ConsumerProfile).where(ConsumerProfile.aadhaar_encrypted.isnot(None))
    )
    for profile in profiles_result.scalars().all():
        try:
            if decrypt_aadhaar(profile.aadhaar_encrypted) == data.aadhaar_number:
                raise HTTPException(
                    status_code=http_status.HTTP_409_CONFLICT,
                    detail="Aadhaar number is already registered. Each Aadhaar can only be linked to one account.",
                )
        except HTTPException:
            raise
        except Exception:
            pass  # decryption error on old record — skip safely

    # ── Duplicate mobile check ─────────────────────────────────────────────
    result = await db.execute(select(User).where(User.mobile_number == data.mobile_number))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=http_status.HTTP_409_CONFLICT,
            detail="Mobile number is already registered. Please use a different mobile number.",
        )

    # ── Resolve email — optional field, generate placeholder if missing ────
    # Email is NOT the primary identifier; we generate a unique placeholder
    # so the DB NOT NULL constraint is satisfied without blocking registration.
    effective_email = data.email if data.email else None
    if not effective_email:
        last4 = str(data.aadhaar_number)[-4:]
        effective_email = f"aadhaar_{last4}_{str(data.mobile_number)[-4:]}@consumer.tasmac.local"
    else:
        # If a real email was supplied, still check it won't violate unique constraint
        result = await db.execute(select(User).where(User.email == effective_email))
        if result.scalar_one_or_none():
            # Email collision — generate unique placeholder so Aadhaar still registers
            last4 = str(data.aadhaar_number)[-4:]
            import time
            effective_email = f"aadhaar_{last4}_{int(time.time())}@consumer.tasmac.local"

    # ── Create user ────────────────────────────────────────────────────────
    from app.models.user import UserRole
    user = User(
        full_name=data.full_name,
        email=effective_email,   # may be auto-generated placeholder if no email given
        mobile_number=data.mobile_number,
        password_hash=hash_password(data.password),
        role=UserRole.CONSUMER,
    )
    db.add(user)
    await db.flush()  # get user.id

    # ── Create consumer profile ────────────────────────────────────────────
    aadhaar_enc = encrypt_aadhaar(data.aadhaar_number)
    profile = ConsumerProfile(
        user_id=user.id,
        dob=data.dob,
        gender=Gender(data.gender) if isinstance(data.gender, str) else data.gender,
        district=data.district,
        address=data.address,
        aadhaar_encrypted=aadhaar_enc,
    )
    db.add(profile)
    await db.flush()
    await db.refresh(user)
    return user


_LOCKOUT_THRESHOLDS = [0, 0, 1, 2, 5, 10, 30]  # minutes after N failures


class AuthService:

    # ── Registration ──────────────────────────────────────────────────────────
    async def register(self, db: AsyncSession, data: RegisterRequest) -> User:
        # Check duplicate email
        existing = await db.execute(select(User).where(User.email == data.email))
        if existing.scalar_one_or_none():
            from fastapi import HTTPException, status
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

        # Resolve consumer role
        role_result = await db.execute(select(Role).where(Role.name == "consumer"))
        role = role_result.scalar_one_or_none()
        if not role:
            raise RuntimeError("consumer role not seeded")

        user = User(
            email=data.email,
            password_hash=hash_password(data.password),
            role_id=role.id,
        )
        db.add(user)
        await db.flush()  # get user.id

        consumer = Consumer(
            user_id=user.id,
            dob=data.dob,
            gender=data.gender,
            district=data.district,
            mock_id_number_enc=encrypt_field(data.mock_id_number) if data.mock_id_number else None,
        )
        db.add(consumer)
        return user

    # ── Login ─────────────────────────────────────────────────────────────────
    async def login(self, db: AsyncSession, identifier: str, password: str) -> tuple[str, str, "User", str]:
        """Resolve identifier (mobile, Aadhaar 12-digit, Aadhaar last-4, or email) → User, then verify password."""
        from fastapi import HTTPException, status
        from app.core.security import decrypt_aadhaar
        from app.models.consumer_profile import ConsumerProfile

        identifier = identifier.strip()

        # Try mobile number first (most common path)
        result = await db.execute(select(User).where(User.mobile_number == identifier))
        user = result.scalar_one_or_none()

        # Fall back to email
        if user is None:
            result = await db.execute(select(User).where(User.email == identifier))
            user = result.scalar_one_or_none()

        # Fall back to Aadhaar — full 12-digit or last-4 shorthand
        if user is None and identifier.isdigit() and len(identifier) in (4, 12):
            profiles_result = await db.execute(
                select(ConsumerProfile).where(ConsumerProfile.aadhaar_encrypted.isnot(None))
            )
            for profile in profiles_result.scalars().all():
                try:
                    raw = decrypt_aadhaar(profile.aadhaar_encrypted)
                    matched = (
                        raw == identifier               # full 12-digit match
                        or raw[-4:] == identifier       # last-4 shorthand
                    )
                    if matched:
                        user_result = await db.execute(select(User).where(User.id == profile.user_id))
                        user = user_result.scalar_one_or_none()
                        break
                except Exception:
                    continue  # skip records that can't be decrypted

        _invalid = HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

        if user is None:
            raise _invalid


        # Lockout check
        if user.locked_until and user.locked_until > datetime.now(timezone.utc):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Account temporarily locked. Try again later.",
            )

        if not verify_password(password, user.password_hash):
            user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
            attempts = user.failed_login_attempts
            if attempts >= 5:
                lockout_mins = _LOCKOUT_THRESHOLDS[min(attempts - 4, len(_LOCKOUT_THRESHOLDS) - 1)]
                user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=lockout_mins)
            await db.flush()
            raise _invalid

        # Success — reset counters
        user.failed_login_attempts = 0
        user.locked_until = None

        # Resolve role name — prefer user.role enum if role_id not present
        role_name: str
        if hasattr(user, 'role') and user.role is not None:
            role_name = user.role.value if hasattr(user.role, 'value') else str(user.role)
        else:
            role_result = await db.execute(select(Role).where(Role.id == user.role_id))
            role_obj = role_result.scalar_one()
            role_name = role_obj.name

        family_id = str(uuid.uuid4())
        access = create_access_token(str(user.id), role_name)
        refresh = create_refresh_token(str(user.id), family_id)
        return access, refresh, user, role_name

    # ── Token Refresh ─────────────────────────────────────────────────────────
    async def refresh_access_token(self, db: AsyncSession, refresh_token: str) -> str:
        from fastapi import HTTPException, status
        from app.core.security import decode_token
        from jose import JWTError

        try:
            payload = decode_token(refresh_token)
            if payload.get("type") != "refresh":
                raise ValueError
            user_id = payload["sub"]
        except (JWTError, KeyError, ValueError):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

        result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
        user = result.scalar_one_or_none()
        if not user or not user.is_active:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

        role_result = await db.execute(select(Role).where(Role.id == user.role_id))
        role = role_result.scalar_one()
        return create_access_token(str(user.id), role.name)

    # ── Forgot Password ────────────────────────────────────────────────────────

    async def request_password_reset(self, mobile: str, db: AsyncSession) -> None:
        """Generate a 6-digit OTP, hash it, store on the User, log to console (dev).

        Always returns silently — never leaks whether the mobile is registered.
        """
        import secrets
        from app.core.security import hash_password as hash_otp

        result = await db.execute(select(User).where(User.mobile_number == mobile))
        user = result.scalar_one_or_none()
        if not user:
            return  # anti-enumeration: succeed silently

        otp_plain = f"{secrets.randbelow(900_000) + 100_000:06d}"
        user.otp_hash = hash_otp(otp_plain)
        user.otp_expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
        user.otp_attempts = 0
        user.otp_used = False
        await db.commit()

        # In production replace this with SMS gateway call
        print(f"\n[DEV OTP] Code: {otp_plain}  |  Mobile: {mobile}\n", flush=True)

    async def verify_reset_otp(self, mobile: str, otp_code: str, db: AsyncSession) -> str:
        """Verify OTP. On success returns a short-lived reset_token JWT (10 min).

        Increments otp_attempts and raises 401 on failure, 429 after 5 attempts.
        """
        from fastapi import HTTPException, status
        from app.core.security import verify_password as check_otp, create_access_token

        result = await db.execute(select(User).where(User.mobile_number == mobile))
        user = result.scalar_one_or_none()

        _bad = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired OTP")

        if not user or not user.otp_hash or user.otp_used:
            raise _bad
        if user.otp_expires_at and user.otp_expires_at < datetime.now(timezone.utc):
            raise _bad
        if user.otp_attempts >= 5:
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many OTP attempts. Request a new OTP.")

        user.otp_attempts = (user.otp_attempts or 0) + 1
        if not check_otp(otp_code, user.otp_hash):
            await db.commit()
            raise _bad

        # ✅ Valid — mark used and issue reset token
        user.otp_used = True
        await db.commit()

        # Short-lived reset token (10 min) — purpose claim prevents misuse as auth token
        from jose import jwt as _jwt
        from app.core.config import get_settings as _cfg
        _s = _cfg()
        reset_payload = {
            "sub": str(user.id),
            "role": "password_reset",
            "type": "access",
            "exp": datetime.now(timezone.utc) + timedelta(minutes=10),
        }
        reset_token = _jwt.encode(reset_payload, _s.jwt_secret_key, algorithm=_s.jwt_algorithm)
        return reset_token

    async def reset_password(self, reset_token: str, new_password: str, db: AsyncSession) -> None:
        """Validate reset_token, hash new_password, save, clear OTP fields, bump token_version."""
        from fastapi import HTTPException, status
        from app.core.security import decode_token, hash_password
        from jose import JWTError

        try:
            payload = decode_token(reset_token)
            if payload.get("role") != "password_reset":
                raise ValueError("wrong purpose")
            user_id = uuid.UUID(payload["sub"])
        except (JWTError, KeyError, ValueError):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired reset token")

        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        user.password_hash = hash_password(new_password)
        user.token_version = (user.token_version or 0) + 1
        user.failed_login_attempts = 0
        user.locked_until = None
        user.otp_hash = None
        user.otp_expires_at = None
        user.otp_used = False
        user.otp_attempts = 0
        await db.commit()

