"""FastAPI dependency providers.

All user-identity resolution is done EXCLUSIVELY from the verified JWT `sub` claim.
Path/body user_id parameters are NEVER trusted for ownership checks.

Security additions (Admin Module):
- token_version check: if JWT token_version < user.token_version, token is revoked.
- Role-specific dependency aliases for all 5 roles.
"""
from __future__ import annotations

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.user import User, UserRole

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Resolve the authenticated user from the Bearer token.

    - Decodes and validates the JWT.
    - Fetches the user record from DB using the `sub` (user_id) claim.
    - Checks token_version to honour immediate token revocation.
    - Rejects inactive or locked accounts.
    """
    payload = decode_access_token(credentials.credentials)
    user_id: str = payload["sub"]
    token_version_claim: int = payload.get("token_version", 0)

    result = await db.execute(select(User).where(User.id == user_id))
    user: User | None = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Token version check — revokes all tokens issued before this version
    if (user.token_version or 0) > token_version_claim:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )

    from datetime import datetime, timezone  # local import to avoid circular
    if user.locked_until and user.locked_until > datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is temporarily locked due to multiple failed attempts",
        )

    return user


def require_role(*roles: str):
    """Factory: returns a FastAPI dependency that enforces one of the given roles."""
    async def _check(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role.value not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access restricted. Required role(s): {', '.join(roles)}",
            )
        return current_user
    return _check


# ── Role-specific convenience dependencies ────────────────────────────────────

async def get_current_consumer(current_user: User = Depends(get_current_user)) -> User:
    """Verify the authenticated user carries the CONSUMER role."""
    if current_user.role != UserRole.CONSUMER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to consumer accounts",
        )
    return current_user


async def get_current_admin(current_user: User = Depends(get_current_user)) -> User:
    """Verify the authenticated user carries the ADMIN role."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to administrator accounts",
        )
    return current_user


async def get_current_operator(current_user: User = Depends(get_current_user)) -> User:
    """Verify the authenticated user carries the OPERATOR role."""
    if current_user.role != UserRole.OPERATOR:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to shop operator accounts",
        )
    return current_user


async def get_current_doctor(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Verify the authenticated user carries the DOCTOR role AND profile is active.

    Two-layer check:
    1. User.is_active — handled by get_current_user above
    2. DoctorProfile.is_active — admin explicitly activates/deactivates the clinical profile
       This means an admin can deactivate a doctor's clinical access without deleting their account.
    """
    if current_user.role != UserRole.DOCTOR:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to doctor accounts",
        )
    from app.models.doctor_profile import DoctorProfile
    result = await db.execute(
        select(DoctorProfile).where(DoctorProfile.user_id == current_user.id)
    )
    profile = result.scalar_one_or_none()
    if not profile or not profile.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Doctor account is not yet activated. Contact the administrator.",
        )
    return current_user


def get_client_ip(request: Request) -> str:
    """Extract the client IP from the request, falling back to 'unknown'."""
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else "unknown"
