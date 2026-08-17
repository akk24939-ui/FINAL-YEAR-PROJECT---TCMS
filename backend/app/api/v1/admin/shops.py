"""Admin shops endpoints — CRUD, PIN reset, temp password, suspend/reactivate."""
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_admin, get_client_ip
from app.models.user import User
from app.services import admin_service

router = APIRouter()


class CreateShopRequest(BaseModel):
    name: str
    district: str
    address: str
    license_number: Optional[str] = None
    operator_name: str
    operator_phone: str
    initial_password: str = Field(
        ...,
        min_length=8,
        description="Permanent initial password set by admin.",
    )


class SuspendShopRequest(BaseModel):
    reason: str


def _serialize_shop(shop) -> dict:
    now_import = __import__("datetime").datetime.now(__import__("datetime").timezone.utc)
    pin_overdue = (
        shop.pin_rotation_due_at is not None and
        shop.pin_rotation_due_at < now_import
    )
    return {
        "id": str(shop.id),
        "shop_code": shop.shop_code,
        "name": shop.name,
        "district": shop.district,
        "address": shop.address,
        "license_number": shop.license_number,
        "operator_name": shop.operator_name,
        "operator_phone": shop.operator_phone,
        "is_active": shop.is_active,
        "suspended_at": shop.suspended_at.isoformat() if shop.suspended_at else None,
        "suspension_reason": shop.suspension_reason,
        "pin_rotation_due_at": shop.pin_rotation_due_at.isoformat() if shop.pin_rotation_due_at else None,
        "pin_overdue": pin_overdue,
        "created_at": shop.created_at.isoformat() if shop.created_at else None,
    }


@router.get("/shops", summary="List all shops")
async def list_shops(
    district: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    shops, total = await admin_service.list_shops(db, district=district, is_active=is_active, skip=skip, limit=limit)
    return {"total": total, "shops": [_serialize_shop(s) for s in shops]}


@router.post("/shops", summary="Create a new shop + operator account")
async def create_shop(
    body: CreateShopRequest,
    request: Request,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
    ip: str = Depends(get_client_ip),
):
    shop, operator, raw_pin = await admin_service.create_shop(
        name=body.name,
        district=body.district,
        address=body.address,
        license_number=body.license_number,
        operator_name=body.operator_name,
        operator_phone=body.operator_phone,
        initial_password=body.initial_password,
        admin=current_user,
        db=db,
        ip_address=ip,
    )
    return {
        "shop": _serialize_shop(shop),
        "operator_email": operator.email,
        "shop_code": shop.shop_code,
        "initial_pin": raw_pin,
        "must_change_password": True,
        "message": "Shop created. The operator must change their password on first login.",
    }


@router.post("/shops/{shop_id}/reset-pin", summary="Reset shop operator PIN")
async def reset_pin(
    shop_id: uuid.UUID,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
    ip: str = Depends(get_client_ip),
):
    shop, raw_pin = await admin_service.reset_shop_pin(shop_id, current_user, db, ip)
    return {
        "shop_code": shop.shop_code,
        "new_pin": raw_pin,
        "message": "PIN reset. Save the new PIN — it will not be shown again.",
    }


@router.post("/shops/{shop_id}/temp-password", summary="Issue temporary password for shop operator")
async def issue_temp_password(
    shop_id: uuid.UUID,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
    ip: str = Depends(get_client_ip),
):
    operator, plaintext = await admin_service.issue_temp_password(
        shop_id=shop_id,
        admin=current_user,
        db=db,
        ip_address=ip,
    )
    return {
        "temp_password": plaintext,
        "expires_in_hours": 24,
        "must_change_password": True,
        "operator_name": operator.full_name,
        "message": "Temporary password issued. Show this to the operator securely — it will NOT be shown again.",
    }


@router.post("/shops/{shop_id}/suspend", summary="Suspend a shop")
async def suspend_shop(
    shop_id: uuid.UUID,
    body: SuspendShopRequest,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
    ip: str = Depends(get_client_ip),
):
    shop = await admin_service.suspend_shop(shop_id, body.reason, current_user, db, ip)
    return {"message": "Shop suspended.", "shop": _serialize_shop(shop)}


@router.post("/shops/{shop_id}/reactivate", summary="Reactivate a suspended shop")
async def reactivate_shop(
    shop_id: uuid.UUID,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
    ip: str = Depends(get_client_ip),
):
    shop = await admin_service.reactivate_shop(shop_id, current_user, db, ip)
    return {"message": "Shop reactivated.", "shop": _serialize_shop(shop)}
