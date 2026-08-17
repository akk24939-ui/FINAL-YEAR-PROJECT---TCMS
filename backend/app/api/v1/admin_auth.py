"""Admin portal authentication — login, forced password change, refresh, logout.

Portal URL: /admin/auth/*
Separate from consumer auth — no role selector on the login form.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_admin, get_client_ip
from app.core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    verify_password,
    set_refresh_cookie,
    clear_refresh_cookie,
    get_refresh_token_from_cookie,
    decode_refresh_token,
)
from app.models.audit_log import AuditLog, AuditEventType
from app.models.user import User, UserRole

router = APIRouter(prefix="/admin/auth", tags=["Admin Auth"])

# MAX_ADMIN_ATTEMPTS = 5     # ← re-enable to turn lockout back on
# LOCKOUT_MINUTES = 15


class AdminLoginRequest(BaseModel):
    username: str  # email
    password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=12, description="Minimum 12 characters")


async def _audit(db: AsyncSession, event_type, user: User | None, description: str, ip: str, metadata: dict = None):
    db.add(AuditLog(
        id=uuid.uuid4(),
        user_id=user.id if user else None,
        actor_id=user.id if user else None,
        event_type=event_type.value if hasattr(event_type, 'value') else event_type,
        description=description,
        metadata_json=metadata or {},
        ip_address=ip,
    ))


@router.post("/login", summary="Admin portal login")
async def admin_login(
    body: AdminLoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
    ip: str = Depends(get_client_ip),
):
    result = await db.execute(
        select(User).where(User.email == body.username, User.role == UserRole.ADMIN)
    )
    user: User | None = result.scalar_one_or_none()

    # Constant-time: same error regardless of whether user exists
    if not user:
        db.add(AuditLog(
            id=uuid.uuid4(), event_type=AuditEventType.LOGIN_FAILED.value,
            description=f"Admin login failed — unknown username: {body.username[:50]}",
            ip_address=ip,
        ))
        await db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    now = datetime.now(timezone.utc)
    if not verify_password(body.password, user.password_hash):
        user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
        await _audit(db, AuditEventType.LOGIN_FAILED, user, f"Admin login failed (attempt {user.failed_login_attempts})", ip)
        await db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    # Reset lockout
    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login_at = now
    user.last_login_ip = ip

    access_token = create_access_token(str(user.id), "ADMIN", token_version=user.token_version or 0)
    refresh_token = create_refresh_token(str(user.id))
    user.refresh_token_hash = hash_password(refresh_token[:72])

    await _audit(db, AuditEventType.LOGIN_SUCCESS, user, "Admin login successful", ip)
    await db.commit()

    set_refresh_cookie(response, refresh_token)

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "must_change_password": user.must_change_password,
        "admin": {"id": str(user.id), "full_name": user.full_name, "email": user.email},
    }


@router.post("/change-password", summary="Admin forced password change (first login)")
async def change_password(
    body: ChangePasswordRequest,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
    ip: str = Depends(get_client_ip),
):
    if not verify_password(body.current_password, current_user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")

    if body.new_password == body.current_password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="New password must differ from current password")

    current_user.password_hash = hash_password(body.new_password)
    current_user.must_change_password = False
    current_user.token_version = (current_user.token_version or 0) + 1

    await _audit(db, AuditEventType.PROFILE_UPDATED, current_user, "Admin password changed", ip)
    await db.commit()

    return {"message": "Password changed successfully. Please log in again with your new password."}


@router.post("/refresh", summary="Refresh admin access token")
async def refresh_token(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    token = get_refresh_token_from_cookie(request)
    payload = decode_refresh_token(token)
    user_id = payload["sub"]

    result = await db.execute(
        select(User).where(User.id == user_id, User.role == UserRole.ADMIN)
    )
    user: User | None = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    new_access = create_access_token(str(user.id), "ADMIN", token_version=user.token_version or 0)
    new_refresh = create_refresh_token(str(user.id))
    user.refresh_token_hash = hash_password(new_refresh[:72])
    await db.commit()

    set_refresh_cookie(response, new_refresh)
    return {"access_token": new_access, "token_type": "bearer"}


@router.post("/logout", summary="Admin logout")
async def logout(
    response: Response,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
    ip: str = Depends(get_client_ip),
):
    current_user.refresh_token_hash = None
    await _audit(db, AuditEventType.LOGOUT, current_user, "Admin logged out", ip)
    await db.commit()
    clear_refresh_cookie(response)
    return {"message": "Logged out successfully"}
