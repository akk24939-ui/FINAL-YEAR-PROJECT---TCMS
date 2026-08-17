"""Doctor API — patient search and detail endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_doctor
from app.core.limiter import limiter
from app.models.user import User
from app.services import doctor_service

router = APIRouter()


@router.get("/patients/search", summary="Search patient by exact mobile or Aadhaar number")
@limiter.limit("30/minute")
async def search_patient(
    request: Request,
    query: str = Query(..., min_length=4, description="Exact mobile number or Aadhaar number"),
    current_user: User = Depends(get_current_doctor),
    db: AsyncSession = Depends(get_db),
):
    result = await doctor_service.search_patient(query, current_user, db)
    if result is None:
        return {"found": False, "patient": None}
    return {"found": True, "patient": result}


@router.get("/patients/{patient_id}", summary="Get full patient detail + consumption history")
async def get_patient_detail(
    patient_id: str,
    current_user: User = Depends(get_current_doctor),
    db: AsyncSession = Depends(get_db),
):
    return await doctor_service.get_patient_detail(patient_id, current_user, db)
