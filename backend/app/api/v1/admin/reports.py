"""Admin reports endpoint — district stats and summary exports."""
from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_admin
from app.models.purchase import Purchase
from app.models.shop import Shop
from app.models.user import User, UserRole

router = APIRouter()


@router.get("/reports/summary", summary="System summary report")
async def get_summary(
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(
        select(func.count()).select_from(User).where(User.role == UserRole.CONSUMER)
    )
    total_consumers = r.scalar_one()

    r = await db.execute(
        select(func.count()).select_from(Shop).where(Shop.is_active == True)
    )
    total_shops = r.scalar_one()

    r = await db.execute(select(func.count()).select_from(Purchase))
    total_purchases = r.scalar_one()

    r = await db.execute(
        select(func.coalesce(func.sum(Purchase.price), 0))
    )
    total_revenue = r.scalar_one() or 0

    return {
        "total_consumers": total_consumers,
        "total_active_shops": total_shops,
        "total_purchases": total_purchases,
        "total_revenue": float(total_revenue),
    }


@router.get("/reports/district-sales", summary="District-wise sales report")
async def get_district_sales(
    page_size: int = 20,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Returns per-district purchase count and revenue."""
    r = await db.execute(
        select(Shop.district, func.count(Purchase.id), func.coalesce(func.sum(Purchase.price), 0))
        .join(Purchase, Purchase.shop_id == Shop.id, isouter=True)
        .group_by(Shop.district)
        .order_by(Shop.district)
        .limit(page_size)
    )
    rows = r.all()
    return {
        "districts": [
            {
                "district": row[0],
                "total_purchases": row[1],
                "total_revenue": float(row[2]),
            }
            for row in rows
        ]
    }


@router.get("/reports/age-groups", summary="Purchases by consumer age group")
async def get_age_groups(
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Placeholder — returns empty buckets until ConsumerProfile.dob is wired up."""
    return {
        "age_groups": [
            {"group": "18-25", "count": 0},
            {"group": "26-35", "count": 0},
            {"group": "36-50", "count": 0},
            {"group": "51+",   "count": 0},
        ]
    }


@router.get("/reports/daily-trend", summary="Daily purchase trend (last 30 days)")
async def get_daily_trend(
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Returns daily purchase count for the last 30 days."""
    from sqlalchemy import cast, Date, text
    r = await db.execute(
        select(
            cast(Purchase.purchased_at, Date).label("day"),
            func.count(Purchase.id).label("count"),
        )
        .group_by(text("day"))
        .order_by(text("day"))
    )
    rows = r.all()
    return {
        "daily_trend": [
            {"date": str(row[0]), "purchases": row[1]}
            for row in rows
        ]
    }


@router.get("/reports/restriction-adoption", summary="Restriction adopted by consumers")
async def get_restriction_adoption(
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Returns counts of consumers who have adopted various restriction types."""
    from app.models.consumer_profile import ConsumerProfile
    from app.models.restriction import SelfRestriction

    r = await db.execute(
        select(func.count()).select_from(ConsumerProfile)
        .where(ConsumerProfile.is_teetotaler == True)
    )
    teetotalers = r.scalar_one()

    r = await db.execute(
        select(func.count()).select_from(SelfRestriction)
        .where(SelfRestriction.is_locked == True)
    )
    self_locked = r.scalar_one()

    return {
        "restriction_adoption": {
            "teetotalers": teetotalers,
            "self_locked": self_locked,
        }
    }


@router.get("/reports/district-stats", summary="District-wise stats report (legacy)")
async def get_district_stats(
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    return await get_district_sales(page_size=100, current_user=current_user, db=db)
