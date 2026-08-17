"""Consumer purchase history endpoint (read-only)."""
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_consumer
from app.models.user import User
from app.models.purchase import Purchase

router = APIRouter(prefix="/purchases", tags=["Consumer - Purchases"])


@router.get("/")
async def get_purchase_history(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    product_name: Optional[str] = Query(None),
    current_user: User = Depends(get_current_consumer),
    db: AsyncSession = Depends(get_db),
):
    """Return paginated purchase history for the authenticated consumer only."""
    # IDOR-safe: filter strictly by current_user.id from JWT — never from path/body
    stmt = select(Purchase).where(Purchase.consumer_id == current_user.id)

    if start_date:
        stmt = stmt.where(Purchase.purchased_at >= start_date)
    if end_date:
        stmt = stmt.where(Purchase.purchased_at <= end_date)
    if product_name:
        stmt = stmt.where(Purchase.product_name.ilike(f"%{product_name}%"))

    # Count total
    count_result = await db.execute(
        select(func.count()).select_from(stmt.subquery())
    )
    total = count_result.scalar_one()

    # Paginated results
    items_result = await db.execute(
        stmt.order_by(Purchase.purchased_at.desc()).offset(skip).limit(limit)
    )
    items = items_result.scalars().all()

    return {
        "items": [
            {
                "id": str(p.id),
                "product_name": p.product_name,
                "quantity_ml": p.quantity_ml,
                "price": float(p.price),
                "purchased_at": p.purchased_at.isoformat(),
            }
            for p in items
        ],
        "total": total,
        "skip": skip,
        "limit": limit,
    }
