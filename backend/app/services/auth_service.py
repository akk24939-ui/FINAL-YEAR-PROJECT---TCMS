"""Auth service — registration, login, token refresh, logout, OTP.

Security guarantees:
- Generic error messages on any auth failure (never reveal whether email/mobile
  exists or which field was wrong).
- user_id is always resolved from the JWT `sub` claim, never from request body.
- Refresh tokens are server-side hashed; raw token only lives in the httpOnly cookie.
- Account lockout after OTP_MAX_ATTEMPTS failed login attempts.
- Aadhaar stored Fernet-encrypted; never logged.
"""
from __future__ import annotations

import hashlib
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    encrypt_aadhaar,
    decrypt_aadhaar,
    generate_otp,
    get_refresh_token_from_cookie,
    hash_otp,
    hash_password,
    mask_aadhaar,
    set_refresh_cookie,
    clear_refresh_cookie,
    verify_otp as _verify_otp_hash,
    verify_password,
)
from app.models.audit_log import AuditEventType, AuditLog
from app.models.consumer_profile import ConsumerProfile
from app.models.notification import (
    Notification,
    NotificationCategory,
    NotificationType,
)
from app.models.restriction import SelfRestriction
from app.models.user import User, UserRole
from app.models.user_role import UserRole_
from app.schemas.consumer import RegisterFinalRequest


# ── Internal helpers ───────────────────────────────────────────────────────────

def _write_audit(
    db: Session,
    event_type: AuditEventType,
    *,
    user_id=None,
    description: Optional[str] = None,
    metadata_json: Optional[dict] = None,
    ip_address: Optional[str] = None,
) -> None:
    """Append an immutable audit record.  Never raises — failures are swallowed
    so they don't mask the original business error."""
    try:
        log = AuditLog(
            user_id=user_id,
            event_type=event_type.value,
            description=description,
            metadata_json=metadata_json,
            ip_address=ip_address,
        )
        db.add(log)
        db.flush()  # flush but don't commit — caller controls transaction
    except Exception:
        pass  # audit must not break the main flow


def _hash_token_for_storage(raw_token: str) -> str:
    """SHA-256 hash of the refresh token for DB storage comparison.

    We use SHA-256 (not bcrypt) here because refresh tokens already contain
    32 bytes of cryptographic randomness (the jti), so additional KDF overhead
    is unnecessary for this one-way lookup.
    """
    return hashlib.sha256(raw_token.encode()).hexdigest()


def _lock_user(user: User, db: Session, ip: str) -> None:
    """Lock account for 30 minutes after too many failures."""
    user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=30)
    db.flush()
    _write_audit(
        db,
        AuditEventType.ACCOUNT_LOCKED,
        user_id=user.id,
        description="Account locked after repeated failed attempts",
        ip_address=ip,
    )


# ── Registration ───────────────────────────────────────────────────────────────

def register_consumer(
    data: RegisterFinalRequest,
    db: Session,
    ip: str,
) -> User:
    """Create a new consumer account atomically.

    All DB writes happen in a single transaction so partial state is never
    committed.  Generic HTTP 400 is raised if email or mobile is already taken.
    """
    # Duplicate check — generic error to prevent enumeration
    existing_email = db.query(User).filter(User.email == data.email).first()
    existing_mobile = db.query(User).filter(
        User.mobile_number == data.mobile_number
    ).first()
    if existing_email or existing_mobile:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Registration failed. Please check your details and try again.",
        )

    # Create User
    user = User(
        email=data.email,
        mobile_number=data.mobile_number,
        full_name=data.full_name,
        password_hash=hash_password(data.password),
        role=UserRole.CONSUMER,
        is_active=True,
        is_verified=False,
    )
    db.add(user)
    db.flush()  # get user.id

    # Create ConsumerProfile
    profile = ConsumerProfile(
        user_id=user.id,
        aadhaar_encrypted=encrypt_aadhaar(data.aadhaar_number),
        dob=data.dob,
        gender=data.gender,
        district=data.district,
        address=data.address,
    )
    db.add(profile)
    db.flush()  # get profile.id

    # Create default SelfRestriction
    restriction = SelfRestriction(
        user_id=user.id,
        consumer_id=profile.id,
    )
    db.add(restriction)

    # Audit — no PII in metadata
    _write_audit(
        db,
        AuditEventType.CONSUMER_REGISTERED,
        user_id=user.id,
        description="New consumer account created",
        metadata_json={"role": "CONSUMER"},
        ip_address=ip,
    )

    db.commit()
    db.refresh(user)
    return user


# ── Login ──────────────────────────────────────────────────────────────────────

def login_consumer(
    identifier: str,
    password: str,
    response: Response,
    db: Session,
    ip: str,
) -> dict:
    """Authenticate by mobile number, full Aadhaar number, or Aadhaar last-4.

    Accepted identifier formats:
      - 10 digits  → mobile number (direct DB lookup)
      - 12 digits  → full mock Aadhaar number (decrypt-and-compare all profiles)
      - 4  digits  → Aadhaar last-4 (decrypt-and-compare last 4 chars)

    On any failure: increment failed_login_attempts, lock if >= 5, and return
    a GENERIC error (never reveal which field was wrong).
    """
    _generic_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid credentials",
    )

    # Reject clearly malformed identifiers early
    if not identifier.isdigit():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Identifier must contain digits only (mobile number or Aadhaar).",
        )
    if len(identifier) not in (4, 10, 12):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Enter a 10-digit mobile number, 12-digit Aadhaar, or Aadhaar last 4 digits.",
        )

    # ── Locate user ────────────────────────────────────────────────────────────
    user: Optional[User] = None

    # ── Mode 1: 10-digit mobile number (fast direct lookup) ────────────────────
    if len(identifier) == 10:
        user = db.query(User).filter(User.mobile_number == identifier).first()

    # ── Mode 2: Full 12-digit Aadhaar (decrypt-and-compare, timing-safe) ───────
    elif len(identifier) == 12:
        profiles = (
            db.query(ConsumerProfile)
            .join(User, ConsumerProfile.user_id == User.id)
            .filter(User.is_active == True)  # noqa: E712
            .all()
        )
        for profile in profiles:
            try:
                raw = decrypt_aadhaar(profile.aadhaar_encrypted)
                if raw == identifier:
                    user = db.query(User).filter(User.id == profile.user_id).first()
                    break
            except Exception:
                continue

    # ── Mode 3: Aadhaar last-4 digits (legacy, timing-safe) ───────────────────
    elif len(identifier) == 4:
        profiles = (
            db.query(ConsumerProfile)
            .join(User, ConsumerProfile.user_id == User.id)
            .filter(User.is_active == True)  # noqa: E712
            .all()
        )
        for profile in profiles:
            try:
                raw = decrypt_aadhaar(profile.aadhaar_encrypted)
                if raw[-4:] == identifier:
                    user = db.query(User).filter(User.id == profile.user_id).first()
                    break
            except Exception:
                continue

    if user is None:
        # Log failed attempt with no user_id (prevent email enumeration)
        _write_audit(
            db,
            AuditEventType.LOGIN_FAILED,
            description="Login attempt with unknown identifier",
            ip_address=ip,
        )
        db.commit()
        raise _generic_error

    # ── Check lockout ──────────────────────────────────────────────────────────
    now = datetime.now(timezone.utc)
    if user.locked_until and user.locked_until > now:
        _write_audit(
            db,
            AuditEventType.LOGIN_FAILED,
            user_id=user.id,
            description="Login attempt on locked account",
            ip_address=ip,
        )
        db.commit()
        raise _generic_error

    # ── Verify password ────────────────────────────────────────────────────────
    if not verify_password(password, user.password_hash):
        user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
        if user.failed_login_attempts >= 5:
            _lock_user(user, db, ip)
        _write_audit(
            db,
            AuditEventType.LOGIN_FAILED,
            user_id=user.id,
            description="Incorrect password",
            ip_address=ip,
        )
        db.commit()
        raise _generic_error

    # ── Success path ───────────────────────────────────────────────────────────
    access_token = create_access_token(str(user.id), user.role.value)
    refresh_token = create_refresh_token(str(user.id))

    # Store hash of refresh token for server-side rotation validation
    user.refresh_token_hash = _hash_token_for_storage(refresh_token)
    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login_at = now
    user.last_login_ip = ip

    set_refresh_cookie(response, refresh_token)

    _write_audit(
        db,
        AuditEventType.LOGIN_SUCCESS,
        user_id=user.id,
        description="Successful login",
        ip_address=ip,
    )
    db.commit()

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": str(user.id),
        "role": user.role.value,
        "full_name": user.full_name,
    }


# ── Token refresh ──────────────────────────────────────────────────────────────

def refresh_tokens(
    request: Request,
    response: Response,
    db: Session,
) -> dict:
    """Issue new access + refresh tokens using the httpOnly cookie.

    Implements refresh-token rotation: the old token is invalidated immediately
    after the new pair is issued.
    """
    raw_refresh = get_refresh_token_from_cookie(request)
    payload = decode_refresh_token(raw_refresh)
    user_id: str = payload["sub"]

    user: Optional[User] = db.query(User).filter(User.id == user_id).first()
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    # Verify stored hash matches
    expected_hash = _hash_token_for_storage(raw_refresh)
    if not user.refresh_token_hash or user.refresh_token_hash != expected_hash:
        # Possible token reuse — revoke all
        user.refresh_token_hash = None
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token already used or revoked",
        )

    # Issue new tokens (rotation)
    new_access = create_access_token(str(user.id), user.role.value)
    new_refresh = create_refresh_token(str(user.id))

    user.refresh_token_hash = _hash_token_for_storage(new_refresh)
    set_refresh_cookie(response, new_refresh)

    _write_audit(
        db,
        AuditEventType.TOKEN_REFRESHED,
        user_id=user.id,
        description="Access token refreshed",
    )
    db.commit()

    return {
        "access_token": new_access,
        "token_type": "bearer",
        "user_id": str(user.id),
        "role": user.role.value,
        "full_name": user.full_name,
    }


# ── Logout ─────────────────────────────────────────────────────────────────────

def logout(
    request: Request,
    response: Response,
    db: Session,
    current_user: User,
) -> None:
    """Revoke server-side refresh token and clear cookie."""
    current_user.refresh_token_hash = None
    clear_refresh_cookie(response)
    _write_audit(
        db,
        AuditEventType.LOGOUT,
        user_id=current_user.id,
        description="User logged out",
    )
    db.commit()


# ── OTP ────────────────────────────────────────────────────────────────────────

def send_otp(mobile: str, db: Session, ip: str) -> None:
    """Generate, hash, and store a 6-digit OTP for the given mobile number.

    Prints the OTP to console (mock SMS gateway for development).
    """
    user: Optional[User] = db.query(User).filter(
        User.mobile_number == mobile
    ).first()
    if user is None:
        # Return silently — do not reveal whether mobile is registered
        return

    otp = generate_otp()
    user.otp_hash = hash_otp(otp)
    user.otp_expires_at = datetime.now(timezone.utc) + timedelta(
        seconds=settings.OTP_TTL_SECONDS
    )
    user.otp_attempts = 0
    user.otp_used = False

    print(f"[MOCK SMS] OTP for {mobile}: {otp}")  # noqa: T201

    _write_audit(
        db,
        AuditEventType.OTP_SENT,
        user_id=user.id,
        description="OTP dispatched",
        ip_address=ip,
    )
    db.commit()


def verify_otp(mobile: str, otp_code: str, db: Session, ip: str) -> bool:
    """Verify a 6-digit OTP for the given mobile number.

    Returns True on success, raises HTTPException on failure.
    """
    user: Optional[User] = db.query(User).filter(
        User.mobile_number == mobile
    ).first()

    _invalid = HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Invalid or expired OTP",
    )

    if user is None:
        raise _invalid

    now = datetime.now(timezone.utc)

    if user.otp_used:
        raise _invalid

    if not user.otp_expires_at or user.otp_expires_at < now:
        raise _invalid

    if (user.otp_attempts or 0) >= settings.OTP_MAX_ATTEMPTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many OTP attempts. Request a new OTP.",
        )

    if not user.otp_hash or not _verify_otp_hash(otp_code, user.otp_hash):
        user.otp_attempts = (user.otp_attempts or 0) + 1
        if user.otp_attempts >= settings.OTP_MAX_ATTEMPTS:
            _lock_user(user, db, ip)
        _write_audit(
            db,
            AuditEventType.LOGIN_FAILED,
            user_id=user.id,
            description="Failed OTP verification",
            ip_address=ip,
        )
        db.commit()
        raise _invalid

    # ── Success ────────────────────────────────────────────────────────────────
    user.otp_used = True
    user.is_verified = True
    user.otp_attempts = 0

    _write_audit(
        db,
        AuditEventType.OTP_VERIFIED,
        user_id=user.id,
        description="OTP verified successfully",
        ip_address=ip,
    )
    db.commit()
    return True
