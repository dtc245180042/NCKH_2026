import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_db
from app.core.security import create_access_token, get_password_hash
from app.main import app
from app.models import Base
from app.models.package import Package
from app.models.storage_location import StorageLocation
from app.models.user import User
from app.services.storage_heuristic import StorageHeuristicEngine


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


def test_storage_heuristic_classification():
    """Kiểm thử phân loại hàng hóa ABC (LOG-118)"""
    engine = StorageHeuristicEngine()

    # Nhóm A: Hàng quay vòng nhanh hoặc nhẹ / trung tâm lớn
    assert engine.classify_abc(weight=1.5, destination_code="VN-HN-01") == "Zone A"
    assert engine.classify_abc(weight=2.0, destination_code="70000", turnover_hint="HIGH") == "Zone A"

    # Nhóm B: Hàng trung bình
    assert engine.classify_abc(weight=6.5, destination_code="VN-DN-02") == "Zone B"
    assert engine.classify_abc(weight=5.0, destination_code="45000", turnover_hint="MEDIUM") == "Zone B"

    # Nhóm C: Hàng nặng / quay vòng chậm
    assert engine.classify_abc(weight=25.0, destination_code="VN-PROV-99") == "Zone C"
    assert engine.classify_abc(weight=12.0, destination_code="33000", turnover_hint="LOW") == "Zone C"


def test_recommend_slot_distance_and_overflow():
    """Kiểm thử gợi ý ô kệ tối ưu khoảng cách và cơ chế tràn vùng (Overflow)"""
    engine = StorageHeuristicEngine()

    locations = [
        {"id": 1, "code": "LOC-A01", "zone": "Zone A", "capacity": 2, "current_count": 0, "is_full": False},
        {"id": 2, "code": "LOC-A02", "zone": "Zone A", "capacity": 2, "current_count": 2, "is_full": True},  # Đầy
        {"id": 3, "code": "LOC-B01", "zone": "Zone B", "capacity": 2, "current_count": 0, "is_full": False},
        {"id": 4, "code": "LOC-C01", "zone": "Zone C", "capacity": 2, "current_count": 0, "is_full": False},
    ]

    # Kiện hàng A -> gợi ý LOC-A01
    best_a = engine.recommend_slot(package_weight=1.2, destination_code="VN-HN", available_locations=locations)
    assert best_a is not None
    assert best_a["code"] == "LOC-A01"
    assert best_a["recommended_zone"] == "Zone A"
    assert best_a["is_overflow"] is False

    # Giả lập Zone A bị đầy hoàn toàn -> Tự động tràn sang Zone B (Overflow)
    locations[0]["is_full"] = True
    locations[0]["current_count"] = 2
    best_overflow = engine.recommend_slot(package_weight=1.2, destination_code="VN-HN", available_locations=locations)
    assert best_overflow is not None
    assert best_overflow["recommended_zone"] == "Zone B"
    assert best_overflow["is_overflow"] is True

    # Khi cả 3 Zone đều đầy -> Trả về None
    for loc in locations:
        loc["is_full"] = True
    best_full = engine.recommend_slot(package_weight=1.2, destination_code="VN-HN", available_locations=locations)
    assert best_full is None


def test_api_recommend_and_assign_slot(client, db_session):
    """Kiểm thử API /recommend-slot và /assign-slot tích hợp cơ sở dữ liệu"""
    # Tạo user Operator
    user = User(
        username="op_storage_test",
        password_hash=get_password_hash("TestPass@2026!"),
        full_name="Storage Operator",
        role="Operator",
        is_active=True,
    )
    db_session.add(user)

    # Tạo ô kệ Zone A
    loc_a = StorageLocation(code="LOC-A-TEST-01", zone="Zone A", capacity=2, current_count=0, is_full=False)
    db_session.add(loc_a)

    # Tạo bưu kiện
    pkg = Package(
        barcode="PKG-AUTO-SLOT-01",
        weight=2.0,
        destination_code="VN-10001",
        status="Created"
    )
    db_session.add(pkg)
    db_session.commit()

    token = create_access_token(subject=user.id, role=user.role)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Gọi API gợi ý ô kệ
    resp_rec = client.post(f"/api/v1/packages/{pkg.id}/recommend-slot", headers=headers)
    assert resp_rec.status_code == 200
    data_rec = resp_rec.json()
    assert "recommended_slot" in data_rec
    assert data_rec["recommended_slot"]["recommended_zone"] == "Zone A"

    # 2. Gọi API gán ô kệ và lưu kho
    resp_assign = client.post(f"/api/v1/packages/{pkg.id}/assign-slot", headers=headers)
    assert resp_assign.status_code == 200
    data_assign = resp_assign.json()
    assert data_assign["status"] == "Stored"
    assert data_assign["location"]["code"] == loc_a.code
    assert data_assign["location"]["current_count"] == 1
