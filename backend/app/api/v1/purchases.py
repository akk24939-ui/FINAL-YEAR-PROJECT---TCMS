from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_role
from app.schemas.purchase import PurchaseCreate, PurchaseHistoryResponse
from app.services import purchase_service
from app.models.user import User
from app.models.shop import Shop

router = APIRouter(prefix="/purchases", tags=["Purchases"])


@router.post("/", summary="Record a purchase (Operator only)")
async def record_purchase(
    data: PurchaseCreate,
    current_user: User = Depends(require_role("OPERATOR")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Shop).where(Shop.operator_id == current_user.id, Shop.is_active == True)  # noqa
    )
    shop = result.scalar_one_or_none()
    if not shop:
        raise HTTPException(status_code=404, detail="No active shop found for this operator")
    return await purchase_service.record_purchase(db, data, str(shop.id), str(current_user.id))


@router.get("/my-history", response_model=PurchaseHistoryResponse, summary="Consumer purchase history")
async def get_my_history(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(require_role("CONSUMER")),
    db: AsyncSession = Depends(get_db),
):
    return await purchase_service.get_history(db, str(current_user.id), limit, offset)
