"""Bộ kiểm thử tính toàn vẹn của mô hình CSDL 3NF (Bảng 4.5 - Bảng 4.10).

LƯU Ý KỸ THUẬT VÀ GIỚI HẠN CỦA SQLITE SO VỚI MYSQL:
1. SQLite in-memory được sử dụng để chạy unit test siêu tốc và hoàn toàn cô lập,
   không phụ thuộc vào MySQL daemon.
2. PRAGMA foreign_keys=ON được kích hoạt riêng cho test_engine để kiểm chứng khóa ngoại.
3. Giới hạn: SQLite có tính type affinity (kiểu động), không kiểm soát chặt chẽ độ dài VARCHAR
   như MySQL InnoDB; không hỗ trợ collation utf8mb4_unicode_ci. Kiểm thử tích hợp toàn diện
   sẽ được thực hiện trên container MySQL thật khi có chỉ đạo.
"""

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

# Tuyệt đối không import app.core.database ở mức module để tránh kích hoạt MySQL engine
from app.models import (
    Base,
    Package,
    SortingGate,
    StorageLocation,
    SystemLog,
    TrackingSession,
    User,
)

# Tạo riêng engine SQLite in-memory cho test với StaticPool (không dùng pool_size của MySQL)
test_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

# Listener PRAGMA foreign_keys CHỈ GẮN TRỰC TIẾP lên test_engine, không gán lên Engine toàn cục
@event.listens_for(test_engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


TestingSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=test_engine,
)


@pytest.fixture(name="db")
def db_fixture():
    """Tạo bảng sạch trước mỗi test và dọn dẹp sau khi chạy xong."""
    Base.metadata.create_all(bind=test_engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()
        Base.metadata.drop_all(bind=test_engine)


def test_model_defaults(db: Session):
    """Kiểm tra các giá trị mặc định của bảng Users, StorageLocations, SortingGates."""
    # 1. User default is_active
    user = User(
        username="toan_test",
        password_hash="hash_123",
        full_name="Nguyễn Văn Toàn",
        role="Admin",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    assert user.is_active is True

    # 2. StorageLocation default current_count và is_full
    loc = StorageLocation(
        code="RACK-A-01",
        zone="Zone A",
        capacity=50,
    )
    db.add(loc)
    db.commit()
    db.refresh(loc)
    assert loc.current_count == 0
    assert loc.is_full is False

    # 3. SortingGate default diverter_status
    gate = SortingGate(
        gate_number=1,
        target_province="Hà Nội",
    )
    db.add(gate)
    db.commit()
    db.refresh(gate)
    assert gate.diverter_status == "IDLE"


def test_check_constraints_reject_invalid_values(db: Session):
    """Kiểm tra CheckConstraint từ chối các giá trị ngoài phạm vi cho phép."""
    # 1. CHECK role: chỉ chấp nhận 'Admin', 'Manager', 'Operator'
    invalid_user = User(
        username="user_bad_role",
        password_hash="hash_123",
        full_name="Bad Role User",
        role="Viewer",  # 'Viewer' không hợp lệ
    )
    db.add(invalid_user)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()

    # 2. CHECK status: chỉ chấp nhận 'Created', 'On_Belt', 'Stored', 'Dispatched'
    invalid_package = Package(
        barcode="PKG-BAD-STATUS-001",
        weight=2.5,
        destination_code="HAN-01",
        status="LOST",  # 'LOST' không hợp lệ
    )
    db.add(invalid_package)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()

    # 3. CHECK diverter_status: chỉ chấp nhận 'IDLE', 'ACTIVE', 'ERROR'
    invalid_gate = SortingGate(
        gate_number=2,
        target_province="Đà Nẵng",
        diverter_status="JAMMED",  # 'JAMMED' không hợp lệ
    )
    db.add(invalid_gate)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_unique_constraints(db: Session):
    """Kiểm tra ràng buộc UNIQUE trên username, barcode, code, gate_number."""
    # 1. UNIQUE username
    u1 = User(username="admin_dup", password_hash="h1", full_name="User 1", role="Admin")
    u2 = User(username="admin_dup", password_hash="h2", full_name="User 2", role="Operator")
    db.add(u1)
    db.commit()
    db.add(u2)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()

    # 2. UNIQUE barcode
    p1 = Package(barcode="BARCODE-DUP", weight=1.0, destination_code="HAN", status="Created")
    p2 = Package(barcode="BARCODE-DUP", weight=2.0, destination_code="SGN", status="Created")
    db.add(p1)
    db.commit()
    db.add(p2)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()

    # 3. UNIQUE storage location code
    l1 = StorageLocation(code="LOC-DUP", zone="Zone A", capacity=10)
    l2 = StorageLocation(code="LOC-DUP", zone="Zone B", capacity=20)
    db.add(l1)
    db.commit()
    db.add(l2)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()

    # 4. UNIQUE gate_number
    g1 = SortingGate(gate_number=99, target_province="Hải Phòng")
    g2 = SortingGate(gate_number=99, target_province="Quảng Ninh")
    db.add(g1)
    db.commit()
    db.add(g2)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_foreign_key_blocking(db: Session):
    """Kiểm tra khóa ngoại chặn ghi dữ liệu khi tham chiếu id không tồn tại."""
    # 1. Package tham chiếu location_id không tồn tại
    pkg_bad_loc = Package(
        barcode="PKG-FK-001",
        weight=3.0,
        destination_code="DAD",
        status="Created",
        location_id=99999,  # Không tồn tại
    )
    db.add(pkg_bad_loc)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()

    # 2. Package tham chiếu gate_id không tồn tại
    pkg_bad_gate = Package(
        barcode="PKG-FK-002",
        weight=4.0,
        destination_code="SGN",
        status="Created",
        gate_id=88888,  # Không tồn tại
    )
    db.add(pkg_bad_gate)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()

    # 3. SystemLog tham chiếu user_id không tồn tại
    log_bad_user = SystemLog(
        user_id=77777,  # Không tồn tại
        action="LOGIN_ATTEMPT",
        details="Non-existent user test",
    )
    db.add(log_bad_user)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_valid_creation_and_relationships(db: Session):
    """Kiểm tra tạo dữ liệu hợp lệ và duyệt quan hệ giữa các bảng."""
    # 1. Tạo User và SystemLog
    user = User(
        username="operator_vinh",
        password_hash="pwd_vinh_secure",
        full_name="Nguyễn Hồng Vinh",
        role="Operator",
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    log = SystemLog(
        user_id=user.id,
        action="CONVEYOR_START",
        details="Khởi động băng tải mô phỏng",
    )
    db.add(log)
    db.commit()
    db.refresh(log)

    assert log.user.username == "operator_vinh"
    assert len(user.system_logs) == 1

    # 2. Tạo StorageLocation, SortingGate và Package
    loc = StorageLocation(code="RACK-B-05", zone="Zone B", capacity=100)
    gate = SortingGate(gate_number=3, target_province="Hồ Chí Minh")
    db.add_all([loc, gate])
    db.commit()
    db.refresh(loc)
    db.refresh(gate)

    pkg = Package(
        barcode="VNPOST-888999",
        weight=5.5,
        dimensions="30x20x15",
        destination_code="SGN-02",
        status="Stored",
        tracking_id=101,
        location_id=loc.id,
        gate_id=gate.id,
    )
    db.add(pkg)
    db.commit()
    db.refresh(pkg)

    assert pkg.storage_location.code == "RACK-B-05"
    assert pkg.sorting_gate.gate_number == 3
    assert len(loc.packages) == 1
    assert len(gate.packages) == 1

    # 3. Tạo TrackingSession
    session_rec = TrackingSession(
        tracking_id=101,
        camera_id="CAM-CONVEYOR-01",
    )
    db.add(session_rec)
    db.commit()
    db.refresh(session_rec)

    assert session_rec.tracking_id == 101
    assert session_rec.start_time is not None
    assert session_rec.end_time is None


def test_foreign_key_on_delete_behavior(db: Session):
    """Kiểm tra hành vi ON DELETE:
    - RESTRICT: Xóa StorageLocation hoặc SortingGate đang có Package tham chiếu -> Bị chặn với IntegrityError.
    - SET NULL: Xóa User đang có SystemLog -> user_id của log chuyển thành NULL, log vẫn tồn tại.
    """
    from sqlalchemy import delete

    # 1. Test RESTRICT với StorageLocation
    loc = StorageLocation(code="RACK-DEL-01", zone="Zone A", capacity=20)
    gate = SortingGate(gate_number=50, target_province="Cần Thơ")
    db.add_all([loc, gate])
    db.commit()

    pkg = Package(
        barcode="PKG-ONDELETE-01",
        weight=2.0,
        destination_code="VCA",
        status="Created",
        location_id=loc.id,
        gate_id=gate.id,
    )
    db.add(pkg)
    db.commit()

    # Thử xóa StorageLocation ở mức CSDL khi đang có Package tham chiếu (ON DELETE RESTRICT)
    with pytest.raises(IntegrityError):
        db.execute(delete(StorageLocation).where(StorageLocation.id == loc.id))
        db.commit()
    db.rollback()

    # Thử xóa SortingGate ở mức CSDL khi đang có Package tham chiếu (ON DELETE RESTRICT)
    with pytest.raises(IntegrityError):
        db.execute(delete(SortingGate).where(SortingGate.gate_number == 50))
        db.commit()
    db.rollback()

    # 2. Test SET NULL với User và SystemLog (ON DELETE SET NULL)
    user = User(
        username="user_to_delete",
        password_hash="hash_del",
        full_name="Deleted User",
        role="Operator",
    )
    db.add(user)
    db.commit()

    log = SystemLog(
        user_id=user.id,
        action="TEST_SET_NULL",
        details="Log before user deletion",
    )
    db.add(log)
    db.commit()
    log_id = log.id

    # Xóa User ở mức CSDL
    db.execute(delete(User).where(User.id == user.id))
    db.commit()

    # Kiểm tra log vẫn tồn tại và user_id chuyển thành None (NULL)
    db.expire_all()
    persisted_log = db.query(SystemLog).filter_by(id=log_id).first()
    assert persisted_log is not None
    assert persisted_log.user_id is None
    assert persisted_log.action == "TEST_SET_NULL"


