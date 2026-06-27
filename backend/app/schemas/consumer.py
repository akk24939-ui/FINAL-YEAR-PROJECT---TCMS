from pydantic import BaseModel, Field
from datetime import datetime, date
import uuid


class ConsumerProfileResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    daily_limit_ml: int
    weekly_limit_ml: int
    monthly_limit_ml: int
    is_teetotaler: bool
    qr_token: str | None
    age_verified: bool
    updated_at: datetime

    model_config = {"from_attributes": True}


class UpdateLimitsRequest(BaseModel):
    daily_limit_ml: int | None = Field(None, ge=0, le=5000)
    weekly_limit_ml: int | None = Field(None, ge=0, le=20000)
    monthly_limit_ml: int | None = Field(None, ge=0, le=60000)


class ConsumerStatsResponse(BaseModel):
    today_ml: int
    week_ml: int
    month_ml: int
    daily_limit_ml: int
    weekly_limit_ml: int
    monthly_limit_ml: int
    daily_percent: float
    weekly_percent: float
    monthly_percent: float
    is_teetotaler: bool
    status: str  # "safe", "warning", "exceeded"
