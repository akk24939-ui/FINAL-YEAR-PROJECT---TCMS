"""Shop operator router — QR scan+verify, record purchase, view shop info."""
from __future__ import annotations

import uuid
from fastapi import APIRouter, Depends, HTTPException, Request, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_role
from app.models.models import Consumer, Product, Shop, User
from app.schemas.schemas import ProductOut, PurchaseCreate, PurchaseOut, ShopOut
from app.services.purchase_service import PurchaseService
from app.services.qr_service import QRService
from app.services.audit_service import AuditService

router = APIRouter(prefix="/shops", tags=["shops"])
limiter = Limiter(key_func=get_remote_address)
_purchase_svc = PurchaseService()
_qr_svc = QRService()


@router.get("/me", response_model=ShopOut)
async def my_shop(
    current_user: User = Depends(require_role("shop_operator")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Shop).where(Shop.operator_user_id == current_user.id))
    shop = result.scalar_one_or_none()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found for this operator")
    return ShopOut.model_validate(shop)


@router.post("/me/verify-qr")
@limiter.limit("60/minute")
async def verify_qr(
    request: Request,
    payload: dict,
    current_user: User = Depends(require_role("shop_operator")),
    db: AsyncSession = Depends(get_db),
):
    signed_token = payload.get("signed_token", "")
    consumer = await _qr_svc.verify(db, signed_token)
    await AuditService(request.client.host).log(
        db, actor_user_id=current_user.id, action="READ", target_table="consumers", target_id=consumer.id
    )
    return {
        "consumer_id": consumer.id,
        "district": consumer.district,
        "teetotaler_flag": consumer.teetotaler_flag,
        "status": "verified",
    }


@router.post("/me/purchases", response_model=PurchaseOut, status_code=201)
@limiter.limit("30/minute")
async def record_purchase(
    request: Request,
    data: PurchaseCreate,
    current_user: User = Depends(require_role("shop_operator")),
    db: AsyncSession = Depends(get_db),
):
    shop_result = await db.execute(select(Shop).where(Shop.operator_user_id == current_user.id))
    shop = shop_result.scalar_one_or_none()
    if not shop:
        raise HTTPException(status_code=404, detail="No shop assigned")

    # Consumer must be verified – consumer_id passed in idempotency payload (from verify-qr step)
    consumer_id_str = request.headers.get("X-Consumer-ID")
    if not consumer_id_str:
        raise HTTPException(status_code=400, detail="X-Consumer-ID header required")

    consumer_result = await db.execute(select(Consumer).where(Consumer.id == uuid.UUID(consumer_id_str)))
    consumer = consumer_result.scalar_one_or_none()
    if not consumer:
        raise HTTPException(status_code=404, detail="Consumer not found")

    purchase = await _purchase_svc.record_purchase(db, consumer=consumer, shop_id=shop.id, data=data)
    await AuditService(request.client.host).log(
        db, actor_user_id=current_user.id, action="CREATE", target_table="purchases", target_id=purchase.id
    )
    return PurchaseOut.model_validate(purchase)


@router.get("/products", response_model=list[ProductOut])
async def list_products(
    current_user: User = Depends(require_role("shop_operator")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Product))
    return [ProductOut.model_validate(p) for p in result.scalars().all()]
