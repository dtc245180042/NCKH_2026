"""
Bộ kiểm thử tự động (Unit Test Suite) cho Backend Hệ thống AI Logistics
Kiểm tra:
1. Thuật toán tìm đường A* cho AMR (Hiệu năng < 10ms, Heuristic Manhattan/Chebyshev)
2. Bảo mật mật khẩu & JWT Token RBAC
3. Mô hình CSDL chuẩn 3NF (6 bảng)
4. Dịch vụ phân loại bưu kiện IoT & Ánh xạ bưu chính
"""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.models import User, Package, StorageLocation, SortingGate, TrackingSession, SystemLog
from app.core.security import get_password_hash, verify_password, create_access_token, decode_access_token
from app.services.a_star import AStarPlanner
from app.services.sorting_service import IoTSortingService


class TestAMRPathfinding:
    """Kiểm thử thuật toán tìm đường A* (UC-08)"""

    def test_a_star_manhattan_basic(self):
        planner = AStarPlanner(width=50, height=50)
        start = (2, 2)
        goal = (20, 20)

        path, cost, expanded, exec_ms = planner.find_path(start, goal, heuristic_mode="manhattan")

        assert len(path) > 0, "Thuật toán phải tìm thấy đường đi"
        assert path[0] == start, "Điểm đầu phải trùng với start"
        assert path[-1] == goal, "Điểm cuối phải trùng với goal"
        assert exec_ms < 10.0, f"Thời gian tính toán A* ({exec_ms:.2f}ms) phải nhỏ hơn 10ms theo NFR-01"

    def test_a_star_dynamic_obstacle_replanning(self):
        planner = AStarPlanner(width=30, height=30)
        start = (5, 5)
        goal = (5, 10)

        # Chặn đường trực tiếp bằng vật cản động
        dynamic_obstacles = [(5, 7), (5, 8)]
        path, cost, expanded, exec_ms = planner.find_path(
            start, goal, dynamic_obstacles=dynamic_obstacles
        )

        assert len(path) > 0, "Robot phải tìm được đường vòng tránh vật cản động"
        assert (5, 7) not in path, "Lộ trình không được đi qua vật cản động (5, 7)"
        assert (5, 8) not in path, "Lộ trình không được đi qua vật cản động (5, 8)"

    def test_a_star_chebyshev_8_directions(self):
        planner = AStarPlanner(width=40, height=40)
        start = (2, 2)
        goal = (10, 10)

        path, cost, expanded, exec_ms = planner.find_path(
            start, goal, heuristic_mode="chebyshev", allow_diagonal=True
        )

        assert len(path) > 0
        assert exec_ms < 10.0


class TestSecurityModule:
    """Kiểm thử module bảo mật mật khẩu và JWT RBAC (UC-01)"""

    def test_password_hash_and_verify(self):
        raw_pass = "IctuLogistics2026@"
        hashed = get_password_hash(raw_pass)

        assert hashed != raw_pass
        assert verify_password(raw_pass, hashed) is True
        assert verify_password("wrong_password", hashed) is False

    def test_jwt_token_generation_and_decode(self):
        user_id = 99
        role = "ADMIN"
        token = create_access_token(subject=user_id, role=role)

        assert isinstance(token, str)
        payload = decode_access_token(token)

        assert payload is not None
        assert payload.get("sub") == str(user_id)
        assert payload.get("role") == role


class TestDatabase3NFModels:
    """Kiểm thử cấu trúc 6 bảng CSDL chuẩn 3NF"""

    @pytest.fixture
    def db_session(self):
        # Sử dụng SQLite In-memory cách ly kiểm thử
        engine = create_engine("sqlite:///:memory:", echo=False)
        Base.metadata.create_all(bind=engine)
        SessionTest = sessionmaker(bind=engine)
        session = SessionTest()
        yield session
        session.close()

    def test_create_and_link_entities(self, db_session):
        # 1. Tạo user
        user = User(username="test_admin", hashed_password="fake_hash", role="ADMIN")
        db_session.add(user)

        # 2. Tạo ô kệ kho
        loc = StorageLocation(
            location_code="RACK-TEST-01",
            zone="A",
            grid_x=10,
            grid_y=10,
            capacity_weight=100.0
        )
        db_session.add(loc)
        db_session.commit()

        # 3. Tạo bưu kiện gán vào ô kệ
        pkg = Package(
            barcode="PKG-TEST-001",
            destination_zone="Miền Bắc",
            postal_code="100000",
            current_location_id=loc.location_id
        )
        db_session.add(pkg)
        db_session.commit()

        # 4. Tạo cổng phân loại
        gate = SortingGate(
            gate_number=1,
            target_zone="Miền Bắc",
            postal_code_prefix="100000",
            conveyor_position_x=380.0
        )
        db_session.add(gate)

        # 5. Tạo session tracking
        track = TrackingSession(
            package_id=pkg.package_id,
            assigned_track_id=10,
            confidence_score=0.98
        )
        db_session.add(track)

        # 6. Tạo system log
        log = SystemLog(
            event_type="TEST_EVENT",
            description="Unit test ghi log thành công",
            user_id=user.user_id
        )
        db_session.add(log)
        db_session.commit()

        # Kiểm tra tính toàn vẹn dữ liệu
        assert db_session.query(User).count() == 1
        assert db_session.query(Package).count() == 1
        assert db_session.query(StorageLocation).count() == 1
        assert db_session.query(SortingGate).count() == 1
        assert db_session.query(TrackingSession).count() == 1
        assert db_session.query(SystemLog).count() == 1

        # Kiểm tra relationship ORM
        assert pkg.storage_location.location_code == "RACK-TEST-01"
        assert track.package.barcode == "PKG-TEST-001"
        assert log.user.username == "test_admin"


class TestIoTSortingService:
    """Kiểm thử dịch vụ phân loại cổng IoT (UC-07)"""

    def test_routing_lookup(self):
        service = IoTSortingService()

        pkg_north = Package(postal_code="100000", destination_zone="Miền Bắc")
        pkg_central = Package(postal_code="550000", destination_zone="Miền Trung")
        pkg_south = Package(postal_code="700000", destination_zone="Miền Nam")
        pkg_intl = Package(postal_code="999000", destination_zone="Quốc Tế")
        pkg_unknown = Package(postal_code="123456", destination_zone="Khác")

        assert service.resolve_target_gate(pkg_north) == 1
        assert service.resolve_target_gate(pkg_central) == 2
        assert service.resolve_target_gate(pkg_south) == 3
        assert service.resolve_target_gate(pkg_intl) == 4
        assert service.resolve_target_gate(pkg_unknown) == 4
