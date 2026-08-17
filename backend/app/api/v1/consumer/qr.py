"""Consumer QR code endpoint."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

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
    """Generate or refresh a signed QR code for the authenticated consumer."""
    qr_data = await _qr_service.issue(db, current_user)
    await db.commit()
    return {
        "qr_image_base64": qr_data["qr_image_base64"],
        "expires_at": qr_data["expires_at"].isoformat(),
        "issued_at": qr_data["issued_at"].isoformat() if qr_data["issued_at"] else None,
    }
