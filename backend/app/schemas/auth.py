import re
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, field_validator


class OtpRequest(BaseModel):
    """Request to send an OTP."""
    mobile_number: str = Field(..., pattern=r"^\d{10}$", description="10-digit mobile number")


class OtpVerify(BaseModel):
    """Verify an OTP."""
    mobile_number: str = Field(..., pattern=r"^\d{10}$")
    otp_code: str = Field(..., pattern=r"^\d{6}$", description="6-digit OTP code")


class LoginRequest(BaseModel):
    """Login identifier accepts three formats:
      - 10-digit mobile number (e.g. '9876543210')
      - Full 12-digit mock Aadhaar number (e.g. '234567890123')
      - Aadhaar last-4 digits only (e.g. '0123') — legacy, still supported
    """
    identifier: str = Field(
        ...,
        min_length=4,
        max_length=12,
        description=(
            "10-digit mobile number, full 12-digit Aadhaar, "
            "or Aadhaar last-4 digits"
        ),
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


class ForgotPasswordRequest(BaseModel):
    """Step 1 — request a reset OTP by mobile number."""
    mobile_number: str = Field(..., pattern=r"^\d{10}$", description="10-digit mobile number")


class VerifyResetOtpRequest(BaseModel):
    """Step 2 — verify the 6-digit OTP, receive a short-lived reset token."""
    mobile_number: str = Field(..., pattern=r"^\d{10}$")
    otp_code: str = Field(..., pattern=r"^\d{6}$", description="6-digit OTP")


class ResetPasswordRequest(BaseModel):
    """Step 3 — set a new password using the reset token from step 2."""
    reset_token: str = Field(..., description="Short-lived JWT returned by verify-reset-otp")
    new_password: str = Field(..., min_length=8, description="New password (min 8 chars)")

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter.")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter.")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one digit.")
        if not re.search(r"[!@#$%^&*()_+\-=\[\]{};:'\",.<>?]", v):
            raise ValueError("Password must contain at least one special character.")
        return v
