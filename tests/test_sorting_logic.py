"""
Bộ kiểm thử đơn vị độc lập cho Phân hệ Phân loại Bưu chính IoT & Chống kẹt hàng
Tác giả kiểm thử: Nguyễn Thị Thu Hà (Task LOG-104 & LOG-114, LOG-115)
Tham chiếu đặc tả: docs/srs-ieee830/SRS_IEEE_830_SPECIFICATION.md (UC-06, UC-07, UC-09)
Tương thích cả pytest lẫn python -m unittest (thư viện chuẩn).
"""
import os
import sys
import unittest
import warnings

# Bỏ qua warning tạm thời của datetime.utcnow trong SQLAlchemy khi chạy test
warnings.filterwarnings("ignore", category=DeprecationWarning)
warnings.filterwarnings("ignore", category=ResourceWarning)

# Đảm bảo import được package app từ thư mục gốc dự án
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.models import Package, SortingGate, SystemLog
from app.services.sorting_service import IoTSortingService


class TestIoTSortingSystem(unittest.TestCase):
    """Kiểm thử toàn diện phân hệ IoT Sorting và Virtual Attribution"""

    def setUp(self):
        """Khởi tạo CSDL SQLite in-memory cho mỗi ca kiểm thử"""
        self.engine = create_engine("sqlite:///:memory:", echo=False)
        Base.metadata.create_all(bind=self.engine)
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        self.db = SessionLocal()

        # Seed các cổng phân loại 1, 2, 3 và 4
        self.gates = [
            SortingGate(gate_number=1, target_zone="Miền Bắc", postal_code_prefix="100000", conveyor_position_x=200.0, status="IDLE"),
            SortingGate(gate_number=2, target_zone="Miền Trung", postal_code_prefix="550000", conveyor_position_x=350.0, status="IDLE"),
            SortingGate(gate_number=3, target_zone="Miền Nam", postal_code_prefix="700000", conveyor_position_x=500.0, status="IDLE"),
            SortingGate(gate_number=4, target_zone="Quốc Tế", postal_code_prefix="999000", conveyor_position_x=650.0, status="IDLE"),
        ]
        self.db.add_all(self.gates)
        self.db.commit()
        self.service = IoTSortingService()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    # --- UC-06: VIRTUAL ATTRIBUTION (ÁNH XẠ MÃ BƯU CHÍNH) ---
    def test_routing_north_zone(self):
        pkg = Package(barcode="PKG-HN-001", postal_code="100000", destination_zone="Miền Bắc")
        gate_num = self.service.resolve_target_gate(pkg)
        self.assertEqual(gate_num, 1, "Mã 100000 (Hà Nội) phải định tuyến vào Cổng 1")

    def test_routing_central_zone(self):
        pkg = Package(barcode="PKG-DN-002", postal_code="550000", destination_zone="Miền Trung")
        gate_num = self.service.resolve_target_gate(pkg)
        self.assertEqual(gate_num, 2, "Mã 550000 (Đà Nẵng) phải định tuyến vào Cổng 2")

    def test_routing_south_zone(self):
        pkg = Package(barcode="PKG-HCM-003", postal_code="700000", destination_zone="Miền Nam")
        gate_num = self.service.resolve_target_gate(pkg)
        self.assertEqual(gate_num, 3, "Mã 700000 (TP.HCM) phải định tuyến vào Cổng 3")

    def test_routing_unrecognized_to_recheck_lane(self):
        pkg = Package(barcode="PKG-UNKNOWN-999", postal_code="999999", destination_zone="Không rõ")
        gate_num = self.service.resolve_target_gate(pkg)
        self.assertEqual(gate_num, 4, "Mã không xác định phải đưa về Cổng 4 (Làn Re-check)")

    # --- UC-07: SORTING GATE TRIGGER (KÍCH HOẠT CỔNG GẠT) ---
    def test_trigger_gate_actuation(self):
        pkg = Package(
            barcode="PKG-TEST-01",
            postal_code="100000",
            destination_zone="Miền Bắc",
            status="RECEIVED"
        )
        self.db.add(pkg)
        self.db.commit()
        self.db.refresh(pkg)

        res = self.service.trigger_gate(self.db, gate_number=1, package_id=pkg.package_id, deflect_angle_deg=45.0)

        self.assertEqual(res["status"], "TRIGGERED")
        self.assertEqual(res["gate_number"], 1)
        self.assertEqual(res["angle_deg"], 45.0)

        # Kiểm tra trạng thái cổng và kiện hàng
        gate = self.db.query(SortingGate).filter(SortingGate.gate_number == 1).first()
        self.assertEqual(gate.status, "DEFLECTING")
        self.assertEqual(gate.total_diverted_count, 1)

        db_pkg = self.db.query(Package).filter(Package.package_id == pkg.package_id).first()
        self.assertEqual(db_pkg.status, "SORTED")

        # Kiểm tra nhật ký sự kiện SCADA
        log = self.db.query(SystemLog).filter(SystemLog.event_type == "SORT_TRIGGER").first()
        self.assertIsNotNone(log)
        self.assertIn("Cổng IoT #1", log.description)

    # --- UC-09: ANTI-JAM ALERT & SAFE STOP (CHỐNG KẸT HÀNG) ---
    def test_anti_jam_detection_and_alert(self):
        res = self.service.handle_anti_jam_alert(self.db, gate_number=2)

        self.assertEqual(res["alert"], "GATE_JAM_ALERT")
        self.assertEqual(res["gate_number"], 2)

        gate = self.db.query(SortingGate).filter(SortingGate.gate_number == 2).first()
        self.assertEqual(gate.status, "JAMMED")

        log = self.db.query(SystemLog).filter(SystemLog.event_type == "GATE_JAM_ALERT").first()
        self.assertIsNotNone(log)
        self.assertIn("CẢNH BÁO KẸT HÀNG: Cổng IoT #2", log.description)


if __name__ == "__main__":
    unittest.main()
