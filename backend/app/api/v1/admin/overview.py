"""Admin overview endpoint — dashboard stats."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_admin
from app.models.audit_log import AuditLog
from app.models.purchase import Purchase
from app.models.shop import Shop
from app.models.user import User, UserRole

router = APIRouter()


@router.get("/overview", summary="Admin dashboard overview stats")
async def get_overview(
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    # Total consumers
    r = await db.execute(
        select(func.count()).select_from(User)
        .where(User.role == UserRole.CONSUMER, User.is_active == True)
    )
    total_consumers = r.scalar_one()

    # Total operators
    r = await db.execute(
        select(func.count()).select_from(User)
        .where(User.role == UserRole.OPERATOR, User.is_active == True)
    )
    total_operators = r.scalar_one()

    # Total doctors
    r = await db.execute(
        select(func.count()).select_from(User)
        .where(User.role == UserRole.DOCTOR)
    )
    total_doctors = r.scalar_one()

    # Total / suspended shops
    r = await db.execute(
        select(func.count()).select_from(Shop).where(Shop.is_active == True)
    )
    total_shops = r.scalar_one()

    r = await db.execute(
        select(func.count()).select_from(Shop).where(Shop.is_active == False)
    )
    suspended_shops = r.scalar_one()

    # Today's purchases
    today_start = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    r = await db.execute(
        select(func.count()).select_from(Purchase)
        .where(Purchase.purchased_at >= today_start)
    )
    today_purchases = r.scalar_one()

    # Recent 10 audit events
    r = await db.execute(
        select(AuditLog).order_by(AuditLog.created_at.desc()).limit(10)
    )
    recent_logs = r.scalars().all()

    recent_audit = [
        {
            "id": str(log.id),
            "event_type": log.event_type,
            "description": log.description,
            "ip_address": log.ip_address,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        }
        for log in recent_logs
    ]

    return {
        "total_consumers": total_consumers,
        "total_operators": total_operators,
        "total_doctors": total_doctors,
        "total_shops": total_shops,
        "suspended_shops": suspended_shops,
        "today_purchases": today_purchases,
        "recent_audit": recent_audit,
    }
