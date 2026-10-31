import time
from typing import Any, Dict, List, Optional

class SortingGateController:
    """
    Bộ điều khiển cơ cấu phân loại cổng IoT thông minh (LOG-114 & LOG-115).
    - Ánh xạ điểm đến theo mã bưu chính (Virtual Attribution).
    - Đồng bộ kích hoạt cần gạt góc 45 độ theo tọa độ vạch kích hoạt.
    - Cơ chế chống kẹt hàng (Anti-jam) tự động dừng khẩn cấp băng chuyền sau 3s.
    """
    def __init__(self):
        # 3 Cổng phân loại tương ứng 3 miền
        self.gates: Dict[int, Dict[str, Any]] = {
            1: {
                "id": 1,
                "name": "Cổng 1 (Miền Bắc)",
                "target_region": "Bắc",
                "zip_range": (10000, 39999),
                "trigger_x": 220.0,
                "chute_x": 240.0,
                "angle": 0.0,          # 0 độ: song song; 45 độ: mở gạt hàng
                "status": "IDLE",       # IDLE, DIVERTING, JAMMED
                "divert_start_time": 0.0,
                "diverted_count": 0
            },
            2: {
                "id": 2,
                "name": "Cổng 2 (Miền Trung)",
                "target_region": "Trung",
                "zip_range": (40000, 69999),
                "trigger_x": 360.0,
                "chute_x": 380.0,
                "angle": 0.0,
                "status": "IDLE",
                "divert_start_time": 0.0,
                "diverted_count": 0
            },
            3: {
                "id": 3,
                "name": "Cổng 3 (Miền Nam)",
                "target_region": "Nam",
                "zip_range": (70000, 99999),
                "trigger_x": 500.0,
                "chute_x": 520.0,
                "angle": 0.0,
                "status": "IDLE",
                "divert_start_time": 0.0,
                "diverted_count": 0
            }
        }
        self.jam_threshold_sec: float = 3.0
        self.is_emergency_stopped: bool = False
        self.last_jammed_gate_id: Optional[int] = None

    def route_by_zipcode(self, destination_code: str) -> Optional[int]:
        """
        Ánh xạ mã bưu chính sang Cổng phân loại đích (Virtual Attribution):
        - 10000 - 39999: Cổng 1 (Miền Bắc)
        - 40000 - 69999: Cổng 2 (Miền Trung)
        - 70000 - 99999: Cổng 3 (Miền Nam)
        - Mã không hợp lệ hoặc lỗi: None (Trôi về làn Re-check cuối băng tải)
        """
        # Hỗ trợ định dạng "VN-10000" hoặc "10000"
        clean_code = "".join(filter(str.isdigit, destination_code))
        if not clean_code or len(clean_code) < 5:
            return None

        zip_num = int(clean_code[:5])
        for gate_id, gate in self.gates.items():
            low, high = gate["zip_range"]
            if low <= zip_num <= high:
                return gate_id
        return None

    def update_gate_states(self, now: float = None) -> Dict[str, Any]:
        """
        Kiểm tra thời gian mở cổng và phát hiện ngoại lệ kẹt hàng (Anti-jam).
        Nếu cổng mở quá 3.0s mà chưa hoàn tất gạt: Bật cảnh báo Jam và dừng băng tải.
        """
        if now is None:
            now = time.time()

        jam_detected = False
        for gate_id, gate in self.gates.items():
            if gate["status"] == "DIVERTING":
                elapsed = now - gate["divert_start_time"]
                if elapsed > self.jam_threshold_sec:
                    gate["status"] = "JAMMED"
                    self.is_emergency_stopped = True
                    self.last_jammed_gate_id = gate_id
                    jam_detected = True
                elif elapsed > 1.2:  # Gạt thành công bình thường trong 1.2s
                    gate["angle"] = 0.0
                    gate["status"] = "IDLE"
                    gate["diverted_count"] += 1

        return {
            "emergency_stop": self.is_emergency_stopped,
            "jam_detected": jam_detected,
            "jammed_gate_id": self.last_jammed_gate_id
        }

    def trigger_gate(self, gate_id: int, now: float = None) -> bool:
        """Kích hoạt mở cần gạt cổng góc 45 độ"""
        if self.is_emergency_stopped or gate_id not in self.gates:
            return False

        if now is None:
            now = time.time()

        gate = self.gates[gate_id]
        gate["status"] = "DIVERTING"
        gate["angle"] = 45.0
        gate["divert_start_time"] = now
        return True

    def confirm_package_diverted(self, gate_id: int):
        """Cảm biến xác nhận bưu kiện đã rơi vào làn an toàn -> Thu cần gạt về 0 độ"""
        if gate_id in self.gates:
            gate = self.gates[gate_id]
            gate["angle"] = 0.0
            gate["status"] = "IDLE"
            gate["diverted_count"] += 1

    def simulate_jam(self, gate_id: int):
        """Kích hoạt giả lập kẹt bưu kiện phục vụ kiểm thử"""
        if gate_id in self.gates:
            gate = self.gates[gate_id]
            gate["status"] = "JAMMED"
            gate["angle"] = 45.0
            self.is_emergency_stopped = True
            self.last_jammed_gate_id = gate_id

    def clear_jam(self):
        """Xử lý giải phóng kẹt hàng và khôi phục hoạt động băng chuyền"""
        self.is_emergency_stopped = False
        self.last_jammed_gate_id = None
        for gate in self.gates.values():
            if gate["status"] == "JAMMED":
                gate["status"] = "IDLE"
                gate["angle"] = 0.0

    def get_gates_snapshot(self) -> List[Dict[str, Any]]:
        """Xuất danh sách trạng thái cổng phục vụ broadcast WebSocket"""
        result = []
        for g in self.gates.values():
            result.append({
                "id": g["id"],
                "name": g["name"],
                "target_region": g["target_region"],
                "status": g["status"],
                "diverter_angle": g["angle"],
                "diverted_count": g["diverted_count"]
            })
        return result

