"""Shop portal authentication — login via shop_code + PIN.

Portal URL: /shop/auth/login
Separate portal from all other roles.
"""
from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_client_ip
from app.core.security import clear_refresh_cookie, set_refresh_cookie
from app.services import shop_auth_service

router = APIRouter(prefix="/shop/auth", tags=["Shop Auth"])


class ShopLoginRequest(BaseModel):
    shop_code: str
    pin: str


@router.post("/login", summary="Shop operator login (shop_code + PIN)")
def shop_login(
    body: ShopLoginRequest,
    response: Response,
    db: Session = Depends(get_db),
    ip: str = Depends(get_client_ip),
):
    result = shop_auth_service.shop_login(
        shop_code=body.shop_code,
        pin=body.pin,
        db=db,
        ip_address=ip,
    )
    set_refresh_cookie(response, result["refresh_token"])
    return {
        "access_token": result["access_token"],
        "token_type": "bearer",
        "shop": result["shop"],
        "pin_rotation_warning": result.get("pin_rotation_warning"),
    }


@router.post("/logout", summary="Shop operator logout")
def shop_logout(response: Response):
    clear_refresh_cookie(response)
    return {"message": "Logged out"}
