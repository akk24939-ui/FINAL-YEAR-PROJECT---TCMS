"""Shop portal authentication — login via shop_code + PIN, change password.

Portal URL: /shop/auth/*
Separate portal from all other roles.

Feature 2: Returns must_change_password flag on login.
Feature 2: POST /shop/auth/change-password — operator changes their own password.
Feature 3: Enforces temp_password expiry (otp_expires_at) on login.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_client_ip
from app.core.security import clear_refresh_cookie, set_refresh_cookie
from app.models.user import User, UserRole
from app.services import admin_service, shop_auth_service
from fastapi import HTTPException

router = APIRouter(prefix="/shop/auth", tags=["Shop Auth"])


class ShopLoginRequest(BaseModel):
    shop_code: str
    pin: str


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(
        ...,
        min_length=8,
        description="Min 8 chars, upper + lower + digit + symbol required.",
    )
    confirm_password: str = Field(..., min_length=1)


@router.post("/login", summary="Shop operator login (shop_code + PIN)")
def shop_login(
    body: ShopLoginRequest,
    response: Response,
    db: Session = Depends(get_db),
    ip: str = Depends(get_client_ip),
):
    """Authenticate operator by shop_code + PIN.

    Returns must_change_password=True if:
    - Admin set an initial password that hasn't been changed yet (Feature 2).
    - Admin issued a temp password that is still active (Feature 3).

    Also checks that temp password has not expired (24-hour window).
    """
    result = shop_auth_service.shop_login(
        shop_code=body.shop_code,
        pin=body.pin,
        db=db,
        ip_address=ip,
    )
    # Enforce temp password expiry: if otp_expires_at has passed, block login
    # and require admin to issue a new temp password.
    operator = result.get("_operator_obj")
    if operator and operator.otp_expires_at:
        now_utc = datetime.now(timezone.utc)
        if operator.must_change_password and operator.otp_expires_at < now_utc:
            raise HTTPException(
                status_code=403,
                detail=(
                    "Your temporary password has expired (24-hour limit). "
                    "Contact your administrator to issue a new one."
                ),
            )

    set_refresh_cookie(response, result["refresh_token"])
    return {
        "access_token": result["access_token"],
        "token_type": "bearer",
        "shop": result["shop"],
        "must_change_password": result.get("must_change_password", False),
        "pin_rotation_warning": result.get("pin_rotation_warning"),
    }


@router.post("/change-password", summary="Operator changes their own password (Feature 2)")
def change_password(
    body: ChangePasswordRequest,
    response: Response,
    db: Session = Depends(get_db),
    ip: str = Depends(get_client_ip),
    current_user: User = Depends(get_current_user),
):
    """Force or voluntary password change for a shop operator.

    - Requires valid JWT (must be logged in, even with must_change_password=True).
    - Verifies current password before allowing change.
    - Enforces password policy: min 8 chars, upper+lower+digit+symbol.
    - Clears must_change_password flag on success.
    - Invalidates all existing tokens (token_version bump).
    """
    if current_user.role != UserRole.OPERATOR:
        raise HTTPException(status_code=403, detail="Only shop operators can use this endpoint.")

    if body.new_password != body.confirm_password:
        raise HTTPException(status_code=422, detail="New password and confirmation do not match.")

    # Find operator's shop to pass shop_id for audit log
    from app.models.shop import Shop
    shop = db.query(Shop).filter(Shop.operator_id == current_user.id).first()
    shop_id = shop.id if shop else current_user.id  # fallback

    admin_service.change_operator_password(
        shop_id=shop_id,
        operator_user=current_user,
        current_password=body.current_password,
        new_password=body.new_password,
        db=db,
        ip_address=ip,
    )

    # Clear refresh cookie so operator must re-login with new password
    clear_refresh_cookie(response)

    return {
        "message": "Password changed successfully. Please log in again with your new password.",
        "must_change_password": False,
    }


@router.post("/logout", summary="Shop operator logout")
def shop_logout(response: Response):
    clear_refresh_cookie(response)
    return {"message": "Logged out"}
