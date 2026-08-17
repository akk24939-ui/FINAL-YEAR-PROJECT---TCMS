"""Admin consumers endpoint — read-only view of consumer accounts."""
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

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
    if not profile or not profile.aadhaar_encrypted:
        return None
    try:
        raw = decrypt_aadhaar(profile.aadhaar_encrypted)
        return mask_aadhaar(raw)
    except Exception:
        logger.warning("aadhaar decryption failed for consumer_profile id=%s", profile.id)
        return None


@router.get("/consumers", summary="Search and list consumers (admin view)")
async def list_consumers(
    search: Optional[str] = Query(None, description="Search by name or mobile number"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    users, total = await admin_service.list_consumers(db, search=search, skip=skip, limit=limit)

    logger.info(
        "admin=%s list_consumers search=%r skip=%d limit=%d → total=%d returned=%d",
        current_user.id, search, skip, limit, total, len(users),
    )

    now_utc = datetime.now(timezone.utc)
    results = []
    for user, profile in users:
        # profile is already eagerly loaded — no lazy-load needed

        restriction_result = await db.execute(
            select(SelfRestriction).where(
                SelfRestriction.user_id == user.id,
                SelfRestriction.is_locked == True,  # noqa
            ).where(
                (SelfRestriction.locked_until == None)  # noqa
                | (SelfRestriction.locked_until > now_utc)
            )
        )
        active_restriction = restriction_result.scalar_one_or_none()

        results.append({
            "user_id": str(user.id),
            "full_name": user.full_name,
            "email": user.email,
            "mobile_number": user.mobile_number,
            "is_active": user.is_active,
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
            "aadhaar_masked": _safe_aadhaar_masked(profile),
            "district": profile.district if profile else None,
            "is_teetotaler": profile.is_teetotaler if profile else False,
            "is_self_restricted": active_restriction is not None,
            "restriction_until": (
                active_restriction.locked_until.isoformat()
                if active_restriction and active_restriction.locked_until
                else None
            ),
        })

    return {"total": total, "consumers": results}
