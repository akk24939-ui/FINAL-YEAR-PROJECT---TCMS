"""
Security helpers: JWT, Argon2id hashing, AES-GCM field encryption, QR HMAC signing.

Security Notes:
  - JWT access tokens: HS256, 15-min lifetime, no sensitive data in payload.
  - Refresh tokens: stored in DB; rotated on every use; family-invalidated on replay.
  - Passwords: Argon2id (time_cost=3, memory_cost=65536, parallelism=2).
  - Field encryption: Fernet (AES-128-CBC + HMAC-SHA256) from cryptography library.
  - QR tokens: HMAC-SHA256 signed reference IDs — never contain raw consumer data.
"""
import hashlib
import hmac as _hmac
import uuid
from datetime import datetime, timedelta, timezone

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, InvalidHashError
from cryptography.fernet import Fernet
from jose import JWTError, jwt

from app.core.config import get_settings

settings = get_settings()

# ── Password hashing ──────────────────────────────────────────────────────────
_ph = PasswordHasher(time_cost=3, memory_cost=65536, parallelism=2)


def hash_password(plain: str) -> str:
    return _ph.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return _ph.verify(hashed, plain)
    except (VerifyMismatchError, InvalidHashError):
        return False


def password_needs_rehash(hashed: str) -> bool:
    return _ph.check_needs_rehash(hashed)


# ── JWT ───────────────────────────────────────────────────────────────────────
def create_access_token(user_id: str, role: str, token_version: int = 0) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    return jwt.encode(
        {"sub": user_id, "role": role, "exp": expire, "type": "access", "token_version": token_version},
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )


def create_refresh_token(user_id: str, family_id: str | None = None) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)
    payload: dict = {"sub": user_id, "exp": expire, "type": "refresh"}
    if family_id:
        payload["fam"] = family_id
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict:
    """Raises JWTError if invalid or expired."""
    return jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])


# ── Field encryption (AES-GCM via Fernet) ────────────────────────────────────
_fernet = Fernet(settings.field_encryption_key.encode())


def encrypt_field(plain: str) -> str:
    return _fernet.encrypt(plain.encode()).decode()


def decrypt_field(cipher: str) -> str:
    return _fernet.decrypt(cipher.encode()).decode()


# ── QR HMAC signing ───────────────────────────────────────────────────────────
def sign_qr_reference(ref_id: str) -> str:
    """Returns HMAC-SHA256 hex of the opaque reference ID."""
    return _hmac.new(
        settings.qr_hmac_secret.encode(),
        ref_id.encode(),
        hashlib.sha256,
    ).hexdigest()


def verify_qr_signature(ref_id: str, provided_sig: str) -> bool:
    expected = sign_qr_reference(ref_id)
    return _hmac.compare_digest(expected, provided_sig)


# ── Aadhaar-specific wrappers (semantic aliases over field encryption) ─────────
# Consumer service uses these named functions; they delegate to the generic
# encrypt_field / decrypt_field helpers so the crypto stays in one place.

def encrypt_aadhaar(plain: str) -> str:
    """Encrypt a mock Aadhaar number (Fernet AES-128-CBC + HMAC)."""
    return encrypt_field(plain)


def decrypt_aadhaar(cipher: str) -> str:
    """Decrypt a Fernet-encrypted Aadhaar field."""
    return decrypt_field(cipher)


def mask_aadhaar(plain: str) -> str:
    """Return only the last 4 digits, e.g. 'XXXX XXXX 1234'."""
    digits = plain.replace(" ", "").replace("-", "")
    if len(digits) < 4:
        return "XXXX"
    return f"XXXX XXXX {digits[-4:]}"


# ── Additional aliases used by admin/operator modules ─────────────────────────

def decode_access_token(token: str) -> dict:
    """Alias for decode_token — used by admin dependencies module."""
    return decode_token(token)


def verify_qr_payload(signed_token: str) -> dict:
    """Verify a QR signed token (format: ref_id.hmac_sig) and return {uid: ref_id}.

    Used by operator_service to check consumer QR codes at the counter.
    Raises ValueError if signature is invalid.
    """
    parts = signed_token.rsplit(".", 1)
    if len(parts) != 2:
        raise ValueError("Invalid QR token format")
    ref_id, provided_sig = parts
    if not verify_qr_signature(ref_id, provided_sig):
        raise ValueError("QR signature verification failed")
    return {"uid": ref_id}


def decode_refresh_token(token: str) -> dict:
    """Decode and validate a refresh token. Raises JWTError if invalid."""
    payload = decode_token(token)
    if payload.get("type") != "refresh":
        from jose import JWTError
        raise JWTError("Not a refresh token")
    return payload


def hash_pin(pin: str) -> str:
    """Hash a 6-digit shop operator PIN (same Argon2id as passwords)."""
    return hash_password(pin)


def verify_pin(plain: str, hashed: str) -> bool:
    """Verify a shop operator PIN."""
    return verify_password(plain, hashed)


# ── HTTP-only cookie helpers ───────────────────────────────────────────────────

def set_refresh_cookie(response, token: str) -> None:
    """Set the refresh token as an HttpOnly secure cookie."""
    response.set_cookie(
        key="refresh_token",
        value=token,
        httponly=True,
        secure=False,   # set True in production (HTTPS only)
        samesite="lax",
        max_age=settings.refresh_token_expire_days * 24 * 3600,
        path="/",
    )


def clear_refresh_cookie(response) -> None:
    """Delete the refresh token cookie."""
    response.delete_cookie(key="refresh_token", path="/")


def get_refresh_token_from_cookie(request) -> str:
    """Extract refresh token from cookie; raise 401 if missing."""
    from fastapi import HTTPException, status
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token missing",
        )
    return token
