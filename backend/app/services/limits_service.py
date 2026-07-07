"""
ConsumerLimits service — handles the dedicated consumer_limits table.

Completely separate from the SelfRestriction (lock/unlock) service.
The limits table stores what the consumer WANTS their limits to be.
The restriction table stores whether they are LOCKED from changing them.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.audit_log import AuditEventType, AuditLog
from app.models.consumer_limits import ConsumerLimits
from app.models.consumer_profile import ConsumerProfile
from app.models.restriction import SelfRestriction
from app.models.user import User
from app.schemas.dashboard import ConsumerLimitsResponse, ConsumerLimitsUpdateRequest


# ── helpers ───────────────────────────────────────────────────────────────────

def _write_audit(
    db: Session,
    event_type: AuditEventType,
    *,
    user_id,
    description: Optional[str] = None,
    metadata_json: Optional[dict] = None,
) -> None:
    try:
        db.add(AuditLog(
            user_id=user_id,
            event_type=event_type,
            description=description,
            metadata_json=metadata_json,
        ))
        db.flush()
    except Exception:
        pass


def _fetch_profile(user: User, db: Session) -> ConsumerProfile:
    profile = db.query(ConsumerProfile).filter(
        ConsumerProfile.user_id == user.id
    ).first()
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Consumer profile not found",
        )
    return profile


def _get_or_create_limits(consumer_id: uuid.UUID, db: Session) -> ConsumerLimits:
    """Fetch limits record, creating a default one if it doesn't exist yet."""
    limits = db.query(ConsumerLimits).filter(
        ConsumerLimits.consumer_id == consumer_id
    ).first()
    if limits is None:
        limits = ConsumerLimits(
            consumer_id=consumer_id,
            daily_limit_sd=0.0,
            weekly_limit_sd=0.0,
            monthly_limit_sd=0.0,
            beverage_preference=[],
        )
        db.add(limits)
        db.flush()
    return limits


def _is_locked(user: User, db: Session) -> tuple[bool, Optional[datetime]]:
    """Check if the consumer has an active self-restriction lock."""
    restriction = db.query(SelfRestriction).filter(
        SelfRestriction.user_id == user.id
    ).first()
    if restriction and restriction.is_locked:
        now = datetime.now(timezone.utc)
        if restriction.locked_until is None or restriction.locked_until > now:
            return True, restriction.locked_until
    return False, None


def _build_response(
    limits: ConsumerLimits,
    locked: bool,
    locked_until: Optional[datetime],
) -> ConsumerLimitsResponse:
    daily = limits.daily_limit_sd
    weekly = limits.weekly_limit_sd
    monthly = limits.monthly_limit_sd

    # Advisory cross-limit warnings (informational only, never block save)
    warn_weekly = weekly > 0 and daily > 0 and (daily * 7) > weekly
    warn_monthly = monthly > 0 and weekly > 0 and (weekly * 4) > monthly

    return ConsumerLimitsResponse(
        id=limits.id,
        consumer_id=limits.consumer_id,
        daily_limit_sd=daily,
        weekly_limit_sd=weekly,
        monthly_limit_sd=monthly,
        beverage_preference=limits.beverage_preference or [],
        warn_weekly_vs_daily=warn_weekly,
        warn_monthly_vs_weekly=warn_monthly,
        is_locked=locked,
        locked_until=locked_until,
        updated_at=limits.updated_at,
    )


# ── Public functions ──────────────────────────────────────────────────────────

def get_limits(user: User, db: Session) -> ConsumerLimitsResponse:
    """Return current limits for the authenticated consumer."""
    profile = _fetch_profile(user, db)
    limits = _get_or_create_limits(profile.id, db)
    db.commit()
    locked, locked_until = _is_locked(user, db)
    return _build_response(limits, locked, locked_until)


def update_limits(
    user: User, data: ConsumerLimitsUpdateRequest, db: Session
) -> ConsumerLimitsResponse:
    """Save new limits.

    Blocked if a self-restriction lock is active.
    Writes audit_log with old + new values.
    """
    locked, locked_until = _is_locked(user, db)
    if locked:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Limits are locked while self-restriction is active. "
                   "Lift the restriction first.",
        )

    profile = _fetch_profile(user, db)
    limits = _get_or_create_limits(profile.id, db)

    # Capture old values for audit
    old_values = {
        "daily": limits.daily_limit_sd,
        "weekly": limits.weekly_limit_sd,
        "monthly": limits.monthly_limit_sd,
        "beverage_preference": limits.beverage_preference,
    }

    # Apply new values
    limits.daily_limit_sd = data.daily_limit_sd
    limits.weekly_limit_sd = data.weekly_limit_sd
    limits.monthly_limit_sd = data.monthly_limit_sd
    limits.beverage_preference = data.beverage_preference

    _write_audit(
        db,
        AuditEventType.LIMIT_CHANGED,
        user_id=user.id,
        description="Consumer limits updated",
        metadata_json={
            "old": old_values,
            "new": {
                "daily": data.daily_limit_sd,
                "weekly": data.weekly_limit_sd,
                "monthly": data.monthly_limit_sd,
                "beverage_preference": data.beverage_preference,
            },
        },
    )
    db.commit()
    db.refresh(limits)

    return _build_response(limits, locked=False, locked_until=None)
