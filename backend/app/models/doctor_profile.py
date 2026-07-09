"""DoctorProfile model — extended profile for Doctor-role users.

Doctors are provisioned ONLY by Admin (no public registration).
Default state: is_active=False until Admin explicitly activates.
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, Boolean, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


class DoctorProfile(Base):
    __tablename__ = "doctor_profiles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )

    # Mock medical registration number (format: MRN-XXXXXXXX for this project)
    medical_reg_number: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False
    )

    specialization: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    contact_phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    hospital_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)

    # Activation lifecycle — Admin must explicitly set is_active=True
    is_active: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    activated_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    activated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    deactivated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    deactivation_reason: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    user: Mapped["User"] = relationship(
        "User", back_populates="doctor_profile",
        foreign_keys=[user_id],
    )

    def __repr__(self) -> str:
        return f"<DoctorProfile mrn={self.medical_reg_number} active={self.is_active}>"
