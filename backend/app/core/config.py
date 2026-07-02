"""Application settings loaded from .env via pydantic-settings."""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    BCRYPT_ROUNDS: int = 12
    FERNET_KEY: str  # base64 url-safe 32-byte key
    OTP_TTL_SECONDS: int = 300   # 5 minutes
    OTP_MAX_ATTEMPTS: int = 5
    QR_TTL_SECONDS: int = 1800   # 30 minutes
    ALLOWED_ORIGIN: str = "http://localhost:5173"
    UPLOAD_DIR: str = "uploads/photos"
    MAX_UPLOAD_SIZE_MB: int = 5
    COOLING_OFF_HOURS: int = 24
    ENVIRONMENT: str = "development"

    class Config:
        env_file = ".env"


settings = Settings()
