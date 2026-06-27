from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import require_role
from app.models.user import User
from app.models.caretaker_link import CaretakerLink
from app.models.alert import Alert
from datetime import datetime, timezone

router = APIRouter(prefix="/caretaker", tags=["Caretaker"])


@router.post("/link", summary="Link to a consumer as caretaker")
def link_consumer(
    consumer_email: str,
    current_user: User = Depends(require_role("CARETAKER")),
    db: Session = Depends(get_db),
):
    consumer = db.query(User).filter(User.email == consumer_email).first()
    if not consumer:
        raise Exception("Consumer not found")
    existing = db.query(CaretakerLink).filter(
        CaretakerLink.consumer_id == consumer.id,
        CaretakerLink.caretaker_id == current_user.id,
    ).first()
    if existing:
        return {"message": "Already linked", "consent_given": existing.consent_given}
    link = CaretakerLink(consumer_id=consumer.id, caretaker_id=current_user.id)
    db.add(link)
    db.commit()
    return {"message": "Link request sent. Awaiting consumer consent.", "link_id": str(link.id)}


@router.get("/my-consumers", summary="Get consumers linked to this caretaker")
def get_linked_consumers(
    current_user: User = Depends(require_role("CARETAKER")),
    db: Session = Depends(get_db),
):
    links = db.query(CaretakerLink).filter(
        CaretakerLink.caretaker_id == current_user.id,
        CaretakerLink.is_active == True,
    ).all()
    return [{
        "consumer_id": str(l.consumer_id),
        "consumer_name": l.consumer.full_name if l.consumer else "Unknown",
        "consent_given": l.consent_given,
        "linked_at": str(l.linked_at),
    } for l in links]


@router.get("/alerts", summary="Get alerts for linked consumers")
def get_alerts(
    current_user: User = Depends(require_role("CARETAKER")),
    db: Session = Depends(get_db),
):
    links = db.query(CaretakerLink).filter(
        CaretakerLink.caretaker_id == current_user.id,
        CaretakerLink.consent_given == True,
    ).all()
    consumer_ids = [str(l.consumer_id) for l in links]
    if not consumer_ids:
        return []
    alerts = db.query(Alert).filter(Alert.consumer_id.in_(consumer_ids)).order_by(Alert.created_at.desc()).limit(50).all()
    return [{"id": str(a.id), "type": a.alert_type.value, "message": a.message, "is_read": a.is_read, "created_at": str(a.created_at)} for a in alerts]


router_doctor = APIRouter(prefix="/doctor", tags=["Doctor"])


@router_doctor.get("/health-trends", summary="Anonymous health trends by district")
def get_health_trends(
    current_user: User = Depends(require_role("DOCTOR")),
    db: Session = Depends(get_db),
):
    import random
    # Return anonymized mock trends (no PII)
    districts = ["Chennai", "Coimbatore", "Madurai", "Tiruchirappalli", "Salem", "Tirunelveli", "Tiruppur", "Erode"]
    return [
        {
            "district": d,
            "avg_consumption_ml": round(random.uniform(250, 850), 1),
            "consumer_count": random.randint(500, 5000),
            "high_risk_count": random.randint(50, 400),
            "medium_risk_count": random.randint(100, 800),
            "low_risk_count": random.randint(300, 3000),
            "risk_level": random.choice(["LOW", "MEDIUM", "HIGH"]),
        }
        for d in districts
    ]


@router_doctor.get("/risk-analytics", summary="Risk level analytics")
def get_risk_analytics(
    current_user: User = Depends(require_role("DOCTOR")),
    db: Session = Depends(get_db),
):
    return {
        "total_consumers": 124500,
        "high_risk": 12450,
        "medium_risk": 37350,
        "low_risk": 74700,
        "high_risk_percent": 10.0,
        "medium_risk_percent": 30.0,
        "low_risk_percent": 60.0,
        "note": "All data is anonymized. No personal identifiers included.",
    }
