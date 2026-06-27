from pydantic import BaseModel, EmailStr, Field
from app.models.user import UserRole
import uuid
from datetime import datetime


class RegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=200)
    email: EmailStr
    password: str = Field(..., min_length=8)
    phone: str | None = None
    role: UserRole = UserRole.CONSUMER
    aadhaar_number: str | None = Field(None, min_length=12, max_length=12)
    district: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user_id: str
    role: str
    full_name: str


class RefreshRequest(BaseModel):
    refresh_token: str


class UserResponse(BaseModel):
    id: uuid.UUID
    full_name: str
    email: str
    role: UserRole
    is_active: bool
    district: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
