"""
Bộ kiểm thử đơn vị chuyên sâu: Cơ chế Chống Kẹt Hàng, Watchdog & Khóa Liên Động Băng Tải (UC-09)
Tác giả kiểm thử: Nguyễn Thị Thu Hà (Task LOG-115)
Tham chiếu kế hoạch: docs/plans/iot-antijam.md
Tương thích chuẩn unittest của Python.
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


class TestIoTAntiJamSafetySystem(unittest.TestCase):
    """Kiểm thử toàn diện phân hệ cảm biến phản hồi, Watchdog và an toàn kẹt hàng IoT"""

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

        # Khởi tạo instance độc lập cho service
        self.service = IoTSortingService()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_watchdog_normal_feedback_before_timeout(self):
        """Kịch bản bình thường: Cảm biến quang phản hồi trước 3.0s -> Thu cần gạt về IDLE, băng tải an toàn"""
        pkg = Package(barcode="PKG-NORM-01", postal_code="100000", destination_zone="Miền Bắc", status="RECEIVED")
        self.db.add(pkg)
        self.db.commit()
        self.db.refresh(pkg)

        t_start = 1000.0
        # Mở cần gạt Cổng 1
        self.service.trigger_gate(self.db, gate_number=1, package_id=pkg.package_id, start_time=t_start)
        self.assertIn(1, self.service.active_actuations)

        # Cảm biến phản hồi sau 1.2 giây (trong ngưỡng an toàn < 3.0s)
        feedback_res = self.service.register_sensor_feedback(self.db, gate_number=1, package_id=pkg.package_id)
        self.assertEqual(feedback_res["status"], "SUCCESS")
        self.assertEqual(feedback_res["gate_status"], "IDLE")
        self.assertNotIn(1, self.service.active_actuations)

        # Quét Watchdog sau 3.5 giây: Không phát sinh cảnh báo kẹt nào
        scan_res = self.service.scan_jam_watchdog(self.db, current_time=t_start + 3.5)
        self.assertEqual(scan_res["jammed_gates_count"], 0)
        self.assertFalse(scan_res["conveyor_interlocked"])
        self.assertEqual(scan_res["conveyor_speed"], 135.0)

    def test_watchdog_timeout_triggers_jam_alert_and_stops_conveyor(self):
        """Kịch bản kẹt hàng: Quá 3.0s không có feedback -> Kích hoạt JAMMED, khóa liên động dừng băng tải về 0"""
        pkg = Package(barcode="PKG-JAM-01", postal_code="550000", destination_zone="Miền Trung", status="RECEIVED")
        self.db.add(pkg)
        self.db.commit()
        self.db.refresh(pkg)

        t_start = 2000.0
        # Mở cần gạt Cổng 2 lúc t=2000.0s
        self.service.trigger_gate(self.db, gate_number=2, package_id=pkg.package_id, start_time=t_start)

        # Giả lập thời gian trôi qua 3.2 giây (vượt ngưỡng 3.0s) mà không có cảm biến phản hồi
        scan_res = self.service.scan_jam_watchdog(self.db, current_time=t_start + 3.2)

        # Kiểm tra phát hiện kẹt
        self.assertEqual(scan_res["jammed_gates_count"], 1)
        self.assertTrue(scan_res["conveyor_interlocked"])
        self.assertEqual(scan_res["conveyor_speed"], 0.0)

        # Kiểm tra trạng thái cổng trong CSDL
        gate = self.db.query(SortingGate).filter(SortingGate.gate_number == 2).first()
        self.assertEqual(gate.status, "JAMMED")

        # Kiểm tra log SCADA
        log = self.db.query(SystemLog).filter(SystemLog.event_type == "GATE_JAM_ALERT").first()
        self.assertIsNotNone(log)
        self.assertIn("Cổng IoT #2 không nhận được tín hiệu feedback sau 3.0s", log.description)

    def test_conveyor_safety_interlocking_blocks_other_gates(self):
        """Khi khóa liên động băng tải đang kích hoạt (băng tải dừng), từ chối mở bất kỳ cổng nào khác"""
        # Giả lập băng tải đang bị khóa do sự cố
        self.service.conveyor_interlocked = True
        self.service.conveyor_speed = 0.0

        pkg = Package(barcode="PKG-BLOCK-01", postal_code="700000", destination_zone="Miền Nam", status="RECEIVED")
        self.db.add(pkg)
        self.db.commit()
        self.db.refresh(pkg)

        # Cố tình kích hoạt Cổng 3
        with self.assertRaises(ValueError) as ctx:
            self.service.trigger_gate(self.db, gate_number=3, package_id=pkg.package_id)

        self.assertIn("Khóa liên động băng tải đang kích hoạt", str(ctx.exception))

    def test_emergency_stop_system_shutdown(self):
        """Lệnh Dừng khẩn cấp toàn hệ thống (Emergency Stop) dừng toàn bộ băng tải và các cổng"""
        pkg = Package(barcode="PKG-EMER-01", postal_code="100000", destination_zone="Miền Bắc", status="RECEIVED")
        self.db.add(pkg)
        self.db.commit()
        self.db.refresh(pkg)

        # Đang có cổng 1 mở
        self.service.trigger_gate(self.db, gate_number=1, package_id=pkg.package_id)
        self.assertIn(1, self.service.active_actuations)

        # Nhấn nút dừng khẩn cấp
        stop_res = self.service.trigger_emergency_stop(
            self.db,
            operator_name="Nguyen Thi Thu Ha",
            reason="Phat hien di vat tren bang truyen"
        )

        self.assertEqual(stop_res["status"], "EMERGENCY_STOPPED")
        self.assertEqual(stop_res["conveyor_speed"], 0.0)
        self.assertTrue(self.service.conveyor_interlocked)
        self.assertEqual(len(self.service.active_actuations), 0)

        # Kiểm tra log khẩn cấp
        log = self.db.query(SystemLog).filter(SystemLog.event_type == "SYSTEM_EMERGENCY_STOP").first()
        self.assertIsNotNone(log)
        self.assertIn("DỪNG KHẨN CẤP TOÀN HỆ THỐNG", log.description)

    def test_jam_resolution_and_mttr_calculation(self):
        """Quy trình xử lý sự cố kẹt hàng: Báo cáo nguyên nhân, tính downtime, khôi phục IDLE và mở lại băng tải"""
        pkg = Package(barcode="PKG-RESOLVE-01", postal_code="700000", destination_zone="Miền Nam", status="RECEIVED")
        self.db.add(pkg)
        self.db.commit()
        self.db.refresh(pkg)

        t_jam = 5000.0
        # Gây sự cố kẹt cổng 3 lúc t=5000.0s
        self.service.handle_anti_jam_alert(self.db, gate_number=3, package_id=pkg.package_id, incident_time=t_jam)
        self.assertTrue(self.service.conveyor_interlocked)

        t_resolve = 5042.5  # Nhân viên gỡ kẹt xong sau 42.5 giây
        res = self.service.resolve_jam_incident(
            self.db,
            gate_number=3,
            operator_name="Nguyen Thi Thu Ha",
            root_cause="Kien hang meo mo bi mac ket mieng mang",
            corrective_action="Gỡ kiện bằng tay và kiểm tra góc cần gạt",
            resolve_time=t_resolve
        )

        self.assertEqual(res["status"], "RESOLVED_SUCCESS")
        self.assertEqual(res["gate_number"], 3)
        self.assertEqual(res["new_status"], "IDLE")
        self.assertEqual(res["downtime_seconds"], 42.5)
        self.assertTrue(res["conveyor_resumed"])

        # Kiểm tra băng tải đã được khôi phục tốc độ 135.0 px/s
        self.assertFalse(self.service.conveyor_interlocked)
        self.assertEqual(self.service.conveyor_speed, 135.0)

        # Kiểm tra tính toán chỉ số MTTR
        metrics = self.service.get_antijam_metrics(self.db)
        self.assertEqual(metrics["total_jam_incidents"], 1)
        self.assertEqual(metrics["total_downtime_seconds"], 42.5)
        self.assertEqual(metrics["mttr_seconds"], 42.5)

    def test_multiple_jams_conveyor_remains_stopped_until_all_cleared(self):
        """Khi nhiều cổng cùng bị kẹt, băng tải chỉ được phép chạy lại khi TOÀN BỘ các cổng đã được gỡ kẹt"""
        # Giả lập Cổng 1 và Cổng 2 cùng kẹt
        self.service.handle_anti_jam_alert(self.db, gate_number=1, incident_time=100.0)
        self.service.handle_anti_jam_alert(self.db, gate_number=2, incident_time=105.0)
        self.assertTrue(self.service.conveyor_interlocked)

        # Nhân viên gỡ kẹt xong Cổng 1
        res1 = self.service.resolve_jam_incident(self.db, gate_number=1, resolve_time=130.0)
        self.assertEqual(res1["status"], "RESOLVED_SUCCESS")
        # Băng tải VẪN PHẢI DỪNG vì Cổng 2 vẫn đang kẹt!
        self.assertFalse(res1["conveyor_resumed"])
        self.assertTrue(self.service.conveyor_interlocked)
        self.assertEqual(self.service.conveyor_speed, 0.0)

        # Nhân viên gỡ kẹt nốt Cổng 2
        res2 = self.service.resolve_jam_incident(self.db, gate_number=2, resolve_time=140.0)
        self.assertEqual(res2["status"], "RESOLVED_SUCCESS")
        # Bây giờ toàn bộ đã thông -> Băng tải mới được chạy lại
        self.assertTrue(res2["conveyor_resumed"])
        self.assertFalse(self.service.conveyor_interlocked)
        self.assertEqual(self.service.conveyor_speed, 135.0)


if __name__ == "__main__":
    unittest.main()

