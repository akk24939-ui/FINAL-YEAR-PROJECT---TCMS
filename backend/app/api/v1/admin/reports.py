"""Admin reports endpoint — district stats and summary exports."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.core.dependencies import get_current_admin
from app.models.district import District
from app.models.purchase import Purchase
from app.models.shop import Shop
from app.models.user import User, UserRole

router = APIRouter()


@router.get("/reports/district-stats", summary="District-wise stats report")
def get_district_stats(
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    districts = db.query(District).all()
    result = []
    for d in districts:
        shop_count = db.query(Shop).filter(Shop.district == d.name, Shop.is_active == True).count()
        purchase_count = (
            db.query(Purchase)
            .join(Shop, Purchase.shop_id == Shop.id)
            .filter(Shop.district == d.name)
            .count()
        )
        revenue = (
            db.query(func.coalesce(func.sum(Purchase.price), 0))
            .join(Shop, Purchase.shop_id == Shop.id)
            .filter(Shop.district == d.name)
            .scalar()
        ) or 0
        result.append({
            "district": d.name,
            "code": d.code,
            "shop_count": shop_count or d.shop_count,
            "total_purchases": purchase_count,
            "total_revenue": float(revenue),
        })
    return {"districts": result}


@router.get("/reports/summary", summary="System summary report")
def get_summary(
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    total_consumers = db.query(User).filter(User.role == UserRole.CONSUMER).count()
    total_shops = db.query(Shop).filter(Shop.is_active == True).count()
    total_purchases = db.query(Purchase).count()
    total_revenue = db.query(func.coalesce(func.sum(Purchase.price), 0)).scalar() or 0
    return {
        "total_consumers": total_consumers,
        "total_active_shops": total_shops,
        "total_purchases": total_purchases,
        "total_revenue": float(total_revenue),
    }
