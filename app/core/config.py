import json
from typing import List, Union
from pydantic import AnyHttpUrl, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )

    # Project Information
    PROJECT_NAME: str = "AI Smart Logistics Tracking System"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"

    # MySQL Configuration
    MYSQL_SERVER: str = "localhost"
    MYSQL_PORT: int = 3307
    MYSQL_USER: str = "logistics_user"
    MYSQL_PASSWORD: str = "change_me_app_password"
    MYSQL_DB: str = "ai_logistics_db"

    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        # Sử dụng URL.create để tự động encode an toàn các ký tự đặc biệt trong mật khẩu (@, :, /, #, ?, %)
        # LƯU Ý KỸ THUẬT: Khi sử dụng URI này với Alembic (qua configparser của alembic.ini/env.py),
        # nếu chuỗi URI được URL-encode có chứa ký tự '%', cần escape '%' thành '%%' để tránh lỗi nội suy cấu hình.
        return URL.create(
            drivername="mysql+pymysql",
            username=self.MYSQL_USER,
            password=self.MYSQL_PASSWORD,
            host=self.MYSQL_SERVER,
            port=self.MYSQL_PORT,
            database=self.MYSQL_DB,
            query={"charset": "utf8mb4"},
        ).render_as_string(hide_password=False)

    # JWT Security Configuration
    SECRET_KEY: str = "change_this_to_a_secure_random_key_min_32_chars"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # Initial Admin Configuration
    INITIAL_ADMIN_USERNAME: str = "admin"
    INITIAL_ADMIN_PASSWORD: str = "change_me"
    INITIAL_ADMIN_FULLNAME: str = "System Administrator"

    # CORS Configuration
    BACKEND_CORS_ORIGINS: Union[List[str], str] = ["http://localhost:3000", "http://localhost:8000"]

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            if v.startswith("[") and v.endswith("]"):
                try:
                    return json.loads(v)
                except Exception:
                    pass
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, list):
            return v
        return []

    @model_validator(mode="after")
    def validate_production_security(self) -> "Settings":
        """Chặn khởi động nếu môi trường khác development mà dùng khóa hoặc mật khẩu mẫu."""
        if self.ENVIRONMENT.lower() != "development":
            if "change_this" in self.SECRET_KEY:
                raise ValueError(
                    "AN TOÀN BẢO MẬT: SECRET_KEY đang sử dụng giá trị mẫu mặc định. "
                    "Hệ thống từ chối khởi động ở môi trường ngoài development!"
                )
            if self.INITIAL_ADMIN_PASSWORD == "change_me":
                raise ValueError(
                    "AN TOÀN BẢO MẬT: INITIAL_ADMIN_PASSWORD đang sử dụng giá trị mẫu 'change_me'. "
                    "Hệ thống từ chối khởi động ở môi trường ngoài development!"
                )
        return self


settings = Settings()

