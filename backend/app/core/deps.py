"""
FastAPI dependency injection helpers.

Security Notes:
  - get_current_user extracts and validates JWT; raises 401 on any failure.
  - require_role enforces RBAC at the API layer — never trusts frontend state.
  - Errors are intentionally non-leaky (no internal details exposed).
"""
from __future__ import annotations

import uuid
from typing import Callable

from fastapi import Cookie, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_token
from app.models.models import User

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    from sqlalchemy import select

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    token: str | None = None
    if credentials:
        token = credentials.credentials
    else:
        # Try X-Access-Token header as fallback (not cookie, to avoid CSRF surface)
        token = request.headers.get("X-Access-Token")

    if not token:
        raise credentials_exception

    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise credentials_exception
        user_id: str = payload.get("sub", "")  # type: ignore[assignment]
        if not user_id:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise credentials_exception

    return user


def require_role(*roles: str) -> Callable:
    """Returns a FastAPI dependency that enforces RBAC."""
    async def _check(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role.value not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access restricted. Required role(s): {', '.join(roles)}",
            )
        return current_user
    return _check


async def get_audit_logger(request: Request):
    """Returns a simple callable that logs to audit_logs table."""
    from app.services.audit_service import AuditService
    return AuditService(
        ip_address=request.client.host if request.client else None
    )
