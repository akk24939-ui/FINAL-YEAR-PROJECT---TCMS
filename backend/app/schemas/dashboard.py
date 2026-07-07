"""
Pydantic schemas for the Consumer Dashboard module.

Covers:
  - Profile view + update (with all new fields)
  - ConsumerLimits view + update (dedicated limits table)
  - Dashboard summary response (consumption cards + chart data)
"""
from __future__ import annotations

from datetime import date, datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator

from app.models.consumer_profile import BeveragePreference, Gender


# ── Beverage preference items ─────────────────────────────────────────────────
BEVERAGE_CHOICES = {"BEER", "WINE", "SPIRITS", "MIXED"}


# ═══════════════════════════════════════════════════════════════════════════════
#  PROFILE SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════════

class ProfileUpdateRequest(BaseModel):
    """Fields the consumer can update on their profile.

    Sensitive fields (Aadhaar, DOB at first set) are immutable after initial
    registration. full_name and mobile_number CAN be updated here.
    """
    full_name: Optional[str] = Field(None, min_length=2, max_length=200)
    mobile_number: Optional[str] = Field(None, pattern=r"^\d{10}$")
    gender: Optional[Gender] = None
    district: Optional[str] = Field(None, max_length=100)
    address: Optional[str] = Field(None, max_length=1000)
    blood_group: Optional[str] = Field(
        None, pattern=r"^(A|B|AB|O)[+-]$",
        description="e.g. A+, B-, O+, AB+"
    )
    emergency_contact_name: Optional[str] = Field(None, max_length=200)
    emergency_contact_phone: Optional[str] = Field(None, pattern=r"^\d{10}$")
    beverage_preference: Optional[BeveragePreference] = None


class ProfileResponse(BaseModel):
    """Full consumer profile returned to the client.

    Aadhaar is ALWAYS masked — raw number never returned.
    """
    id: UUID
    user_id: UUID
    full_name: str
    email: str
    mobile_number: Optional[str] = None
    aadhaar_masked: str
    dob: Optional[date] = None
    gender: Optional[Gender] = None
    district: Optional[str] = None
    address: Optional[str] = None
    blood_group: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    photo_path: Optional[str] = None
    beverage_preference: BeveragePreference
    is_teetotaler: bool
    teetotaler_set_at: Optional[datetime] = None
    member_since: Optional[datetime] = None

    # Restriction summary (for UI lock indicator)
    is_self_restricted: bool = False
    restriction_locked_until: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ═══════════════════════════════════════════════════════════════════════════════
#  LIMITS SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════════

class ConsumerLimitsUpdateRequest(BaseModel):
    """Payload for PUT /consumer/limits.

    All three sliders + beverage preference sent together.
    Zero means "no limit set" (unlimited).
    """
    daily_limit_sd: float = Field(..., ge=0.0, le=20.0,
        description="Daily limit in standard drinks. 0 = no limit.")
    weekly_limit_sd: float = Field(..., ge=0.0, le=60.0,
        description="Weekly limit in standard drinks. 0 = no limit.")
    monthly_limit_sd: float = Field(..., ge=0.0, le=200.0,
        description="Monthly limit in standard drinks. 0 = no limit.")
    beverage_preference: List[str] = Field(
        default_factory=list,
        description="List of preferred beverage types: BEER, WINE, SPIRITS, MIXED"
    )

    @field_validator("beverage_preference")
    @classmethod
    def validate_beverage_prefs(cls, v: List[str]) -> List[str]:
        invalid = set(v) - BEVERAGE_CHOICES
        if invalid:
            raise ValueError(f"Invalid beverage types: {invalid}. Must be one of {BEVERAGE_CHOICES}")
        return v

    @model_validator(mode="after")
    def cross_validate_limits(self) -> "ConsumerLimitsUpdateRequest":
        """Advisory cross-validation — logged as warnings, not hard errors."""
        # These are informational — the backend accepts them but the frontend
        # shows inline amber warnings. We do NOT block the save server-side.
        return self


class ConsumerLimitsResponse(BaseModel):
    """Current limits returned to the client."""
    id: UUID
    consumer_id: UUID
    daily_limit_sd: float
    weekly_limit_sd: float
    monthly_limit_sd: float
    beverage_preference: List[str]
    # Advisory cross-limit warnings (computed server-side)
    warn_weekly_vs_daily: bool = False   # weekly < daily * 7
    warn_monthly_vs_weekly: bool = False  # monthly < weekly * 4
    # Lock state (from restrictions table)
    is_locked: bool = False
    locked_until: Optional[datetime] = None
    updated_at: datetime

    model_config = {"from_attributes": True}


# ═══════════════════════════════════════════════════════════════════════════════
#  DASHBOARD SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════════

class ConsumptionSummary(BaseModel):
    """Single period (today / week / month) consumption card data."""
    consumed_sd: float              # standard drinks consumed in period
    limit_sd: float                 # consumer's set limit (0 = no limit)
    percent_used: float             # 0–100+, capped display at 100 but can exceed
    status: str                     # "safe" | "warn" | "exceeded"
    # Ml equivalents for the consumer's preferred beverage
    consumed_beer_ml: Optional[float] = None
    consumed_wine_ml: Optional[float] = None
    consumed_spirits_ml: Optional[float] = None


class DailyChartPoint(BaseModel):
    """One point on the 7-day daily consumption line chart."""
    label: str          # "Mon", "Tue", …
    date: str           # ISO date "2026-07-04"
    consumed_sd: float
    limit_sd: float     # consumer's daily limit (for reference line)


class WeeklyChartPoint(BaseModel):
    """One bar on the 4-week weekly consumption bar chart."""
    label: str          # "Week 1", …
    week_start: str     # ISO date of Monday
    consumed_sd: float
    limit_sd: float     # consumer's weekly limit (for reference line)


class DashboardResponse(BaseModel):
    """Full dashboard data payload."""
    consumer_name: str
    aadhaar_masked: str
    member_since: Optional[datetime] = None
    is_teetotaler: bool
    is_self_restricted: bool
    restriction_locked_until: Optional[datetime] = None

    today: ConsumptionSummary
    this_week: ConsumptionSummary
    this_month: ConsumptionSummary

    daily_chart: List[DailyChartPoint]    # last 7 days
    weekly_chart: List[WeeklyChartPoint]  # last 4 weeks

    who_daily_advisory: float = 2.0       # standard drinks / day
    who_weekly_advisory: float = 14.0     # standard drinks / week

    # Alert flags (for conditional banner in UI)
    alert_type: Optional[str] = None      # "daily_exceeded" | "weekly_90" | etc.
    alert_message: Optional[str] = None
