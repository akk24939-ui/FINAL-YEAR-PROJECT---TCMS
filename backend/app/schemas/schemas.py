"""
Pydantic v2 schemas for all domains.
Security Notes:
  - Passwords validated server-side for length (min 8 chars).
  - No password ever returned in any response schema.
  - Role is read from DB, never accepted from request payload.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


# ────────────────────────────── Auth ──────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    dob: date
    gender: Optional[str] = None
    district: str = Field(min_length=1, max_length=100)
    mock_id_number: Optional[str] = Field(None, description="Simulated — not real Aadhaar")

    @field_validator("gender")
    @classmethod
    def gender_allowed(cls, v):
        if v is not None and v not in ("M", "F", "Other"):
            raise ValueError("gender must be M, F, or Other")
        return v


class LoginRequest(BaseModel):
    identifier: str  # mobile number, Aadhaar last-4, or email
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds
    user_id: Optional[str] = None
    full_name: Optional[str] = None
    role: Optional[str] = None


# ────────────────────────────── Users ─────────────────────────────────────────

class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    role: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ────────────────────────────── Consumer ──────────────────────────────────────

class ConsumerProfileOut(BaseModel):
    id: uuid.UUID
    district: str
    gender: Optional[str]
    dob: date
    teetotaler_flag: bool

    model_config = {"from_attributes": True}


class ConsumerProfileUpdate(BaseModel):
    district: Optional[str] = None
    gender: Optional[str] = None
    teetotaler_flag: Optional[bool] = None


# ────────────────────────────── Restrictions ──────────────────────────────────

class RestrictionCreate(BaseModel):
    daily_limit: Optional[Decimal] = Field(None, ge=0)
    weekly_limit: Optional[Decimal] = Field(None, ge=0)
    monthly_limit: Optional[Decimal] = Field(None, ge=0)
    self_restricted: bool = False
    effective_from: date


class RestrictionOut(BaseModel):
    id: uuid.UUID
    daily_limit: Optional[Decimal]
    weekly_limit: Optional[Decimal]
    monthly_limit: Optional[Decimal]
    self_restricted: bool
    effective_from: date

    model_config = {"from_attributes": True}


# ────────────────────────────── Products ──────────────────────────────────────

class ProductOut(BaseModel):
    id: uuid.UUID
    name: str
    category: Optional[str]
    volume_ml: int
    standard_drink_equiv: Decimal
    price: Decimal

    model_config = {"from_attributes": True}


# ────────────────────────────── Purchases ─────────────────────────────────────

class PurchaseCreate(BaseModel):
    product_id: uuid.UUID
    quantity: int = Field(ge=1)
    idempotency_key: str = Field(min_length=10, max_length=64)


class PurchaseOut(BaseModel):
    id: uuid.UUID
    consumer_id: uuid.UUID
    shop_id: uuid.UUID
    product_id: uuid.UUID
    quantity: int
    timestamp: datetime

    model_config = {"from_attributes": True}


# ────────────────────────────── QR Codes ──────────────────────────────────────

class QRCodeOut(BaseModel):
    id: uuid.UUID
    signed_token: str
    issued_at: datetime
    expires_at: datetime
    used_flag: bool

    model_config = {"from_attributes": True}


class QRVerifyRequest(BaseModel):
    signed_token: str
    reference_id: str


# ────────────────────────────── Notifications ─────────────────────────────────

class NotificationOut(BaseModel):
    id: uuid.UUID
    type: str
    message: str
    read_flag: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ────────────────────────────── Consents ──────────────────────────────────────

class ConsentCreate(BaseModel):
    caretaker_email: EmailStr
    scope: str = Field(default="VIEW_STATUS")


class ConsentOut(BaseModel):
    id: uuid.UUID
    caretaker_user_id: uuid.UUID
    scope: str
    granted_at: datetime
    revoked_at: Optional[datetime]

    model_config = {"from_attributes": True}


# ────────────────────────────── Shops ─────────────────────────────────────────

class ShopOut(BaseModel):
    id: uuid.UUID
    name: str
    district: str
    license_no: str

    model_config = {"from_attributes": True}


# ────────────────────────────── Reports ───────────────────────────────────────

class ReportOut(BaseModel):
    id: uuid.UUID
    type: str
    scope: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ────────────────────────────── Analytics (aggregated only) ───────────────────

class DistrictAnalyticsOut(BaseModel):
    district: str
    total_purchases: int
    total_standard_drinks: Decimal
    unique_consumers: int   # min 5 enforced server-side


class PaginatedResponse(BaseModel):
    items: list
    total: int
    page: int
    size: int
    pages: int


# ────────────────────────────── Error ─────────────────────────────────────────

class ErrorResponse(BaseModel):
    detail: str
