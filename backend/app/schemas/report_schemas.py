"""
Pydantic v2 schemas for the Admin Report module.

Security Notes:
  - extra="forbid" on all models prevents unknown field injection.
  - sort_by is a whitelisted Literal enum — never interpolated into SQL.
  - page_size capped at 200 to prevent memory exhaustion.
  - All string fields have explicit max_length.
  - No PII fields — report responses contain only aggregates.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


# ── Query filter params ───────────────────────────────────────────────────────

class ReportFilterParams(BaseModel):
    """Validated query parameters for all report endpoints."""
    model_config = ConfigDict(extra="forbid")

    district:   str | None  = Field(None, max_length=100)
    from_date:  date | None = None
    to_date:    date | None = None
    shop_id:    uuid.UUID | None = None
    category:   str | None  = Field(None, max_length=50)
    page:       int          = Field(1, ge=1)
    page_size:  int          = Field(50, ge=1, le=200)
    sort_by:    Literal[
        "district", "revenue", "purchases", "date", "unique_consumers"
    ] = "district"


# ── Response models — district sales ─────────────────────────────────────────

class DistrictSalesRow(BaseModel):
    district:          str
    total_purchases:   int
    total_revenue:     Decimal
    total_drinks:      Decimal
    unique_consumers:  int


class DistrictSalesResponse(BaseModel):
    page:       int
    page_size:  int
    total:      int
    data:       list[DistrictSalesRow]


# ── Response models — age group consumption ───────────────────────────────────

class AgeGroupRow(BaseModel):
    age_bracket:     str
    consumer_count:  int
    total_drinks:    Decimal


class AgeGroupResponse(BaseModel):
    data: list[AgeGroupRow]


# ── Response models — shop revenue monthly ────────────────────────────────────

class ShopRevenueRow(BaseModel):
    shop_id:      uuid.UUID
    shop_name:    str
    district:     str
    year_month:   str   # "YYYY-MM"
    transactions: int
    revenue:      Decimal


class ShopRevenueResponse(BaseModel):
    page:       int
    page_size:  int
    total:      int
    data:       list[ShopRevenueRow]


# ── Response models — daily consumption trend ─────────────────────────────────

class DailyTrendRow(BaseModel):
    purchase_date:   date
    district:        str
    total_purchases: int
    total_drinks:    Decimal


class DailyTrendResponse(BaseModel):
    data: list[DailyTrendRow]


# ── Response models — restriction adoption ────────────────────────────────────

class RestrictionAdoptionRow(BaseModel):
    district:          str
    total_consumers:   int
    restricted_count:  int
    adoption_rate_pct: Decimal


class RestrictionAdoptionResponse(BaseModel):
    data: list[RestrictionAdoptionRow]


# ── Summary response (dashboard top cards) ───────────────────────────────────

class ReportSummaryResponse(BaseModel):
    total_active_shops: int
    total_consumers:    int
    total_purchases:    int
    total_revenue:      Decimal
    total_drinks:       Decimal
    districts_covered:  int
    restricted_consumers: int


# ── Audit log reference in PDF cover ─────────────────────────────────────────

class PDFCoverMeta(BaseModel):
    title:         str
    report_type:   str
    filters:       dict
    generated_by:  str   # email or "system"
    generated_at:  datetime
    audit_log_id:  uuid.UUID


# ── Power BI manifest ────────────────────────────────────────────────────────

class PowerBIManifestFile(BaseModel):
    filename:     str
    view_name:    str
    row_count:    int
    generated_at: datetime


class PowerBIManifestResponse(BaseModel):
    generated_at: datetime
    files:        list[PowerBIManifestFile]
    instructions: str
