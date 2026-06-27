from datetime import datetime, timezone, date
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.purchase import Purchase
from app.models.consumer_profile import ConsumerProfile
from app.models.alert import Alert, AlertType
from app.models.shop import Shop
from app.schemas.purchase import PurchaseCreate, PurchaseResponse, PurchaseHistoryResponse
from fastapi import HTTPException


def record_purchase(db: Session, data: PurchaseCreate, shop_id: str, operator_id: str) -> dict:
    # Validate QR token
    profile = db.query(ConsumerProfile).filter(ConsumerProfile.qr_token == data.consumer_qr_token).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Invalid consumer QR token")

    consumer_id = profile.user_id

    # Teetotaler check
    if profile.is_teetotaler:
        alert = Alert(
            consumer_id=consumer_id,
            alert_type=AlertType.TEETOTALER_BREACH,
            message="Purchase attempted — you are registered as a Teetotaler.",
        )
        db.add(alert)
        db.commit()
        raise HTTPException(status_code=403, detail="Consumer is registered as a Teetotaler. Purchase blocked.")

    # Daily limit check
    today = date.today()
    today_start = datetime(today.year, today.month, today.day, tzinfo=timezone.utc)
    today_ml = db.query(func.coalesce(func.sum(Purchase.quantity_ml), 0)).filter(
        Purchase.consumer_id == consumer_id,
        Purchase.purchased_at >= today_start
    ).scalar() or 0

    if today_ml + data.quantity_ml > profile.daily_limit_ml:
        alert = Alert(
            consumer_id=consumer_id,
            alert_type=AlertType.LIMIT_REACHED,
            message=f"Daily limit of {profile.daily_limit_ml}ml reached. Purchase blocked.",
        )
        db.add(alert)
        db.commit()
        raise HTTPException(status_code=403, detail=f"Daily limit exceeded. Consumed: {today_ml}ml, Limit: {profile.daily_limit_ml}ml")

    # Approaching limit warning (75%)
    if (today_ml + data.quantity_ml) >= profile.daily_limit_ml * 0.75:
        alert = Alert(
            consumer_id=consumer_id,
            alert_type=AlertType.APPROACHING_LIMIT,
            message="You are approaching your daily limit.",
        )
        db.add(alert)

    purchase = Purchase(
        consumer_id=consumer_id,
        shop_id=shop_id,
        product_id=data.product_id,
        product_name=data.product_name,
        quantity_ml=data.quantity_ml,
        price=data.price,
        operator_id=operator_id,
        notes=data.notes,
    )
    db.add(purchase)
    db.commit()
    db.refresh(purchase)
    return {"message": "Purchase recorded successfully", "purchase_id": str(purchase.id)}


def get_history(db: Session, consumer_id: str, limit: int = 50, offset: int = 0) -> PurchaseHistoryResponse:
    query = db.query(Purchase).filter(Purchase.consumer_id == consumer_id)
    total = query.count()
    purchases = query.order_by(Purchase.purchased_at.desc()).offset(offset).limit(limit).all()
    total_ml = sum(p.quantity_ml for p in purchases)
    total_spent = sum(p.price for p in purchases)
    return PurchaseHistoryResponse(
        purchases=[PurchaseResponse.model_validate(p) for p in purchases],
        total_count=total,
        total_ml=total_ml,
        total_spent=Decimal(str(total_spent)),
    )
