"""Unit test cho module app.core.config và cơ chế sinh SQLALCHEMY_DATABASE_URI an toàn."""

import pytest
from sqlalchemy.engine import make_url
from app.core.config import Settings


@pytest.mark.parametrize(
    "raw_password,description",
    [
        ("pass@123", "Chứa ký tự @ (phân tách user/host)"),
        ("pass:123", "Chứa ký tự : (phân tách host/port)"),
        ("pass/123", "Chứa ký tự / (phân tách database path)"),
        ("pass#123", "Chứa ký tự # (phân tách fragment)"),
        ("pass?123", "Chứa ký tự ? (phân tách query params)"),
        ("pass%123", "Chứa ký tự % (ký tự escape)"),
        ("P@ss:w/0rd#2026?%xyz", "Tổ hợp phức tạp chứa toàn bộ @ : / # ? %"),
    ],
)
def test_database_uri_special_character_passwords(monkeypatch, raw_password, description):
    """Kiểm tra URL.create mã hóa và phân tích chuẩn xác mật khẩu có ký tự đặc biệt."""
    # Dùng monkeypatch đặt rõ biến môi trường, cô lập hoàn toàn khỏi file .env
    monkeypatch.setenv("ENVIRONMENT", "development")
    monkeypatch.setenv("MYSQL_SERVER", "db.example.internal")
    monkeypatch.setenv("MYSQL_PORT", "3306")
    monkeypatch.setenv("MYSQL_USER", "special_user")
    monkeypatch.setenv("MYSQL_PASSWORD", raw_password)
    monkeypatch.setenv("MYSQL_DB", "logistics_test_db")
    monkeypatch.setenv("SECRET_KEY", "change_this_to_a_secure_random_key_min_32_chars")
    monkeypatch.setenv("INITIAL_ADMIN_PASSWORD", "change_me")

    settings = Settings()
    uri = settings.SQLALCHEMY_DATABASE_URI

    # Parse lại URI bằng make_url chuẩn của SQLAlchemy
    parsed = make_url(uri)

    assert parsed.drivername == "mysql+pymysql"
    assert parsed.username == "special_user"
    assert parsed.password == raw_password, f"Lỗi mật khẩu không khớp: {description}"
    assert parsed.host == "db.example.internal"
    assert parsed.port == 3306
    assert parsed.database == "logistics_test_db"
    assert parsed.query.get("charset") == "utf8mb4"


def test_cors_origins_parsing(monkeypatch):
    """Kiểm tra parse danh sách CORS origins từ chuỗi JSON và chuỗi phân cách bởi dấu phẩy."""
    monkeypatch.setenv("ENVIRONMENT", "development")
    monkeypatch.setenv("BACKEND_CORS_ORIGINS", '["http://localhost:3000", "http://localhost:8080"]')
    
    settings = Settings()
    assert settings.BACKEND_CORS_ORIGINS == ["http://localhost:3000", "http://localhost:8080"]

    # Test với chuỗi phân tách bởi dấu phẩy
    monkeypatch.setenv("BACKEND_CORS_ORIGINS", "http://localhost:3000, http://localhost:5173")
    settings2 = Settings()
    assert settings2.BACKEND_CORS_ORIGINS == ["http://localhost:3000", "http://localhost:5173"]

