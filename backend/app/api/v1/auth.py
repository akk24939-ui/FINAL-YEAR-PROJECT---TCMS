"""Auth router — register, login, refresh, logout."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.schemas.schemas import LoginRequest, RegisterRequest, TokenResponse, UserOut
from app.schemas.auth import ForgotPasswordRequest, VerifyResetOtpRequest, ResetPasswordRequest
from app.services.auth_service import AuthService
from app.services.audit_service import AuditService

router = APIRouter(prefix="/auth", tags=["auth"])
limiter = Limiter(key_func=get_remote_address)
_svc = AuthService()


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def register(request: Request, data: RegisterRequest, db: AsyncSession = Depends(get_db)):
    user = await _svc.register(db, data)
    await AuditService(ip_address=request.client.host if request.client else None).log(
        db, actor_user_id=user.id, action="CREATE", target_table="users", target_id=user.id
    )
    from app.models.models import Role
    from sqlalchemy import select
    role = (await db.execute(select(Role).where(Role.id == user.role_id))).scalar_one()
    return UserOut(id=user.id, email=user.email, role=role.name, is_active=user.is_active, created_at=user.created_at)


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(request: Request, data: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    access, refresh, user, role_name = await _svc.login(db, data.identifier, data.password)
    response.set_cookie(
        key="refresh_token",
        value=refresh,
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=7 * 24 * 3600,
        path="/api/v1/auth/refresh",
    )
    return TokenResponse(
        access_token=access,
        expires_in=15 * 60,
        user_id=str(user.id),
        full_name=getattr(user, "full_name", None) or "",
        role=role_name,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(request: Request, db: AsyncSession = Depends(get_db)):
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No refresh token")
    access = await _svc.refresh_access_token(db, refresh_token)
    return TokenResponse(access_token=access, expires_in=15 * 60)


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie(key="refresh_token", path="/api/v1/auth/refresh")
    return {"message": "Logged out"}


# ── Forgot Password ────────────────────────────────────────────────────────────

@router.post("/forgot-password", status_code=202)
@limiter.limit("5/hour")
async def forgot_password(
    request: Request,
    body: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """Step 1 — request a password-reset OTP.

    Always returns 202 regardless of whether the mobile is registered,
    to prevent account enumeration.
    """
    await _svc.request_password_reset(body.mobile_number, db)
    return {"message": "If the mobile number is registered, an OTP has been sent."}


@router.post("/verify-reset-otp")
@limiter.limit("10/15minutes")
async def verify_reset_otp(
    request: Request,
    body: VerifyResetOtpRequest,
    db: AsyncSession = Depends(get_db),
):
    """Step 2 — verify the OTP. Returns a short-lived reset_token (10 min)."""
    reset_token = await _svc.verify_reset_otp(body.mobile_number, body.otp_code, db)
    return {"reset_token": reset_token}


@router.post("/reset-password", status_code=200)
@limiter.limit("5/hour")
async def reset_password(
    request: Request,
    body: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """Step 3 — set a new password using the reset_token from step 2."""
    await _svc.reset_password(body.reset_token, body.new_password, db)
    return {"message": "Password reset successfully. You can now log in."}

