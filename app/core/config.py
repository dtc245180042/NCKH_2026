"""
Core configuration and application settings.
Tuân thủ tiêu chuẩn an toàn thông tin và bảo mật môi trường.
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
    ENVIRONMENT: str = "development"

    # Security & JWT Token
    SECRET_KEY: str = "super-secret-jwt-token-key-sv2026-ictu-logistics-change-in-prod"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 8  # 8 giờ (chuẩn ca làm việc kho)
    ALGORITHM: str = "HS256"

    # Khởi tạo mật khẩu mạnh ban đầu (loại bỏ mật khẩu yếu mặc định)
    INITIAL_ADMIN_PASSWORD: str = "Admin@ICTU2026!Secure"
    INITIAL_OPERATOR_PASSWORD: str = "Operator@ICTU2026!Secure"
    INITIAL_VIEWER_PASSWORD: str = "Viewer@ICTU2026!Secure"

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

    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() == "production"

    def is_secret_key_default(self) -> bool:
        return "change-in-prod" in self.SECRET_KEY or "super-secret" in self.SECRET_KEY


settings = Settings()
