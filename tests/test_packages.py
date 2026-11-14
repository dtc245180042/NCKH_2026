import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_db
from app.core.security import create_access_token, get_password_hash
from app.main import app
from app.models import Base
from app.models.package import Package
from app.models.sorting_gate import SortingGate
from app.models.storage_location import StorageLocation
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


@pytest.fixture(name="auth_headers")
def fixture_auth_headers(db_session):
    user = User(
        username="operator_warehouse",
        password_hash=get_password_hash("Password123"),
        full_name="Warehouse Operator",
        role="Operator",
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    token = create_access_token(subject=user.id, role=user.role)
    return {"Authorization": f"Bearer {token}"}


def test_create_package_success(client, auth_headers):
    payload = {
        "barcode": "PKG-VN-1001",
        "weight": 2.5,
        "dimensions": "30x20x15",
        "destination_code": "HAN",
    }
    resp = client.post("/api/v1/packages", json=payload, headers=auth_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["barcode"] == "PKG-VN-1001"
    assert data["status"] == "Created"


def test_create_package_duplicate_barcode_fails(client, auth_headers):
    payload = {
        "barcode": "PKG-VN-DUP",
        "weight": 1.2,
        "destination_code": "DAD",
    }
    resp1 = client.post("/api/v1/packages", json=payload, headers=auth_headers)
    assert resp1.status_code == 201

    resp2 = client.post("/api/v1/packages", json=payload, headers=auth_headers)
    assert resp2.status_code == 400
    assert "đã tồn tại" in resp2.json()["detail"]


def test_package_storage_capacity_check(client, auth_headers, db_session):
    # Tạo ô kệ sức chứa 1
    loc = StorageLocation(code="LOC-A01", zone="A", capacity=1, current_count=0, is_full=False)
    db_session.add(loc)
    db_session.commit()

    # Tạo 2 kiện hàng với barcode >= 3 ký tự
    p1 = Package(barcode="PKG-001", weight=1.0, destination_code="HAN", status="Created")
    p2 = Package(barcode="PKG-002", weight=1.0, destination_code="HAN", status="Created")
    db_session.add_all([p1, p2])
    db_session.commit()

    # Gán kiện 1 vào kệ LOC-A01 -> thành công, kệ đầy
    r1 = client.patch(f"/api/v1/packages/{p1.id}", json={"location_id": loc.id}, headers=auth_headers)
    assert r1.status_code == 200

    # Gán tiếp kiện 2 vào cùng kệ -> phải bị chặn 400 vì đã đầy
    r2 = client.patch(f"/api/v1/packages/{p2.id}", json={"location_id": loc.id}, headers=auth_headers)
    assert r2.status_code == 400
    assert "đã đầy sức chứa" in r2.json()["detail"]


def test_list_locations_endpoint(client, auth_headers, db_session):
    loc1 = StorageLocation(code="LOC-Z1", zone="ZoneA", capacity=10, current_count=2, is_full=False)
    loc2 = StorageLocation(code="LOC-Z2", zone="ZoneB", capacity=5, current_count=5, is_full=True)
    db_session.add_all([loc1, loc2])
    db_session.commit()

    resp = client.get("/api/v1/locations", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 2
    assert len(data["items"]) == 2
