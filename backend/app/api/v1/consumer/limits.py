"""Consumer limits endpoints — view limits, decrease/increase, lock, confirm increase."""
from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.database import get_db
from app.core.dependencies import get_current_consumer
from app.models.user import User
from app.schemas.consumer import LimitUpdateRequest, SelfRestrictionLockRequest, SelfRestrictionResponse
from app.services import restriction_service

router = APIRouter(prefix="/limits", tags=["Limits"])


@router.get("", response_model=SelfRestrictionResponse)
def get_limits(
    current_user: User = Depends(get_current_consumer),
    db=Depends(get_db),
):
    """Return the consumer's current purchase limits and lock state."""
    r = restriction_service.get_restrictions(user=current_user, db=db)
    return SelfRestrictionResponse(
        daily_limit_sd=r.daily_limit_sd,
        weekly_limit_sd=r.weekly_limit_sd,
        monthly_limit_sd=r.monthly_limit_sd,
        pending_daily_limit_sd=r.pending_daily_limit_sd,
        pending_weekly_limit_sd=r.pending_weekly_limit_sd,
        pending_monthly_limit_sd=r.pending_monthly_limit_sd,
        lock_requested_at=r.lock_requested_at,
        is_locked=r.is_locked,
        locked_until=r.locked_until,
        lock_reason=r.lock_reason,
    )


@router.put("", response_model=SelfRestrictionResponse)
def update_limits(
    body: LimitUpdateRequest,
    current_user: User = Depends(get_current_consumer),
    db=Depends(get_db),
):
    """Update purchase limits.

    - If all new values ≤ current: applied immediately.
    - If any new value > current: starts 24-hour cooling-off period.
    - Blocked while a self-restriction lock is active.
    """
    r = restriction_service.update_limits(user=current_user, data=body, db=db)
    return SelfRestrictionResponse(
        daily_limit_sd=r.daily_limit_sd,
        weekly_limit_sd=r.weekly_limit_sd,
        monthly_limit_sd=r.monthly_limit_sd,
        pending_daily_limit_sd=r.pending_daily_limit_sd,
        pending_weekly_limit_sd=r.pending_weekly_limit_sd,
        pending_monthly_limit_sd=r.pending_monthly_limit_sd,
        lock_requested_at=r.lock_requested_at,
        is_locked=r.is_locked,
        locked_until=r.locked_until,
        lock_reason=r.lock_reason,
    )


@router.post("/lock", response_model=SelfRestrictionResponse)
def lock_limits(
    body: SelfRestrictionLockRequest,
    current_user: User = Depends(get_current_consumer),
    db=Depends(get_db),
):
    """Apply a voluntary self-restriction lock for 1–365 days.

    While locked, purchase limits cannot be increased.
    """
    r = restriction_service.lock_limits(user=current_user, data=body, db=db)
    return SelfRestrictionResponse(
        daily_limit_sd=r.daily_limit_sd,
        weekly_limit_sd=r.weekly_limit_sd,
        monthly_limit_sd=r.monthly_limit_sd,
        pending_daily_limit_sd=r.pending_daily_limit_sd,
        pending_weekly_limit_sd=r.pending_weekly_limit_sd,
        pending_monthly_limit_sd=r.pending_monthly_limit_sd,
        lock_requested_at=r.lock_requested_at,
        is_locked=r.is_locked,
        locked_until=r.locked_until,
        lock_reason=r.lock_reason,
    )


@router.post("/confirm-increase", response_model=SelfRestrictionResponse)
def confirm_increase(
    current_user: User = Depends(get_current_consumer),
    db=Depends(get_db),
):
    """Apply a pending limit increase after the 24-hour cooling-off period.

    Raises 400 if the cooling-off period has not yet elapsed.
    """
    r = restriction_service.confirm_increase(user=current_user, db=db)
    return SelfRestrictionResponse(
        daily_limit_sd=r.daily_limit_sd,
        weekly_limit_sd=r.weekly_limit_sd,
        monthly_limit_sd=r.monthly_limit_sd,
        pending_daily_limit_sd=r.pending_daily_limit_sd,
        pending_weekly_limit_sd=r.pending_weekly_limit_sd,
        pending_monthly_limit_sd=r.pending_monthly_limit_sd,
        lock_requested_at=r.lock_requested_at,
        is_locked=r.is_locked,
        locked_until=r.locked_until,
        lock_reason=r.lock_reason,
    )
