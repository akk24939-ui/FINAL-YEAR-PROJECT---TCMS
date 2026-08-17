"""Admin doctors endpoints — create, activate, deactivate, revoke."""
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_admin, get_client_ip
from app.models.user import User, UserRole
from app.services import admin_service

router = APIRouter()


class CreateDoctorRequest(BaseModel):
    full_name: str
    specialization: Optional[str] = None
    contact_phone: Optional[str] = None
    hospital_name: Optional[str] = None
    initial_password: Optional[str] = None


class DeactivateDoctorRequest(BaseModel):
    reason: str
    revoke_tokens: bool = True


class ResetPasswordRequest(BaseModel):
    new_password: str


def _serialize_doctor(user: User, profile) -> dict:
    return {
        "user_id": str(user.id),
        "email": user.email,
        "full_name": user.full_name,
        "is_active": user.is_active,
        "must_change_password": user.must_change_password,
        "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "profile": {
            "medical_reg_number": profile.medical_reg_number,
            "specialization": profile.specialization,
            "contact_phone": profile.contact_phone,
            "hospital_name": profile.hospital_name,
            "is_active": profile.is_active,
            "activated_at": profile.activated_at.isoformat() if profile.activated_at else None,
            "deactivated_at": profile.deactivated_at.isoformat() if profile.deactivated_at else None,
            "deactivation_reason": profile.deactivation_reason,
        },
    }


@router.get("/doctors", summary="List all doctors")
async def list_doctors(
    is_active: Optional[bool] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    results, total = await admin_service.list_doctors(db, is_active=is_active, skip=skip, limit=limit)
    return {"total": total, "doctors": [_serialize_doctor(u, p) for u, p in results]}


@router.post("/doctors", summary="Create a new doctor account (admin only)")
async def create_doctor(
    body: CreateDoctorRequest,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
    ip: str = Depends(get_client_ip),
):
    user, profile, temp_password = await admin_service.create_doctor(
        full_name=body.full_name,
        specialization=body.specialization,
        contact_phone=body.contact_phone,
        hospital_name=body.hospital_name,
        admin=current_user,
        db=db,
        ip_address=ip,
        initial_password=body.initial_password,
    )
    # Auto-activate immediately so doctor can log in right away
    profile = await admin_service.activate_doctor(user.id, current_user, db, ip)
    return {
        "doctor": _serialize_doctor(user, profile),
        "temp_password": temp_password,
        "login_email": user.email,
        "message": "Doctor account created and activated. Share the credentials securely.",
    }


@router.post("/doctors/{doctor_user_id}/activate", summary="Activate a doctor account")
async def activate_doctor(
    doctor_user_id: uuid.UUID,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
    ip: str = Depends(get_client_ip),
):
    profile = await admin_service.activate_doctor(doctor_user_id, current_user, db, ip)
    return {"message": "Doctor activated.", "is_active": profile.is_active}


@router.post("/doctors/{doctor_user_id}/deactivate", summary="Deactivate a doctor (optionally revoke tokens)")
async def deactivate_doctor(
    doctor_user_id: uuid.UUID,
    body: DeactivateDoctorRequest,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
    ip: str = Depends(get_client_ip),
):
    profile = await admin_service.deactivate_doctor(
        doctor_user_id, body.reason, current_user, db, ip, revoke_tokens=body.revoke_tokens
    )
    return {
        "message": "Doctor deactivated. Tokens revoked." if body.revoke_tokens else "Doctor deactivated.",
        "is_active": profile.is_active,
    }


@router.post("/doctors/{doctor_user_id}/reset-password", summary="Reset doctor password (admin)")
async def reset_doctor_password(
    doctor_user_id: uuid.UUID,
    body: ResetPasswordRequest,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import select
    from app.core.security import hash_password

    if len(body.new_password) < 6:
        raise HTTPException(status_code=422, detail="Password must be at least 6 characters.")

    result = await db.execute(
        select(User).where(User.id == doctor_user_id, User.role == UserRole.DOCTOR)
    )
    doctor_user = result.scalar_one_or_none()
    if not doctor_user:
        raise HTTPException(status_code=404, detail="Doctor not found.")

    doctor_user.password_hash = hash_password(body.new_password)
    doctor_user.must_change_password = False
    doctor_user.token_version = (doctor_user.token_version or 0) + 1
    doctor_user.failed_login_attempts = 0
    await db.commit()
    return {"message": "Password reset.", "new_password": body.new_password}
