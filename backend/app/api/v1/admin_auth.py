"""Admin portal authentication — login, forced password change, refresh, logout.

Portal URL: /admin/auth/*
Separate from consumer auth — no role selector on the login form.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

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


def _audit(db: Session, event_type: str, user: User, description: str, ip: str, metadata: dict = None):
    db.add(AuditLog(
        id=uuid.uuid4(),
        user_id=user.id,
        actor_id=user.id,
        event_type=event_type,
        description=description,
        metadata_json=metadata or {},
        ip_address=ip,
    ))


@router.post("/login", summary="Admin portal login")
def admin_login(
    body: AdminLoginRequest,
    response: Response,
    db: Session = Depends(get_db),
    ip: str = Depends(get_client_ip),
):
    user: User | None = db.query(User).filter(
        User.email == body.username,
        User.role == UserRole.ADMIN,
    ).first()

    # Constant-time: same error regardless of whether user exists
    if not user:
        db.add(AuditLog(
            id=uuid.uuid4(), event_type=AuditEventType.LOGIN_FAILED,
            description=f"Admin login failed — unknown username: {body.username[:50]}",
            ip_address=ip,
        ))
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    # Lockout disabled for development — to re-enable, restore the block below
    # ── LOCKOUT (disabled) ─────────────────────────────────────────────────
    # now = datetime.now(timezone.utc)
    # if user.locked_until and user.locked_until > now:
    #     mins = int((user.locked_until - now).total_seconds() // 60) + 1
    #     raise HTTPException(status_code=423, detail=f"Account locked. Try again in {mins} minute(s).")
    # ──────────────────────────────────────────────────────────────────────

    now = datetime.now(timezone.utc)
    if not verify_password(body.password, user.password_hash):
        # Track failed attempts in audit log (no lockout applied)
        user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
        _audit(db, AuditEventType.LOGIN_FAILED, user, f"Admin login failed (attempt {user.failed_login_attempts})", ip)
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    # Reset lockout
    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login_at = now
    user.last_login_ip = ip

    access_token = create_access_token(str(user.id), "ADMIN", token_version=user.token_version or 0)
    refresh_token = create_refresh_token(str(user.id))
    user.refresh_token_hash = hash_password(refresh_token[:72])

    _audit(db, AuditEventType.LOGIN_SUCCESS, user, "Admin login successful", ip)
    db.commit()

    set_refresh_cookie(response, refresh_token)

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "must_change_password": user.must_change_password,
        "admin": {"id": str(user.id), "full_name": user.full_name, "email": user.email},
    }


@router.post("/change-password", summary="Admin forced password change (first login)")
def change_password(
    body: ChangePasswordRequest,
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
    ip: str = Depends(get_client_ip),
):
    if not verify_password(body.current_password, current_user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")

    if body.new_password == body.current_password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="New password must differ from current password")

    current_user.password_hash = hash_password(body.new_password)
    current_user.must_change_password = False
    # Increment token_version to invalidate old sessions after password change
    current_user.token_version = (current_user.token_version or 0) + 1

    _audit(db, AuditEventType.PROFILE_UPDATED, current_user, "Admin password changed", ip)
    db.commit()

    return {"message": "Password changed successfully. Please log in again with your new password."}


@router.post("/refresh", summary="Refresh admin access token")
def refresh_token(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    token = get_refresh_token_from_cookie(request)
    payload = decode_refresh_token(token)
    user_id = payload["sub"]

    user = db.query(User).filter(User.id == user_id, User.role == UserRole.ADMIN).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    new_access = create_access_token(str(user.id), "ADMIN", token_version=user.token_version or 0)
    new_refresh = create_refresh_token(str(user.id))
    user.refresh_token_hash = hash_password(new_refresh[:72])
    db.commit()

    set_refresh_cookie(response, new_refresh)
    return {"access_token": new_access, "token_type": "bearer"}


@router.post("/logout", summary="Admin logout")
def logout(
    response: Response,
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
    ip: str = Depends(get_client_ip),
):
    current_user.refresh_token_hash = None
    _audit(db, AuditEventType.LOGOUT, current_user, "Admin logged out", ip)
    db.commit()
    clear_refresh_cookie(response)
    return {"message": "Logged out successfully"}
