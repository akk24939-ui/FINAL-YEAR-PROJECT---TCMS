"""Consumer registration endpoints.

Two-step flow:
  Step A: POST /register/extract-id  — OCR extract from ID document (no DB writes)
  Step B: POST /register             — Final registration with validated data

Rate limit: 5 requests/hour per IP (both endpoints) to prevent automated abuse.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status

from app.core.dependencies import get_client_ip
from app.core.limiter import limiter
from app.schemas.consumer import RegisterExtractResponse, RegisterFinalRequest
from app.services import auth_service, image_service, ocr_service
from app.core.config import settings
from app.core.database import get_db

router = APIRouter(prefix="/register", tags=["Registration"])

_ALLOWED_ID_MIMES = ["image/jpeg", "image/png", "application/pdf"]
_ALLOWED_IMAGE_MIMES = ["image/jpeg", "image/png"]
_MAX_BYTES = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024


@router.post("/extract-id", response_model=RegisterExtractResponse)
@limiter.limit("5/hour")
async def extract_id(
    request: Request,
    file: UploadFile = File(..., description="Aadhaar card image (JPEG/PNG/PDF)"),
):
    """OCR-extract fields from an uploaded Aadhaar card image.

    - Validates MIME type from magic bytes (not extension).
    - Strips EXIF metadata before processing.
    - Returns pre-filled fields with confidence scores.
    - Does NOT persist anything to the database.
    """
    raw_bytes = await file.read()

    # Size guard
    if len(raw_bytes) > _MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum allowed size is {settings.MAX_UPLOAD_SIZE_MB} MB.",
        )

    # MIME validation from magic bytes
    detected_mime = image_service.validate_mime(raw_bytes, _ALLOWED_ID_MIMES)

    # For PDF we skip EXIF strip (not applicable); for images we strip EXIF
    if detected_mime in _ALLOWED_IMAGE_MIMES:
        clean_bytes = image_service.strip_exif_and_reencode(raw_bytes)
    else:
        # PDF — pass raw bytes to OCR; Tesseract can handle PDF via poppler
        clean_bytes = raw_bytes

    return ocr_service.extract_from_image(clean_bytes)


@router.post("", status_code=201)
@limiter.limit("5/hour")
def register(
    request: Request,
    body: RegisterFinalRequest,
    ip: str = Depends(get_client_ip),
    db=Depends(get_db),
):
    """Complete consumer registration.

    - Server-side re-validates age >= 18 and password strength.
    - Creates User, ConsumerProfile, SelfRestriction, UserRole_ in one transaction.
    - Returns generic error if email/mobile is already registered.
    """
    user = auth_service.register_consumer(data=body, db=db, ip=ip)
    return {
        "message": "Registration successful. Please verify your mobile number to activate your account.",
        "user_id": str(user.id),
    }
