import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_db
from app.core.security import create_access_token, get_password_hash
from app.main import app
from app.models import Base
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


@pytest.fixture(name="admin_user")
def fixture_admin_user(db_session):
    admin = User(
        username="super_admin",
        password_hash=get_password_hash("AdminPass123"),
        full_name="Super Administrator",
        role="Admin",
        is_active=True,
    )
    db_session.add(admin)
    db_session.commit()
    db_session.refresh(admin)
    return admin


@pytest.fixture(name="admin_token")
def fixture_admin_token(admin_user):
    return create_access_token(subject=admin_user.id, role=admin_user.role)


@pytest.fixture(name="operator_user")
def fixture_operator_user(db_session):
    op = User(
        username="normal_operator",
        password_hash=get_password_hash("OperatorPass123"),
        full_name="Normal Operator",
        role="Operator",
        is_active=True,
    )
    db_session.add(op)
    db_session.commit()
    db_session.refresh(op)
    return op


@pytest.fixture(name="operator_token")
def fixture_operator_token(operator_user):
    return create_access_token(subject=operator_user.id, role=operator_user.role)


def test_operator_cannot_create_user(client, operator_token):
    headers = {"Authorization": f"Bearer {operator_token}"}
    payload = {
        "username": "new_user",
        "full_name": "New User",
        "role": "Operator",
        "password": "Password123",
    }
    resp = client.post("/api/v1/users", json=payload, headers=headers)
    assert resp.status_code == 403
    assert resp.json()["detail"] == "Quyền truy cập bị từ chối"


def test_admin_create_user_success(client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    payload = {
        "username": "new_manager",
        "full_name": "New Manager",
        "role": "Manager",
        "password": "Password123",
    }
    resp = client.post("/api/v1/users", json=payload, headers=headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["username"] == "new_manager"
    assert data["role"] == "Manager"
    assert "password_hash" not in data


def test_admin_create_user_password_over_72_bytes_fails_422(client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    payload = {
        "username": "invalid_user",
        "full_name": "Invalid User",
        "role": "Operator",
        "password": "A" * 73,
    }
    resp = client.post("/api/v1/users", json=payload, headers=headers)
    assert resp.status_code == 422


def test_admin_cannot_self_deactivate(client, admin_user, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    resp = client.patch(f"/api/v1/users/{admin_user.id}/status", json={"is_active": False}, headers=headers)
    assert resp.status_code == 400
    assert resp.json()["detail"] == "Không thể tự vô hiệu hóa tài khoản của chính mình"


def test_cannot_deactivate_last_active_admin(client, admin_user, admin_token, db_session):
    # Tạo thêm 1 admin khác rồi thử dùng admin_token để khóa admin_user
    # Trong trường hợp admin_user là admin duy nhất:
    headers = {"Authorization": f"Bearer {admin_token}"}
    # Tạo admin 2
    admin2 = User(
        username="admin_2",
        password_hash=get_password_hash("Pass1234"),
        full_name="Admin 2",
        role="Admin",
        is_active=False,
    )
    db_session.add(admin2)
    db_session.commit()

    # admin_user vẫn là active admin duy nhất, admin2 đã bị False
    resp = client.patch(f"/api/v1/users/{admin_user.id}/status", json={"is_active": False}, headers=headers)
    assert resp.status_code == 400


def test_cannot_demote_last_active_admin(client, admin_user, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    resp = client.patch(f"/api/v1/users/{admin_user.id}", json={"role": "Operator"}, headers=headers)
    assert resp.status_code == 400


def test_pagination_max_limit_enforced(client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    # Thử limit = 101 (vượt trần 100) -> 422
    resp = client.get("/api/v1/users?limit=101", headers=headers)
    assert resp.status_code == 422
