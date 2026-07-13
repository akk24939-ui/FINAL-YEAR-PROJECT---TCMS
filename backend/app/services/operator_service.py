"""Operator service — shop dashboard, consumer lookup, purchase with global-limit enforcement."""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.alert import Alert, AlertType
from app.models.consumer_profile import ConsumerProfile
from app.models.consumer_limits import ConsumerLimits
from app.models.purchase import Purchase
from app.models.product import Product
from app.models.qr_code import QrCode
from app.models.restriction import SelfRestriction
from app.models.shop import Shop
from app.models.system_config import SystemConfig
from app.models.user import User
from app.core.security import verify_qr_payload, decrypt_aadhaar, mask_aadhaar


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_global_limit(key: str, db: Session, default: float) -> float:
    cfg = db.query(SystemConfig).filter(SystemConfig.key == key).first()
    if cfg:
        try:
            return float(cfg.value)
        except (ValueError, TypeError):
            pass
    return default


def _today_consumed_ml(consumer_id: uuid.UUID, db: Session) -> float:
    today_start = datetime.combine(date.today(), datetime.min.time()).replace(tzinfo=timezone.utc)
    return db.query(func.coalesce(func.sum(Purchase.quantity_ml), 0)).filter(
        Purchase.consumer_id == consumer_id,
        Purchase.purchased_at >= today_start,
    ).scalar() or 0


def _week_consumed_ml(consumer_id: uuid.UUID, db: Session) -> float:
    from datetime import timedelta
    today = date.today()
    week_start = datetime.combine(today - timedelta(days=today.weekday()), datetime.min.time()).replace(tzinfo=timezone.utc)
    return db.query(func.coalesce(func.sum(Purchase.quantity_ml), 0)).filter(
        Purchase.consumer_id == consumer_id,
        Purchase.purchased_at >= week_start,
    ).scalar() or 0


def ml_to_sd(ml: float, alcohol_pct: float = 5.0) -> float:
    """Convert ml of beverage to Standard Drinks (10g pure alcohol)."""
    pure_alcohol_g = (ml * alcohol_pct / 100) * 0.789  # density of ethanol
    return round(pure_alcohol_g / 10, 2)


# ── Shop dashboard ────────────────────────────────────────────────────────────

def get_operator_dashboard(operator: User, db: Session) -> dict:
    shop = db.query(Shop).filter(Shop.operator_id == operator.id, Shop.is_active == True).first()
    if not shop:
        raise HTTPException(status_code=404, detail="No active shop assigned to this operator.")

    today_start = datetime.combine(date.today(), datetime.min.time()).replace(tzinfo=timezone.utc)
    today_purchases = (
        db.query(Purchase)
        .filter(Purchase.shop_id == shop.id, Purchase.purchased_at >= today_start)
        .order_by(Purchase.purchased_at.desc())
        .limit(20)
        .all()
    )
    today_count = db.query(Purchase).filter(Purchase.shop_id == shop.id, Purchase.purchased_at >= today_start).count()
    today_revenue = db.query(func.coalesce(func.sum(Purchase.price), 0)).filter(
        Purchase.shop_id == shop.id, Purchase.purchased_at >= today_start
    ).scalar() or 0

    # PIN rotation warning
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
        "today_revenue": float(today_revenue),
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

def lookup_consumer_by_qr(qr_payload_str: str, db: Session) -> dict:
    """
    Verify QR payload signature, then return safe consumer info for the operator.
    The operator sees: name, masked Aadhaar, limits, today's consumption.
    The operator does NOT see: full Aadhaar, email, or any health data.
    """
    try:
        payload = verify_qr_payload(qr_payload_str)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid or expired QR code. Ask consumer to refresh their QR.")

    consumer_user_id = payload["uid"]
    profile = db.query(ConsumerProfile).filter(
        ConsumerProfile.user_id == consumer_user_id
    ).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Consumer profile not found.")

    user = db.query(User).filter(User.id == consumer_user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=403, detail="Consumer account is inactive.")

    # Check self-restriction (is_locked=True AND lock has not expired)
    now_utc = datetime.now(timezone.utc)
    active_restriction = db.query(SelfRestriction).filter(
        SelfRestriction.user_id == consumer_user_id,
        SelfRestriction.is_locked == True,
    ).filter(
        # locked_until is NULL (permanent) OR still in the future
        (SelfRestriction.locked_until == None) | (SelfRestriction.locked_until > now_utc)
    ).first()
    if active_restriction:
        until_str = (
            active_restriction.locked_until.strftime("%d %b %Y")
            if active_restriction.locked_until else "further notice"
        )
        raise HTTPException(
            status_code=403,
            detail=f"Consumer has a self-restriction active until {until_str}. Purchase blocked."
        )

    # Today's consumption
    today_ml = _today_consumed_ml(uuid.UUID(consumer_user_id), db)
    week_ml = _week_consumed_ml(uuid.UUID(consumer_user_id), db)

    # Limits (use ConsumerLimits if exists, else profile defaults)
    limits_row = db.query(ConsumerLimits).filter(ConsumerLimits.user_id == consumer_user_id).first()
    daily_limit_ml = (limits_row.daily_limit_ml if limits_row else None) or profile.daily_limit_ml or 960
    weekly_limit_ml = (limits_row.weekly_limit_ml if limits_row else None) or profile.weekly_limit_ml or 4800

    remaining_daily = max(0, daily_limit_ml - today_ml)
    remaining_weekly = max(0, weekly_limit_ml - week_ml)

    return {
        "consumer_user_id": consumer_user_id,
        "full_name": user.full_name,
        "aadhaar_masked": (
            mask_aadhaar(decrypt_aadhaar(profile.aadhaar_encrypted))
            if profile and profile.aadhaar_encrypted else None
        ),
        "district": profile.district,
        "is_teetotaler": profile.is_teetotaler,
        "daily_limit_ml": daily_limit_ml,
        "weekly_limit_ml": weekly_limit_ml,
        "today_consumed_ml": today_ml,
        "week_consumed_ml": week_ml,
        "remaining_daily_ml": remaining_daily,
        "remaining_weekly_ml": remaining_weekly,
        "daily_pct_used": round((today_ml / daily_limit_ml) * 100, 1) if daily_limit_ml else 0,
        "can_purchase": remaining_daily > 0,
    }


# ── Record purchase ───────────────────────────────────────────────────────────

def record_purchase(
    consumer_user_id: str,
    product_name: str,
    quantity_ml: int,
    price: float,
    alcohol_pct: float,
    operator: User,
    db: Session,
    product_id: Optional[str] = None,
    notes: Optional[str] = None,
) -> dict:
    """
    Record a purchase with full limit checking:
    - Teetotaler block
    - Self-restriction block
    - Global daily/weekly SD cap (from system_config)
    - Consumer personal daily/weekly ml limit
    """
    profile = db.query(ConsumerProfile).filter(
        ConsumerProfile.user_id == consumer_user_id
    ).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Consumer profile not found.")

    user = db.query(User).filter(User.id == consumer_user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=403, detail="Consumer account is inactive.")

    # Teetotaler block
    if profile.is_teetotaler:
        db.add(Alert(
            consumer_id=consumer_user_id,
            alert_type=AlertType.TEETOTALER_BREACH,
            message="Purchase attempted — you are registered as a Teetotaler.",
        ))
        db.commit()
        raise HTTPException(status_code=403, detail="Consumer is a Teetotaler. Purchase blocked.")

    # Self-restriction block
    now_utc = datetime.now(timezone.utc)
    active_restriction = db.query(SelfRestriction).filter(
        SelfRestriction.user_id == consumer_user_id,
        SelfRestriction.is_locked == True,
    ).filter(
        (SelfRestriction.locked_until == None) | (SelfRestriction.locked_until > now_utc)
    ).first()
    if active_restriction:
        raise HTTPException(status_code=403, detail="Consumer has a self-restriction active. Purchase blocked.")


    # Get limits
    limits_row = db.query(ConsumerLimits).filter(ConsumerLimits.user_id == consumer_user_id).first()
    daily_limit_ml = (limits_row.daily_limit_ml if limits_row else None) or profile.daily_limit_ml or 960
    weekly_limit_ml = (limits_row.weekly_limit_ml if limits_row else None) or profile.weekly_limit_ml or 4800

    # Apply global system cap (convert SD limits to ml)
    global_daily_sd = _get_global_limit("global_daily_limit_sd", db, 4.0)
    global_weekly_sd = _get_global_limit("global_weekly_limit_sd", db, 14.0)
    # 1 SD ≈ 240ml of 5% beer equivalent
    global_daily_ml = global_daily_sd * 240
    global_weekly_ml = global_weekly_sd * 240
    effective_daily_ml = min(daily_limit_ml, global_daily_ml)
    effective_weekly_ml = min(weekly_limit_ml, global_weekly_ml)

    today_ml = _today_consumed_ml(uuid.UUID(consumer_user_id), db)
    week_ml = _week_consumed_ml(uuid.UUID(consumer_user_id), db)

    # Daily limit check
    if today_ml + quantity_ml > effective_daily_ml:
        db.add(Alert(
            consumer_id=consumer_user_id,
            alert_type=AlertType.LIMIT_REACHED,
            message=f"Daily limit of {effective_daily_ml:.0f}ml reached. Purchase blocked.",
        ))
        db.commit()
        raise HTTPException(
            status_code=403,
            detail=f"Daily limit exceeded. Already consumed {today_ml:.0f}ml of {effective_daily_ml:.0f}ml limit."
        )

    # Weekly limit check
    if week_ml + quantity_ml > effective_weekly_ml:
        db.add(Alert(
            consumer_id=consumer_user_id,
            alert_type=AlertType.LIMIT_REACHED,
            message=f"Weekly limit of {effective_weekly_ml:.0f}ml reached. Purchase blocked.",
        ))
        db.commit()
        raise HTTPException(
            status_code=403,
            detail=f"Weekly limit exceeded. Already consumed {week_ml:.0f}ml of {effective_weekly_ml:.0f}ml weekly limit."
        )

    # Approaching-limit warning (≥75%)
    if (today_ml + quantity_ml) >= effective_daily_ml * 0.75:
        db.add(Alert(
            consumer_id=consumer_user_id,
            alert_type=AlertType.APPROACHING_LIMIT,
            message="Approaching your daily alcohol limit.",
        ))

    # Get operator's shop
    shop = db.query(Shop).filter(Shop.operator_id == operator.id, Shop.is_active == True).first()
    if not shop:
        raise HTTPException(status_code=404, detail="No active shop for this operator.")

    # Compute standard drinks for this purchase
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
    db.commit()
    db.refresh(purchase)

    return {
        "message": "Purchase recorded successfully.",
        "purchase_id": str(purchase.id),
        "standard_drinks": std_drinks,
        "remaining_daily_ml": remaining_after,
        "remaining_daily_sd": ml_to_sd(remaining_after, alcohol_pct),
        "approaching_limit": (today_ml + quantity_ml) >= effective_daily_ml * 0.75,
    }


# ── Shop purchase history ─────────────────────────────────────────────────────

def get_shop_history(
    operator: User,
    db: Session,
    skip: int = 0,
    limit: int = 50,
    date_filter: Optional[date] = None,
) -> dict:
    shop = db.query(Shop).filter(Shop.operator_id == operator.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="No shop found for this operator.")

    q = db.query(Purchase).filter(Purchase.shop_id == shop.id)
    if date_filter:
        day_start = datetime.combine(date_filter, datetime.min.time()).replace(tzinfo=timezone.utc)
        day_end = datetime.combine(date_filter, datetime.max.time()).replace(tzinfo=timezone.utc)
        q = q.filter(Purchase.purchased_at >= day_start, Purchase.purchased_at <= day_end)

    total = q.count()
    purchases = q.order_by(Purchase.purchased_at.desc()).offset(skip).limit(limit).all()
    total_revenue = sum(float(p.price) for p in purchases)

    return {
        "shop_code": shop.shop_code,
        "total": total,
        "total_revenue": total_revenue,
        "purchases": [_serialize_purchase(p) for p in purchases],
    }


# ── Product catalogue ─────────────────────────────────────────────────────────

def get_products(db: Session) -> list[dict]:
    products = db.query(Product).filter(Product.is_active == True).order_by(Product.category, Product.name).all()
    if not products:
        # Return seeded TASMAC product catalogue
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
        {"id": str(_uuid.uuid4()), "name": "Aristocrat Premium Whisky", "category": "Whisky", "volume_ml": 180, "price": 90.0, "alcohol_pct": 42.8},
        {"id": str(_uuid.uuid4()), "name": "Contessa Rum", "category": "Rum", "volume_ml": 375, "price": 180.0, "alcohol_pct": 42.8},
        {"id": str(_uuid.uuid4()), "name": "Smirnoff Vodka", "category": "Vodka", "volume_ml": 180, "price": 200.0, "alcohol_pct": 37.5},
        {"id": str(_uuid.uuid4()), "name": "Smirnoff Vodka", "category": "Vodka", "volume_ml": 750, "price": 780.0, "alcohol_pct": 37.5},
        {"id": str(_uuid.uuid4()), "name": "Sula Shiraz", "category": "Wine", "volume_ml": 750, "price": 580.0, "alcohol_pct": 13.5},
        {"id": str(_uuid.uuid4()), "name": "Fratelli Merlot", "category": "Wine", "volume_ml": 750, "price": 750.0, "alcohol_pct": 13.0},
    ]
