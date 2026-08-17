"""Admin/analytics router — district analytics, revenue, export (gov_admin + doctor).
Also exposes the consumer management list used by the Admin Portal Consumers page.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_role
from app.core.security import decrypt_aadhaar, mask_aadhaar
from app.models.consumer_profile import ConsumerProfile
from app.models.models import Consumer, Product, Purchase, Shop, User
from app.models.restriction import SelfRestriction
from app.models.user import UserRole

router = APIRouter(prefix="/admin", tags=["admin"])
limiter = Limiter(key_func=get_remote_address)

K_ANON_THRESHOLD = 5  # suppress cells with fewer than this many unique consumers


# ── Consumer list (admin read-only view) ────────────────────────────────────────
@router.get("/consumers")
async def list_consumers(
    search: Optional[str] = Query(default=None, description="Filter by name or mobile"),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    current_user: User = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    """Read-only paginated consumer list for the Admin Portal.

    Returns: name, masked Aadhaar, district, flags (teetotaler / self-restricted),
             last login, and account status. No raw Aadhaar ever returned.
    """
    # ── Base query: join User → ConsumerProfile (LEFT so users without profile show) ──
    base_q = (
        select(User, ConsumerProfile, SelfRestriction)
        .outerjoin(ConsumerProfile, ConsumerProfile.user_id == User.id)
        .outerjoin(SelfRestriction, SelfRestriction.user_id == User.id)
        .where(User.role == UserRole.CONSUMER)
    )

    if search:
        pattern = f"%{search.strip()}%"
        base_q = base_q.where(
            or_(
                User.full_name.ilike(pattern),
                User.mobile_number.ilike(pattern),
            )
        )

    # Count total (without pagination)
    count_q = select(func.count()).select_from(
        select(User.id)
        .outerjoin(ConsumerProfile, ConsumerProfile.user_id == User.id)
        .outerjoin(SelfRestriction, SelfRestriction.user_id == User.id)
        .where(User.role == UserRole.CONSUMER)
        .subquery()
    )
    if search:
        pattern = f"%{search.strip()}%"
        count_q = select(func.count()).select_from(
            select(User.id)
            .outerjoin(ConsumerProfile, ConsumerProfile.user_id == User.id)
            .where(User.role == UserRole.CONSUMER)
            .where(
                or_(
                    User.full_name.ilike(pattern),
                    User.mobile_number.ilike(pattern),
                )
            )
            .subquery()
        )

    total_result = await db.execute(count_q)
    total = total_result.scalar_one_or_none() or 0

    rows_result = await db.execute(
        base_q.order_by(User.created_at.desc()).offset(skip).limit(limit)
    )
    rows = rows_result.all()

    now = datetime.now(timezone.utc)

    consumers = []
    for row in rows:
        user: User = row[0]
        profile: Optional[ConsumerProfile] = row[1]
        restriction: Optional[SelfRestriction] = row[2]

        # Mask Aadhaar — only last 4 digits
        aadhaar_masked: Optional[str] = None
        if profile and profile.aadhaar_encrypted:
            try:
                raw = decrypt_aadhaar(profile.aadhaar_encrypted)
                aadhaar_masked = mask_aadhaar(raw)
            except Exception:
                aadhaar_masked = "XXXX XXXX ????"

        # is_self_restricted = restriction lock is currently active
        is_self_restricted = False
        restriction_until: Optional[str] = None
        if restriction and restriction.is_locked:
            if restriction.locked_until is None or restriction.locked_until > now:
                is_self_restricted = True
                restriction_until = restriction.locked_until.isoformat() if restriction.locked_until else None

        consumers.append({
            "user_id": str(user.id),
            "full_name": user.full_name,
            "email": user.email if not user.email.endswith("@consumer.tasmac.local") else "",
            "mobile_number": user.mobile_number,
            "is_active": user.is_active,
            "created_at": user.created_at.isoformat(),
            "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
            "aadhaar_masked": aadhaar_masked,
            "district": profile.district if profile else None,
            "is_teetotaler": profile.is_teetotaler if profile else False,
            "is_self_restricted": is_self_restricted,
            "restriction_until": restriction_until,
        })

    return {"total": total, "consumers": consumers}





@router.get("/analytics/district")
async def district_analytics(
    district: str = Query(default=None),
    current_user: User = Depends(require_role("gov_admin")),
    db: AsyncSession = Depends(get_db),
):
    """Returns anonymised aggregate purchase stats per district. k-anonymity enforced."""
    q = (
        select(
            Consumer.district,
            func.count(Purchase.id).label("total_purchases"),
            func.coalesce(func.sum(Product.standard_drink_equiv * Purchase.quantity), 0).label("total_drinks"),
            func.count(func.distinct(Consumer.id)).label("unique_consumers"),
        )
        .join(Purchase, Purchase.consumer_id == Consumer.id)
        .join(Product, Purchase.product_id == Product.id)
        .group_by(Consumer.district)
        .having(func.count(func.distinct(Consumer.id)) >= K_ANON_THRESHOLD)
    )
    if district:
        q = q.where(Consumer.district == district)
    result = await db.execute(q)
    rows = result.fetchall()
    return [
        {
            "district": r.district,
            "total_purchases": r.total_purchases,
            "total_standard_drinks": float(r.total_drinks),
            "unique_consumers": r.unique_consumers,
        }
        for r in rows
    ]


@router.get("/analytics/revenue")
async def revenue_analytics(
    current_user: User = Depends(require_role("gov_admin")),
    db: AsyncSession = Depends(get_db),
):
    """Aggregated revenue by shop district — no individual consumer data exposed."""
    q = (
        select(
            Shop.district,
            func.count(Purchase.id).label("transactions"),
            func.coalesce(func.sum(Product.price * Purchase.quantity), 0).label("revenue"),
        )
        .join(Purchase, Purchase.shop_id == Shop.id)
        .join(Product, Purchase.product_id == Product.id)
        .group_by(Shop.district)
    )
    result = await db.execute(q)
    rows = result.fetchall()
    return [
        {"district": r.district, "transactions": r.transactions, "revenue": float(r.revenue)}
        for r in rows
    ]


@router.get("/analytics/health-trends")
async def health_trends(
    current_user: User = Depends(require_role("doctor")),
    db: AsyncSession = Depends(get_db),
):
    """Anonymous health trend data — only age‑groups and aggregate consumption. No PII."""
    result = await db.execute(text("""
        SELECT
            CASE
                WHEN EXTRACT(YEAR FROM age(c.dob)) < 25 THEN '<25'
                WHEN EXTRACT(YEAR FROM age(c.dob)) < 35 THEN '25-34'
                WHEN EXTRACT(YEAR FROM age(c.dob)) < 45 THEN '35-44'
                WHEN EXTRACT(YEAR FROM age(c.dob)) < 55 THEN '45-54'
                ELSE '55+'
            END AS age_group,
            COUNT(DISTINCT c.id) AS consumer_count,
            COALESCE(SUM(p2.standard_drink_equiv * pu.quantity), 0) AS total_drinks
        FROM consumers c
        JOIN purchases pu ON pu.consumer_id = c.id
        JOIN products p2 ON p2.id = pu.product_id
        GROUP BY age_group
        HAVING COUNT(DISTINCT c.id) >= :threshold
        ORDER BY age_group
    """), {"threshold": K_ANON_THRESHOLD})
    rows = result.fetchall()
    return [
        {"age_group": r.age_group, "consumer_count": r.consumer_count, "total_drinks": float(r.total_drinks)}
        for r in rows
    ]
