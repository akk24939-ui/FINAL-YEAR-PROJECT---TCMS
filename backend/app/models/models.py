"""
models.py — backward-compatibility re-export shim.

This file once contained all SQLAlchemy class definitions.
They now live in individual per-entity modules (see models/__init__.py).
Importing from this file is equivalent to importing from the sub-modules.

Do NOT add new class definitions here — add them to the appropriate sub-module.
"""
from app.models.user import User, UserRole                              # noqa: F401
from app.models.role import Role                                        # noqa: F401
from app.models.consumer_profile import ConsumerProfile, Gender, BeveragePreference  # noqa: F401
from app.models.restriction import SelfRestriction                     # noqa: F401
from app.models.consumer_limits import ConsumerLimits                  # noqa: F401
from app.models.notification import Notification, NotificationType, NotificationCategory  # noqa: F401
from app.models.qr_code import QrCode                                  # noqa: F401
from app.models.shop import Shop                                        # noqa: F401
from app.models.product import Product                                  # noqa: F401
from app.models.purchase import Purchase                                # noqa: F401
from app.models.audit_log import AuditLog, AuditEventType              # noqa: F401
from app.models.alert import Alert                                      # noqa: F401
from app.models.caretaker_link import CaretakerLink                    # noqa: F401
from app.models.limits_history import LimitsHistory                    # noqa: F401
from app.models.district import District                                # noqa: F401
from app.models.health_report import HealthReport                      # noqa: F401
from app.models.system_config import SystemConfig                      # noqa: F401
from app.models.doctor_profile import DoctorProfile                    # noqa: F401
from app.models.doctor_restriction import (                             # noqa: F401
    DoctorRestriction, RestrictionCategory, RestrictionType, RestrictionStatus
)

# Aliases for callers that used the old consolidated class names
Consumer    = ConsumerProfile         # was: class Consumer(Base): __tablename__ = "consumers"
Restriction = SelfRestriction         # was: class Restriction(Base): __tablename__ = "restrictions"
QRCode      = QrCode                  # was: class QRCode(Base): __tablename__ = "qr_codes"
Consent     = CaretakerLink           # was: class Consent(Base): __tablename__ = "consents"
Report      = HealthReport            # was: class Report(Base): __tablename__ = "reports"

__all__ = [
    "User", "UserRole",
    "Role",
    "ConsumerProfile", "Consumer", "Gender", "BeveragePreference",
    "SelfRestriction", "Restriction",
    "ConsumerLimits",
    "Notification", "NotificationType", "NotificationCategory",
    "QrCode", "QRCode",
    "Shop", "Product", "Purchase",
    "AuditLog", "AuditEventType",
    "Alert", "CaretakerLink", "LimitsHistory", "District",
    "HealthReport", "SystemConfig",
    "DoctorProfile", "DoctorRestriction",
    "RestrictionCategory", "RestrictionType", "RestrictionStatus",
]
