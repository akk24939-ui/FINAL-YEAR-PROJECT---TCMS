"""Consumer restrictions endpoint — privacy-limited view of doctor restrictions."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_consumer
from app.models.user import User
from app.models.doctor_restriction import DoctorRestriction
from app.models.doctor_profile import DoctorProfile

router = APIRouter()


def _restriction_label(category: str) -> str:
    return {
        "liver_disease":          "Liver Disease",
        "addiction_risk":         "Addiction Risk",
        "medication_interaction": "Medication Interaction",
        "pregnancy":              "Pregnancy",
        "other":                  "Other Medical",
    }.get(category, category.replace("_", " ").title())


@router.get(
    "/restrictions",
    summary="View my active doctor-issued restrictions (privacy-limited)",
    tags=["Consumer"],
)
async def get_my_restrictions(
    current_user: User = Depends(get_current_consumer),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns all doctor restrictions on this consumer's account.
    Privacy-limited: shows category + issuing clinic only.
    """
    result = await db.execute(
        select(DoctorRestriction)
        .where(DoctorRestriction.patient_user_id == current_user.id)
        .order_by(DoctorRestriction.created_at.desc())
    )
    all_restrictions = result.scalars().all()

    restrictions = []
    for r in all_restrictions:
        prof_result = await db.execute(
            select(DoctorProfile).where(DoctorProfile.user_id == r.doctor_user_id)
        )
        doc_prof = prof_result.scalar_one_or_none()
        restrictions.append({
            "restriction_id": str(r.id),
            "restriction_type": r.restriction_type,
            "reason_category": r.reason_category,
            "reason_category_label": _restriction_label(r.reason_category),
            "status": r.status,
            "start_date": r.start_date.isoformat(),
            "end_date": r.end_date.isoformat() if r.end_date else None,
            "issuing_clinic": doc_prof.hospital_name if doc_prof else None,
        })

    return {
        "restrictions": restrictions,
        "has_active_restriction": any(r["status"] == "active" for r in restrictions),
    }
