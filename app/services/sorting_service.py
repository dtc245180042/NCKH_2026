"""
Dịch vụ điều phối Cổng phân loại cơ khí IoT & Cơ chế Chống kẹt hàng (UC-06, UC-07, UC-09)
Tuân thủ đặc tả tại .agents/skills/iot-sorting-control/SKILL.md & docs/plans/iot-antijam.md
- Gán nhãn ảo & Ánh xạ bưu chính (Virtual Attribution)
- Kích hoạt cổng phân loại góc 45 độ
- Đồng hồ giám sát cảm biến quang học phản hồi (Jam Watchdog Timer - Ngưỡng 3.0s)
- Khóa liên động dừng khẩn cấp băng tải (Conveyor Safety Interlocking)
- Phân cấp sự cố & Dừng khẩn cấp toàn hệ thống (Emergency Stop)
- Khôi phục sự cố (Resolve Jam) & Đo lường thời gian gián đoạn MTTR
- Ghi nhật ký SCADA vào system_logs
"""
import time
from typing import Optional, Dict, Any, List, Tuple
from sqlalchemy.orm import Session
from app.models import SortingGate, Package, SystemLog


class IoTSortingService:
    # 1. BẢNG ÁNH XẠ MÃ BƯU CHÍNH
    ROUTING_MAP = {
        "100000": 1,  # Miền Bắc (Hà Nội) -> Cổng 1
        "250000": 1,  # Miền Bắc (Thái Nguyên) -> Cổng 1
        "180000": 1,  # Miền Bắc (Hải Phòng) -> Cổng 1
        "550000": 2,  # Miền Trung (Đà Nẵng) -> Cổng 2
        "530000": 2,  # Miền Trung (Huế) -> Cổng 2
        "700000": 3,  # Miền Nam (TP.HCM) -> Cổng 3
        "820000": 3,  # Miền Nam (Bình Dương) -> Cổng 3
        "999000": 4,  # Quốc Tế / Làn Re-check -> Cổng 4
    }

    ZONE_TO_GATE = {
        "Miền Bắc": 1,
        "Miền Trung": 2,
        "Miền Nam": 3,
        "Quốc Tế": 4,
        "Re-check": 4,
    }

    # THỜI GIAN TIMEOUT CẢM BIẾN QUANG PHẢN HỒI (GIÂY)
    SENSOR_TIMEOUT_SECONDS = 3.0
    DEFAULT_CONVEYOR_SPEED = 135.0  # pixel/giây

    def __init__(self):
        # Trạng thái điều hành phần cứng thời gian thực
        self.conveyor_speed = self.DEFAULT_CONVEYOR_SPEED
        self.conveyor_interlocked = False  # True khi băng tải bị khóa dừng do sự cố
        # Theo dõi các cổng đang mở cần gạt: {gate_number: {"package_id": int, "start_time": float, "angle": float}}
        self.active_actuations: Dict[int, Dict[str, Any]] = {}
        # Lịch sử các vụ kẹt hàng để tính toán MTTR
        self.jam_incidents: List[Dict[str, Any]] = []

    def resolve_target_gate(self, package: Package) -> int:
        """
        Ánh xạ bưu kiện sang cổng phân loại tương ứng (Virtual Attribution - UC-06)
        """
        code = (package.postal_code or "").strip()
        if code in self.ROUTING_MAP:
            return self.ROUTING_MAP[code]

        if len(code) >= 2 and code[:2].isdigit():
            prefix = int(code[:2])
            if 10 <= prefix <= 39:
                return 1
            elif 40 <= prefix <= 69:
                return 2
            elif 70 <= prefix <= 96:
                return 3
            elif prefix == 99:
                return 4

        zone = (package.destination_zone or "").strip()
        if zone in self.ZONE_TO_GATE:
            return self.ZONE_TO_GATE[zone]

        return 4  # Mặc định chuyển tiếp kiểm tra lại

    def check_gate_safety(self, db: Session, gate_number: int) -> Tuple[bool, str]:
        """
        Kiểm tra an toàn tiền kích hoạt: Chặn lệnh nếu cổng đang kẹt hoặc băng tải bị khóa
        """
        if self.conveyor_interlocked:
            return False, "Khóa liên động băng tải đang kích hoạt (CONVEYOR_INTERLOCKED). Băng tải đang dừng an toàn!"

        gate = db.query(SortingGate).filter(SortingGate.gate_number == gate_number).first()
        if not gate:
            return False, f"Không tìm thấy Cổng IoT số {gate_number} trong CSDL."

        if gate.status == "JAMMED":
            return False, f"Cổng IoT #{gate_number} đang bị KẸT HÀNG (JAMMED). Khóa liên động từ chối mở cần gạt!"

        if gate.status == "MAINTENANCE":
            return False, f"Cổng IoT #{gate_number} đang BẢO TRÌ. Từ chối kích hoạt!"

        return True, "Cổng sẵn sàng hoạt động an toàn."

    def trigger_gate(
        self,
        db: Session,
        gate_number: int,
        package_id: int,
        deflect_angle_deg: float = 45.0,
        start_time: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Phát lệnh kích hoạt cơ cấu gạt cổng IoT góc 45 độ (UC-07)
        Khởi tạo Jam Watchdog Timer theo dõi cảm biến phản hồi.
        """
        is_safe, msg = self.check_gate_safety(db, gate_number)
        if not is_safe:
            raise ValueError(msg)

        gate = db.query(SortingGate).filter(SortingGate.gate_number == gate_number).first()
        package = db.query(Package).filter(Package.package_id == package_id).first()
        if not package:
            raise ValueError(f"Không tìm thấy bưu kiện ID {package_id}")

        now = start_time if start_time is not None else time.time()

        # Cập nhật trạng thái cổng
        gate.status = "DEFLECTING"
        gate.total_diverted_count += 1
        package.status = "SORTED"

        # Đăng ký vào bảng theo dõi Watchdog Timer
        self.active_actuations[gate_number] = {
            "package_id": package_id,
            "start_time": now,
            "angle_deg": deflect_angle_deg
        }

        # Ghi log sự kiện SCADA
        log_entry = SystemLog(
            event_type="SORT_TRIGGER",
            description=(
                f"Cổng IoT #{gate_number} kích hoạt góc {deflect_angle_deg}° "
                f"phân loại kiện {package.barcode} ({package.destination_zone}). Khởi động Watchdog Timer 3.0s."
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
            "watchdog_timeout_sec": self.SENSOR_TIMEOUT_SECONDS,
            "timestamp": now
        }

    def register_sensor_feedback(
        self,
        db: Session,
        gate_number: int,
        package_id: int
    ) -> Dict[str, Any]:
        """
        Tiếp nhận tín hiệu xung cảm biến quang học tại miệng máng:
        Kiện hàng đã rơi qua làn an toàn -> Tự động thu cần gạt về 0 độ (IDLE), hủy đếm lùi Watchdog.
        """
        gate = db.query(SortingGate).filter(SortingGate.gate_number == gate_number).first()
        if not gate:
            raise ValueError(f"Không tìm thấy Cổng IoT #{gate_number}")

        # Hủy đăng ký Watchdog
        if gate_number in self.active_actuations:
            del self.active_actuations[gate_number]

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
            "feedback_received": True,
            "gate_status": "IDLE",
            "message": f"Cổng #{gate_number} đã thu cần gạt về vị trí an toàn (IDLE)."
        }

    def handle_anti_jam_alert(
        self,
        db: Session,
        gate_number: int,
        package_id: Optional[int] = None,
        incident_time: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Xử lý ngoại lệ chống kẹt hàng (Anti-Jam Warning - UC-09):
        Khi cảm biến không phát hiện kiện rơi vào làn sau 3 giây.
        Kích hoạt Khóa liên động an toàn (Conveyor Interlocking) dừng băng tải về 0 px/s.
        """
        now = incident_time if incident_time is not None else time.time()
        gate = db.query(SortingGate).filter(SortingGate.gate_number == gate_number).first()
        if gate:
            gate.status = "JAMMED"

        # Kích hoạt khóa liên động dừng băng chuyền bảo vệ cơ khí
        self.conveyor_speed = 0.0
        self.conveyor_interlocked = True

        # Ghi nhận vụ kẹt hàng vào danh sách sự cố
        incident_entry = {
            "incident_id": len(self.jam_incidents) + 1,
            "gate_number": gate_number,
            "package_id": package_id,
            "start_time": now,
            "resolved_time": None,
            "downtime_seconds": None,
            "root_cause": None,
            "operator_name": None
        }
        self.jam_incidents.append(incident_entry)

        log_entry = SystemLog(
            event_type="GATE_JAM_ALERT",
            description=(
                f"CẢNH BÁO KẸT HÀNG: Cổng IoT #{gate_number} không nhận được tín hiệu feedback sau 3.0s! "
                f"Kích hoạt Khóa liên động (Conveyor Interlock): Tự động dừng băng tải bảo vệ cơ khí."
            )
        )
        db.add(log_entry)
        db.commit()

        return {
            "alert": "GATE_JAM_ALERT",
            "gate_number": gate_number,
            "package_id": package_id,
            "gate_status": "JAMMED",
            "conveyor_interlocked": True,
            "conveyor_speed": 0.0,
            "action_taken": "Tự động kích hoạt khóa liên động dừng băng tải về 0 px/s để bảo vệ động cơ."
        }

    def scan_jam_watchdog(
        self,
        db: Session,
        current_time: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Quét định kỳ toàn bộ các cổng đang mở cần gạt (Watchdog Engine):
        Nếu thời gian mở vượt quá SENSOR_TIMEOUT_SECONDS (3.0s) mà chưa có feedback -> Tự động kích hoạt Anti-Jam.
        """
        now = current_time if current_time is not None else time.time()
        details = []
        jammed_count = 0
        timed_out_gates = []

        for gate_num, info in list(self.active_actuations.items()):
            elapsed = now - info["start_time"]
            pkg_id = info["package_id"]

            if elapsed >= self.SENSOR_TIMEOUT_SECONDS:
                # Kích hoạt báo kẹt hàng
                self.handle_anti_jam_alert(db, gate_number=gate_num, package_id=pkg_id, incident_time=now)
                timed_out_gates.append(gate_num)
                jammed_count += 1
                details.append({
                    "gate_number": gate_num,
                    "package_id": pkg_id,
                    "elapsed_seconds": round(elapsed, 2),
                    "status": "JAMMED",
                    "action_taken": f"TIMEOUT > 3.0s: Kích hoạt khóa liên động dừng băng tải khẩn cấp."
                })
            else:
                details.append({
                    "gate_number": gate_num,
                    "package_id": pkg_id,
                    "elapsed_seconds": round(elapsed, 2),
                    "status": "DEFLECTING",
                    "action_taken": "Đang trong ngưỡng thời gian an toàn, chờ cảm biến phản hồi."
                })

        # Xóa các cổng đã bị chuyển sang trạng thái kẹt khỏi active_actuations
        for g in timed_out_gates:
            if g in self.active_actuations:
                del self.active_actuations[g]

        return {
            "timestamp": now,
            "total_gates_scanned": 4,
            "active_actuations": len(self.active_actuations),
            "jammed_gates_count": jammed_count,
            "conveyor_interlocked": self.conveyor_interlocked,
            "conveyor_speed": self.conveyor_speed,
            "details": details
        }

    def trigger_emergency_stop(
        self,
        db: Session,
        operator_name: str = "Operator",
        reason: str = "Nút dừng khẩn cấp được kích hoạt thủ công"
    ) -> Dict[str, Any]:
        """
        Dừng khẩn cấp toàn bộ hệ thống (Emergency Stop - Level 3):
        Dừng toàn bộ băng tải, khóa liên động toàn bộ dây chuyền, đưa các cổng đang mở về an toàn.
        """
        now = time.time()
        self.conveyor_speed = 0.0
        self.conveyor_interlocked = True

        stopped_gates = list(self.active_actuations.keys())
        self.active_actuations.clear()

        # Cập nhật các cổng đang mở về JAMMED hoặc MAINTENANCE
        for g_num in stopped_gates:
            gate = db.query(SortingGate).filter(SortingGate.gate_number == g_num).first()
            if gate:
                gate.status = "MAINTENANCE"

        log_entry = SystemLog(
            event_type="SYSTEM_EMERGENCY_STOP",
            description=f"DỪNG KHẨN CẤP TOÀN HỆ THỐNG do {operator_name}: {reason}. Băng tải ngắt điện, tốc độ = 0 px/s."
        )
        db.add(log_entry)
        db.commit()

        return {
            "status": "EMERGENCY_STOPPED",
            "action": "SYSTEM_SHUTDOWN",
            "conveyor_speed": 0.0,
            "stopped_gates": stopped_gates,
            "message": f"Toàn bộ hệ thống phân loại đã dừng khẩn cấp: {reason}",
            "timestamp": now
        }

    def resolve_jam_incident(
        self,
        db: Session,
        gate_number: int,
        operator_name: str = "Operator",
        root_cause: str = "Bưu kiện méo mó kẹt máng",
        corrective_action: str = "Đã gỡ kiện thủ công",
        resolve_time: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Quy trình xử lý sự cố kẹt hàng & Khôi phục vận hành:
        - Tính toán thời gian gián đoạn (Downtime)
        - Đưa cổng từ JAMMED về IDLE
        - Mở khóa liên động băng tải nếu không còn cổng nào khác bị kẹt
        """
        now = resolve_time if resolve_time is not None else time.time()
        gate = db.query(SortingGate).filter(SortingGate.gate_number == gate_number).first()
        if not gate:
            raise ValueError(f"Không tìm thấy Cổng IoT #{gate_number}")

        prev_status = gate.status
        gate.status = "IDLE"

        # Tính toán downtime cho incident gần nhất của cổng này
        downtime = 0.0
        for inc in reversed(self.jam_incidents):
            if inc["gate_number"] == gate_number and inc["resolved_time"] is None:
                inc["resolved_time"] = now
                inc["downtime_seconds"] = round(now - inc["start_time"], 2)
                inc["root_cause"] = root_cause
                inc["operator_name"] = operator_name
                downtime = inc["downtime_seconds"]
                break

        # Kiểm tra xem còn cổng nào khác trong CSDL đang JAMMED không
        other_jammed = db.query(SortingGate).filter(
            SortingGate.status == "JAMMED",
            SortingGate.gate_number != gate_number
        ).count()

        conveyor_resumed = False
        if other_jammed == 0:
            # Không còn cổng nào kẹt -> Khôi phục lại băng chuyền
            self.conveyor_interlocked = False
            self.conveyor_speed = self.DEFAULT_CONVEYOR_SPEED
            conveyor_resumed = True

        log_entry = SystemLog(
            event_type="JAM_RESOLVED",
            description=(
                f"SỰ CỐ ĐÃ KHẮC PHỤC: Cổng #{gate_number} khôi phục từ '{prev_status}' về 'IDLE' "
                f"bởi {operator_name}. Nguyên nhân: {root_cause}. Thời gian khắc phục: {downtime}s. "
                f"Băng tải: {'Tiếp tục chạy' if conveyor_resumed else 'Vẫn tạm dừng do cổng khác còn lỗi'}."
            )
        )
        db.add(log_entry)
        db.commit()

        return {
            "status": "RESOLVED_SUCCESS",
            "gate_number": gate_number,
            "previous_status": prev_status,
            "new_status": "IDLE",
            "downtime_seconds": downtime,
            "conveyor_resumed": conveyor_resumed,
            "message": f"Sự cố kẹt tại Cổng #{gate_number} đã được giải quyết an toàn. MTTR downtime: {downtime}s.",
            "timestamp": now
        }

    def get_antijam_metrics(self, db: Session) -> Dict[str, Any]:
        """
        Thống kê chỉ số MTTR (Mean Time to Recovery) và lịch sử sự cố
        """
        resolved_incidents = [i for i in self.jam_incidents if i["downtime_seconds"] is not None]
        total_downtime = sum(i["downtime_seconds"] for i in resolved_incidents)
        mttr = round(total_downtime / len(resolved_incidents), 2) if resolved_incidents else 0.0

        jammed_gates = [
            g.gate_number for g in db.query(SortingGate).filter(SortingGate.status == "JAMMED").all()
        ]

        return {
            "total_jam_incidents": len(self.jam_incidents),
            "total_downtime_seconds": round(total_downtime, 2),
            "mttr_seconds": mttr,
            "active_jammed_gates": jammed_gates,
            "conveyor_interlocked": self.conveyor_interlocked,
            "summary": f"Tổng cộng {len(self.jam_incidents)} sự cố ghi nhận. Thời gian phục hồi trung bình (MTTR): {mttr} giây/lần."
        }


sorting_service = IoTSortingService()
