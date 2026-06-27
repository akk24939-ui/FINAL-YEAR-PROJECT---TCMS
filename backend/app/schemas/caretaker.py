from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CaretakerLinkRequest(BaseModel):
    consumer_email: str = Field(..., description="Email of the consumer to monitor")


class CaretakerLinkResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    caretaker_id: str
    consumer_id: str
    consent_given: bool
    is_active: bool
    created_at: datetime


class AlertResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    consumer_id: str
    alert_type: str
    message: str
    is_read: bool
    is_sent_to_caretaker: bool
    created_at: datetime
    read_at: datetime | None


class ConsumerStatusResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    consumer_id: str
    full_name: str
    is_teetotaler: bool
    daily_limit_ml: float
    weekly_limit_ml: float
    monthly_limit_ml: float
    daily_consumed_ml: float
    weekly_consumed_ml: float
    monthly_consumed_ml: float
    daily_usage_pct: float
    unread_alerts: int
    last_purchase_at: datetime | None
    risk_level: str  # LOW / MODERATE / HIGH / CRITICAL
