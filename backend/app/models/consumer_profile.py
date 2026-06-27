import uuid
from datetime import datetime, date
from typing import Optional
from sqlalchemy import String, Boolean, DateTime, Integer, ForeignKey, Date, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class ConsumerProfile(Base):
    __tablename__ = "consumer_profiles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    daily_limit_ml: Mapped[int] = mapped_column(Integer, default=750)
    weekly_limit_ml: Mapped[int] = mapped_column(Integer, default=3000)
    monthly_limit_ml: Mapped[int] = mapped_column(Integer, default=10000)
    is_teetotaler: Mapped[bool] = mapped_column(Boolean, default=False)
    qr_token: Mapped[Optional[str]] = mapped_column(String(255), unique=True, nullable=True)
    dob: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    age_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user: Mapped["User"] = relationship("User", back_populates="consumer_profile")
    limits_history: Mapped[list["LimitsHistory"]] = relationship("LimitsHistory", back_populates="consumer")
