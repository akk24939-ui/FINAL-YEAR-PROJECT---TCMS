from pydantic import BaseModel
from datetime import date


class HealthTrendResponse(BaseModel):
    district: str
    avg_consumption_ml: float
    consumer_count: int
    risk_level: str
    high_risk_count: int
    medium_risk_count: int
    low_risk_count: int
    report_date: date

    model_config = {"from_attributes": True}


class RiskAnalyticsResponse(BaseModel):
    total_consumers: int
    high_risk: int
    medium_risk: int
    low_risk: int
    high_risk_percent: float
    medium_risk_percent: float
    low_risk_percent: float
    districts: list[HealthTrendResponse]


class CaretakerLinkRequest(BaseModel):
    consumer_email: str


class AlertResponse(BaseModel):
    id: str
    alert_type: str
    message: str
    is_read: bool
    created_at: date

    model_config = {"from_attributes": True}
