from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class OtpRequest(BaseModel):
    """Request to send an OTP."""
    mobile_number: str = Field(..., pattern=r"^\d{10}$", description="10-digit mobile number")


class OtpVerify(BaseModel):
    """Verify an OTP."""
    mobile_number: str = Field(..., pattern=r"^\d{10}$")
    otp_code: str = Field(..., pattern=r"^\d{6}$", description="6-digit OTP code")


class LoginRequest(BaseModel):
    """Login can use mobile number OR the masked Aadhaar (last 4)."""
    identifier: str = Field(
        ..., 
        description="Either 10-digit mobile number or Aadhaar last 4 digits (e.g., '1234')"
    )
    password: str = Field(...)


class CookieTokenResponse(BaseModel):
    """Response returned when login succeeds.
    Notice that the refresh_token is missing here because it is sent via httpOnly cookie.
    """
    access_token: str
    token_type: str = "bearer"
    user_id: str
    role: str
    full_name: str
