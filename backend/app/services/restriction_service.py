"""Restriction service — consumer-imposed purchase limits with cooling-off enforcement.

Business rules (enforced at the service layer):
1. DECREASE: new values ≤ current → applied immediately.
2. INCREASE: new values > current → 24-hour cooling-off period required.
3. Cannot change limits while a self-restriction lock is active.
4. Lock means: is_locked=True AND locked_until > now().
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.audit_log import AuditEventType, AuditLog
from app.models.notification import (
    Notification,
    NotificationCategory,
    NotificationType,
)
from app.models.restriction import SelfRestriction
from app.models.user import User
from app.schemas.consumer import LimitUpdateRequest, SelfRestrictionLockRequest


# ── Internal helpers ───────────────────────────────────────────────────────────

def _write_audit(
    db: Session,
    event_type: AuditEventType,
    *,
    user_id,
    description: Optional[str] = None,
    metadata_json: Optional[dict] = None,
) -> None:
    try:
        log = AuditLog(
            user_id=user_id,
            event_type=event_type,
            description=description,
            metadata_json=metadata_json,
        )
        db.add(log)
        db.flush()
    except Exception:
        pass


def _fetch_restriction(user: User, db: Session) -> SelfRestriction:
    r = (
        db.query(SelfRestriction)
        .filter(SelfRestriction.user_id == user.id)
        .first()
    )
    if r is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restriction record not found",
        )
    return r


def _is_locked(restriction: SelfRestriction) -> bool:
    if not restriction.is_locked:
        return False
    if restriction.locked_until is None:
        return True
    return restriction.locked_until > datetime.now(timezone.utc)


# ── Public service functions ───────────────────────────────────────────────────

def get_restrictions(user: User, db: Session) -> SelfRestriction:
    """Fetch the restriction record for *user*.

    Ownership is enforced by filtering on user.id from JWT.
    """
    return _fetch_restriction(user, db)


def update_limits(
    user: User, data: LimitUpdateRequest, db: Session
) -> SelfRestriction:
    """Update purchase limits with cooling-off logic.

    - DECREASE (all new ≤ all current): applied instantly.
    - INCREASE (any new > any current): sets pending fields and starts 24h timer.
    - Blocked if account is actively locked.
    """
    r = _fetch_restriction(user, db)

    if _is_locked(r):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Cannot change limits while a self-restriction lock is active. "
                f"Lock expires at {r.locked_until.isoformat() if r.locked_until else 'never'}."
            ),
        )

    is_decrease = (
        data.daily_limit_sd <= r.daily_limit_sd
        and data.weekly_limit_sd <= r.weekly_limit_sd
        and data.monthly_limit_sd <= r.monthly_limit_sd
    )

    if is_decrease:
        old = {
            "daily": r.daily_limit_sd,
            "weekly": r.weekly_limit_sd,
            "monthly": r.monthly_limit_sd,
        }
        r.daily_limit_sd = data.daily_limit_sd
        r.weekly_limit_sd = data.weekly_limit_sd
        r.monthly_limit_sd = data.monthly_limit_sd
        # Clear any stale pending increase
        r.pending_daily_limit_sd = None
        r.pending_weekly_limit_sd = None
        r.pending_monthly_limit_sd = None
        r.lock_requested_at = None

        _write_audit(
            db,
            AuditEventType.LIMIT_CHANGED,
            user_id=user.id,
            description="Limits decreased immediately",
            metadata_json={
                "old": old,
                "new": {
                    "daily": data.daily_limit_sd,
                    "weekly": data.weekly_limit_sd,
                    "monthly": data.monthly_limit_sd,
                },
            },
        )
    else:
        # Increase path — set pending values and start cooling-off
        r.pending_daily_limit_sd = data.daily_limit_sd
        r.pending_weekly_limit_sd = data.weekly_limit_sd
        r.pending_monthly_limit_sd = data.monthly_limit_sd
        r.lock_requested_at = datetime.now(timezone.utc)

        _write_audit(
            db,
            AuditEventType.LIMIT_INCREASE_REQUESTED,
            user_id=user.id,
            description="Limit increase requested — 24h cooling-off started",
            metadata_json={
                "pending": {
                    "daily": data.daily_limit_sd,
                    "weekly": data.weekly_limit_sd,
                    "monthly": data.monthly_limit_sd,
                }
            },
        )

        # Notify user
        db.add(Notification(
            user_id=user.id,
            notification_type=NotificationType.INFO,
            category=NotificationCategory.SELF_RESTRICTION,
            title="Limit Increase Requested",
            message=(
                "Your limit increase request has been recorded. "
                f"You can confirm it after {settings.COOLING_OFF_HOURS} hours."
            ),
        ))

    db.commit()
    db.refresh(r)
    return r


def lock_limits(
    user: User, data: SelfRestrictionLockRequest, db: Session
) -> SelfRestriction:
    """Apply a voluntary self-restriction lock for *data.lock_days* days."""
    r = _fetch_restriction(user, db)

    if _is_locked(r):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A lock is already active on this account.",
        )

    r.is_locked = True
    r.locked_until = datetime.now(timezone.utc) + timedelta(days=data.lock_days)
    r.lock_reason = data.lock_reason

    _write_audit(
        db,
        AuditEventType.SELF_RESTRICTION_LOCKED,
        user_id=user.id,
        description="Self-restriction lock applied",
        metadata_json={
            "lock_days": data.lock_days,
            "locked_until": r.locked_until.isoformat(),
        },
    )

    db.add(Notification(
        user_id=user.id,
        notification_type=NotificationType.INFO,
        category=NotificationCategory.SELF_RESTRICTION,
        title="Self-Restriction Lock Active",
        message=(
            f"Your account has been locked for {data.lock_days} day(s). "
            "You cannot increase purchase limits during this period."
        ),
    ))

    db.commit()
    db.refresh(r)
    return r


def request_increase(
    user: User, data: LimitUpdateRequest, db: Session
) -> SelfRestriction:
    """Alias for the INCREASE path of update_limits — starts cooling-off period."""
    return update_limits(user, data, db)


def confirm_increase(user: User, db: Session) -> SelfRestriction:
    """Apply pending limit increase after the cooling-off period has elapsed."""
    r = _fetch_restriction(user, db)

    if r.lock_requested_at is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No pending limit increase to confirm.",
        )

    cooling_off = timedelta(hours=settings.COOLING_OFF_HOURS)
    elapsed = datetime.now(timezone.utc) - r.lock_requested_at

    if elapsed < cooling_off:
        remaining_seconds = int((cooling_off - elapsed).total_seconds())
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Cooling-off period has not elapsed. "
                f"Please wait {remaining_seconds // 3600}h "
                f"{(remaining_seconds % 3600) // 60}m more."
            ),
        )

    # Apply pending values
    r.daily_limit_sd = r.pending_daily_limit_sd or r.daily_limit_sd
    r.weekly_limit_sd = r.pending_weekly_limit_sd or r.weekly_limit_sd
    r.monthly_limit_sd = r.pending_monthly_limit_sd or r.monthly_limit_sd

    # Clear pending
    r.pending_daily_limit_sd = None
    r.pending_weekly_limit_sd = None
    r.pending_monthly_limit_sd = None
    r.lock_requested_at = None

    _write_audit(
        db,
        AuditEventType.LIMIT_INCREASE_CONFIRMED,
        user_id=user.id,
        description="Limit increase confirmed after cooling-off period",
        metadata_json={
            "new_daily": r.daily_limit_sd,
            "new_weekly": r.weekly_limit_sd,
            "new_monthly": r.monthly_limit_sd,
        },
    )

    db.add(Notification(
        user_id=user.id,
        notification_type=NotificationType.SUCCESS,
        category=NotificationCategory.SELF_RESTRICTION,
        title="Limit Increase Confirmed",
        message="Your purchase limits have been successfully increased.",
    ))

    db.commit()
    db.refresh(r)
    return r
