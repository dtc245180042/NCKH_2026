import pytest
from alembic.config import Config
from alembic import command
import tempfile
import os
from sqlalchemy import create_engine, inspect

def test_alembic_migrations_upgrade_and_downgrade():
    """
    Kiểm tra kịch bản migration ban đầu của Alembic:
    - Chạy upgrade head trên SQLite file tạm
    - Kiểm tra có đủ 6 bảng và các chỉ mục chính xác
    - Chạy downgrade base và kiểm tra các bảng đã được dọn sạch
    """
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
        db_path = tmp.name

    try:
        sqlite_url = f"sqlite:///{db_path}"
        cfg = Config("alembic.ini")
        cfg.set_main_option("sqlalchemy.url", sqlite_url)

        # 1. Chạy migration upgrade
        command.upgrade(cfg, "head")

        # Kiểm tra sự tồn tại của 6 bảng
        engine = create_engine(sqlite_url)
        inspector = inspect(engine)
        tables = set(inspector.get_table_names())
        expected_tables = {
            "users",
            "packages",
            "storage_locations",
            "sorting_gates",
            "tracking_sessions",
            "system_logs",
            "alembic_version",
        }
        assert expected_tables.issubset(tables), f"Thiếu bảng sau khi upgrade: {expected_tables - tables}"

        # 2. Chạy migration downgrade
        command.downgrade(cfg, "base")

        # Kiểm tra các bảng nghiệp vụ đã bị hủy
        inspector = inspect(engine)
        remaining_tables = set(inspector.get_table_names())
        for tbl in ["users", "packages", "storage_locations", "sorting_gates", "tracking_sessions", "system_logs"]:
            assert tbl not in remaining_tables, f"Bảng {tbl} chưa được dọn sạch sau downgrade"

        engine.dispose()
    finally:
        if os.path.exists(db_path):
            os.remove(db_path)
