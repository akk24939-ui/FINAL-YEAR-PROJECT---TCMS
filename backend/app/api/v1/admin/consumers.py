"""Admin consumers endpoint — read-only view of consumer accounts.

Bug fixes applied (2026-07-13):
  1. profile.aadhaar_masked does not exist on ConsumerProfile model.
     Fixed to decrypt + mask dynamically via decrypt_aadhaar / mask_aadhaar.
  2. SelfRestriction.is_active does not exist. Fixed to use is_locked +
     locked_until expiry check (same fix applied in operator_service.py).
  3. active_restriction.restriction_until does not exist. Fixed to use
     locked_until (the actual column name on SelfRestriction).
"""
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_admin
from app.core.security import decrypt_aadhaar, mask_aadhaar
from app.models.consumer_profile import ConsumerProfile
from app.models.restriction import SelfRestriction
from app.models.user import User
from app.services import admin_service

logger = logging.getLogger(__name__)

router = APIRouter()


def _safe_aadhaar_masked(profile: Optional[ConsumerProfile]) -> Optional[str]:
    """Decrypt and mask Aadhaar from the consumer profile.

    Returns None gracefully if profile is missing, aadhaar_encrypted is
    null, or decryption fails (e.g. key rotation).
    """
    if not profile or not profile.aadhaar_encrypted:
        return None
    try:
        raw = decrypt_aadhaar(profile.aadhaar_encrypted)
        return mask_aadhaar(raw)
    except Exception:
        logger.warning(
            "aadhaar decryption failed for consumer_profile id=%s",
            profile.id,
        )
        return None


@router.get("/consumers", summary="Search and list consumers (admin view)")
def list_consumers(
    search: Optional[str] = Query(None, description="Search by name or mobile number"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Return a paginated, searchable list of all CONSUMER accounts.

    Logging is added so that empty-result cases are traceable in server
    logs without requiring a debugger.
    """
    users, total = admin_service.list_consumers(db, search=search, skip=skip, limit=limit)

    logger.info(
        "admin=%s list_consumers search=%r skip=%d limit=%d → total=%d returned=%d",
        current_user.id, search, skip, limit, total, len(users),
    )

    if total == 0:
        logger.warning(
            "admin consumer list returned 0 results (search=%r). "
            "Check that CONSUMER-role users exist in the database.",
            search,
        )

    now_utc = datetime.now(timezone.utc)

    results = []
    for user in users:
        profile: Optional[ConsumerProfile] = user.consumer_profile

        # Active restriction: is_locked=True AND lock has not expired
        active_restriction = (
            db.query(SelfRestriction)
            .filter(
                SelfRestriction.user_id == user.id,
                SelfRestriction.is_locked == True,  # noqa: E712
            )
            .filter(
                # locked_until is NULL (permanent lock) OR still in the future
                (SelfRestriction.locked_until == None)  # noqa: E711
                | (SelfRestriction.locked_until > now_utc)
            )
            .first()
        )

        results.append({
            "user_id": str(user.id),
            "full_name": user.full_name,
            "email": user.email,
            "mobile_number": user.mobile_number,
            "is_active": user.is_active,
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
            # Bug fix: was profile.aadhaar_masked (AttributeError) — now computed safely
            "aadhaar_masked": _safe_aadhaar_masked(profile),
            "district": profile.district if profile else None,
            "is_teetotaler": profile.is_teetotaler if profile else False,
            "is_self_restricted": active_restriction is not None,
            # Bug fix: was active_restriction.restriction_until (wrong field name)
            "restriction_until": (
                active_restriction.locked_until.isoformat()
                if active_restriction and active_restriction.locked_until
                else None
            ),
        })

    return {"total": total, "consumers": results}
