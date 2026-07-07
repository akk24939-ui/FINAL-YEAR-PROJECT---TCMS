"""Consumer limits endpoints — view and update self-set purchase limits."""
from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.database import get_db
from app.core.dependencies import get_current_consumer
from app.models.user import User
from app.schemas.dashboard import ConsumerLimitsResponse, ConsumerLimitsUpdateRequest
from app.services import limits_service

router = APIRouter(prefix="/limits", tags=["Consumer Limits"])


@router.get("", response_model=ConsumerLimitsResponse)
def get_limits(
    current_user: User = Depends(get_current_consumer),
    db=Depends(get_db),
):
    """Return the consumer's current self-set purchase limits.

    Includes advisory cross-limit warnings and active restriction lock status.
    """
    return limits_service.get_limits(user=current_user, db=db)


@router.put("", response_model=ConsumerLimitsResponse)
def update_limits(
    body: ConsumerLimitsUpdateRequest,
    current_user: User = Depends(get_current_consumer),
    db=Depends(get_db),
):
    """Save new purchase limits and beverage preferences.

    Rules:
    - Blocked if a self-restriction lock is active (403).
    - Zero value = no limit set (effectively unlimited).
    - Advisory warnings returned when daily * 7 > weekly, etc.
    - Writes audit log entry on every successful save.
    """
    return limits_service.update_limits(user=current_user, data=body, db=db)
