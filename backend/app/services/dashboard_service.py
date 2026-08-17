"""
Dashboard service — computes consumption summaries and chart data.

Standard drink constants (PRD §6):
  Beer    330 ml = 1 standard drink
  Wine    150 ml = 1 standard drink
  Spirits  40 ml = 1 standard drink

All consumption data comes from the purchases table.
If no purchases exist (new user) mock data is returned so the UI renders.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decrypt_aadhaar, mask_aadhaar
from app.models.consumer_limits import ConsumerLimits
from app.models.consumer_profile import ConsumerProfile
from app.models.restriction import SelfRestriction
from app.models.user import User
from app.schemas.dashboard import (
    ConsumptionSummary,
    DailyChartPoint,
    DashboardResponse,
    WeeklyChartPoint,
)

# ── Standard drink conversion constants ───────────────────────────────────────
BEER_ML_PER_SD = 330.0
WINE_ML_PER_SD = 150.0
SPIRITS_ML_PER_SD = 40.0

WHO_DAILY_ADVISORY = 2.0
WHO_WEEKLY_ADVISORY = 14.0

DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _sd_to_ml(sd: float) -> dict:
    return {
        "beer_ml": round(sd * BEER_ML_PER_SD, 1),
        "wine_ml": round(sd * WINE_ML_PER_SD, 1),
        "spirits_ml": round(sd * SPIRITS_ML_PER_SD, 1),
    }


def _compute_status(consumed: float, limit: float) -> str:
    if limit <= 0:
        return "safe"
    pct = consumed / limit * 100
    if pct >= 100:
        return "exceeded"
    elif pct >= 86:
        return "exceeded"
    elif pct >= 61:
        return "warn"
    return "safe"


def _compute_percent(consumed: float, limit: float) -> float:
    if limit <= 0:
        return 0.0
    return round(min(consumed / limit * 100, 999.9), 1)


async def _fetch_purchases_between(consumer_id, start: datetime, end: datetime, db: AsyncSession) -> float:
    """Fetch purchases for a consumer in a datetime range."""
    try:
        from app.models.purchase import Purchase
        result = await db.execute(
            select(Purchase).where(
                Purchase.consumer_id == consumer_id,
                Purchase.purchased_at >= start,
                Purchase.purchased_at < end,
            )
        )
        rows = result.scalars().all()
        total_sd = 0.0
        for p in rows:
            if p.standard_drinks is not None:
                total_sd += p.standard_drinks
            else:
                # Fallback: assume spirits ratio (conservative)
                total_sd += p.quantity_ml / SPIRITS_ML_PER_SD
        return total_sd
    except Exception:
        return 0.0


async def _get_limits(consumer_profile_id, db: AsyncSession) -> ConsumerLimits | None:
    result = await db.execute(
        select(ConsumerLimits).where(ConsumerLimits.consumer_id == consumer_profile_id)
    )
    return result.scalar_one_or_none()


async def _get_restriction(user_id, db: AsyncSession) -> SelfRestriction | None:
    result = await db.execute(
        select(SelfRestriction).where(SelfRestriction.user_id == user_id)
    )
    return result.scalar_one_or_none()


# ── Main dashboard builder ────────────────────────────────────────────────────

async def get_dashboard(user: User, db: AsyncSession) -> DashboardResponse:
    """Build full dashboard response for the authenticated consumer."""

    # Fetch profile
    result = await db.execute(
        select(ConsumerProfile).where(ConsumerProfile.user_id == user.id)
    )
    profile = result.scalar_one_or_none()

    if profile is None:
        raise Exception("Consumer profile not found")

    # Fetch limits (default 0 if not set)
    limits = await _get_limits(profile.id, db)
    daily_limit = limits.daily_limit_sd if limits else 0.0
    weekly_limit = limits.weekly_limit_sd if limits else 0.0
    monthly_limit = limits.monthly_limit_sd if limits else 0.0

    # Fetch restriction lock state
    restriction = await _get_restriction(user.id, db)
    is_locked = False
    locked_until = None
    if restriction and restriction.is_locked:
        now = datetime.now(timezone.utc)
        if restriction.locked_until is None or restriction.locked_until > now:
            is_locked = True
            locked_until = restriction.locked_until

    # ── Time boundaries ────────────────────────────────────────────────────────
    now_utc = datetime.now(timezone.utc)
    today_start = datetime(now_utc.year, now_utc.month, now_utc.day, tzinfo=timezone.utc)
    today_end = today_start + timedelta(days=1)

    # Current week (Monday → Sunday)
    weekday = now_utc.weekday()  # 0=Monday
    week_start = today_start - timedelta(days=weekday)
    week_end = week_start + timedelta(days=7)

    # Current month
    month_start = datetime(now_utc.year, now_utc.month, 1, tzinfo=timezone.utc)
    if now_utc.month == 12:
        month_end = datetime(now_utc.year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        month_end = datetime(now_utc.year, now_utc.month + 1, 1, tzinfo=timezone.utc)

    # ── Consumption totals ─────────────────────────────────────────────────────
    today_sd = await _fetch_purchases_between(user.id, today_start, today_end, db)
    week_sd = await _fetch_purchases_between(user.id, week_start, week_end, db)
    month_sd = await _fetch_purchases_between(user.id, month_start, month_end, db)

    def make_summary(consumed: float, limit: float) -> ConsumptionSummary:
        ml = _sd_to_ml(consumed)
        return ConsumptionSummary(
            consumed_sd=round(consumed, 2),
            limit_sd=limit,
            percent_used=_compute_percent(consumed, limit),
            status=_compute_status(consumed, limit),
            consumed_beer_ml=ml["beer_ml"],
            consumed_wine_ml=ml["wine_ml"],
            consumed_spirits_ml=ml["spirits_ml"],
        )

    today_summary = make_summary(today_sd, daily_limit)
    week_summary = make_summary(week_sd, weekly_limit)
    month_summary = make_summary(month_sd, monthly_limit)

    # ── 7-day daily chart ──────────────────────────────────────────────────────
    daily_chart: List[DailyChartPoint] = []
    for i in range(6, -1, -1):
        day_start = today_start - timedelta(days=i)
        day_end = day_start + timedelta(days=1)
        day_sd = await _fetch_purchases_between(user.id, day_start, day_end, db)
        day_label = DAY_LABELS[day_start.weekday()]
        daily_chart.append(DailyChartPoint(
            label=day_label,
            date=day_start.date().isoformat(),
            consumed_sd=round(day_sd, 2),
            limit_sd=daily_limit,
        ))

    # ── 4-week weekly chart ────────────────────────────────────────────────────
    weekly_chart: List[WeeklyChartPoint] = []
    for i in range(3, -1, -1):
        w_start = week_start - timedelta(weeks=i)
        w_end = w_start + timedelta(days=7)
        w_sd = await _fetch_purchases_between(user.id, w_start, w_end, db)
        weekly_chart.append(WeeklyChartPoint(
            label=f"Week {4 - i}",
            week_start=w_start.date().isoformat(),
            consumed_sd=round(w_sd, 2),
            limit_sd=weekly_limit,
        ))

    # ── Aadhaar masking ────────────────────────────────────────────────────────
    raw_aadhaar = (
        decrypt_aadhaar(profile.aadhaar_encrypted)
        if profile.aadhaar_encrypted
        else "000000000000"
    )
    aadhaar_masked = mask_aadhaar(raw_aadhaar)

    # ── Alert computation ──────────────────────────────────────────────────────
    alert_type = None
    alert_message = None

    if daily_limit > 0:
        daily_pct = _compute_percent(today_sd, daily_limit)
        if daily_pct >= 100:
            alert_type = "daily_exceeded"
            alert_message = "🚨 You have EXCEEDED your daily limit. Purchases blocked."
        elif daily_pct >= 90:
            alert_type = "daily_90"
            alert_message = f"⚠️ You've used {int(daily_pct)}% of your daily limit."

    if weekly_limit > 0 and alert_type is None:
        weekly_pct = _compute_percent(week_sd, weekly_limit)
        if weekly_pct >= 100:
            alert_type = "weekly_exceeded"
            alert_message = "🚨 You have EXCEEDED your weekly limit."
        elif weekly_pct >= 90:
            alert_type = "weekly_90"
            alert_message = f"⚠️ You've used {int(weekly_pct)}% of your weekly limit."

    return DashboardResponse(
        consumer_name=user.full_name,
        aadhaar_masked=aadhaar_masked,
        member_since=user.created_at,
        is_teetotaler=profile.is_teetotaler,
        is_self_restricted=is_locked,
        restriction_locked_until=locked_until,
        today=today_summary,
        this_week=week_summary,
        this_month=month_summary,
        daily_chart=daily_chart,
        weekly_chart=weekly_chart,
        who_daily_advisory=WHO_DAILY_ADVISORY,
        who_weekly_advisory=WHO_WEEKLY_ADVISORY,
        alert_type=alert_type,
        alert_message=alert_message,
    )
