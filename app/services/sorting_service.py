"""
Dịch vụ điều phối Cổng phân loại cơ khí IoT (UC-06, UC-07, UC-09)
Tuân thủ đặc tả tại .agents/skills/iot-sorting-control/SKILL.md
- Gán nhãn ảo & Ánh xạ bưu chính toàn diện (VNPost Virtual Attribution)
- Kiểm tra an toàn tiền kích hoạt (Pre-actuation Safety Checks)
- Chu kỳ kích hoạt gạt góc 45 độ & Cảm biến quang học phản hồi (Feedback Sensor Lifecycle)
- Cơ chế xử lý ngoại lệ chống kẹt hàng (Anti-Jam Warning) & Khôi phục cổng (Clear Jam)
- Ghi nhật ký sự kiện vào system_logs
"""
import time
from typing import Optional, Dict, Any, Tuple
from sqlalchemy.orm import Session
from app.models import SortingGate, Package, SystemLog


class IoTSortingService:
    # 1. BẢNG ÁNH XẠ MÃ BƯU CHÍNH ĐẦY ĐỦ CỐ ĐỊNH (EXACT MATCH)
    EXACT_ROUTING_MAP = {
        "100000": 1,  # Hà Nội (Miền Bắc) -> Cổng 1
        "250000": 1,  # Thái Nguyên (Miền Bắc) -> Cổng 1
        "180000": 1,  # Hải Phòng (Miền Bắc) -> Cổng 1
        "550000": 2,  # Đà Nẵng (Miền Trung) -> Cổng 2
        "530000": 2,  # Thừa Thiên Huế (Miền Trung) -> Cổng 2
        "650000": 2,  # Khánh Hòa (Miền Trung) -> Cổng 2
        "700000": 3,  # TP. Hồ Chí Minh (Miền Nam) -> Cổng 3
        "820000": 3,  # Bình Dương (Miền Nam) -> Cổng 3
        "900000": 3,  # Cần Thơ (Miền Nam) -> Cổng 3
        "999000": 4,  # Quốc Tế / Chuyển tiếp đặc biệt -> Cổng 4
    }

    # 2. BẢNG ÁNH XẠ THEO TÊN VÙNG MIỀN
    ZONE_TO_GATE = {
        "Miền Bắc": 1,
        "Miền Trung": 2,
        "Miền Nam": 3,
        "Quốc Tế": 4,
        "Re-check": 4,
    }

    def resolve_target_gate(self, package: Package) -> int:
        """
        Ánh xạ bưu kiện sang cổng phân loại tương ứng (Virtual Attribution - UC-06).
        Ưu tiên:
        1. Khớp chính xác mã bưu chính trong EXACT_ROUTING_MAP
        2. Khớp tiền tố 2 chữ số theo quy chuẩn VNPost (10-39: Bắc, 40-69: Trung, 70-96: Nam)
        3. Khớp destination_zone
        4. Mặc định: Cổng 4 (Làn Re-check / Kiểm tra thủ công)
        """
        code = (package.postal_code or "").strip()
        if code in self.EXACT_ROUTING_MAP:
            return self.EXACT_ROUTING_MAP[code]

        # Kiểm tra tiền tố 2 chữ số theo bảng mã Bưu điện Việt Nam
        if len(code) >= 2 and code[:2].isdigit():
            prefix = int(code[:2])
            if 10 <= prefix <= 39:
                return 1  # Miền Bắc
            elif 40 <= prefix <= 69:
                return 2  # Miền Trung & Tây Nguyên
            elif 70 <= prefix <= 96:
                return 3  # Miền Nam
            elif prefix == 99:
                return 4  # Quốc Tế / Ngoại lệ

        zone = (package.destination_zone or "").strip()
        if zone in self.ZONE_TO_GATE:
            return self.ZONE_TO_GATE[zone]

        return 4  # Mặc định gom về làn Re-check

    def resolve_postal_route(self, postal_code: str, destination_zone: Optional[str] = None) -> Dict[str, Any]:
        """
        Hàm tiện ích tra cứu lộ trình bưu chính phục vụ REST API và kiểm thử.
        """
        dummy_pkg = Package(
            barcode="TEMP_LOOKUP",
            postal_code=postal_code,
            destination_zone=destination_zone
        )
        gate_num = self.resolve_target_gate(dummy_pkg)

        gate_names = {
            1: "Cổng 1 (Miền Bắc)",
            2: "Cổng 2 (Miền Trung)",
            3: "Cổng 3 (Miền Nam)",
            4: "Cổng 4 (Làn Re-check / Kiểm tra lại)"
        }
        zone_names = {
            1: "Miền Bắc",
            2: "Miền Trung",
            3: "Miền Nam",
            4: "Re-check / Quốc Tế"
        }

        is_recheck = (gate_num == 4)
        desc = (
            "Định tuyến tự động thành công vào cổng phân loại chuyên tuyến."
            if not is_recheck else
            "Bưu kiện chuyển về làn Re-check do mã không xác định hoặc thuộc danh mục chuyển tiếp."
        )

        return {
            "postal_code": postal_code,
            "target_gate": gate_num,
            "target_zone": zone_names.get(gate_num, "Không xác định"),
            "gate_label": gate_names.get(gate_num, f"Cổng {gate_num}"),
            "is_recheck": is_recheck,
            "description": desc
        }

    def check_gate_safety(self, db: Session, gate_number: int) -> Tuple[bool, str]:
        """
        Kiểm tra điều kiện an toàn tiền kích hoạt (Pre-actuation Safety Check):
        - Cổng phải tồn tại
        - Không ở trạng thái JAMMED (kẹt hàng)
        - Không ở trạng thái MAINTENANCE (bảo trì)
        """
        gate = db.query(SortingGate).filter(SortingGate.gate_number == gate_number).first()
        if not gate:
            return False, f"Không tìm thấy Cổng IoT số {gate_number} trong cơ sở dữ liệu."

        if gate.status == "JAMMED":
            return False, f"CẢNH BÁO: Cổng IoT #{gate_number} đang bị KẸT HÀNG (JAMMED). Từ chối mở cần gạt!"

        if gate.status == "MAINTENANCE":
            return False, f"Cổng IoT #{gate_number} đang BẢO TRÌ. Từ chối kích hoạt!"

        return True, "Cổng sẵn sàng hoạt động an toàn."

    def trigger_gate(
        self,
        db: Session,
        gate_number: int,
        package_id: int,
        deflect_angle_deg: float = 45.0
    ) -> Dict[str, Any]:
        """
        Phát lệnh kích hoạt cơ cấu gạt cổng IoT góc 45 độ (UC-07)
        Kèm cơ chế kiểm tra an toàn chống xô đổ hàng khi cổng đang lỗi.
        """
        # Kiểm tra an toàn trước khi gạt
        is_safe, msg = self.check_gate_safety(db, gate_number)
        if not is_safe:
            raise ValueError(msg)

        gate = db.query(SortingGate).filter(SortingGate.gate_number == gate_number).first()
        package = db.query(Package).filter(Package.package_id == package_id).first()
        if not package:
            raise ValueError(f"Không tìm thấy bưu kiện ID {package_id}")

        # Cập nhật trạng thái cổng và bưu kiện
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

    def execute_divert_cycle(
        self,
        db: Session,
        gate_number: int,
        package_id: int,
        deflect_angle_deg: float = 45.0,
        simulate_feedback: bool = True
    ) -> Dict[str, Any]:
        """
        Mô phỏng chu kỳ đóng/mở cần gạt hoàn chỉnh kèm cảm biến phản hồi (Feedback Sensor Lifecycle):
        1. Pre-check an toàn
        2. Kích hoạt mở cần gạt góc 45 độ (DEFLECTING)
        3. Tiếp nhận phản hồi từ cảm biến quang miệng máng
        4. Tự động thu cần gạt về 0 độ (IDLE) nếu thành công, hoặc chuyển JAMMED nếu timeout
        """
        # 1. Kích hoạt mở cần gạt
        trigger_res = self.trigger_gate(
            db=db,
            gate_number=gate_number,
            package_id=package_id,
            deflect_angle_deg=deflect_angle_deg
        )

        gate = db.query(SortingGate).filter(SortingGate.gate_number == gate_number).first()

        # 2. Xử lý cảm biến quang học phản hồi (Feedback Sensor)
        if simulate_feedback:
            # Cảm biến xác nhận kiện đã lọt qua máng trượt an toàn -> Thu cần gạt về 0 độ
            gate.status = "IDLE"

            feedback_log = SystemLog(
                event_type="SORT_FEEDBACK_OK",
                description=f"Cảm biến quang học xác nhận: Kiện ID {package_id} đã vào làn Cổng #{gate_number} an toàn. Thu cần gạt về 0°."
            )
            db.add(feedback_log)
            db.commit()

            return {
                "status": "SUCCESS",
                "gate_number": gate_number,
                "package_id": package_id,
                "angle_deg": deflect_angle_deg,
                "feedback_received": True,
                "final_gate_status": "IDLE",
                "message": f"Chu kỳ phân loại hoàn tất thành công. Cổng #{gate_number} đã thu cần gạt về vị trí an toàn (IDLE)."
            }
        else:
            # Giả lập tình huống cảm biến timeout sau 3 giây không nhận được kiện rơi
            jam_res = self.handle_anti_jam_alert(db, gate_number)
            return {
                "status": "JAM_ALERT",
                "gate_number": gate_number,
                "package_id": package_id,
                "angle_deg": deflect_angle_deg,
                "feedback_received": False,
                "final_gate_status": "JAMMED",
                "message": f"CẢNH BÁO: Cảm biến không phản hồi sau 3s! Cổng #{gate_number} chuyển sang trạng thái JAMMED."
            }

    def handle_anti_jam_alert(self, db: Session, gate_number: int) -> Dict[str, Any]:
        """
        Xử lý ngoại lệ chống kẹt hàng (Anti-Jam Warning - UC-09):
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

    def reset_gate_status(self, db: Session, gate_number: int) -> Dict[str, Any]:
        """
        Khôi phục trạng thái cổng phân loại sau khi gỡ kẹt hàng hoặc bảo trì xong (Clear Jam / Reset):
        Đưa trạng thái từ JAMMED/MAINTENANCE về IDLE để tiếp tục vận hành.
        """
        gate = db.query(SortingGate).filter(SortingGate.gate_number == gate_number).first()
        if not gate:
            raise ValueError(f"Không tìm thấy Cổng IoT số {gate_number}")

        prev_status = gate.status
        gate.status = "IDLE"

        log_entry = SystemLog(
            event_type="GATE_RESET",
            description=f"Nhân viên vận hành đã xác nhận gỡ lỗi: Cổng IoT #{gate_number} được khôi phục từ '{prev_status}' về 'IDLE'."
        )
        db.add(log_entry)
        db.commit()

        return {
            "status": "RESET_SUCCESS",
            "gate_number": gate_number,
            "previous_status": prev_status,
            "new_status": "IDLE",
            "message": f"Cổng IoT #{gate_number} đã được khôi phục về trạng thái IDLE thành công."
        }


sorting_service = IoTSortingService()
