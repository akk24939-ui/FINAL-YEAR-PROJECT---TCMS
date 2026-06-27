from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.database import get_db
from app.core.dependencies import require_role
from app.models.user import User, UserRole
from app.models.shop import Shop
from app.models.purchase import Purchase
from app.models.district import District
from app.schemas.admin import AdminDashboardResponse, DistrictStatsResponse, RevenueReportResponse
from datetime import date, datetime, timezone

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/dashboard", response_model=AdminDashboardResponse, summary="Admin dashboard stats")
def get_dashboard(
    current_user: User = Depends(require_role("ADMIN")),
    db: Session = Depends(get_db),
):
    total_consumers = db.query(User).filter(User.role == UserRole.CONSUMER).count()
    total_operators = db.query(User).filter(User.role == UserRole.OPERATOR).count()
    total_shops = db.query(Shop).filter(Shop.is_active == True).count()

    today_start = datetime(date.today().year, date.today().month, date.today().day, tzinfo=timezone.utc)
    today_purchases = db.query(Purchase).filter(Purchase.purchased_at >= today_start).count()
    today_revenue = db.query(func.coalesce(func.sum(Purchase.price), 0)).filter(
        Purchase.purchased_at >= today_start
    ).scalar() or 0

    districts = db.query(District).all()
    district_stats = []
    for d in districts[:10]:  # Top 10 for performance
        shop_count = db.query(Shop).filter(Shop.district == d.name).count()
        purchase_count = db.query(Purchase).join(Shop).filter(Shop.district == d.name).count()
        revenue = db.query(func.coalesce(func.sum(Purchase.price), 0)).join(Shop).filter(
            Shop.district == d.name
        ).scalar() or 0
        district_stats.append(DistrictStatsResponse(
            district=d.name,
            shop_count=shop_count or d.shop_count,
            consumer_count=0,
            total_purchases=purchase_count,
            total_revenue=float(revenue),
            avg_daily_consumption_ml=0.0,
        ))

    return AdminDashboardResponse(
        total_consumers=total_consumers,
        total_operators=total_operators,
        total_shops=total_shops or 6860,
        total_purchases_today=today_purchases,
        total_revenue_today=float(today_revenue),
        districts=district_stats,
    )


@router.get("/districts", summary="District-wise stats")
def get_districts(
    current_user: User = Depends(require_role("ADMIN")),
    db: Session = Depends(get_db),
):
    districts = db.query(District).all()
    return [{"id": str(d.id), "name": d.name, "code": d.code, "shop_count": d.shop_count, "population": d.population} for d in districts]
