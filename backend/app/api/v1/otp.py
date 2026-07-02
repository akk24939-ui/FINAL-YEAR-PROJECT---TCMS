"""OTP endpoints — send and verify one-time passwords.

Rate limits (per IP):
  - POST /otp/send   : 3/hour  — prevents OTP flooding
  - POST /otp/verify : 5/15min — prevents brute-force
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Request

from app.core.dependencies import get_client_ip
from app.core.limiter import limiter
from app.schemas.auth import OtpRequest, OtpVerify
from app.services import auth_service
from app.core.database import get_db

router = APIRouter(prefix="/otp", tags=["OTP"])


@router.post("/send", status_code=202)
@limiter.limit("3/hour")
def send_otp(
    request: Request,
    body: OtpRequest,
    ip: str = Depends(get_client_ip),
    db=Depends(get_db),
):
    """Dispatch a 6-digit OTP to the registered mobile number.

    Always returns 202 regardless of whether the mobile is registered,
    to prevent user enumeration.
    """
    auth_service.send_otp(mobile=body.mobile_number, db=db, ip=ip)
    return {"message": "If the mobile number is registered, an OTP has been sent."}


@router.post("/verify")
@limiter.limit("5/15minutes")
def verify_otp(
    request: Request,
    body: OtpVerify,
    ip: str = Depends(get_client_ip),
    db=Depends(get_db),
):
    """Verify the 6-digit OTP.  Marks the account as verified on success."""
    auth_service.verify_otp(
        mobile=body.mobile_number,
        otp_code=body.otp_code,
        db=db,
        ip=ip,
    )
    return {"message": "OTP verified successfully. Your account is now verified."}
