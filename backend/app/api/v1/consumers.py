"""Consumer router — profile, restrictions, QR, notifications, consents."""
from __future__ import annotations

import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.models import Consumer, Consent, Notification, Restriction, User
from app.schemas.schemas import (
    ConsentCreate, ConsentOut, ConsumerProfileOut, ConsumerProfileUpdate,
    NotificationOut, QRCodeOut, RestrictionCreate, RestrictionOut,
)
from app.services.audit_service import AuditService
from app.services.qr_service import QRService

router = APIRouter(prefix="/consumers", tags=["consumers"])
_qr_svc = QRService()


async def _get_consumer(user: User, db: AsyncSession) -> Consumer:
    result = await db.execute(select(Consumer).where(Consumer.user_id == user.id))
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Consumer profile not found")
    return c


@router.get("/me", response_model=ConsumerProfileOut)
async def get_my_profile(
    request: Request,
    current_user: User = Depends(require_role("consumer")),
    db: AsyncSession = Depends(get_db),
):
    consumer = await _get_consumer(current_user, db)
    await AuditService(request.client.host).log(db, actor_user_id=current_user.id,
        action="READ", target_table="consumers", target_id=consumer.id)
    return ConsumerProfileOut.model_validate(consumer)


@router.patch("/me", response_model=ConsumerProfileOut)
async def update_my_profile(
    data: ConsumerProfileUpdate,
    request: Request,
    current_user: User = Depends(require_role("consumer")),
    db: AsyncSession = Depends(get_db),
):
    consumer = await _get_consumer(current_user, db)
    if data.district is not None:
        consumer.district = data.district
    if data.gender is not None:
        consumer.gender = data.gender
    if data.teetotaler_flag is not None:
        consumer.teetotaler_flag = data.teetotaler_flag
    await db.flush()
    await AuditService(request.client.host).log(db, actor_user_id=current_user.id,
        action="UPDATE", target_table="consumers", target_id=consumer.id)
    return ConsumerProfileOut.model_validate(consumer)


@router.post("/me/restrictions", response_model=RestrictionOut, status_code=201)
async def set_restriction(
    data: RestrictionCreate,
    current_user: User = Depends(require_role("consumer")),
    db: AsyncSession = Depends(get_db),
):
    consumer = await _get_consumer(current_user, db)
    restriction = Restriction(consumer_id=consumer.id, **data.model_dump())
    db.add(restriction)
    await db.flush()
    return RestrictionOut.model_validate(restriction)


@router.get("/me/restrictions", response_model=list[RestrictionOut])
async def get_restrictions(
    current_user: User = Depends(require_role("consumer")),
    db: AsyncSession = Depends(get_db),
):
    consumer = await _get_consumer(current_user, db)
    result = await db.execute(
        select(Restriction).where(Restriction.consumer_id == consumer.id)
        .order_by(Restriction.effective_from.desc())
    )
    return [RestrictionOut.model_validate(r) for r in result.scalars().all()]


@router.post("/me/qr", response_model=dict)
async def issue_qr(
    request: Request,
    current_user: User = Depends(require_role("consumer")),
    db: AsyncSession = Depends(get_db),
):
    consumer = await _get_consumer(current_user, db)
    result = await _qr_svc.issue(db, consumer)
    await AuditService(request.client.host).log(db, actor_user_id=current_user.id,
        action="CREATE", target_table="qr_codes")
    return result


@router.get("/me/notifications", response_model=list[NotificationOut])
async def get_notifications(
    current_user: User = Depends(require_role("consumer")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Notification).where(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
    )
    return [NotificationOut.model_validate(n) for n in result.scalars().all()]


@router.post("/me/consents", response_model=ConsentOut, status_code=201)
async def grant_consent(
    data: ConsentCreate,
    current_user: User = Depends(require_role("consumer")),
    db: AsyncSession = Depends(get_db),
):
    consumer = await _get_consumer(current_user, db)
    # Resolve caretaker user by email
    ct_result = await db.execute(select(User).where(User.email == data.caretaker_email))
    caretaker = ct_result.scalar_one_or_none()
    if not caretaker:
        raise HTTPException(status_code=404, detail="Caretaker user not found")
    consent = Consent(consumer_id=consumer.id, caretaker_user_id=caretaker.id, scope=data.scope)
    db.add(consent)
    await db.flush()
    return ConsentOut.model_validate(consent)


@router.delete("/me/consents/{consent_id}", status_code=204)
async def revoke_consent(
    consent_id: uuid.UUID,
    current_user: User = Depends(require_role("consumer")),
    db: AsyncSession = Depends(get_db),
):
    from datetime import datetime, timezone
    consumer = await _get_consumer(current_user, db)
    result = await db.execute(select(Consent).where(
        Consent.id == consent_id, Consent.consumer_id == consumer.id
    ))
    consent = result.scalar_one_or_none()
    if not consent:
        raise HTTPException(status_code=404, detail="Consent not found")
    consent.revoked_at = datetime.now(timezone.utc)
    await db.flush()
