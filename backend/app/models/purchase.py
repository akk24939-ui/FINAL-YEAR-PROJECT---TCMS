import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import String, DateTime, Integer, Numeric, ForeignKey, Text, Float, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base
from decimal import Decimal


class Purchase(Base):
    __tablename__ = "purchases"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    consumer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    shop_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("shops.id"), nullable=True, index=True)
    shop_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    product_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=True)
    product_name: Mapped[str] = mapped_column(String(200), nullable=False)
    quantity_ml: Mapped[int] = mapped_column(Integer, nullable=False)
    standard_drinks: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # computed: qty_ml / ml_per_std_drink
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    remaining_daily_limit: Mapped[Optional[float]] = mapped_column(Float, nullable=True)   # std drinks left after purchase
    remaining_weekly_limit: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # std drinks left after purchase
    operator_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    purchased_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    consumer: Mapped["User"] = relationship("User", back_populates="purchases", foreign_keys=[consumer_id])
    shop: Mapped["Shop"] = relationship("Shop", back_populates="purchases")
    product: Mapped[Optional["Product"]] = relationship("Product", back_populates="purchases")
