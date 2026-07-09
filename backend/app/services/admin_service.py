"""Admin service — account provisioning, global config, shop and doctor management.

All mutating functions write an audit log entry.
No plaintext PINs or passwords are ever stored.
"""
from __future__ import annotations

import random
import secrets
import string
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.audit_log import AuditLog, AuditEventType
from app.models.doctor_profile import DoctorProfile
from app.models.shop import Shop
from app.models.system_config import SystemConfig
from app.models.user import User, UserRole


# ── Constants ─────────────────────────────────────────────────────────────────

PIN_ROTATION_DAYS = 90
GLOBAL_LIMIT_KEYS = {
    "global_daily_limit_sd": ("Maximum standard drinks per day for all consumers", 4.0),
    "global_weekly_limit_sd": ("Maximum standard drinks per week for all consumers", 14.0),
    "global_monthly_limit_sd": ("Maximum standard drinks per month for all consumers", 40.0),
}


# ── Audit helper ──────────────────────────────────────────────────────────────

def _audit(
    db: Session,
    event_type: str,
    actor: User,
    target_user_id: Optional[uuid.UUID] = None,
    description: str = "",
    metadata: Optional[dict] = None,
    ip_address: str = "unknown",
) -> None:
    log = AuditLog(
        id=uuid.uuid4(),
        user_id=target_user_id,
        actor_id=actor.id,
        event_type=event_type,
        description=description,
        metadata_json=metadata or {},
        ip_address=ip_address,
    )
    db.add(log)


# ── PIN generation ─────────────────────────────────────────────────────────────

def _generate_pin() -> str:
    """Generate a cryptographically random 6-digit PIN string."""
    return f"{secrets.randbelow(900_000) + 100_000:06d}"


def _generate_shop_code(district: str, db: Session) -> str:
    """Generate unique shop code TSM-{DISTRICT3}-{NNNNN}."""
    prefix = district[:3].upper()
    for _ in range(100):
        number = random.randint(1, 99999)
        code = f"TSM-{prefix}-{number:05d}"
        if not db.query(Shop).filter(Shop.shop_code == code).first():
            return code
    raise RuntimeError("Failed to generate unique shop code after 100 attempts")


# ── Overview stats ─────────────────────────────────────────────────────────────

def get_overview_stats(db: Session) -> dict:
    from app.models.purchase import Purchase
    total_consumers = db.query(User).filter(User.role == UserRole.CONSUMER, User.is_active == True).count()
    total_operators = db.query(User).filter(User.role == UserRole.OPERATOR, User.is_active == True).count()
    total_doctors = db.query(User).filter(User.role == UserRole.DOCTOR).count()
    total_shops = db.query(Shop).filter(Shop.is_active == True).count()
    suspended_shops = db.query(Shop).filter(Shop.is_active == False).count()

    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_purchases = db.query(Purchase).filter(Purchase.purchased_at >= today_start).count()

    # Recent audit events
    recent_audit = (
        db.query(AuditLog)
        .order_by(AuditLog.created_at.desc())
        .limit(10)
        .all()
    )

    return {
        "total_consumers": total_consumers,
        "total_operators": total_operators,
        "total_doctors": total_doctors,
        "total_shops": total_shops,
        "suspended_shops": suspended_shops,
        "today_purchases": today_purchases,
        "recent_audit": recent_audit,
    }


# ── Shop management ───────────────────────────────────────────────────────────

def create_shop(
    name: str,
    district: str,
    address: str,
    license_number: Optional[str],
    operator_name: str,
    operator_phone: str,
    admin: User,
    db: Session,
    ip_address: str = "unknown",
) -> tuple[Shop, User, str]:
    """
    Create shop + operator User account.
    Returns (shop, operator_user, plaintext_pin) — caller shows PIN once then discards.
    """
    # Generate credentials
    shop_code = _generate_shop_code(district, db)
    raw_pin = _generate_pin()
    pin_hash = hash_password(raw_pin)

    # Synthetic email for operator (not used for login — login is shop_code + PIN)
    operator_email = f"op_{shop_code.lower().replace('-', '_')}@tasmac.internal"

    # Create operator User
    operator_user = User(
        id=uuid.uuid4(),
        email=operator_email,
        full_name=operator_name,
        password_hash=hash_password(secrets.token_hex(32)),  # Unusable password — PIN-only auth
        pin_hash=pin_hash,
        role=UserRole.OPERATOR,
        is_active=True,
        is_verified=True,
        must_change_password=False,
        last_pin_rotation=datetime.now(timezone.utc),
    )
    db.add(operator_user)
    db.flush()  # get operator_user.id

    # Create Shop
    shop = Shop(
        id=uuid.uuid4(),
        shop_code=shop_code,
        name=name,
        district=district,
        address=address,
        license_number=license_number,
        operator_name=operator_name,
        operator_phone=operator_phone,
        operator_id=operator_user.id,
        is_active=True,
        pin_rotation_due_at=datetime.now(timezone.utc) + timedelta(days=PIN_ROTATION_DAYS),
    )
    db.add(shop)

    _audit(
        db, AuditEventType.ADMIN_CREATED_SHOP, actor=admin,
        target_user_id=operator_user.id,
        description=f"Created shop {shop_code} — {name} ({district})",
        metadata={"shop_code": shop_code, "district": district},
        ip_address=ip_address,
    )
    db.commit()
    db.refresh(shop)
    db.refresh(operator_user)
    return shop, operator_user, raw_pin


def reset_shop_pin(
    shop_id: uuid.UUID,
    admin: User,
    db: Session,
    ip_address: str = "unknown",
) -> tuple[Shop, str]:
    """Generate and store a new PIN. Returns (shop, plaintext_pin) — shown once."""
    shop = db.query(Shop).filter(Shop.id == shop_id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")

    operator = db.query(User).filter(User.id == shop.operator_id).first()
    if not operator:
        raise HTTPException(status_code=404, detail="Shop operator user not found")

    raw_pin = _generate_pin()
    operator.pin_hash = hash_password(raw_pin)
    operator.pin_failed_attempts = 0
    operator.pin_locked_until = None
    operator.last_pin_rotation = datetime.now(timezone.utc)
    shop.pin_rotation_due_at = datetime.now(timezone.utc) + timedelta(days=PIN_ROTATION_DAYS)

    _audit(
        db, AuditEventType.ADMIN_RESET_PIN, actor=admin,
        target_user_id=operator.id,
        description=f"PIN reset for shop {shop.shop_code}",
        metadata={"shop_code": shop.shop_code},
        ip_address=ip_address,
    )
    db.commit()
    db.refresh(shop)
    return shop, raw_pin


def suspend_shop(
    shop_id: uuid.UUID,
    reason: str,
    admin: User,
    db: Session,
    ip_address: str = "unknown",
) -> Shop:
    shop = db.query(Shop).filter(Shop.id == shop_id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    if not shop.is_active:
        raise HTTPException(status_code=400, detail="Shop is already suspended")

    shop.is_active = False
    shop.suspended_at = datetime.now(timezone.utc)
    shop.suspension_reason = reason
    shop.suspended_by = admin.id

    _audit(
        db, AuditEventType.ADMIN_SUSPENDED_SHOP, actor=admin,
        description=f"Suspended shop {shop.shop_code}: {reason}",
        metadata={"shop_code": shop.shop_code, "reason": reason},
        ip_address=ip_address,
    )
    db.commit()
    db.refresh(shop)
    return shop


def reactivate_shop(
    shop_id: uuid.UUID,
    admin: User,
    db: Session,
    ip_address: str = "unknown",
) -> Shop:
    shop = db.query(Shop).filter(Shop.id == shop_id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    if shop.is_active:
        raise HTTPException(status_code=400, detail="Shop is already active")

    shop.is_active = True
    shop.suspended_at = None
    shop.suspension_reason = None
    shop.suspended_by = None

    _audit(
        db, AuditEventType.ADMIN_REACTIVATED_SHOP, actor=admin,
        description=f"Reactivated shop {shop.shop_code}",
        metadata={"shop_code": shop.shop_code},
        ip_address=ip_address,
    )
    db.commit()
    db.refresh(shop)
    return shop


def list_shops(
    db: Session,
    district: Optional[str] = None,
    is_active: Optional[bool] = None,
    skip: int = 0,
    limit: int = 50,
) -> tuple[list[Shop], int]:
    q = db.query(Shop)
    if district:
        q = q.filter(Shop.district.ilike(f"%{district}%"))
    if is_active is not None:
        q = q.filter(Shop.is_active == is_active)
    total = q.count()
    shops = q.order_by(Shop.created_at.desc()).offset(skip).limit(limit).all()
    return shops, total


# ── Doctor management ─────────────────────────────────────────────────────────

def _generate_temp_password() -> str:
    """Generate a secure temporary password (16 chars, mixed)."""
    chars = string.ascii_letters + string.digits + "!@#$"
    return "".join(secrets.choice(chars) for _ in range(16))


def _generate_mrn() -> str:
    """Generate a mock Medical Registration Number: MRN-XXXXXXXX."""
    return f"MRN-{secrets.randbelow(90_000_000) + 10_000_000:08d}"


def create_doctor(
    full_name: str,
    specialization: Optional[str],
    contact_phone: Optional[str],
    hospital_name: Optional[str],
    admin: User,
    db: Session,
    ip_address: str = "unknown",
) -> tuple[User, DoctorProfile, str]:
    """
    Create doctor User + DoctorProfile.
    Returns (user, profile, plaintext_temp_password) — shown once.
    """
    mrn = _generate_mrn()
    temp_password = _generate_temp_password()
    doctor_email = f"dr_{mrn.lower().replace('-', '_')}@tasmac.internal"

    doctor_user = User(
        id=uuid.uuid4(),
        email=doctor_email,
        full_name=full_name,
        password_hash=hash_password(temp_password),
        role=UserRole.DOCTOR,
        is_active=True,
        is_verified=True,
        must_change_password=True,
    )
    db.add(doctor_user)
    db.flush()

    doctor_profile = DoctorProfile(
        id=uuid.uuid4(),
        user_id=doctor_user.id,
        medical_reg_number=mrn,
        specialization=specialization,
        contact_phone=contact_phone,
        hospital_name=hospital_name,
        is_active=False,  # Must be explicitly activated by admin
    )
    db.add(doctor_profile)

    _audit(
        db, AuditEventType.ADMIN_CREATED_DOCTOR, actor=admin,
        target_user_id=doctor_user.id,
        description=f"Created doctor {full_name} ({mrn})",
        metadata={"mrn": mrn, "specialization": specialization},
        ip_address=ip_address,
    )
    db.commit()
    db.refresh(doctor_user)
    db.refresh(doctor_profile)
    return doctor_user, doctor_profile, temp_password


def activate_doctor(
    doctor_user_id: uuid.UUID,
    admin: User,
    db: Session,
    ip_address: str = "unknown",
) -> DoctorProfile:
    profile = db.query(DoctorProfile).filter(DoctorProfile.user_id == doctor_user_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Doctor profile not found")
    if profile.is_active:
        raise HTTPException(status_code=400, detail="Doctor is already active")

    profile.is_active = True
    profile.activated_by = admin.id
    profile.activated_at = datetime.now(timezone.utc)
    profile.deactivated_at = None

    _audit(
        db, AuditEventType.ADMIN_ACTIVATED_DOCTOR, actor=admin,
        target_user_id=doctor_user_id,
        description=f"Activated doctor {profile.medical_reg_number}",
        metadata={"mrn": profile.medical_reg_number},
        ip_address=ip_address,
    )
    db.commit()
    db.refresh(profile)
    return profile


def deactivate_doctor(
    doctor_user_id: uuid.UUID,
    reason: str,
    admin: User,
    db: Session,
    ip_address: str = "unknown",
    revoke_tokens: bool = True,
) -> DoctorProfile:
    profile = db.query(DoctorProfile).filter(DoctorProfile.user_id == doctor_user_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Doctor profile not found")

    doctor_user = db.query(User).filter(User.id == doctor_user_id).first()
    if not doctor_user:
        raise HTTPException(status_code=404, detail="Doctor user not found")

    profile.is_active = False
    profile.deactivated_at = datetime.now(timezone.utc)
    profile.deactivation_reason = reason

    if revoke_tokens:
        # Increment token_version to immediately invalidate all existing JWTs
        doctor_user.token_version = (doctor_user.token_version or 0) + 1

    event = AuditEventType.ADMIN_REVOKED_DOCTOR if revoke_tokens else AuditEventType.ADMIN_DEACTIVATED_DOCTOR
    _audit(
        db, event, actor=admin,
        target_user_id=doctor_user_id,
        description=f"Deactivated doctor {profile.medical_reg_number}: {reason}",
        metadata={"mrn": profile.medical_reg_number, "tokens_revoked": revoke_tokens},
        ip_address=ip_address,
    )
    db.commit()
    db.refresh(profile)
    return profile


def list_doctors(
    db: Session,
    is_active: Optional[bool] = None,
    skip: int = 0,
    limit: int = 50,
) -> tuple[list[tuple[User, DoctorProfile]], int]:
    q = (
        db.query(User, DoctorProfile)
        .join(DoctorProfile, DoctorProfile.user_id == User.id)
        .filter(User.role == UserRole.DOCTOR)
    )
    if is_active is not None:
        q = q.filter(DoctorProfile.is_active == is_active)
    total = q.count()
    results = q.order_by(User.created_at.desc()).offset(skip).limit(limit).all()
    return results, total


# ── Consumer management (read-only for admin) ─────────────────────────────────

def list_consumers(
    db: Session,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
) -> tuple[list[User], int]:
    q = db.query(User).filter(User.role == UserRole.CONSUMER)
    if search:
        q = q.filter(User.full_name.ilike(f"%{search}%"))
    total = q.count()
    users = q.order_by(User.created_at.desc()).offset(skip).limit(limit).all()
    return users, total


# ── Global limits (system_config) ─────────────────────────────────────────────

def get_global_limits(db: Session) -> dict:
    configs = db.query(SystemConfig).filter(
        SystemConfig.key.in_(list(GLOBAL_LIMIT_KEYS.keys()))
    ).all()
    result = {k: v for k, (_, v) in GLOBAL_LIMIT_KEYS.items()}  # defaults
    for cfg in configs:
        try:
            result[cfg.key] = float(cfg.value)
        except (ValueError, TypeError):
            pass
    return result


def update_global_limits(
    daily_limit_sd: float,
    weekly_limit_sd: float,
    monthly_limit_sd: float,
    admin: User,
    db: Session,
    ip_address: str = "unknown",
) -> dict:
    if daily_limit_sd < 0 or weekly_limit_sd < 0 or monthly_limit_sd < 0:
        raise HTTPException(status_code=422, detail="Limits cannot be negative")

    old_limits = get_global_limits(db)

    updates = {
        "global_daily_limit_sd": daily_limit_sd,
        "global_weekly_limit_sd": weekly_limit_sd,
        "global_monthly_limit_sd": monthly_limit_sd,
    }

    for key, value in updates.items():
        cfg = db.query(SystemConfig).filter(SystemConfig.key == key).first()
        if cfg:
            cfg.value = str(value)
            cfg.updated_by = admin.id
        else:
            desc, _ = GLOBAL_LIMIT_KEYS[key]
            db.add(SystemConfig(
                id=uuid.uuid4(),
                key=key,
                value=str(value),
                description=desc,
                updated_by=admin.id,
            ))

    _audit(
        db, AuditEventType.ADMIN_UPDATED_GLOBAL_LIMITS, actor=admin,
        description="Updated global alcohol limits",
        metadata={
            "old": old_limits,
            "new": {"global_daily_limit_sd": daily_limit_sd,
                    "global_weekly_limit_sd": weekly_limit_sd,
                    "global_monthly_limit_sd": monthly_limit_sd},
        },
        ip_address=ip_address,
    )
    db.commit()
    return get_global_limits(db)


# ── Audit log viewer ──────────────────────────────────────────────────────────

def get_audit_logs(
    db: Session,
    event_type: Optional[str] = None,
    actor_id: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    skip: int = 0,
    limit: int = 50,
) -> tuple[list[AuditLog], int]:
    q = db.query(AuditLog)
    if event_type:
        q = q.filter(AuditLog.event_type == event_type)
    if actor_id:
        try:
            q = q.filter(AuditLog.actor_id == uuid.UUID(actor_id))
        except ValueError:
            pass
    if date_from:
        q = q.filter(AuditLog.created_at >= date_from)
    if date_to:
        q = q.filter(AuditLog.created_at <= date_to)
    total = q.count()
    logs = q.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()
    return logs, total
