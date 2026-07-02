"""Role model — named permission roles for RBAC.

Stores canonical role definitions. The join table `user_roles` links users
to their role(s). A single user can have exactly one role in this prototype.
"""
import uuid
from datetime import datetime

from sqlalchemy import String, DateTime, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


class Role(Base):
    __tablename__ = "roles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # e.g. "CONSUMER", "OPERATOR", "ADMIN", "DOCTOR", "CARETAKER"
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationship back to the join table
    user_roles: Mapped[list["UserRole_"]] = relationship(
        "UserRole_", back_populates="role"
    )

    def __repr__(self) -> str:
        return f"<Role name={self.name}>"
