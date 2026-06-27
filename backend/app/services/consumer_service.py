import secrets
from datetime import datetime, timezone, date
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from app.models.consumer_profile import ConsumerProfile
from app.models.purchase import Purchase
from app.models.alert import Alert, AlertType
from app.models.user import User
from app.schemas.consumer import ConsumerProfileResponse, UpdateLimitsRequest, ConsumerStatsResponse
from fastapi import HTTPException
import qrcode
import io
import base64


def get_profile(db: Session, user_id: str) -> ConsumerProfileResponse:
    profile = db.query(ConsumerProfile).filter(ConsumerProfile.user_id == user_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Consumer profile not found")
    return ConsumerProfileResponse.model_validate(profile)


def update_limits(db: Session, user_id: str, data: UpdateLimitsRequest) -> ConsumerProfileResponse:
    profile = db.query(ConsumerProfile).filter(ConsumerProfile.user_id == user_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Consumer profile not found")

    if data.daily_limit_ml is not None:
        profile.daily_limit_ml = data.daily_limit_ml
    if data.weekly_limit_ml is not None:
        profile.weekly_limit_ml = data.weekly_limit_ml
    if data.monthly_limit_ml is not None:
        profile.monthly_limit_ml = data.monthly_limit_ml

    db.commit()
    db.refresh(profile)
    return ConsumerProfileResponse.model_validate(profile)


def toggle_teetotaler(db: Session, user_id: str) -> dict:
    profile = db.query(ConsumerProfile).filter(ConsumerProfile.user_id == user_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Consumer profile not found")
    profile.is_teetotaler = not profile.is_teetotaler
    db.commit()
    return {"is_teetotaler": profile.is_teetotaler, "message": "Teetotaler mode updated"}


def get_stats(db: Session, user_id: str) -> ConsumerStatsResponse:
    profile = db.query(ConsumerProfile).filter(ConsumerProfile.user_id == user_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Consumer profile not found")

    today = date.today()
    today_start = datetime(today.year, today.month, today.day, tzinfo=timezone.utc)

    today_ml = db.query(func.coalesce(func.sum(Purchase.quantity_ml), 0)).filter(
        Purchase.consumer_id == user_id,
        Purchase.purchased_at >= today_start
    ).scalar() or 0

    week_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0) 
    week_start = week_start.replace(day=today.day - today.weekday())
    week_ml = db.query(func.coalesce(func.sum(Purchase.quantity_ml), 0)).filter(
        Purchase.consumer_id == user_id,
        Purchase.purchased_at >= week_start
    ).scalar() or 0

    month_start = datetime(today.year, today.month, 1, tzinfo=timezone.utc)
    month_ml = db.query(func.coalesce(func.sum(Purchase.quantity_ml), 0)).filter(
        Purchase.consumer_id == user_id,
        Purchase.purchased_at >= month_start
    ).scalar() or 0

    daily_pct = min(100.0, (today_ml / max(profile.daily_limit_ml, 1)) * 100)
    weekly_pct = min(100.0, (week_ml / max(profile.weekly_limit_ml, 1)) * 100)
    monthly_pct = min(100.0, (month_ml / max(profile.monthly_limit_ml, 1)) * 100)

    max_pct = max(daily_pct, weekly_pct, monthly_pct)
    status = "safe" if max_pct < 75 else ("warning" if max_pct < 100 else "exceeded")

    return ConsumerStatsResponse(
        today_ml=int(today_ml),
        week_ml=int(week_ml),
        month_ml=int(month_ml),
        daily_limit_ml=profile.daily_limit_ml,
        weekly_limit_ml=profile.weekly_limit_ml,
        monthly_limit_ml=profile.monthly_limit_ml,
        daily_percent=round(daily_pct, 1),
        weekly_percent=round(weekly_pct, 1),
        monthly_percent=round(monthly_pct, 1),
        is_teetotaler=profile.is_teetotaler,
        status=status,
    )


def generate_qr(db: Session, user_id: str) -> dict:
    profile = db.query(ConsumerProfile).filter(ConsumerProfile.user_id == user_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Consumer profile not found")

    if not profile.qr_token:
        profile.qr_token = secrets.token_urlsafe(32)
        db.commit()

    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(profile.qr_token)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#1A3C34", back_color="white")

    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    qr_b64 = base64.b64encode(buffer.getvalue()).decode()

    return {"qr_token": profile.qr_token, "qr_image_base64": qr_b64}
