"""app/schemas package."""

from app.schemas.admin import (
    AllShopsStatsResponse,
    DistrictStatsResponse,
    RevenueReportResponse,
    ShopStatsResponse,
)
from app.schemas.auth import (
    LoginRequest,
    LogoutRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
)
from app.schemas.caretaker import (
    AlertResponse,
    CaretakerLinkRequest,
    CaretakerLinkResponse,
    ConsumerStatusResponse,
)
from app.schemas.consumer import (
    ConsumerCreate,
    ConsumerProfileResponse,
    ConsumerSummaryResponse,
    ToggleTeetotalerRequest,
    UpdateLimitsRequest,
)
from app.schemas.doctor import HealthTrendResponse, RiskAnalyticsResponse
from app.schemas.purchase import (
    PurchaseCreate,
    PurchaseHistoryResponse,
    PurchaseResponse,
    PurchaseStatsResponse,
)
from app.schemas.report import ReportRequest, ReportResponse
from app.schemas.shop import ShopCreate, ShopResponse, ShopUpdate

__all__ = [
    "RegisterRequest",
    "LoginRequest",
    "TokenResponse",
    "RefreshRequest",
    "LogoutRequest",
    "ConsumerCreate",
    "ConsumerProfileResponse",
    "ConsumerSummaryResponse",
    "UpdateLimitsRequest",
    "ToggleTeetotalerRequest",
    "PurchaseCreate",
    "PurchaseResponse",
    "PurchaseHistoryResponse",
    "PurchaseStatsResponse",
    "ShopCreate",
    "ShopUpdate",
    "ShopResponse",
    "DistrictStatsResponse",
    "RevenueReportResponse",
    "ShopStatsResponse",
    "AllShopsStatsResponse",
    "HealthTrendResponse",
    "RiskAnalyticsResponse",
    "CaretakerLinkRequest",
    "CaretakerLinkResponse",
    "AlertResponse",
    "ConsumerStatusResponse",
    "ReportRequest",
    "ReportResponse",
]
