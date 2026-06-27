import uuid
import enum
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Boolean, DateTime, Enum as SAEnum, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class UserRole(str, enum.Enum):
    CONSUMER = "CONSUMER"
    OPERATOR = "OPERATOR"
    ADMIN = "ADMIN"
    DOCTOR = "DOCTOR"
    CARETAKER = "CARETAKER"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    aadhaar_hash: Mapped[Optional[str]] = mapped_column(String(255), unique=True, nullable=True)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(String(15), unique=True, nullable=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(SAEnum(UserRole), default=UserRole.CONSUMER, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    district: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    consumer_profile: Mapped[Optional["ConsumerProfile"]] = relationship("ConsumerProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    purchases: Mapped[list["Purchase"]] = relationship("Purchase", back_populates="consumer", foreign_keys="Purchase.consumer_id")
    operated_shops: Mapped[list["Shop"]] = relationship("Shop", back_populates="operator", foreign_keys="Shop.operator_id")
    alerts: Mapped[list["Alert"]] = relationship("Alert", back_populates="consumer")
    audit_logs: Mapped[list["AuditLog"]] = relationship("AuditLog", back_populates="user")
    caretaker_links_as_caretaker: Mapped[list["CaretakerLink"]] = relationship("CaretakerLink", back_populates="caretaker", foreign_keys="CaretakerLink.caretaker_id")
    caretaker_links_as_consumer: Mapped[list["CaretakerLink"]] = relationship("CaretakerLink", back_populates="consumer", foreign_keys="CaretakerLink.consumer_id")
