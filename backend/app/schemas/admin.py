from pydantic import BaseModel
from datetime import date


class DistrictStatsResponse(BaseModel):
    district: str
    shop_count: int
    consumer_count: int
    total_purchases: int
    total_revenue: float
    avg_daily_consumption_ml: float


class RevenueReportResponse(BaseModel):
    districts: list[DistrictStatsResponse]
    total_revenue: float
    total_purchases: int
    total_shops: int
    report_date: date


class AdminDashboardResponse(BaseModel):
    total_consumers: int
    total_operators: int
    total_shops: int
    total_purchases_today: int
    total_revenue_today: float
    districts: list[DistrictStatsResponse]
