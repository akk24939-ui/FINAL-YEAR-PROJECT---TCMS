"""Model package — import all models so SQLAlchemy / Alembic can discover them.

IMPORT ORDER MATTERS: Base must be initialised before any model, and models
with FK references must be imported after the tables they reference.
"""
# Core auth models
from app.models.user import User, UserRole          # noqa: F401
from app.models.role import Role                    # noqa: F401
from app.models.user_role import UserRole_          # noqa: F401

# Consumer module
from app.models.consumer_profile import (           # noqa: F401
    ConsumerProfile, Gender, BeveragePreference
)
from app.models.restriction import SelfRestriction  # noqa: F401
from app.models.consumer_limits import ConsumerLimits  # noqa: F401
from app.models.notification import (               # noqa: F401
    Notification, NotificationType, NotificationCategory
)
from app.models.qr_code import QrCode               # noqa: F401

# Admin module
from app.models.system_config import SystemConfig   # noqa: F401
from app.models.doctor_profile import DoctorProfile # noqa: F401
from app.models.doctor_restriction import (         # noqa: F401
    DoctorRestriction, RestrictionCategory, RestrictionType, RestrictionStatus
)

# Audit / security
from app.models.audit_log import AuditLog, AuditEventType  # noqa: F401

# Shared models
from app.models.shop import Shop                    # noqa: F401
from app.models.purchase import Purchase            # noqa: F401
from app.models.alert import Alert                  # noqa: F401
from app.models.caretaker_link import CaretakerLink # noqa: F401
from app.models.limits_history import LimitsHistory # noqa: F401
from app.models.product import Product              # noqa: F401
from app.models.district import District            # noqa: F401
from app.models.health_report import HealthReport   # noqa: F401

__all__ = [
    "User", "UserRole",
    "Role",
    "UserRole_",
    "ConsumerProfile", "Gender", "BeveragePreference",
    "SelfRestriction",
    "ConsumerLimits",
    "Notification", "NotificationType", "NotificationCategory",
    "QrCode",
    "SystemConfig",
    "DoctorProfile",
    "DoctorRestriction", "RestrictionCategory", "RestrictionType", "RestrictionStatus",
    "AuditLog", "AuditEventType",
    "Shop", "Purchase", "Alert", "CaretakerLink",
    "LimitsHistory", "Product", "District", "HealthReport",
]
