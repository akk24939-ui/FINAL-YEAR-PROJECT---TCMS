import uuid
from datetime import datetime, date
from typing import Optional
from sqlalchemy import String, DateTime, Integer, Numeric, Date, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base
from decimal import Decimal


class HealthReport(Base):
    __tablename__ = "health_reports"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    district: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    anonymized_count: Mapped[int] = mapped_column(Integer, default=0)
    avg_consumption_ml: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), nullable=True)
    risk_level: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    high_risk_count: Mapped[int] = mapped_column(Integer, default=0)
    medium_risk_count: Mapped[int] = mapped_column(Integer, default=0)
    low_risk_count: Mapped[int] = mapped_column(Integer, default=0)
    report_date: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
