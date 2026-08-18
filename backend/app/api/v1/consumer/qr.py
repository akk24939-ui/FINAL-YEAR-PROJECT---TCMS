"""Consumer QR code endpoints — permanent QR issue and consumer-initiated revocation."""
from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_consumer
from app.models.user import User
from app.services.qr_service import QRService

router = APIRouter(prefix="/qr", tags=["Consumer - QR"])

_qr_service = QRService()


@router.get("/")
async def get_qr_code(
    current_user: User = Depends(get_current_consumer),
    db: AsyncSession = Depends(get_db),
):
    """Return the consumer's permanent QR code (creates one on first call).

    The QR does not expire — it is a permanent HMAC-signed reference.
    To invalidate and get a new QR, POST to /qr/revoke.
    """
    qr_data = await _qr_service.issue(db, current_user)
    await db.commit()
    return {
        "qr_image_base64": qr_data["qr_image_base64"],
        "issued_at": qr_data["issued_at"],
        "is_permanent": True,
    }


@router.post("/revoke")
async def revoke_and_regenerate_qr(
    request: Request,
    current_user: User = Depends(get_current_consumer),
    db: AsyncSession = Depends(get_db),
):
    """Revoke the current QR and issue a brand-new one (consumer-initiated security action).

    Use this if you suspect your QR has been photographed or compromised.
    The old QR will immediately stop working at the shop counter.
    """
    ip = request.client.host if request.client else None
    new_qr = await _qr_service.revoke(db, current_user)
    await db.commit()
    return {
        "message": "Your previous QR has been revoked. Here is your new permanent QR.",
        "qr_image_base64": new_qr["qr_image_base64"],
        "issued_at": new_qr["issued_at"],
        "is_permanent": True,
    }
