import uuid
import secrets
from sqlalchemy.orm import Session
from app.models.user import User, UserRole
from app.models.consumer_profile import ConsumerProfile
from app.schemas.auth import RegisterRequest, LoginRequest, TokenResponse
from app.core.security import hash_password, verify_password, create_access_token, create_refresh_token, verify_token
from app.utils.mock_aadhaar import validate_aadhaar_format, hash_aadhaar
from fastapi import HTTPException, status


def register_user(db: Session, data: RegisterRequest) -> TokenResponse:
    # Check duplicate email
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    # Validate and hash Aadhaar if provided
    aadhaar_hash = None
    if data.aadhaar_number:
        if not validate_aadhaar_format(data.aadhaar_number):
            raise HTTPException(status_code=400, detail="Invalid Aadhaar format. Must be 12 digits starting with 2-9.")
        aadhaar_hash = hash_aadhaar(data.aadhaar_number)

    user = User(
        full_name=data.full_name,
        email=data.email,
        password_hash=hash_password(data.password),
        phone=data.phone,
        role=data.role,
        aadhaar_hash=aadhaar_hash,
        district=data.district,
        is_verified=True,  # Auto-verify for demo
    )
    db.add(user)
    db.flush()

    # Create consumer profile automatically for CONSUMER role
    if data.role == UserRole.CONSUMER:
        profile = ConsumerProfile(
            user_id=user.id,
            qr_token=secrets.token_urlsafe(32),
        )
        db.add(profile)

    db.commit()
    db.refresh(user)

    access_token = create_access_token({"sub": str(user.id), "role": user.role.value})
    refresh_token = create_refresh_token({"sub": str(user.id), "role": user.role.value})

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user_id=str(user.id),
        role=user.role.value,
        full_name=user.full_name,
    )


def login_user(db: Session, data: LoginRequest) -> TokenResponse:
    user = db.query(User).filter(User.email == data.email, User.is_active == True).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    access_token = create_access_token({"sub": str(user.id), "role": user.role.value})
    refresh_token = create_refresh_token({"sub": str(user.id), "role": user.role.value})

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user_id=str(user.id),
        role=user.role.value,
        full_name=user.full_name,
    )


def refresh_access_token(db: Session, refresh_token: str) -> TokenResponse:
    payload = verify_token(refresh_token, token_type="refresh")
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    user = db.query(User).filter(User.id == payload["sub"], User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    access_token = create_access_token({"sub": str(user.id), "role": user.role.value})
    new_refresh = create_refresh_token({"sub": str(user.id), "role": user.role.value})

    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh,
        user_id=str(user.id),
        role=user.role.value,
        full_name=user.full_name,
    )
