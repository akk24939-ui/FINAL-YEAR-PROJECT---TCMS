"""app/schemas package."""

from app.schemas.auth import (
    OtpRequest, OtpVerify, LoginRequest, CookieTokenResponse
)
from app.schemas.consumer import (
    OcrConfidence, RegisterExtractResponse, RegisterFinalRequest,
    SelfRestrictionResponse, ConsumerProfileResponse,
    DrinkingPrefRequest, TeetotalerToggleRequest,
    SelfRestrictionLockRequest, LimitUpdateRequest
)
from app.schemas.notification import (
    NotificationResponse, UnreadCountResponse
)

__all__ = [
    "OtpRequest", "OtpVerify", "LoginRequest", "CookieTokenResponse",
    "OcrConfidence", "RegisterExtractResponse", "RegisterFinalRequest",
    "SelfRestrictionResponse", "ConsumerProfileResponse",
    "DrinkingPrefRequest", "TeetotalerToggleRequest",
    "SelfRestrictionLockRequest", "LimitUpdateRequest",
    "NotificationResponse", "UnreadCountResponse"
]
