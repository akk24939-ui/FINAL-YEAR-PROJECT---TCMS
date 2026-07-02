"""Consumer profile endpoints — view and update profile, upload photo."""
from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_consumer
from app.models.consumer_profile import BeveragePreference, Gender
from app.models.user import User
from app.schemas.consumer import ConsumerProfileResponse
from app.services import consumer_service, image_service

router = APIRouter(prefix="/profile", tags=["Consumer Profile"])

_ALLOWED_PHOTO_MIMES = ["image/jpeg", "image/png"]
_MAX_BYTES = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024


@router.get("", response_model=ConsumerProfileResponse)
def get_profile(
    current_user: User = Depends(get_current_consumer),
    db=Depends(get_db),
):
    """Return the consumer's profile with masked Aadhaar."""
    return consumer_service.get_profile(user=current_user, db=db)


@router.put("", response_model=ConsumerProfileResponse)
def update_profile(
    request: Request,
    district: str | None = None,
    gender: Gender | None = None,
    address: str | None = None,
    beverage_preference: BeveragePreference | None = None,
    current_user: User = Depends(get_current_consumer),
    db=Depends(get_db),
):
    """Update non-sensitive consumer profile fields.

    Only district, gender, address, and beverage_preference are mutable here.
    """
    update_data = {
        "district": district,
        "gender": gender,
        "address": address,
        "beverage_preference": beverage_preference,
    }
    return consumer_service.update_profile(user=current_user, data=update_data, db=db)


@router.post("/photo", status_code=200)
async def upload_photo(
    file: UploadFile = File(..., description="Profile photo (JPEG/PNG, max 5 MB)"),
    current_user: User = Depends(get_current_consumer),
    db=Depends(get_db),
):
    """Upload/replace consumer profile photo.

    - Validates MIME type from magic bytes.
    - Strips EXIF metadata before saving.
    - Returns the stored file path.
    """
    raw_bytes = await file.read()

    if len(raw_bytes) > _MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum size is {settings.MAX_UPLOAD_SIZE_MB} MB.",
        )

    image_service.validate_mime(raw_bytes, _ALLOWED_PHOTO_MIMES)
    clean_bytes = image_service.strip_exif_and_reencode(raw_bytes)

    file_path = consumer_service.upload_photo(
        user=current_user, file_bytes=clean_bytes, db=db
    )
    return {"message": "Photo uploaded successfully.", "path": file_path}
