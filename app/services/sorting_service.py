"""
Dịch vụ điều phối Cổng phân loại cơ khí IoT (UC-06 & UC-07)
Tuân thủ đặc tả tại .agents/skills/iot-sorting-control/SKILL.md
- Gán nhãn ảo & Ánh xạ bưu chính (Virtual Attribution)
- Kích hoạt cổng phân loại góc 45 độ
- Cơ chế chống kẹt hàng (Anti-Jam Exception Handling)
- Ghi nhật ký sự kiện vào system_logs
"""
import time
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from app.models import SortingGate, Package, SystemLog


class IoTSortingService:
    # Bản đồ ánh xạ mã vùng bưu chính và tên vùng sang số hiệu cổng
    ROUTING_MAP = {
        "100000": 1,  # Miền Bắc (Hà Nội) -> Cổng 1
        "550000": 2,  # Miền Trung (Đà Nẵng) -> Cổng 2
        "700000": 3,  # Miền Nam (TP.HCM) -> Cổng 3
        "999000": 4,  # Quốc Tế / Chuyển tiếp -> Cổng 4
    }

    ZONE_TO_GATE = {
        "Miền Bắc": 1,
        "Miền Trung": 2,
        "Miền Nam": 3,
        "Quốc Tế": 4,
    }

    def resolve_target_gate(self, package: Package) -> int:
        """
        Ánh xạ bưu kiện sang cổng phân loại tương ứng (Virtual Attribution)
        Nếu không xác định được, định tuyến về cổng Re-check (Cổng 4)
        """
        if package.postal_code in self.ROUTING_MAP:
            return self.ROUTING_MAP[package.postal_code]
        if package.destination_zone in self.ZONE_TO_GATE:
            return self.ZONE_TO_GATE[package.destination_zone]
        return 4  # Mặc định chuyển tiếp kiểm tra lại

    def trigger_gate(
        self,
        db: Session,
        gate_number: int,
        package_id: int,
        deflect_angle_deg: float = 45.0
    ) -> Dict[str, Any]:
        """
        Phát lệnh kích hoạt cơ cấu gạt cổng IoT góc 45 độ
        """
        gate = db.query(SortingGate).filter(SortingGate.gate_number == gate_number).first()
        if not gate:
            raise ValueError(f"Không tìm thấy Cổng IoT số {gate_number}")

        package = db.query(Package).filter(Package.package_id == package_id).first()
        if not package:
            raise ValueError(f"Không tìm thấy bưu kiện ID {package_id}")

        # Cập nhật trạng thái cổng
        gate.status = "DEFLECTING"
        gate.total_diverted_count += 1
        package.status = "SORTED"

        # Ghi log sự kiện SCADA
        log_entry = SystemLog(
            event_type="SORT_TRIGGER",
            description=(
                f"Cổng IoT #{gate_number} kích hoạt góc {deflect_angle_deg}° "
                f"phân loại kiện {package.barcode} ({package.destination_zone})."
            )
        )
        db.add(log_entry)
        db.commit()

        return {
            "status": "TRIGGERED",
            "gate_number": gate_number,
            "package_id": package_id,
            "angle_deg": deflect_angle_deg,
            "target_zone": gate.target_zone,
            "timestamp": time.time()
        }

    def handle_anti_jam_alert(self, db: Session, gate_number: int) -> Dict[str, Any]:
        """
        Xử lý ngoại lệ chống kẹt hàng (Anti-Jam Warning):
        Khi cảm biến không phát hiện kiện rơi vào làn sau 3 giây
        """
        gate = db.query(SortingGate).filter(SortingGate.gate_number == gate_number).first()
        if gate:
            gate.status = "JAMMED"

        log_entry = SystemLog(
            event_type="GATE_JAM_ALERT",
            description=f"CẢNH BÁO KẸT HÀNG: Cổng IoT #{gate_number} không nhận được tín hiệu feedback sau 3s!"
        )
        db.add(log_entry)
        db.commit()

        return {
            "alert": "GATE_JAM_ALERT",
            "gate_number": gate_number,
            "action_taken": "Tự động phát tín hiệu giảm tốc băng chuyền bảo vệ cơ khí."
        }


sorting_service = IoTSortingService()

