import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_db
from app.core.security import get_password_hash
from app.main import app
from app.models import Base
from app.models.system_log import SystemLog
from app.models.user import User


@pytest.fixture(name="db_session")
def fixture_db_session():
    test_engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=test_engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=test_engine)


@pytest.fixture(name="client")
def fixture_client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_login_success(client, db_session):
    user = User(
        username="operator_test",
        password_hash=get_password_hash("Password123"),
        full_name="Test Operator",
        role="Operator",
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()

    resp = client.post("/api/v1/auth/login", json={"username": "operator_test", "password": "Password123"})
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"

    # Kiểm tra log được ghi
    log = db_session.execute(select(SystemLog).where(SystemLog.user_id == user.id)).scalar_one_or_none()
    assert log is not None
    assert log.action == "LOGIN"
    assert "SUCCESS" in log.details


def test_login_wrong_password_returns_401(client, db_session):
    user = User(
        username="operator_test",
        password_hash=get_password_hash("Password123"),
        full_name="Test Operator",
        role="Operator",
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()

    resp = client.post("/api/v1/auth/login", json={"username": "operator_test", "password": "WrongPassword"})
    assert resp.status_code == 401
    assert resp.json()["detail"] == "Tên đăng nhập hoặc mật khẩu không chính xác"


def test_login_nonexistent_user_returns_401(client, db_session):
    resp = client.post("/api/v1/auth/login", json={"username": "no_such_user", "password": "Password123"})
    assert resp.status_code == 401
    assert resp.json()["detail"] == "Tên đăng nhập hoặc mật khẩu không chính xác"


def test_login_inactive_user_returns_400(client, db_session):
    user = User(
        username="locked_user",
        password_hash=get_password_hash("Password123"),
        full_name="Locked Operator",
        role="Operator",
        is_active=False,
    )
    db_session.add(user)
    db_session.commit()

    resp = client.post("/api/v1/auth/login", json={"username": "locked_user", "password": "Password123"})
    assert resp.status_code == 400
    assert resp.json()["detail"] == "Tài khoản đã bị vô hiệu hóa"


def test_login_password_over_72_bytes_safe_401(client, db_session):
    user = User(
        username="operator_test",
        password_hash=get_password_hash("Password123"),
        full_name="Test Operator",
        role="Operator",
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()

    long_pwd = "A" * 80
    resp = client.post("/api/v1/auth/login", json={"username": "operator_test", "password": long_pwd})
    assert resp.status_code == 401
    assert resp.json()["detail"] == "Tên đăng nhập hoặc mật khẩu không chính xác"


def test_get_me_endpoint(client, db_session):
    user = User(
        username="admin_me",
        password_hash=get_password_hash("Password123"),
        full_name="Admin Test",
        role="Admin",
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()

    login_resp = client.post("/api/v1/auth/login", json={"username": "admin_me", "password": "Password123"})
    token = login_resp.json()["access_token"]

    resp = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["username"] == "admin_me"
    assert data["role"] == "Admin"
    assert "password_hash" not in data
