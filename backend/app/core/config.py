from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://tasmac_user:tasmac_pass@localhost:5432/tasmac_db"
    SECRET_KEY: str = "tasmac-super-secret-jwt-key-2025-tamil-nadu-govt"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    ENVIRONMENT: str = "development"
    APP_NAME: str = "Smart TASMAC API"
    APP_VERSION: str = "1.0.0"
    ALLOWED_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:80",
        "http://localhost",
    ]

    model_config = {"env_file": ".env", "case_sensitive": True}


settings = Settings()
