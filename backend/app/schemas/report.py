from __future__ import annotations

from datetime import date

from pydantic import BaseModel, ConfigDict, Field


class ReportRequest(BaseModel):
    start_date: date
    end_date: date
    district: str | None = None
    consumer_id: str | None = None
    format: str = Field("pdf", pattern="^(pdf|csv|chart)$")


class ReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    report_id: str
    format: str
    filename: str
    content_type: str
    size_bytes: int
    generated_at: str
    download_url: str | None = None
