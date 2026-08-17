from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    database_url: str

    # JWT
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    # Encryption
    field_encryption_key: str
    qr_hmac_secret: str

    # App
    frontend_origin: str = "http://localhost:5173"
    environment: str = "development"
    debug: bool = False
    max_upload_size_mb: int = 5  # max file upload size in MB

    # Rate limits
    rate_limit_auth: str = "10/minute"
    rate_limit_purchase: str = "30/minute"
    rate_limit_export: str = "1/30seconds"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )



@lru_cache()
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]


# Module-level singleton — allows `from app.core.config import settings`
# (used by several service modules that were written before the lru_cache pattern)
settings: Settings = get_settings()
