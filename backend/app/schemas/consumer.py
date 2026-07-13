from datetime import date, datetime
from typing import Optional, Dict
from uuid import UUID
from pydantic import BaseModel, Field, EmailStr, validator

from app.models.consumer_profile import Gender, BeveragePreference


# ── OCR Extraction (Step A) ────────────────────────────────────────────────
class OcrConfidence(BaseModel):
    """Confidence scores (0-100) for OCR-extracted fields."""
    full_name: float
    dob: float
    gender: float
    aadhaar_number: float
    address: float


class RegisterExtractResponse(BaseModel):
    """Returned by the OCR endpoint. Contains pre-filled data + confidence."""
    full_name: Optional[str] = None
    dob: Optional[date] = None
    gender: Optional[Gender] = None
    aadhaar_number: Optional[str] = None
    address: Optional[str] = None
    district: Optional[str] = None
    email: Optional[str] = None
    mobile_number: Optional[str] = None
    raw_text: Optional[str] = None
    source: Optional[str] = "OCR"   # 'OCR' or 'MANUAL' — set by endpoint
    confidence: OcrConfidence


# ── Final Registration (Step D) ────────────────────────────────────────────
class RegisterFinalRequest(BaseModel):
    """Final payload submitted by the user after reviewing OCR data."""
    email: EmailStr
    mobile_number: str = Field(..., pattern=r"^\d{10}$")
    password: str = Field(
        ...,
        min_length=6,
        description="Min 10 chars, server-side strength validated."
    )
    
    full_name: str = Field(..., min_length=2, max_length=200)
    dob: date
    gender: Gender
    aadhaar_number: str = Field(..., pattern=r"^\d{12}$", description="Raw 12-digit number")
    district: str
    address: Optional[str] = None


    @validator('dob')
    def validate_age(cls, v):
        today = date.today()
        age = today.year - v.year - ((today.month, today.day) < (v.month, v.day))
        if age < 18:
            raise ValueError('Consumer must be at least 18 years old')
        return v


# ── Responses ──────────────────────────────────────────────────────────────
class SelfRestrictionResponse(BaseModel):
    daily_limit_sd: float
    weekly_limit_sd: float
    monthly_limit_sd: float
    pending_daily_limit_sd: Optional[float]
    pending_weekly_limit_sd: Optional[float]
    pending_monthly_limit_sd: Optional[float]
    lock_requested_at: Optional[datetime]
    is_locked: bool
    locked_until: Optional[datetime]
    lock_reason: Optional[str]

    class Config:
        from_attributes = True


class ConsumerProfileResponse(BaseModel):
    """Consumer profile data returned to the client.
    Notice Aadhaar is masked here, the raw number is NEVER sent.
    """
    id: UUID
    user_id: UUID
    full_name: str
    email: EmailStr
    mobile_number: Optional[str]
    aadhaar_masked: str  # e.g., "********1234"
    dob: Optional[date]
    gender: Optional[Gender]
    district: Optional[str]
    address: Optional[str]
    photo_path: Optional[str]
    beverage_preference: BeveragePreference
    is_teetotaler: bool
    teetotaler_set_at: Optional[datetime]
    
    restrictions: Optional[SelfRestrictionResponse]

    class Config:
        from_attributes = True


# ── Updates ────────────────────────────────────────────────────────────────
class DrinkingPrefRequest(BaseModel):
    beverage_preference: BeveragePreference


class TeetotalerToggleRequest(BaseModel):
    is_teetotaler: bool


class SelfRestrictionLockRequest(BaseModel):
    lock_days: int = Field(..., ge=1, le=365, description="Days to lock limits")
    lock_reason: Optional[str] = Field(None, max_length=500)


class LimitUpdateRequest(BaseModel):
    """
    Used for both decreasing (instant) and increasing (starts 24h cooling off)
    """
    daily_limit_sd: float = Field(..., ge=0.0, le=50.0)
    weekly_limit_sd: float = Field(..., ge=0.0, le=350.0)
    monthly_limit_sd: float = Field(..., ge=0.0, le=1500.0)
