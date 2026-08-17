"""Doctor API — restriction issue, cancel, and get endpoints."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_doctor, get_current_user
from app.models.user import User, UserRole
from app.services import doctor_service

router = APIRouter()


@router.post(
    "/patients/{patient_id}/restrictions",
    summary="Issue a medical purchase restriction on a consumer",
    status_code=201,
)
async def issue_restriction(
    patient_id: str,
    body: dict,
    current_user: User = Depends(get_current_doctor),
    db: AsyncSession = Depends(get_db),
):
    from app.schemas.doctor import IssueRestrictionRequest
    req = IssueRestrictionRequest(**body)

    return await doctor_service.issue_restriction(
        patient_user_id=patient_id,
        reason=req.reason,
        reason_category=req.reason_category.value,
        restriction_type=req.restriction_type.value,
        duration_days=req.duration_days,
        doctor=current_user,
        db=db,
    )


@router.patch(
    "/restrictions/{restriction_id}/cancel",
    summary="Cancel an active restriction (issuing doctor or admin only)",
)
async def cancel_restriction(
    restriction_id: str,
    body: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role not in (UserRole.DOCTOR, UserRole.ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only doctors or admins can cancel restrictions.",
        )

    from app.schemas.doctor import CancelRestrictionRequest
    req = CancelRestrictionRequest(**body)

    return await doctor_service.cancel_restriction(
        restriction_id=restriction_id,
        cancellation_reason=req.cancellation_reason,
        actor=current_user,
        db=db,
    )


@router.get(
    "/restrictions/{restriction_id}",
    summary="Get full restriction record (issuing doctor or admin)",
)
async def get_restriction(
    restriction_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role not in (UserRole.DOCTOR, UserRole.ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to doctors and admins.",
        )
    return await doctor_service.get_restriction(restriction_id, current_user, db)
