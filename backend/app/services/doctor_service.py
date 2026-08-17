"""Doctor service — identified clinical-intervention logic.

Privacy guardrails enforced here:
- search_patient: exact-match only (no partial/fuzzy). Every call audit-logged.
- get_patient_detail: access itself is audit-logged.
- issue_restriction: writes DoctorRestriction + AuditLog.
- cancel_restriction: only issuing doctor OR admin can cancel; always logged.
- expire_overdue_restrictions: called by APScheduler job every 5 min.

Operators never see the doctor's free-text reason — only reason_category label.
Consumers see category + clinic name, not the full clinical text.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog, AuditEventType
from app.models.consumer_profile import ConsumerProfile
from app.models.doctor_profile import DoctorProfile
from app.models.doctor_restriction import DoctorRestriction, RestrictionStatus
from app.models.purchase import Purchase
from app.models.user import User, UserRole
from app.core.security import decrypt_aadhaar


# ── Helpers ───────────────────────────────────────────────────────────────────

def _mask_query(query: str) -> str:
    return f"****{query[-4:]}" if len(query) >= 4 else "****"


def _calc_age(dob: Optional[date]) -> Optional[int]:
    if not dob:
        return None
    today = date.today()
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))


async def _today_consumed_ml(consumer_user_id: uuid.UUID, db: AsyncSession) -> float:
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    result = await db.execute(
        select(func.sum(Purchase.quantity_ml)).where(
            Purchase.consumer_id == consumer_user_id,
            Purchase.purchased_at >= today_start,
        )
    )
    return float(result.scalar() or 0)


async def _week_consumed_ml(consumer_user_id: uuid.UUID, db: AsyncSession) -> float:
    week_start = datetime.now(timezone.utc) - timedelta(days=7)
    result = await db.execute(
        select(func.sum(Purchase.quantity_ml)).where(
            Purchase.consumer_id == consumer_user_id,
            Purchase.purchased_at >= week_start,
        )
    )
    return float(result.scalar() or 0)


async def _purchases_30d(consumer_user_id: uuid.UUID, db: AsyncSession) -> int:
    month_start = datetime.now(timezone.utc) - timedelta(days=30)
    result = await db.execute(
        select(func.count()).select_from(Purchase).where(
            Purchase.consumer_id == consumer_user_id,
            Purchase.purchased_at >= month_start,
        )
    )
    return result.scalar_one()


def _restriction_label(category: str) -> str:
    return {
        "liver_disease":          "Liver Disease",
        "addiction_risk":         "Addiction Risk",
        "medication_interaction": "Medication Interaction",
        "pregnancy":              "Pregnancy",
        "other":                  "Other Medical",
    }.get(category, category.replace("_", " ").title())


async def _serialize_restriction(
    r: DoctorRestriction,
    db: AsyncSession,
    include_reason: bool = True,
) -> dict:
    doctor_user_res = await db.execute(select(User).where(User.id == r.doctor_user_id))
    doctor_user = doctor_user_res.scalar_one_or_none()

    doctor_profile_res = await db.execute(
        select(DoctorProfile).where(DoctorProfile.user_id == r.doctor_user_id)
    )
    doctor_profile = doctor_profile_res.scalar_one_or_none()

    patient_user_res = await db.execute(select(User).where(User.id == r.patient_user_id))
    patient_user = patient_user_res.scalar_one_or_none()

    cancelled_by_user = None
    if r.cancelled_by:
        cb_res = await db.execute(select(User).where(User.id == r.cancelled_by))
        cancelled_by_user = cb_res.scalar_one_or_none()

    base = {
        "restriction_id": str(r.id),
        "patient_user_id": str(r.patient_user_id),
        "patient_name": patient_user.full_name if patient_user else "—",
        "doctor_user_id": str(r.doctor_user_id),
        "doctor_name": doctor_user.full_name if doctor_user else "—",
        "hospital_name": doctor_profile.hospital_name if doctor_profile else None,
        "reason_category": r.reason_category,
        "reason_category_label": _restriction_label(r.reason_category),
        "restriction_type": r.restriction_type,
        "status": r.status,
        "start_date": r.start_date.isoformat(),
        "end_date": r.end_date.isoformat() if r.end_date else None,
        "created_at": r.created_at.isoformat(),
        "cancelled_at": r.cancelled_at.isoformat() if r.cancelled_at else None,
        "cancelled_by_name": cancelled_by_user.full_name if cancelled_by_user else None,
        "cancellation_reason": r.cancellation_reason,
    }
    if include_reason:
        base["reason"] = r.reason
    return base


def _write_audit(
    db: AsyncSession,
    event_type: AuditEventType,
    actor: User,
    target_user_id: Optional[uuid.UUID] = None,
    description: str = "",
    metadata: Optional[dict] = None,
) -> None:
    db.add(AuditLog(
        event_type=event_type.value,
        actor_id=actor.id,
        user_id=target_user_id,
        description=description,
        metadata_json=metadata or {},
    ))


# ── Patient search (exact match only) ─────────────────────────────────────────

async def search_patient(query: str, doctor: User, db: AsyncSession) -> Optional[dict]:
    query = query.strip()

    if len(query) < 4:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Query too short. Provide exact mobile number or Aadhaar number.",
        )

    # Search 1: exact mobile match
    res = await db.execute(
        select(User).where(User.mobile_number == query, User.role == UserRole.CONSUMER)
    )
    matched_user: Optional[User] = res.scalar_one_or_none()

    # Search 2: exact Aadhaar match (decrypt all consumer profiles and compare)
    if not matched_user:
        prof_res = await db.execute(select(ConsumerProfile))
        profiles = prof_res.scalars().all()
        for profile in profiles:
            if profile.aadhaar_encrypted:
                try:
                    decrypted = decrypt_aadhaar(profile.aadhaar_encrypted)
                    if decrypted == query:
                        u_res = await db.execute(select(User).where(User.id == profile.user_id))
                        matched_user = u_res.scalar_one_or_none()
                        break
                except Exception:
                    continue

    result_found = matched_user is not None

    _write_audit(
        db, AuditEventType.DOCTOR_PATIENT_SEARCH, doctor,
        target_user_id=matched_user.id if matched_user else None,
        description=f"Patient search by doctor {doctor.full_name}",
        metadata={"query_masked": _mask_query(query), "result_found": result_found},
    )
    await db.commit()

    if not matched_user:
        return None

    profile_res = await db.execute(
        select(ConsumerProfile).where(ConsumerProfile.user_id == matched_user.id)
    )
    profile = profile_res.scalar_one_or_none()
    if not profile:
        return None

    now_utc = datetime.now(timezone.utc)
    ar_res = await db.execute(
        select(DoctorRestriction).where(
            DoctorRestriction.patient_user_id == matched_user.id,
            DoctorRestriction.status == RestrictionStatus.ACTIVE.value,
        )
    )
    active_restriction = ar_res.scalar_one_or_none()

    uid = matched_user.id
    daily_limit_ml = 960
    weekly_limit_ml = 4800
    today_ml = await _today_consumed_ml(uid, db)
    week_ml = await _week_consumed_ml(uid, db)

    return {
        "patient_user_id": str(matched_user.id),
        "full_name": matched_user.full_name,
        "age": _calc_age(profile.dob),
        "district": profile.district,
        "beverage_preference": profile.beverage_preference.value if profile.beverage_preference else None,
        "is_teetotaler": profile.is_teetotaler,
        "has_active_doctor_restriction": bool(active_restriction),
        "active_restriction_category": active_restriction.reason_category if active_restriction else None,
        "consumption_summary": {
            "daily_consumed_ml": today_ml,
            "weekly_consumed_ml": week_ml,
            "daily_limit_ml": daily_limit_ml,
            "weekly_limit_ml": weekly_limit_ml,
            "daily_pct_used": round((today_ml / daily_limit_ml) * 100, 1) if daily_limit_ml else 0,
            "weekly_pct_used": round((week_ml / weekly_limit_ml) * 100, 1) if weekly_limit_ml else 0,
            "total_purchases_30d": await _purchases_30d(uid, db),
        },
    }


# ── Patient detail ─────────────────────────────────────────────────────────────

async def get_patient_detail(patient_user_id: str, doctor: User, db: AsyncSession) -> dict:
    patient_res = await db.execute(
        select(User).where(User.id == patient_user_id, User.role == UserRole.CONSUMER)
    )
    patient = patient_res.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found.")

    profile_res = await db.execute(
        select(ConsumerProfile).where(ConsumerProfile.user_id == patient_user_id)
    )
    profile = profile_res.scalar_one_or_none()

    _write_audit(
        db, AuditEventType.DOCTOR_PATIENT_VIEWED, doctor,
        target_user_id=uuid.UUID(patient_user_id),
        description=f"Doctor {doctor.full_name} viewed patient detail",
        metadata={"patient_id": patient_user_id},
    )
    await db.commit()

    uid = patient.id
    daily_limit_ml = (profile.daily_limit_ml if profile else None) or 960
    weekly_limit_ml = (profile.weekly_limit_ml if profile else None) or 4800
    today_ml = await _today_consumed_ml(uid, db)
    week_ml = await _week_consumed_ml(uid, db)

    # Purchase history (last 90 days)
    cutoff = datetime.now(timezone.utc) - timedelta(days=90)
    purchases_res = await db.execute(
        select(Purchase).where(
            Purchase.consumer_id == uid,
            Purchase.purchased_at >= cutoff,
        ).order_by(Purchase.purchased_at.desc()).limit(100)
    )
    purchases = purchases_res.scalars().all()

    purchase_history = [{
        "purchase_id": str(p.id),
        "product_name": p.product_name,
        "quantity_ml": p.quantity_ml,
        "standard_drinks": float(p.standard_drinks) if p.standard_drinks else None,
        "price": float(p.price),
        "shop_name": p.shop_name,
        "purchased_at": p.purchased_at.isoformat(),
    } for p in purchases]

    # Doctor restrictions
    all_res = await db.execute(
        select(DoctorRestriction).where(
            DoctorRestriction.patient_user_id == uid,
        ).order_by(DoctorRestriction.created_at.desc())
    )
    all_restrictions = all_res.scalars().all()

    async def _ser_restriction(r: DoctorRestriction) -> dict:
        doc_user_res = await db.execute(select(User).where(User.id == r.doctor_user_id))
        doc_user = doc_user_res.scalar_one_or_none()
        doc_prof_res = await db.execute(
            select(DoctorProfile).where(DoctorProfile.user_id == r.doctor_user_id)
        )
        doc_prof = doc_prof_res.scalar_one_or_none()
        return {
            "restriction_id": str(r.id),
            "restriction_type": r.restriction_type,
            "reason_category": r.reason_category,
            "reason_category_label": _restriction_label(r.reason_category),
            "status": r.status,
            "start_date": r.start_date.isoformat(),
            "end_date": r.end_date.isoformat() if r.end_date else None,
            "issuing_doctor_name": doc_user.full_name if doc_user else "—",
            "issuing_hospital": doc_prof.hospital_name if doc_prof else None,
        }

    active_restrictions = [await _ser_restriction(r) for r in all_restrictions if r.status == "active"]
    restriction_history = [await _ser_restriction(r) for r in all_restrictions]

    return {
        "patient_user_id": patient_user_id,
        "full_name": patient.full_name,
        "age": _calc_age(profile.dob) if profile else None,
        "district": profile.district if profile else None,
        "beverage_preference": profile.beverage_preference.value if profile and profile.beverage_preference else None,
        "is_teetotaler": profile.is_teetotaler if profile else False,
        "consumption_summary": {
            "daily_consumed_ml": today_ml,
            "weekly_consumed_ml": week_ml,
            "daily_limit_ml": daily_limit_ml,
            "weekly_limit_ml": weekly_limit_ml,
            "daily_pct_used": round((today_ml / daily_limit_ml) * 100, 1) if daily_limit_ml else 0,
            "weekly_pct_used": round((week_ml / weekly_limit_ml) * 100, 1) if weekly_limit_ml else 0,
            "total_purchases_30d": await _purchases_30d(uid, db),
        },
        "purchase_history": purchase_history,
        "active_doctor_restrictions": active_restrictions,
        "restriction_history": restriction_history,
    }


# ── Issue restriction ──────────────────────────────────────────────────────────

async def issue_restriction(
    patient_user_id: str,
    reason: str,
    reason_category: str,
    restriction_type: str,
    duration_days: Optional[int],
    doctor: User,
    db: AsyncSession,
) -> dict:
    patient_res = await db.execute(
        select(User).where(User.id == patient_user_id, User.role == UserRole.CONSUMER)
    )
    patient = patient_res.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found.")

    if restriction_type == "temporary" and not duration_days:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="duration_days is required for temporary restrictions.",
        )

    now_utc = datetime.now(timezone.utc)
    end_date = (now_utc + timedelta(days=duration_days)) if restriction_type == "temporary" and duration_days else None

    restriction = DoctorRestriction(
        patient_user_id=uuid.UUID(patient_user_id),
        doctor_user_id=doctor.id,
        reason=reason,
        reason_category=reason_category,
        restriction_type=restriction_type,
        status=RestrictionStatus.ACTIVE.value,
        start_date=now_utc,
        end_date=end_date,
    )
    db.add(restriction)
    await db.flush()

    _write_audit(
        db, AuditEventType.DOCTOR_RESTRICTION_ISSUED, doctor,
        target_user_id=uuid.UUID(patient_user_id),
        description=f"Doctor {doctor.full_name} issued {restriction_type} restriction",
        metadata={
            "restriction_id": str(restriction.id),
            "category": reason_category,
            "type": restriction_type,
            "duration_days": duration_days,
        },
    )
    await db.commit()

    return await _serialize_restriction(restriction, db, include_reason=True)


# ── Cancel restriction ─────────────────────────────────────────────────────────

async def cancel_restriction(
    restriction_id: str,
    cancellation_reason: str,
    actor: User,
    db: AsyncSession,
) -> dict:
    r_res = await db.execute(
        select(DoctorRestriction).where(DoctorRestriction.id == restriction_id)
    )
    restriction = r_res.scalar_one_or_none()
    if not restriction:
        raise HTTPException(status_code=404, detail="Restriction not found.")

    if restriction.status != RestrictionStatus.ACTIVE.value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Restriction is already {restriction.status}. Cannot cancel.",
        )

    is_issuer = str(restriction.doctor_user_id) == str(actor.id)
    is_admin = actor.role == UserRole.ADMIN
    if not is_issuer and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the issuing doctor or an administrator can cancel this restriction.",
        )

    now_utc = datetime.now(timezone.utc)
    restriction.status = RestrictionStatus.CANCELLED.value
    restriction.cancelled_at = now_utc
    restriction.cancelled_by = actor.id
    restriction.cancellation_reason = cancellation_reason

    _write_audit(
        db, AuditEventType.DOCTOR_RESTRICTION_CANCELLED, actor,
        target_user_id=restriction.patient_user_id,
        description=f"{actor.role.value} {actor.full_name} cancelled restriction",
        metadata={
            "restriction_id": restriction_id,
            "cancelled_by_role": actor.role.value,
            "reason": cancellation_reason,
        },
    )
    await db.commit()

    return await _serialize_restriction(restriction, db, include_reason=True)


# ── Get restriction record ─────────────────────────────────────────────────────

async def get_restriction(restriction_id: str, actor: User, db: AsyncSession) -> dict:
    r_res = await db.execute(
        select(DoctorRestriction).where(DoctorRestriction.id == restriction_id)
    )
    restriction = r_res.scalar_one_or_none()
    if not restriction:
        raise HTTPException(status_code=404, detail="Restriction not found.")

    is_issuer = str(restriction.doctor_user_id) == str(actor.id)
    is_admin = actor.role == UserRole.ADMIN
    if not is_issuer and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Only the issuing doctor or admin may view full restriction details.",
        )
    return await _serialize_restriction(restriction, db, include_reason=True)


# ── Consumer self-view ─────────────────────────────────────────────────────────

async def get_consumer_own_restrictions(consumer: User, db: AsyncSession) -> list[dict]:
    r_res = await db.execute(
        select(DoctorRestriction).where(
            DoctorRestriction.patient_user_id == consumer.id,
        ).order_by(DoctorRestriction.created_at.desc())
    )
    restrictions = r_res.scalars().all()

    result = []
    for r in restrictions:
        doc_prof_res = await db.execute(
            select(DoctorProfile).where(DoctorProfile.user_id == r.doctor_user_id)
        )
        doc_prof = doc_prof_res.scalar_one_or_none()
        result.append({
            "restriction_id": str(r.id),
            "restriction_type": r.restriction_type,
            "reason_category": r.reason_category,
            "reason_category_label": _restriction_label(r.reason_category),
            "status": r.status,
            "start_date": r.start_date.isoformat(),
            "end_date": r.end_date.isoformat() if r.end_date else None,
            "issuing_clinic": doc_prof.hospital_name if doc_prof else None,
        })
    return result


# ── Dashboard (anonymous aggregate) ───────────────────────────────────────────

async def get_dashboard_stats(doctor: User, db: AsyncSession) -> dict:
    now_utc = datetime.now(timezone.utc)
    week_ago = now_utc - timedelta(days=7)

    r = await db.execute(
        select(func.count()).select_from(DoctorRestriction)
        .where(DoctorRestriction.status == "active")
    )
    total_active = r.scalar_one()

    r = await db.execute(
        select(func.count()).select_from(DoctorRestriction)
        .where(DoctorRestriction.doctor_user_id == doctor.id)
    )
    issued_by_me = r.scalar_one()

    r = await db.execute(
        select(func.count()).select_from(DoctorRestriction)
        .where(DoctorRestriction.cancelled_by == doctor.id)
    )
    cancelled_by_me = r.scalar_one()

    r = await db.execute(
        select(func.count()).select_from(DoctorRestriction).where(
            DoctorRestriction.status == "expired",
            DoctorRestriction.end_date >= week_ago,
        )
    )
    recent_expirations = r.scalar_one()

    district_res = await db.execute(
        select(ConsumerProfile.district, func.count(DoctorRestriction.id))
        .join(DoctorRestriction, DoctorRestriction.patient_user_id == ConsumerProfile.user_id)
        .where(DoctorRestriction.status == "active")
        .group_by(ConsumerProfile.district)
    )
    district_rows = district_res.all()

    category_res = await db.execute(
        select(DoctorRestriction.reason_category, func.count(DoctorRestriction.id))
        .where(DoctorRestriction.status == "active")
        .group_by(DoctorRestriction.reason_category)
    )
    category_rows = category_res.all()

    return {
        "total_active_restrictions": total_active,
        "total_issued_by_me": issued_by_me,
        "total_cancelled_by_me": cancelled_by_me,
        "district_breakdown": [{"district": d or "Unknown", "count": c} for d, c in district_rows],
        "category_breakdown": [{"category": _restriction_label(cat), "count": c} for cat, c in category_rows],
        "recent_expirations_7d": recent_expirations,
    }


# ── Scheduler job — auto-expire temporary restrictions ────────────────────────

async def expire_overdue_restrictions(db: AsyncSession) -> int:
    now_utc = datetime.now(timezone.utc)
    r = await db.execute(
        select(DoctorRestriction).where(
            DoctorRestriction.restriction_type == "temporary",
            DoctorRestriction.status == RestrictionStatus.ACTIVE.value,
            DoctorRestriction.end_date <= now_utc,
        )
    )
    overdue = r.scalars().all()

    for restriction in overdue:
        restriction.status = RestrictionStatus.EXPIRED.value
        db.add(AuditLog(
            event_type=AuditEventType.DOCTOR_RESTRICTION_EXPIRED.value,
            user_id=restriction.patient_user_id,
            description="Temporary restriction auto-expired by scheduler",
            metadata_json={
                "restriction_id": str(restriction.id),
                "end_date": restriction.end_date.isoformat() if restriction.end_date else None,
            },
        ))

    if overdue:
        await db.commit()

    return len(overdue)
