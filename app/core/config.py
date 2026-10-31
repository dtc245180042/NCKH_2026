"""
Core configuration and application settings.
"""
from typing import List, Union

try:
    from pydantic_settings import BaseSettings
except ImportError:
    from pydantic import BaseModel as BaseSettings

from pydantic import AnyHttpUrl


class Settings(BaseSettings):
    PROJECT_NAME: str = "Hệ Thống AI Truy Vết & Điều Phối Kho Thông Minh"
    PROJECT_CODE: str = "SV2026-ICTU-08"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"

    # Security & JWT
    SECRET_KEY: str = "super-secret-jwt-token-key-sv2026-ictu-logistics-change-in-prod"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 ngày
    ALGORITHM: str = "HS256"

    # Database
    DATABASE_URL: str = "sqlite:///./logistics.db"

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = ["*"]

    # Simulation & WebSocket
    WS_FPS_TARGET: int = 60
    CONVEYOR_SPEED_PIXELS_PER_SEC: float = 135.0

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
