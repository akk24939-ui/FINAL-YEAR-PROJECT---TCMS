"""Doctor portal — Pydantic v2 request/response schemas."""
from __future__ import annotations

import enum
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict


# ── Shared enums (mirrors DB enums) ───────────────────────────────────────────

class RestrictionCategoryEnum(str, enum.Enum):
    LIVER_DISEASE          = "liver_disease"
    ADDICTION_RISK         = "addiction_risk"
    MEDICATION_INTERACTION = "medication_interaction"
    PREGNANCY              = "pregnancy"
    OTHER                  = "other"

    @property
    def display_label(self) -> str:
        return {
            "liver_disease":          "Liver Disease",
            "addiction_risk":         "Addiction Risk",
            "medication_interaction": "Medication Interaction",
            "pregnancy":              "Pregnancy",
            "other":                  "Other Medical",
        }[self.value]


class RestrictionTypeEnum(str, enum.Enum):
    TEMPORARY = "temporary"
    PERMANENT = "permanent"


class RestrictionStatusEnum(str, enum.Enum):
    ACTIVE    = "active"
    CANCELLED = "cancelled"
    EXPIRED   = "expired"


# ── Patient search ─────────────────────────────────────────────────────────────

class ConsumptionSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    daily_consumed_ml: float
    weekly_consumed_ml: float
    daily_limit_ml: float
    weekly_limit_ml: float
    daily_pct_used: float
    weekly_pct_used: float
    total_purchases_30d: int


class PatientSearchResult(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    patient_user_id: str
    full_name: str
    age: Optional[int] = None
    district: Optional[str] = None
    beverage_preference: Optional[str] = None
    is_teetotaler: bool
    has_active_doctor_restriction: bool
    active_restriction_category: Optional[str] = None
    consumption_summary: ConsumptionSummary


# ── Patient detail ─────────────────────────────────────────────────────────────

class PurchaseHistoryItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    purchase_id: str
    product_name: str
    quantity_ml: int
    standard_drinks: Optional[float]
    price: float
    shop_name: Optional[str]
    purchased_at: datetime


class ActiveRestrictionSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    restriction_id: str
    restriction_type: str
    reason_category: str
    reason_category_label: str
    status: str
    start_date: datetime
    end_date: Optional[datetime]
    issuing_doctor_name: str
    issuing_hospital: Optional[str]


class PatientDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    patient_user_id: str
    full_name: str
    age: Optional[int] = None
    district: Optional[str] = None
    beverage_preference: Optional[str] = None
    is_teetotaler: bool
    consumption_summary: ConsumptionSummary
    purchase_history: list[PurchaseHistoryItem]
    active_doctor_restrictions: list[ActiveRestrictionSummary]
    restriction_history: list[ActiveRestrictionSummary]


# ── Issue restriction ──────────────────────────────────────────────────────────

class IssueRestrictionRequest(BaseModel):
    reason: str = Field(..., min_length=10, max_length=1000)
    reason_category: RestrictionCategoryEnum = RestrictionCategoryEnum.OTHER
    restriction_type: RestrictionTypeEnum = RestrictionTypeEnum.TEMPORARY
    duration_days: Optional[int] = Field(None, ge=1, le=3650)


class RestrictionRecord(BaseModel):
    """Full restriction record returned to the issuing doctor or admin."""
    model_config = ConfigDict(from_attributes=True)

    restriction_id: str
    patient_user_id: str
    patient_name: str
    doctor_user_id: str
    doctor_name: str
    hospital_name: Optional[str]
    reason: str
    reason_category: str
    reason_category_label: str
    restriction_type: str
    status: str
    start_date: datetime
    end_date: Optional[datetime]
    created_at: datetime
    cancelled_at: Optional[datetime]
    cancelled_by_name: Optional[str]
    cancellation_reason: Optional[str]


# ── Cancel restriction ─────────────────────────────────────────────────────────

class CancelRestrictionRequest(BaseModel):
    cancellation_reason: str = Field(..., min_length=5, max_length=500)


# ── Consumer-visible restriction (privacy-limited view) ───────────────────────

class ConsumerRestrictionView(BaseModel):
    """What a consumer sees about their own doctor restrictions.
    No doctor's free-text clinical reason — only category, duration, clinic name.
    """
    model_config = ConfigDict(from_attributes=True)

    restriction_id: str
    restriction_type: str
    reason_category: str
    reason_category_label: str
    status: str
    start_date: datetime
    end_date: Optional[datetime]
    issuing_clinic: Optional[str]


# ── Doctor dashboard (anonymous aggregate) ────────────────────────────────────

class DoctorDashboardStats(BaseModel):
    total_active_restrictions: int
    total_issued_by_me: int
    total_cancelled_by_me: int
    district_breakdown: list[dict]
    category_breakdown: list[dict]
    recent_expirations_7d: int
