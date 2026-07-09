"""Admin consumers endpoint — read-only view of consumer accounts."""
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_admin
from app.models.consumer_profile import ConsumerProfile
from app.models.restriction import SelfRestriction
from app.models.user import User
from app.services import admin_service

router = APIRouter()


@router.get("/consumers", summary="Search and list consumers (admin view)")
def list_consumers(
    search: Optional[str] = Query(None, description="Search by name"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    users, total = admin_service.list_consumers(db, search=search, skip=skip, limit=limit)

    results = []
    for user in users:
        profile: Optional[ConsumerProfile] = user.consumer_profile
        # Active restriction
        active_restriction = (
            db.query(SelfRestriction)
            .filter(
                SelfRestriction.user_id == user.id,
                SelfRestriction.is_active == True,
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
            "aadhaar_masked": profile.aadhaar_masked if profile else None,
            "district": profile.district if profile else None,
            "is_teetotaler": profile.is_teetotaler if profile else False,
            "is_self_restricted": active_restriction is not None,
            "restriction_until": (
                active_restriction.restriction_until.isoformat()
                if active_restriction and active_restriction.restriction_until
                else None
            ),
        })

    return {"total": total, "consumers": results}
