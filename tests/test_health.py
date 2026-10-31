from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health_check_endpoint():
    """Kiểm tra route /api/health trả về HTTP 200 và status healthy độc lập với MySQL."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "project" in data
    assert "environment" in data


def test_root_endpoint():
    """Kiểm tra route root / trả về thông điệp chào mừng và liên kết docs."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "message" in data
    assert data["docs_url"] == "/docs"
    assert data["health_check"] == "/api/health"

