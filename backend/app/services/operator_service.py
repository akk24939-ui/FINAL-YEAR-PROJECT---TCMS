"""Operator service — shop dashboard, consumer lookup, purchase with global-limit enforcement."""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select, update

from app.models.alert import Alert, AlertType
from app.models.consumer_profile import ConsumerProfile
from app.models.consumer_limits import ConsumerLimits
from app.models.doctor_restriction import DoctorRestriction, RestrictionStatus
from app.models.purchase import Purchase
from app.models.product import Product
from app.models.qr_code import QrCode
from app.models.restriction import SelfRestriction
from app.models.shop import Shop
from app.models.system_config import SystemConfig
from app.models.user import User
from app.core.security import mask_aadhaar


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_global_limit(key: str, db: AsyncSession, default: float) -> float:
    result = await db.execute(select(SystemConfig).where(SystemConfig.key == key))
    cfg = result.scalar_one_or_none()
    if cfg:
        try:
            return float(cfg.value)
        except (ValueError, TypeError):
            pass
    return default


async def _today_consumed_ml(consumer_id: uuid.UUID, db: AsyncSession) -> float:
    today_start = datetime.combine(date.today(), datetime.min.time()).replace(tzinfo=timezone.utc)
    result = await db.execute(
        select(func.coalesce(func.sum(Purchase.quantity_ml), 0)).where(
            Purchase.consumer_id == consumer_id,
            Purchase.purchased_at >= today_start,
        )
    )
    return float(result.scalar() or 0)


async def _week_consumed_ml(consumer_id: uuid.UUID, db: AsyncSession) -> float:
    from datetime import timedelta
    today = date.today()
    week_start = datetime.combine(today - timedelta(days=today.weekday()), datetime.min.time()).replace(tzinfo=timezone.utc)
    result = await db.execute(
        select(func.coalesce(func.sum(Purchase.quantity_ml), 0)).where(
            Purchase.consumer_id == consumer_id,
            Purchase.purchased_at >= week_start,
        )
    )
    return float(result.scalar() or 0)


def ml_to_sd(ml: float, alcohol_pct: float = 5.0) -> float:
    """Convert ml of beverage to Standard Drinks (10g pure alcohol)."""
    pure_alcohol_g = (ml * alcohol_pct / 100) * 0.789
    return round(pure_alcohol_g / 10, 2)


# ── Shop dashboard ────────────────────────────────────────────────────────────

async def get_operator_dashboard(operator: User, db: AsyncSession) -> dict:
    shop_result = await db.execute(
        select(Shop).where(Shop.operator_id == operator.id, Shop.is_active == True)  # noqa
    )
    shop = shop_result.scalar_one_or_none()
    if not shop:
        raise HTTPException(status_code=404, detail="No active shop assigned to this operator.")

    today_start = datetime.combine(date.today(), datetime.min.time()).replace(tzinfo=timezone.utc)

    recent_result = await db.execute(
        select(Purchase)
        .where(Purchase.shop_id == shop.id, Purchase.purchased_at >= today_start)
        .order_by(Purchase.purchased_at.desc())
        .limit(20)
    )
    today_purchases = recent_result.scalars().all()

    count_result = await db.execute(
        select(func.count()).select_from(
            select(Purchase).where(
                Purchase.shop_id == shop.id, Purchase.purchased_at >= today_start
            ).subquery()
        )
    )
    today_count = count_result.scalar_one()

    revenue_result = await db.execute(
        select(func.coalesce(func.sum(Purchase.price), 0)).where(
            Purchase.shop_id == shop.id, Purchase.purchased_at >= today_start
        )
    )
    today_revenue = float(revenue_result.scalar() or 0)

    pin_warning = None
    if shop.pin_rotation_due_at:
        days_left = (shop.pin_rotation_due_at - datetime.now(timezone.utc)).days
        if days_left <= 7:
            pin_warning = f"PIN rotation due in {days_left} day(s). Contact your district administrator."

    return {
        "shop": {
            "id": str(shop.id),
            "shop_code": shop.shop_code,
            "name": shop.name,
            "district": shop.district,
            "address": shop.address,
            "license_number": shop.license_number,
            "pin_rotation_due_at": shop.pin_rotation_due_at.isoformat() if shop.pin_rotation_due_at else None,
        },
        "today_purchases_count": today_count,
        "today_revenue": today_revenue,
        "recent_transactions": [_serialize_purchase(p) for p in today_purchases],
        "pin_rotation_warning": pin_warning,
    }


def _serialize_purchase(p: Purchase) -> dict:
    return {
        "id": str(p.id),
        "product_name": p.product_name,
        "quantity_ml": p.quantity_ml,
        "price": float(p.price),
        "standard_drinks": p.standard_drinks,
        "remaining_daily_limit": p.remaining_daily_limit,
        "purchased_at": p.purchased_at.isoformat() if p.purchased_at else None,
    }


# ── Consumer lookup via QR ────────────────────────────────────────────────────

async def lookup_consumer_by_qr(
    qr_payload_str: str,
    db: AsyncSession,
    *,
    operator_user_id=None,
    shop_id: str | None = None,
    ip: str | None = None,
) -> dict:
    """Verify QR payload (v2 or v1), then return safe consumer info for the operator.

    v2 path (permanent): payload = {"cid": "<aadhaar_reference_id>", "sig": "<HMAC>"}
    v1 path (legacy)  : signed token = "<uuid>.<hmac_sig>" (will still work short-term)
    Manual path        : raw reference_id string or UUID for counter-based lookup
    """
    import json as _json
    from app.services.qr_service import QRService

    consumer: User | None = None

    # ── v2: Try new permanent QR payload {"cid": ..., "sig": ...} ─────────────
    try:
        parsed = _json.loads(qr_payload_str)
        # v2 permanent QR
        if parsed.get("cid") and parsed.get("sig"):
            consumer = await QRService().verify(
                db, qr_payload_str,
                operator_user_id=operator_user_id,
                shop_id=shop_id,
                ip=ip,
            )
        # Manual lookup override (operator typed reference_id or UUID + aadhaar_last4)
        elif parsed.get("manual") is True and parsed.get("uid"):
            uid_str = str(parsed["uid"]).strip()
            aadhaar_last4_input = str(parsed.get("aadhaar_last4", "")).strip()

            # Try looking up by aadhaar_reference_id first (new primary key)
            profile_r = await db.execute(
                select(ConsumerProfile).where(ConsumerProfile.aadhaar_reference_id == uid_str)
            )
            profile = profile_r.scalar_one_or_none()
            if profile:
                user_r = await db.execute(select(User).where(User.id == profile.user_id))
                consumer = user_r.scalar_one_or_none()
            else:
                # Fall back to UUID user_id lookup (legacy operator workflow)
                user_r = await db.execute(select(User).where(User.id == uid_str))
                consumer = user_r.scalar_one_or_none()
                if consumer:
                    profile_r2 = await db.execute(
                        select(ConsumerProfile).where(ConsumerProfile.user_id == consumer.id)
                    )
                    profile = profile_r2.scalar_one_or_none()

            # ── Aadhaar last-4 second factor ──────────────────────────────────
            # If operator supplied last4, it MUST match — prevents UUID enumeration.
            if aadhaar_last4_input and profile:
                stored_last4 = (profile.aadhaar_last4 or "").strip()
                if stored_last4 and stored_last4 != aadhaar_last4_input:
                    raise HTTPException(
                        status_code=400,
                        detail="Aadhaar last 4 digits do not match. Please verify with the consumer.",
                    )
            elif aadhaar_last4_input and not profile:
                # uid matched nothing; raise generic error (don't confirm existence)
                raise HTTPException(
                    status_code=400,
                    detail="Consumer not found. Check the Reference ID and Aadhaar last 4 digits.",
                )
    except HTTPException:
        raise
    except Exception:
        pass

    # ── v1 fallback: signed token format "<uid>.<hmac>" ───────────────────────
    if consumer is None and not qr_payload_str.startswith("{"):
        from app.core.security import verify_qr_payload
        try:
            payload = verify_qr_payload(qr_payload_str)
            uid_str = payload["uid"]
            user_r = await db.execute(select(User).where(User.id == uid_str))
            consumer = user_r.scalar_one_or_none()
        except Exception:
            pass

    if consumer is None:
        raise HTTPException(
            status_code=400,
            detail="Invalid QR code. Ask consumer to show their QR Code page."
        )

    if not consumer.is_active:
        raise HTTPException(status_code=403, detail="Consumer account is inactive.")

    profile_result = await db.execute(
        select(ConsumerProfile).where(ConsumerProfile.user_id == consumer.id)
    )
    profile = profile_result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Consumer profile not found.")

    # Self-restriction check
    now_utc = datetime.now(timezone.utc)
    restriction_result = await db.execute(
        select(SelfRestriction).where(
            SelfRestriction.user_id == consumer.id,
            SelfRestriction.is_locked == True,  # noqa
        ).where(
            (SelfRestriction.locked_until == None) | (SelfRestriction.locked_until > now_utc)  # noqa
        )
    )
    active_restriction = restriction_result.scalar_one_or_none()
    if active_restriction:
        until_str = (
            active_restriction.locked_until.strftime("%d %b %Y")
            if active_restriction.locked_until else "further notice"
        )
        raise HTTPException(
            status_code=403,
            detail=f"Consumer has a self-restriction active until {until_str}. Purchase blocked."
        )

    today_ml = await _today_consumed_ml(consumer.id, db)
    week_ml = await _week_consumed_ml(consumer.id, db)

    daily_limit_ml = 960
    weekly_limit_ml = 4800
    remaining_daily = max(0, daily_limit_ml - today_ml)
    remaining_weekly = max(0, weekly_limit_ml - week_ml)

    dr_result = await db.execute(
        select(DoctorRestriction).where(
            DoctorRestriction.patient_user_id == consumer.id,
            DoctorRestriction.status == RestrictionStatus.ACTIVE.value,
        )
    )
    active_doctor_restriction = dr_result.scalar_one_or_none()
    medical_block = active_doctor_restriction is not None
    medical_block_category = active_doctor_restriction.reason_category if active_doctor_restriction else None

    _CATEGORY_LABELS = {
        "liver_disease": "Liver Disease", "addiction_risk": "Addiction Risk",
        "medication_interaction": "Medication Interaction", "pregnancy": "Pregnancy",
        "other": "Other Medical",
    }
    medical_block_label = _CATEGORY_LABELS.get(medical_block_category, "Medical") if medical_block_category else None

    # Display Aadhaar as XXXX XXXX XXXX-last4 (no decryption needed)
    aadhaar_display = None
    if profile.aadhaar_last4:
        aadhaar_display = f"XXXX XXXX {profile.aadhaar_last4}"
    elif profile.aadhaar_encrypted:
        # Legacy fallback — only decrypt if aadhaar_last4 not yet populated
        from app.core.security import decrypt_aadhaar
        try:
            aadhaar_display = mask_aadhaar(decrypt_aadhaar(profile.aadhaar_encrypted))
        except Exception:
            aadhaar_display = "XXXX XXXX XXXX"

    return {
        "consumer_user_id": str(consumer.id),
        "consumer_reference_id": profile.aadhaar_reference_id,
        "full_name": consumer.full_name,
        "aadhaar_masked": aadhaar_display,
        "district": profile.district,
        "is_teetotaler": profile.is_teetotaler,
        "daily_limit_ml": daily_limit_ml,
        "weekly_limit_ml": weekly_limit_ml,
        "today_consumed_ml": today_ml,
        "week_consumed_ml": week_ml,
        "remaining_daily_ml": remaining_daily,
        "remaining_weekly_ml": remaining_weekly,
        "daily_pct_used": round((today_ml / daily_limit_ml) * 100, 1) if daily_limit_ml else 0,
        "can_purchase": remaining_daily > 0 and not medical_block,
        "medical_restriction_active": medical_block,
        "medical_restriction_category": medical_block_label,
    }


# ── Record purchase ───────────────────────────────────────────────────────────

async def record_purchase(
    consumer_user_id: str,
    product_name: str,
    quantity_ml: int,
    price: float,
    alcohol_pct: float,
    operator: User,
    db: AsyncSession,
    product_id: Optional[str] = None,
    notes: Optional[str] = None,
) -> dict:
    """Record a purchase with full limit checking."""
    profile_result = await db.execute(
        select(ConsumerProfile).where(ConsumerProfile.user_id == consumer_user_id)
    )
    profile = profile_result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Consumer profile not found.")

    user_result = await db.execute(select(User).where(User.id == consumer_user_id))
    user = user_result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=403, detail="Consumer account is inactive.")

    # Teetotaler block
    if profile.is_teetotaler:
        db.add(Alert(
            consumer_id=consumer_user_id,
            alert_type=AlertType.TEETOTALER_BREACH,
            message="Purchase attempted — you are registered as a Teetotaler.",
        ))
        await db.commit()
        raise HTTPException(status_code=403, detail="Consumer is a Teetotaler. Purchase blocked.")

    # Self-restriction block
    now_utc = datetime.now(timezone.utc)
    restriction_result = await db.execute(
        select(SelfRestriction).where(
            SelfRestriction.user_id == consumer_user_id,
            SelfRestriction.is_locked == True,  # noqa
        ).where(
            (SelfRestriction.locked_until == None) | (SelfRestriction.locked_until > now_utc)  # noqa
        )
    )
    if restriction_result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Consumer has a self-restriction active. Purchase blocked.")

    # Medical restriction block
    _CAT_LABELS = {
        "liver_disease": "Liver Disease", "addiction_risk": "Addiction Risk",
        "medication_interaction": "Medication Interaction", "pregnancy": "Pregnancy",
        "other": "Other Medical",
    }
    dr_result = await db.execute(
        select(DoctorRestriction).where(
            DoctorRestriction.patient_user_id == consumer_user_id,
            DoctorRestriction.status == RestrictionStatus.ACTIVE.value,
        )
    )
    active_dr = dr_result.scalar_one_or_none()
    if active_dr:
        label = _CAT_LABELS.get(active_dr.reason_category, "Medical restriction")
        raise HTTPException(
            status_code=403,
            detail=f"Purchase blocked: Medical restriction active ({label}). Contact issuing clinic to appeal.",
        )

    daily_limit_ml = 960
    weekly_limit_ml = 4800
    global_daily_sd = await _get_global_limit("global_daily_limit_sd", db, 4.0)
    global_weekly_sd = await _get_global_limit("global_weekly_limit_sd", db, 14.0)
    global_daily_ml = global_daily_sd * 240
    global_weekly_ml = global_weekly_sd * 240
    effective_daily_ml = min(daily_limit_ml, global_daily_ml)
    effective_weekly_ml = min(weekly_limit_ml, global_weekly_ml)

    consumer_uuid = uuid.UUID(str(consumer_user_id))
    today_ml = await _today_consumed_ml(consumer_uuid, db)
    week_ml = await _week_consumed_ml(consumer_uuid, db)

    if today_ml + quantity_ml > effective_daily_ml:
        db.add(Alert(
            consumer_id=consumer_user_id,
            alert_type=AlertType.LIMIT_REACHED,
            message=f"Daily limit of {effective_daily_ml:.0f}ml reached. Purchase blocked.",
        ))
        await db.commit()
        raise HTTPException(
            status_code=403,
            detail=f"Daily limit exceeded. Already consumed {today_ml:.0f}ml of {effective_daily_ml:.0f}ml limit."
        )

    if week_ml + quantity_ml > effective_weekly_ml:
        db.add(Alert(
            consumer_id=consumer_user_id,
            alert_type=AlertType.LIMIT_REACHED,
            message=f"Weekly limit of {effective_weekly_ml:.0f}ml reached. Purchase blocked.",
        ))
        await db.commit()
        raise HTTPException(
            status_code=403,
            detail=f"Weekly limit exceeded. Already consumed {week_ml:.0f}ml of {effective_weekly_ml:.0f}ml weekly limit."
        )

    if (today_ml + quantity_ml) >= effective_daily_ml * 0.75:
        db.add(Alert(
            consumer_id=consumer_user_id,
            alert_type=AlertType.APPROACHING_LIMIT,
            message="Approaching your daily alcohol limit.",
        ))

    shop_result = await db.execute(
        select(Shop).where(Shop.operator_id == operator.id, Shop.is_active == True)  # noqa
    )
    shop = shop_result.scalar_one_or_none()
    if not shop:
        raise HTTPException(status_code=404, detail="No active shop for this operator.")

    std_drinks = ml_to_sd(quantity_ml, alcohol_pct)
    remaining_after = max(0, effective_daily_ml - today_ml - quantity_ml)
    remaining_weekly_after = max(0, effective_weekly_ml - week_ml - quantity_ml)

    purchase = Purchase(
        id=uuid.uuid4(),
        consumer_id=consumer_user_id,
        shop_id=shop.id,
        shop_name=shop.name,
        product_id=product_id,
        product_name=product_name,
        quantity_ml=quantity_ml,
        standard_drinks=std_drinks,
        price=Decimal(str(price)),
        remaining_daily_limit=ml_to_sd(remaining_after, alcohol_pct),
        remaining_weekly_limit=ml_to_sd(remaining_weekly_after, alcohol_pct),
        operator_id=operator.id,
        notes=notes,
    )
    db.add(purchase)
    await db.commit()
    await db.refresh(purchase)

    return {
        "message": "Purchase recorded successfully.",
        "purchase_id": str(purchase.id),
        "standard_drinks": std_drinks,
        "remaining_daily_ml": remaining_after,
        "remaining_daily_sd": ml_to_sd(remaining_after, alcohol_pct),
        "approaching_limit": (today_ml + quantity_ml) >= effective_daily_ml * 0.75,
    }


# ── Shop purchase history ─────────────────────────────────────────────────────

async def get_shop_history(
    operator: User,
    db: AsyncSession,
    skip: int = 0,
    limit: int = 50,
    date_filter: Optional[date] = None,
) -> dict:
    shop_result = await db.execute(select(Shop).where(Shop.operator_id == operator.id))
    shop = shop_result.scalar_one_or_none()
    if not shop:
        raise HTTPException(status_code=404, detail="No shop found for this operator.")

    stmt = select(Purchase).where(Purchase.shop_id == shop.id)
    if date_filter:
        day_start = datetime.combine(date_filter, datetime.min.time()).replace(tzinfo=timezone.utc)
        day_end = datetime.combine(date_filter, datetime.max.time()).replace(tzinfo=timezone.utc)
        stmt = stmt.where(Purchase.purchased_at >= day_start, Purchase.purchased_at <= day_end)

    count_result = await db.execute(
        select(func.count()).select_from(stmt.subquery())
    )
    total = count_result.scalar_one()

    items_result = await db.execute(
        stmt.order_by(Purchase.purchased_at.desc()).offset(skip).limit(limit)
    )
    purchases = items_result.scalars().all()
    total_revenue = sum(float(p.price) for p in purchases)

    return {
        "shop_code": shop.shop_code,
        "total": total,
        "total_revenue": total_revenue,
        "purchases": [_serialize_purchase(p) for p in purchases],
    }


# ── Product catalogue ─────────────────────────────────────────────────────────

async def get_products(db: AsyncSession) -> list[dict]:
    result = await db.execute(
        select(Product).where(Product.is_active == True).order_by(Product.category, Product.name)  # noqa
    )
    products = result.scalars().all()
    if not products:
        return _get_mock_catalogue()
    return [
        {
            "id": str(p.id),
            "name": p.name,
            "category": p.category,
            "volume_ml": p.volume_ml,
            "price": float(p.price),
            "alcohol_pct": float(p.alcohol_percentage) if p.alcohol_percentage else 5.0,
        }
        for p in products
    ]


def _get_mock_catalogue() -> list[dict]:
    """TASMAC standard product catalogue for demo."""
    import uuid as _uuid
    return [
        {"id": str(_uuid.uuid4()), "name": "Kingfisher Premium", "category": "Beer", "volume_ml": 650, "price": 110.0, "alcohol_pct": 4.8},
        {"id": str(_uuid.uuid4()), "name": "Kingfisher Strong", "category": "Beer", "volume_ml": 650, "price": 130.0, "alcohol_pct": 7.2},
        {"id": str(_uuid.uuid4()), "name": "Haywards 5000", "category": "Beer", "volume_ml": 650, "price": 120.0, "alcohol_pct": 7.0},
        {"id": str(_uuid.uuid4()), "name": "Tuborg Strong", "category": "Beer", "volume_ml": 500, "price": 100.0, "alcohol_pct": 7.2},
        {"id": str(_uuid.uuid4()), "name": "Royal Stag", "category": "Whisky", "volume_ml": 180, "price": 160.0, "alcohol_pct": 42.8},
        {"id": str(_uuid.uuid4()), "name": "Royal Stag", "category": "Whisky", "volume_ml": 375, "price": 310.0, "alcohol_pct": 42.8},
        {"id": str(_uuid.uuid4()), "name": "Royal Stag", "category": "Whisky", "volume_ml": 750, "price": 590.0, "alcohol_pct": 42.8},
        {"id": str(_uuid.uuid4()), "name": "McDowell's No.1", "category": "Whisky", "volume_ml": 180, "price": 130.0, "alcohol_pct": 42.8},
        {"id": str(_uuid.uuid4()), "name": "McDowell's No.1", "category": "Whisky", "volume_ml": 750, "price": 520.0, "alcohol_pct": 42.8},
        {"id": str(_uuid.uuid4()), "name": "Old Monk Rum", "category": "Rum", "volume_ml": 180, "price": 110.0, "alcohol_pct": 42.8},
        {"id": str(_uuid.uuid4()), "name": "Old Monk Rum", "category": "Rum", "volume_ml": 750, "price": 440.0, "alcohol_pct": 42.8},
        {"id": str(_uuid.uuid4()), "name": "Bagpiper Gold", "category": "Whisky", "volume_ml": 180, "price": 120.0, "alcohol_pct": 42.8},
        {"id": str(_uuid.uuid4()), "name": "Blenders Pride", "category": "Whisky", "volume_ml": 750, "price": 1450.0, "alcohol_pct": 42.8},
        {"id": str(_uuid.uuid4()), "name": "Signature Rare", "category": "Whisky", "volume_ml": 750, "price": 950.0, "alcohol_pct": 42.8},
        {"id": str(_uuid.uuid4()), "name": "Smirnoff Vodka", "category": "Vodka", "volume_ml": 180, "price": 200.0, "alcohol_pct": 37.5},
        {"id": str(_uuid.uuid4()), "name": "Smirnoff Vodka", "category": "Vodka", "volume_ml": 750, "price": 780.0, "alcohol_pct": 37.5},
        {"id": str(_uuid.uuid4()), "name": "Sula Shiraz", "category": "Wine", "volume_ml": 750, "price": 580.0, "alcohol_pct": 13.5},
        {"id": str(_uuid.uuid4()), "name": "Fratelli Merlot", "category": "Wine", "volume_ml": 750, "price": 750.0, "alcohol_pct": 13.0},
    ]
