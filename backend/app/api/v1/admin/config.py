"""Admin global config endpoints — get and update system-wide alcohol limits."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_admin, get_client_ip
from app.models.user import User
from app.services import admin_service

router = APIRouter()


class UpdateGlobalLimitsRequest(BaseModel):
    daily_limit_sd: float = Field(..., ge=0, le=20)
    weekly_limit_sd: float = Field(..., ge=0, le=100)
    monthly_limit_sd: float = Field(..., ge=0, le=400)


@router.get("/config/limits", summary="Get current global alcohol limits")
async def get_global_limits(
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    limits = await admin_service.get_global_limits(db)
    return {
        "daily_limit_sd": limits.get("global_daily_limit_sd", 4.0),
        "weekly_limit_sd": limits.get("global_weekly_limit_sd", 14.0),
        "monthly_limit_sd": limits.get("global_monthly_limit_sd", 40.0),
        "note": "These are the system-wide caps. Consumer personal limits cannot exceed these values.",
    }


@router.put("/config/limits", summary="Update global alcohol limits for all consumers")
async def update_global_limits(
    body: UpdateGlobalLimitsRequest,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
    ip: str = Depends(get_client_ip),
):
    updated = await admin_service.update_global_limits(
        daily_limit_sd=body.daily_limit_sd,
        weekly_limit_sd=body.weekly_limit_sd,
        monthly_limit_sd=body.monthly_limit_sd,
        admin=current_user,
        db=db,
        ip_address=ip,
    )
    return {
        "daily_limit_sd": updated.get("global_daily_limit_sd"),
        "weekly_limit_sd": updated.get("global_weekly_limit_sd"),
        "monthly_limit_sd": updated.get("global_monthly_limit_sd"),
        "message": "Global limits updated.",
    }
