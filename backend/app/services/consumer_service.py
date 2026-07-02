"""Consumer profile service.

IDOR protection: user identity is ALWAYS taken from the JWT-validated User object
passed in — never from request body or path parameters.
"""
from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import decrypt_aadhaar, mask_aadhaar
from app.models.audit_log import AuditEventType, AuditLog
from app.models.consumer_profile import BeveragePreference, ConsumerProfile, Gender
from app.models.notification import (
    Notification,
    NotificationCategory,
    NotificationType,
)
from app.models.restriction import SelfRestriction
from app.models.user import User
from app.schemas.consumer import (
    ConsumerProfileResponse,
    SelfRestrictionResponse,
)
from app.services.image_service import strip_exif_and_reencode


# ── Internal helpers ───────────────────────────────────────────────────────────

def _write_audit(
    db: Session,
    event_type: AuditEventType,
    *,
    user_id,
    description: Optional[str] = None,
    metadata_json: Optional[dict] = None,
    ip_address: Optional[str] = None,
) -> None:
    try:
        log = AuditLog(
            user_id=user_id,
            event_type=event_type,
            description=description,
            metadata_json=metadata_json,
            ip_address=ip_address,
        )
        db.add(log)
        db.flush()
    except Exception:
        pass


def _fetch_profile(user: User, db: Session) -> ConsumerProfile:
    profile = (
        db.query(ConsumerProfile)
        .filter(ConsumerProfile.user_id == user.id)
        .first()
    )
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Consumer profile not found",
        )
    return profile


def _fetch_restriction(user: User, db: Session) -> Optional[SelfRestriction]:
    return (
        db.query(SelfRestriction)
        .filter(SelfRestriction.user_id == user.id)
        .first()
    )


def _build_response(
    user: User,
    profile: ConsumerProfile,
    restriction: Optional[SelfRestriction],
    raw_aadhaar: str,
) -> ConsumerProfileResponse:
    restriction_resp = None
    if restriction:
        restriction_resp = SelfRestrictionResponse(
            daily_limit_sd=restriction.daily_limit_sd,
            weekly_limit_sd=restriction.weekly_limit_sd,
            monthly_limit_sd=restriction.monthly_limit_sd,
            pending_daily_limit_sd=restriction.pending_daily_limit_sd,
            pending_weekly_limit_sd=restriction.pending_weekly_limit_sd,
            pending_monthly_limit_sd=restriction.pending_monthly_limit_sd,
            lock_requested_at=restriction.lock_requested_at,
            is_locked=restriction.is_locked,
            locked_until=restriction.locked_until,
            lock_reason=restriction.lock_reason,
        )

    return ConsumerProfileResponse(
        id=profile.id,
        user_id=user.id,
        full_name=user.full_name,
        email=user.email,
        mobile_number=user.mobile_number,
        aadhaar_masked=mask_aadhaar(raw_aadhaar),
        dob=profile.dob,
        gender=profile.gender,
        district=profile.district,
        address=profile.address,
        photo_path=profile.photo_path,
        beverage_preference=profile.beverage_preference,
        is_teetotaler=profile.is_teetotaler,
        teetotaler_set_at=profile.teetotaler_set_at,
        restrictions=restriction_resp,
    )


# ── Public service functions ───────────────────────────────────────────────────

def get_profile(user: User, db: Session) -> ConsumerProfileResponse:
    """Return the consumer's profile with masked Aadhaar.

    Ownership enforced by *user* coming exclusively from JWT `sub` claim.
    """
    profile = _fetch_profile(user, db)
    restriction = _fetch_restriction(user, db)

    raw_aadhaar = (
        decrypt_aadhaar(profile.aadhaar_encrypted)
        if profile.aadhaar_encrypted
        else "000000000000"
    )
    return _build_response(user, profile, restriction, raw_aadhaar)


def update_profile(user: User, data: dict, db: Session) -> ConsumerProfileResponse:
    """Update allowed non-sensitive profile fields.

    Only district, gender, address, and beverage_preference can be changed here.
    Sensitive fields (Aadhaar, DOB, name) require a separate verified flow.
    """
    profile = _fetch_profile(user, db)

    allowed_fields = {"district", "gender", "address", "beverage_preference"}
    updated: dict = {}
    for field, value in data.items():
        if field in allowed_fields and value is not None:
            # Validate enum types
            if field == "gender" and isinstance(value, str):
                value = Gender(value)
            if field == "beverage_preference" and isinstance(value, str):
                value = BeveragePreference(value)
            setattr(profile, field, value)
            updated[field] = str(value)

    _write_audit(
        db,
        AuditEventType.PROFILE_UPDATED,
        user_id=user.id,
        description="Consumer profile updated",
        metadata_json={"updated_fields": list(updated.keys())},
    )
    db.commit()
    db.refresh(profile)

    restriction = _fetch_restriction(user, db)
    raw_aadhaar = (
        decrypt_aadhaar(profile.aadhaar_encrypted)
        if profile.aadhaar_encrypted
        else "000000000000"
    )
    return _build_response(user, profile, restriction, raw_aadhaar)


def upload_photo(user: User, file_bytes: bytes, db: Session) -> str:
    """Strip EXIF, save photo, update profile, write audit.

    File is named by user UUID so there is no ambiguity and no path traversal
    risk from user-supplied filenames.
    """
    clean_bytes = strip_exif_and_reencode(file_bytes)

    upload_dir = settings.UPLOAD_DIR
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, f"{user.id}.jpg")

    with open(file_path, "wb") as f:
        f.write(clean_bytes)

    profile = _fetch_profile(user, db)
    profile.photo_path = file_path

    _write_audit(
        db,
        AuditEventType.PHOTO_UPLOADED,
        user_id=user.id,
        description="Profile photo updated",
    )
    db.commit()
    return file_path


def toggle_teetotaler(
    user: User, enabled: bool, db: Session
) -> ConsumerProfileResponse:
    """Enable or disable teetotaler mode for the consumer."""
    profile = _fetch_profile(user, db)
    profile.is_teetotaler = enabled
    profile.teetotaler_set_at = datetime.now(timezone.utc) if enabled else None

    event = (
        AuditEventType.TEETOTALER_ENABLED if enabled else AuditEventType.TEETOTALER_DISABLED
    )
    _write_audit(
        db,
        event,
        user_id=user.id,
        description=f"Teetotaler mode {'enabled' if enabled else 'disabled'}",
    )

    # Create in-app notification
    notif_title = "Teetotaler Mode Enabled" if enabled else "Teetotaler Mode Disabled"
    notif_msg = (
        "You have enabled teetotaler mode. Purchases are now blocked."
        if enabled
        else "You have disabled teetotaler mode. Purchases are now allowed."
    )
    notification = Notification(
        user_id=user.id,
        notification_type=NotificationType.INFO,
        category=NotificationCategory.TEETOTALER,
        title=notif_title,
        message=notif_msg,
    )
    db.add(notification)

    db.commit()
    db.refresh(profile)

    restriction = _fetch_restriction(user, db)
    raw_aadhaar = (
        decrypt_aadhaar(profile.aadhaar_encrypted)
        if profile.aadhaar_encrypted
        else "000000000000"
    )
    return _build_response(user, profile, restriction, raw_aadhaar)
