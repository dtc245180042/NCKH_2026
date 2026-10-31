"""
Database connection, engine, sessionmaker and seed initialization.
Supports SQLite and PostgreSQL via SQLAlchemy 2.0.
Tuân thủ tiêu chuẩn an toàn bảo mật và khởi tạo nhân sự (LOG-124).
"""
from datetime import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from app.core.config import settings

# Xử lý kết nối SQLite thread-safe
connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    echo=False,
    pool_pre_ping=True
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """Dependency injection cung cấp database session per-request"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Khởi tạo tất cả 6 bảng CSDL và nạp dữ liệu mẫu ban đầu (Seed Data)"""
    from app.models import User, StorageLocation, Package, SortingGate, TrackingSession, SystemLog
    from app.core.security import get_password_hash

    # Tạo bảng nếu chưa tồn tại
    Base.metadata.create_all(bind=engine)

    db: Session = SessionLocal()
    try:
        # 1. Khởi tạo người dùng mẫu (RBAC) với mật khẩu mạnh bảo mật (LOG-124)
        if db.query(User).count() == 0:
            admin_user = User(
                username="admin",
                hashed_password=get_password_hash(settings.INITIAL_ADMIN_PASSWORD),
                full_name="Nguyễn Văn Toàn (Quản trị viên)",
                role="ADMIN",
                is_active=True
            )
            op_user = User(
                username="operator",
                hashed_password=get_password_hash(settings.INITIAL_OPERATOR_PASSWORD),
                full_name="Nguyễn Thị Thu Hà (Vận hành kho)",
                role="OPERATOR",
                is_active=True
            )
            viewer_user = User(
                username="viewer",
                hashed_password=get_password_hash(settings.INITIAL_VIEWER_PASSWORD),
                full_name="Khách tham quan / Giám sát",
                role="VIEWER",
                is_active=True
            )
            db.add_all([admin_user, op_user, viewer_user])
            db.commit()

        # 2. Khởi tạo 4 cổng phân loại IoT
        if db.query(SortingGate).count() == 0:
            gates = [
                SortingGate(
                    gate_number=1,
                    target_zone="Miền Bắc",
                    postal_code_prefix="100000",
                    conveyor_position_x=380.0,
                    divert_direction=1,
                    status="IDLE"
                ),
                SortingGate(
                    gate_number=2,
                    target_zone="Miền Trung",
                    postal_code_prefix="550000",
                    conveyor_position_x=620.0,
                    divert_direction=-1,
                    status="IDLE"
                ),
                SortingGate(
                    gate_number=3,
                    target_zone="Miền Nam",
                    postal_code_prefix="700000",
                    conveyor_position_x=860.0,
                    divert_direction=1,
                    status="IDLE"
                ),
                SortingGate(
                    gate_number=4,
                    target_zone="Quốc Tế",
                    postal_code_prefix="999000",
                    conveyor_position_x=1100.0,
                    divert_direction=0,
                    status="IDLE"
                )
            ]
            db.add_all(gates)
            db.commit()

        # 3. Khởi tạo các ô kệ lưu kho bãi
        if db.query(StorageLocation).count() == 0:
            locations = []
            for bay in range(1, 6):
                for tier in range(1, 4):
                    locations.append(StorageLocation(
                        location_code=f"RACK-A-{bay:02d}-{tier:02d}",
                        zone="A (Khu Bắc)",
                        grid_x=280 + bay * 60,
                        grid_y=70,
                        capacity_weight=150.0,
                        is_occupied=(bay == 1 and tier == 1)
                    ))
                    locations.append(StorageLocation(
                        location_code=f"RACK-B-{bay:02d}-{tier:02d}",
                        zone="B (Khu Nam)",
                        grid_x=280 + bay * 60,
                        grid_y=690,
                        capacity_weight=150.0,
                        is_occupied=(bay == 2 and tier == 2)
                    ))
            db.add_all(locations)
            db.commit()

        # 4. Ghi nhận log khởi động hệ thống
        if db.query(SystemLog).count() == 0:
            sys_log = SystemLog(
                event_type="SYSTEM_INIT",
                description="Hệ thống CSDL Logistics 3NF khởi tạo thành công với tài khoản bảo mật (SV2026-ICTU-08).",
                user_id=1
            )
            db.add(sys_log)
            db.commit()

    finally:
        db.close()
