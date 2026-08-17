"""Doctor API — anonymous aggregate dashboard statistics."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_doctor
from app.models.user import User
from app.services import doctor_service

router = APIRouter()


@router.get("/dashboard", summary="Doctor dashboard — anonymous aggregate stats")
async def get_dashboard(
    current_user: User = Depends(get_current_doctor),
    db: AsyncSession = Depends(get_db),
):
    return await doctor_service.get_dashboard_stats(current_user, db)
