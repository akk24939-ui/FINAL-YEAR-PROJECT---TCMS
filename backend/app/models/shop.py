import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Boolean, DateTime, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class Shop(Base):
    __tablename__ = "shops"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # System-generated shop code, e.g. "TSM-CHE-00042"
    shop_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    address: Mapped[str] = mapped_column(Text, nullable=False)
    district: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    license_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Operator contact info (stored on shop, operator FK is for login identity)
    operator_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    operator_phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    # FK to the User record that holds the PIN hash
    operator_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Suspension lifecycle
    suspended_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    suspension_reason: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    suspended_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # PIN rotation tracking (90-day policy)
    pin_rotation_due_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    operator: Mapped[Optional["User"]] = relationship(
        "User", back_populates="operated_shops", foreign_keys=[operator_id]
    )
    purchases: Mapped[list["Purchase"]] = relationship("Purchase", back_populates="shop")
