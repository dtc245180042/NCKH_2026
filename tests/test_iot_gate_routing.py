"""
Bộ kiểm thử đơn vị toàn diện: Logic Điều khiển Cổng Phân loại IoT & Ánh xạ Bưu chính
Tác giả kiểm thử: Nguyễn Thị Thu Hà (Task LOG-114 & LOG-115)
Tham chiếu kế hoạch: docs/plans/iot-gate-routing.md
Tương thích chuẩn unittest của Python (không phụ thuộc thư viện bên ngoài).
"""
import os
import sys
import unittest
import warnings

warnings.filterwarnings("ignore", category=DeprecationWarning)
warnings.filterwarnings("ignore", category=ResourceWarning)

# Đảm bảo import được package app từ thư mục gốc dự án
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.models import Package, SortingGate, SystemLog
from app.services.sorting_service import IoTSortingService


class TestIoTGateRoutingComprehensive(unittest.TestCase):
    """Kiểm thử chuyên sâu logic điều khiển cổng IoT, Virtual Attribution & Feedback Sensor"""

    def setUp(self):
        """Khởi tạo CSDL SQLite in-memory cho mỗi ca kiểm thử"""
        self.engine = create_engine("sqlite:///:memory:", echo=False)
        Base.metadata.create_all(bind=self.engine)
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        self.db = SessionLocal()

        # Seed 4 cổng phân loại
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

    # =========================================================================
    # PHẦN 1: KIỂM THỬ VIRTUAL ATTRIBUTION (ÁNH XẠ MÃ BƯU CHÍNH VNPOST - UC-06)
    # =========================================================================
    def test_routing_north_vietnam_exact_and_prefixes(self):
        """Kiểm tra định tuyến Miền Bắc (Hà Nội, Thái Nguyên, Hải Phòng, tiền tố 10-39) -> Cổng 1"""
        test_cases = [
            ("100000", "Miền Bắc"),   # Hà Nội
            ("250000", "Miền Bắc"),   # Thái Nguyên
            ("180000", "Miền Bắc"),   # Hải Phòng
            ("301234", "Miền Bắc"),   # Bắc Ninh (tiền tố 30)
            ("129999", "Miền Bắc"),   # Lạng Sơn (tiền tố 12)
        ]
        for code, expected_zone in test_cases:
            pkg = Package(barcode=f"PKG-N-{code}", postal_code=code, destination_zone=expected_zone)
            gate_num = self.service.resolve_target_gate(pkg)
            self.assertEqual(gate_num, 1, f"Mã bưu chính {code} ({expected_zone}) phải định tuyến vào Cổng 1")

    def test_routing_central_vietnam_exact_and_prefixes(self):
        """Kiểm tra định tuyến Miền Trung & Tây Nguyên (Đà Nẵng, Huế, Nha Trang, tiền tố 40-69) -> Cổng 2"""
        test_cases = [
            ("550000", "Miền Trung"),  # Đà Nẵng
            ("530000", "Miền Trung"),  # Thừa Thiên Huế
            ("650000", "Miền Trung"),  # Khánh Hòa
            ("471234", "Miền Trung"),  # Đắk Lắk (tiền tố 47)
            ("491234", "Miền Trung"),  # Lâm Đồng (tiền tố 49)
        ]
        for code, expected_zone in test_cases:
            pkg = Package(barcode=f"PKG-C-{code}", postal_code=code, destination_zone=expected_zone)
            gate_num = self.service.resolve_target_gate(pkg)
            self.assertEqual(gate_num, 2, f"Mã bưu chính {code} ({expected_zone}) phải định tuyến vào Cổng 2")

    def test_routing_south_vietnam_exact_and_prefixes(self):
        """Kiểm tra định tuyến Miền Nam (TP.HCM, Bình Dương, Cần Thơ, tiền tố 70-96) -> Cổng 3"""
        test_cases = [
            ("700000", "Miền Nam"),    # TP. Hồ Chí Minh
            ("820000", "Miền Nam"),    # Bình Dương
            ("900000", "Miền Nam"),    # Cần Thơ
            ("751234", "Miền Nam"),    # Đồng Nai (tiền tố 75)
            ("871234", "Miền Nam"),    # An Giang (tiền tố 87)
        ]
        for code, expected_zone in test_cases:
            pkg = Package(barcode=f"PKG-S-{code}", postal_code=code, destination_zone=expected_zone)
            gate_num = self.service.resolve_target_gate(pkg)
            self.assertEqual(gate_num, 3, f"Mã bưu chính {code} ({expected_zone}) phải định tuyến vào Cổng 3")

    def test_routing_unrecognized_and_international_to_recheck_lane(self):
        """Kiểm tra định tuyến kiện lỗi / không mã / quốc tế (tiền tố 99 hoặc chuỗi rỗng) -> Cổng 4 (Re-check)"""
        test_cases = [
            ("999000", "Quốc Tế"),
            ("991234", "Quốc Tế"),
            ("000000", "Lỗi mã"),
            ("ABCDEF", "Rách nhãn"),
            ("", "Không tem nhãn"),
            (None, "Trống dữ liệu"),
        ]
        for code, note in test_cases:
            pkg = Package(barcode="PKG-ERR", postal_code=code, destination_zone=note)
            gate_num = self.service.resolve_target_gate(pkg)
            self.assertEqual(gate_num, 4, f"Trường hợp '{note}' (mã '{code}') phải được gom về Cổng 4 (Làn Re-check)")

    def test_resolve_postal_route_helper(self):
        """Kiểm tra hàm tiện ích tra cứu lộ trình bưu chính resolve_postal_route()"""
        res_north = self.service.resolve_postal_route("100000")
        self.assertEqual(res_north["target_gate"], 1)
        self.assertEqual(res_north["is_recheck"], False)

        res_err = self.service.resolve_postal_route("INVALID_CODE")
        self.assertEqual(res_err["target_gate"], 4)
        self.assertEqual(res_err["is_recheck"], True)

    # =========================================================================
    # PHẦN 2: KIỂM THỬ AN TOÀN TIỀN KÍCH HOẠT (PRE-ACTUATION SAFETY CHECKS)
    # =========================================================================
    def test_pre_check_safety_allows_idle_gate(self):
        """Cổng ở trạng thái IDLE phải sẵn sàng cho phép kích hoạt"""
        is_safe, msg = self.service.check_gate_safety(self.db, gate_number=1)
        self.assertTrue(is_safe)
        self.assertIn("sẵn sàng", msg)

    def test_pre_check_safety_blocks_jammed_gate(self):
        """Cổng ở trạng thái JAMMED phải bị từ chối kích hoạt để chống xô đổ hàng"""
        gate = self.db.query(SortingGate).filter(SortingGate.gate_number == 2).first()
        gate.status = "JAMMED"
        self.db.commit()

        is_safe, msg = self.service.check_gate_safety(self.db, gate_number=2)
        self.assertFalse(is_safe)
        self.assertIn("KẸT HÀNG", msg)

        # Cố tình kích hoạt cổng đang JAMMED phải ném ngoại lệ ValueError
        pkg = Package(barcode="PKG-SAFE-01", postal_code="550000", destination_zone="Miền Trung")
        self.db.add(pkg)
        self.db.commit()
        self.db.refresh(pkg)

        with self.assertRaises(ValueError) as ctx:
            self.service.trigger_gate(self.db, gate_number=2, package_id=pkg.package_id)
        self.assertIn("KẸT HÀNG", str(ctx.exception))

    # =========================================================================
    # PHẦN 3: KIỂM THỬ CHU KỲ GẠT & CẢM BIẾN PHẢN HỒI (FEEDBACK SENSOR - UC-07)
    # =========================================================================
    def test_divert_cycle_with_successful_feedback(self):
        """Kiểm tra chu kỳ gạt thành công có cảm biến quang học phản hồi (mở 45° -> feedback -> thu về 0°)"""
        pkg = Package(barcode="PKG-CYCLE-01", postal_code="100000", destination_zone="Miền Bắc", status="RECEIVED")
        self.db.add(pkg)
        self.db.commit()
        self.db.refresh(pkg)

        # Chạy chu kỳ hoàn chỉnh với simulate_feedback=True
        res = self.service.execute_divert_cycle(
            self.db,
            gate_number=1,
            package_id=pkg.package_id,
            deflect_angle_deg=45.0,
            simulate_feedback=True
        )

        self.assertEqual(res["status"], "SUCCESS")
        self.assertEqual(res["gate_number"], 1)
        self.assertTrue(res["feedback_received"])
        self.assertEqual(res["final_gate_status"], "IDLE")

        # Kiểm tra trạng thái cổng đã tự động thu về IDLE
        gate = self.db.query(SortingGate).filter(SortingGate.gate_number == 1).first()
        self.assertEqual(gate.status, "IDLE")
        self.assertEqual(gate.total_diverted_count, 1)

        # Kiểm tra trạng thái kiện hàng
        self.db.refresh(pkg)
        self.assertEqual(pkg.status, "SORTED")

        # Kiểm tra ghi log xác nhận feedback
        log = self.db.query(SystemLog).filter(SystemLog.event_type == "SORT_FEEDBACK_OK").first()
        self.assertIsNotNone(log)
        self.assertIn("Cảm biến quang học xác nhận", log.description)

    def test_divert_cycle_feedback_timeout_triggers_jam_alert(self):
        """Kiểm tra chu kỳ gặp sự cố: Cảm biến không nhận được tín hiệu sau 3s -> Kích hoạt JAMMED (UC-09)"""
        pkg = Package(barcode="PKG-CYCLE-02", postal_code="700000", destination_zone="Miền Nam", status="RECEIVED")
        self.db.add(pkg)
        self.db.commit()
        self.db.refresh(pkg)

        # Chạy chu kỳ với simulate_feedback=False (giả lập cảm biến timeout)
        res = self.service.execute_divert_cycle(
            self.db,
            gate_number=3,
            package_id=pkg.package_id,
            deflect_angle_deg=45.0,
            simulate_feedback=False
        )

        self.assertEqual(res["status"], "JAM_ALERT")
        self.assertEqual(res["gate_number"], 3)
        self.assertFalse(res["feedback_received"])
        self.assertEqual(res["final_gate_status"], "JAMMED")

        # Kiểm tra cổng chuyển trạng thái JAMMED
        gate = self.db.query(SortingGate).filter(SortingGate.gate_number == 3).first()
        self.assertEqual(gate.status, "JAMMED")

        # Kiểm tra ghi log cảnh báo
        log = self.db.query(SystemLog).filter(SystemLog.event_type == "GATE_JAM_ALERT").first()
        self.assertIsNotNone(log)
        self.assertIn("CẢNH BÁO KẸT HÀNG: Cổng IoT #3", log.description)

    # =========================================================================
    # PHẦN 4: KIỂM THỬ CƠ CHẾ RESET / KHÔI PHỤC CỔNG SAU GỠ KẸT
    # =========================================================================
    def test_reset_gate_from_jammed_to_idle(self):
        """Kiểm tra hàm reset_gate_status khôi phục cổng từ JAMMED về IDLE thành công"""
        gate = self.db.query(SortingGate).filter(SortingGate.gate_number == 3).first()
        gate.status = "JAMMED"
        self.db.commit()

        # Thực hiện reset
        res = self.service.reset_gate_status(self.db, gate_number=3)

        self.assertEqual(res["status"], "RESET_SUCCESS")
        self.assertEqual(res["previous_status"], "JAMMED")
        self.assertEqual(res["new_status"], "IDLE")

        # Kiểm tra CSDL
        self.db.refresh(gate)
        self.assertEqual(gate.status, "IDLE")

        # Kiểm tra ghi log reset
        log = self.db.query(SystemLog).filter(SystemLog.event_type == "GATE_RESET").first()
        self.assertIsNotNone(log)
        self.assertIn("khôi phục từ 'JAMMED' về 'IDLE'", log.description)

        # Sau khi reset, cổng phải sẵn sàng hoạt động lại
        is_safe, msg = self.service.check_gate_safety(self.db, gate_number=3)
        self.assertTrue(is_safe)


if __name__ == "__main__":
    unittest.main()

