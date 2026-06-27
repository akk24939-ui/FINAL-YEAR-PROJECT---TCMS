from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import get_current_user, require_role
from app.schemas.consumer import ConsumerProfileResponse, UpdateLimitsRequest, ConsumerStatsResponse
from app.services import consumer_service
from app.models.user import User

router = APIRouter(prefix="/consumers", tags=["Consumer"])


@router.get("/me/profile", response_model=ConsumerProfileResponse, summary="Get my consumer profile")
def get_profile(
    current_user: User = Depends(require_role("CONSUMER")),
    db: Session = Depends(get_db),
):
    return consumer_service.get_profile(db, str(current_user.id))


@router.put("/me/limits", response_model=ConsumerProfileResponse, summary="Update consumption limits")
def update_limits(
    data: UpdateLimitsRequest,
    current_user: User = Depends(require_role("CONSUMER")),
    db: Session = Depends(get_db),
):
    return consumer_service.update_limits(db, str(current_user.id), data)


@router.post("/me/teetotaler", summary="Toggle teetotaler mode")
def toggle_teetotaler(
    current_user: User = Depends(require_role("CONSUMER")),
    db: Session = Depends(get_db),
):
    return consumer_service.toggle_teetotaler(db, str(current_user.id))


@router.get("/me/stats", response_model=ConsumerStatsResponse, summary="Get consumption statistics")
def get_stats(
    current_user: User = Depends(require_role("CONSUMER")),
    db: Session = Depends(get_db),
):
    return consumer_service.get_stats(db, str(current_user.id))


@router.get("/me/qr", summary="Get QR code for consumer identity")
def get_qr(
    current_user: User = Depends(require_role("CONSUMER")),
    db: Session = Depends(get_db),
):
    return consumer_service.generate_qr(db, str(current_user.id))
