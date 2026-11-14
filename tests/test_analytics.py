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
from app.models.storage_location import StorageLocation
from app.models.sorting_gate import SortingGate
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


def test_get_warehouse_kpis_endpoint(client, db_session):
    """Kiểm thử API /api/v1/analytics/kpis tổng hợp đầy đủ số liệu vận hành kho (LOG-120)"""
    # 1. Tạo user Manager
    user = User(
        username="manager_analytics",
        password_hash=get_password_hash("ManagerPass@2026!"),
        full_name="Analytics Manager",
        role="Manager",
        is_active=True,
    )
    db_session.add(user)

    # 2. Tạo 3 cổng phân loại
    g1 = SortingGate(id=1, gate_number=1, target_province="Hà Nội", diverter_status="IDLE")
    g2 = SortingGate(id=2, gate_number=2, target_province="Đà Nẵng", diverter_status="IDLE")
    g3 = SortingGate(id=3, gate_number=3, target_province="TP. HCM", diverter_status="IDLE")
    db_session.add_all([g1, g2, g3])

    # 3. Tạo ô kệ Zone A, B, C
    loc_a = StorageLocation(code="LOC-A01", zone="Zone A", capacity=10, current_count=7, is_full=False)
    loc_b = StorageLocation(code="LOC-B01", zone="Zone B", capacity=10, current_count=3, is_full=False)
    loc_c = StorageLocation(code="LOC-C01", zone="Zone C", capacity=10, current_count=1, is_full=False)
    db_session.add_all([loc_a, loc_b, loc_c])

    # 4. Tạo các bưu kiện với các trạng thái khác nhau
    pkg1 = Package(barcode="PKG-K-01", weight=2.0, destination_code="VN-10000", status="Stored", location_id=1)
    pkg2 = Package(barcode="PKG-K-02", weight=5.0, destination_code="VN-50000", status="On_Belt", gate_id=2)
    pkg3 = Package(barcode="PKG-K-03", weight=12.0, destination_code="VN-70000", status="Created")
    db_session.add_all([pkg1, pkg2, pkg3])
    db_session.commit()

    token = create_access_token(subject=user.id, role=user.role)
    headers = {"Authorization": f"Bearer {token}"}

    # Gọi API KPI
    resp = client.get("/api/v1/analytics/kpis", headers=headers)
    assert resp.status_code == 200
    data = resp.json()

    # Kiểm tra cấu trúc throughput
    assert "throughput" in data
    assert data["throughput"]["total"] == 3
    assert data["throughput"]["stored"] == 1
    assert data["throughput"]["on_belt"] == 1
    assert data["throughput"]["created"] == 1

    # Kiểm tra cấu trúc phân loại cổng
    assert "sorting" in data
    assert data["sorting"]["accuracy_rate"] >= 99.0
    assert len(data["sorting"]["gates"]) == 3

    # Kiểm tra cấu trúc ô kệ ABC
    assert "storage_zones" in data
    assert "Zone A" in data["storage_zones"]
    assert "Zone B" in data["storage_zones"]
    assert "Zone C" in data["storage_zones"]
    assert data["storage_zones"]["Zone A"]["occupancy_rate"] == 70.0  # 7 / 10 = 70%

    # Kiểm tra hiệu năng AI & AMR
    assert "performance" in data
    assert data["performance"]["ai_mota"] >= 0.90
    assert data["performance"]["ai_idf1"] >= 0.90
    assert data["performance"]["ai_id_switches"] == 0
    assert data["performance"]["ai_inference_ms"] <= 30.0
