"""FastAPI dependency providers.

All user-identity resolution is done EXCLUSIVELY from the verified JWT `sub` claim.
Path/body user_id parameters are NEVER trusted for ownership checks.
"""
from __future__ import annotations

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.user import User, UserRole

security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    """Resolve the authenticated user from the Bearer token.

    - Decodes and validates the JWT.
    - Fetches the user record from DB using the `sub` (user_id) claim.
    - Rejects inactive or locked accounts.
    """
    payload = decode_access_token(credentials.credentials)
    user_id: str = payload["sub"]

    user: User | None = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
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


def get_current_consumer(current_user: User = Depends(get_current_user)) -> User:
    """Verify the authenticated user carries the CONSUMER role."""
    if current_user.role != UserRole.CONSUMER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to consumer accounts",
        )
    return current_user


def get_client_ip(request: Request) -> str:
    """Extract the client IP from the request, falling back to 'unknown'."""
    # Trust X-Forwarded-For when behind a known reverse proxy in production;
    # for now simply use the direct client address.
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else "unknown"
