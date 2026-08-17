"""Operator consumer lookup — verify QR payload and return safe consumer info."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import require_role
from app.models.user import User
from app.services import operator_service

router = APIRouter()


class QRLookupRequest(BaseModel):
    qr_payload: str  # the signed JSON string from the consumer's QR code


@router.post("/consumer/lookup", summary="Look up consumer via QR payload — verify limits before sale")
async def lookup_consumer(
    body: QRLookupRequest,
    current_user: User = Depends(require_role("OPERATOR")),
    db: AsyncSession = Depends(get_db),
):
    """Returns safe, minimal consumer info including daily/weekly limits."""
    return await operator_service.lookup_consumer_by_qr(body.qr_payload, db)
