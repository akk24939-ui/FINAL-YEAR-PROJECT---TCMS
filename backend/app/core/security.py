"""Security utilities — JWT, password hashing, Fernet Aadhaar encryption, OTP, QR signing.

Security design decisions:
- Access tokens: short-lived (15 min), stored in memory by the SPA.
- Refresh tokens: long-lived (7 days), sent and stored ONLY as httpOnly strict cookie.
- Aadhaar: encrypted with Fernet (AES-128-CBC + HMAC-SHA256).  Only last-4 returned in APIs.
- OTP: bcrypt-hashed at rest; single-use + time-boxed + attempt-limited.
- QR payload: HMAC-SHA256 signed JSON; raw PII never embedded.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken
from fastapi import HTTPException, Request, Response, status
from jose import JWTError, jwt
import bcrypt

from app.core.config import settings

# ── Fernet cipher (singleton — key loaded once at startup) ─────────────────────
_fernet = Fernet(settings.FERNET_KEY.encode())


# ── Password helpers ───────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    """Return bcrypt hash of *plain* using configured cost factor."""
    # Ensure plain text is bytes and truncate if it exceeds 72 chars to avoid ValueError
    plain_bytes = plain[:72].encode('utf-8')
    salt = bcrypt.gensalt(rounds=settings.BCRYPT_ROUNDS)
    hashed_bytes = bcrypt.hashpw(plain_bytes, salt)
    return hashed_bytes.decode('utf-8')


def verify_password(plain: str, hashed: str) -> bool:
    """Constant-time bcrypt verification."""
    plain_bytes = plain[:72].encode('utf-8')
    hashed_bytes = hashed.encode('utf-8')
    return bcrypt.checkpw(plain_bytes, hashed_bytes)


# ── JWT helpers ────────────────────────────────────────────────────────────────

def create_access_token(user_id: str, role: str) -> str:
    """Create a signed JWT access token valid for ACCESS_TOKEN_EXPIRE_MINUTES."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "role": role,
        "iat": now,
        "exp": now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        "type": "access",
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    """Create a signed JWT refresh token valid for REFRESH_TOKEN_EXPIRE_DAYS.

    Includes a random *jti* so each token is unique and can be compared
    against the stored hash.
    """
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "jti": secrets.token_hex(32),
        "iat": now,
        "exp": now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        "type": "refresh",
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> dict:
    """Decode and validate an access JWT.

    Raises HTTPException 401 on any failure so callers don't need try/except.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )
        if payload.get("type") != "access":
            raise credentials_exception
        sub: Optional[str] = payload.get("sub")
        if not sub:
            raise credentials_exception
        return payload
    except JWTError:
        raise credentials_exception


def decode_refresh_token(token: str) -> dict:
    """Decode and validate a refresh JWT.

    Raises HTTPException 401 on any failure.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired refresh token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )
        if payload.get("type") != "refresh":
            raise credentials_exception
        sub: Optional[str] = payload.get("sub")
        if not sub:
            raise credentials_exception
        return payload
    except JWTError:
        raise credentials_exception


# ── Cookie helpers ─────────────────────────────────────────────────────────────
_COOKIE_NAME = "refresh_token"
_COOKIE_MAX_AGE = settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600


def set_refresh_cookie(response: Response, refresh_token: str) -> None:
    """Set refresh token as httpOnly, strict-samesite cookie.

    secure=False for local development; set to True in production behind HTTPS.
    """
    secure = settings.ENVIRONMENT != "development"
    response.set_cookie(
        key=_COOKIE_NAME,
        value=refresh_token,
        httponly=True,
        secure=secure,
        samesite="strict",
        max_age=_COOKIE_MAX_AGE,
        path="/",
    )


def clear_refresh_cookie(response: Response) -> None:
    """Remove the refresh token cookie on logout."""
    response.delete_cookie(
        key=_COOKIE_NAME,
        httponly=True,
        samesite="strict",
        path="/",
    )


def get_refresh_token_from_cookie(request: Request) -> str:
    """Extract refresh token from httpOnly cookie.

    Raises HTTPException 401 if the cookie is absent.
    """
    token = request.cookies.get(_COOKIE_NAME)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token missing",
        )
    return token


# ── Fernet Aadhaar encryption ─────────────────────────────────────────────────

def encrypt_aadhaar(raw_number: str) -> str:
    """Encrypt a 12-digit Aadhaar number.  Returns a base64 Fernet token string."""
    encrypted_bytes = _fernet.encrypt(raw_number.encode("utf-8"))
    # Fernet already returns URL-safe base64; decode to str for storage in Text column
    return encrypted_bytes.decode("utf-8")


def decrypt_aadhaar(encrypted: str) -> str:
    """Decrypt a Fernet-encrypted Aadhaar token.  Returns the raw 12-digit string.

    Raises HTTPException 500 if decryption fails (key mismatch / tampered data).
    """
    try:
        raw_bytes = _fernet.decrypt(encrypted.encode("utf-8"))
        return raw_bytes.decode("utf-8")
    except (InvalidToken, Exception):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to decrypt identity data",
        )


def mask_aadhaar(raw_number: str) -> str:
    """Return masked Aadhaar string: '********XXXX' (last 4 visible)."""
    return "*" * 8 + raw_number[-4:]


# ── OTP helpers ────────────────────────────────────────────────────────────────

def generate_otp() -> str:
    """Generate a cryptographically random 6-digit OTP string."""
    return str(secrets.randbelow(900_000) + 100_000)


def hash_otp(otp: str) -> str:
    """Hash an OTP with bcrypt for at-rest storage."""
    return pwd_context.hash(otp)


def verify_otp(otp: str, hashed: str) -> bool:
    """Constant-time bcrypt comparison for OTP verification."""
    return pwd_context.verify(otp, hashed)


# ── QR payload signing ─────────────────────────────────────────────────────────

def _hmac_sign(message: str) -> str:
    """Compute HMAC-SHA256 over *message* using SECRET_KEY.  Returns hex digest."""
    return hmac.new(
        settings.SECRET_KEY.encode("utf-8"),
        message.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def create_qr_payload(user_id: str, expires_at: datetime) -> str:
    """Build a signed JSON QR payload.

    Fields:
      uid  — user UUID (no other PII)
      iat  — issued-at unix timestamp
      exp  — expiry unix timestamp
      sig  — HMAC-SHA256 over "uid|iat|exp"
    """
    iat = int(datetime.now(timezone.utc).timestamp())
    exp = int(expires_at.timestamp())
    message = f"{user_id}|{iat}|{exp}"
    sig = _hmac_sign(message)
    payload = {
        "uid": user_id,
        "iat": iat,
        "exp": exp,
        "sig": sig,
    }
    return json.dumps(payload, separators=(",", ":"))


def verify_qr_payload(payload_str: str) -> dict:
    """Verify a signed QR payload string.

    Raises HTTPException 400 if:
    - JSON parse fails
    - Required fields missing
    - HMAC signature mismatch
    - Token is expired
    """
    bad_payload = HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Invalid or expired QR code",
    )
    try:
        payload = json.loads(payload_str)
    except (json.JSONDecodeError, ValueError):
        raise bad_payload

    uid = payload.get("uid")
    iat = payload.get("iat")
    exp = payload.get("exp")
    sig = payload.get("sig")

    if not all([uid, iat, exp, sig]):
        raise bad_payload

    # Re-compute HMAC
    expected_sig = _hmac_sign(f"{uid}|{iat}|{exp}")
    if not hmac.compare_digest(expected_sig, sig):
        raise bad_payload

    # Check expiry
    now_ts = int(datetime.now(timezone.utc).timestamp())
    if now_ts > exp:
        raise bad_payload

    return payload
