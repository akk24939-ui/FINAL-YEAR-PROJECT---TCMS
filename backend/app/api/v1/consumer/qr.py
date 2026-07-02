"""Consumer QR code endpoint."""
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_consumer
from app.models.user import User
from app.services.qr_service import generate_qr

router = APIRouter(prefix="/qr", tags=["Consumer - QR"])


@router.get("/")
def get_qr_code(
    request: Request,
    current_user: User = Depends(get_current_consumer),
    db: Session = Depends(get_db),
):
    """Generate or refresh a signed QR code for the authenticated consumer."""
    qr_image_b64, qr_record = generate_qr(current_user, request, db)
    return {
        "qr_image_base64": qr_image_b64,
        "expires_at": qr_record.expires_at.isoformat(),
        "issued_at": qr_record.issued_at.isoformat(),
    }
