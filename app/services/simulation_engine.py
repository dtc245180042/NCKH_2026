import time
import math
from typing import Any, Dict, List

class WarehouseSimulationEngine:
    """
    Động cơ mô phỏng vật lý kho bãi thời gian thực:
    - Băng chuyền chuyển động liên tục.
    - 3 Cổng phân loại IoT (Góc mở / Đèn tín hiệu).
    - Xe robot tự hành AMR di chuyển tuần tra theo tọa độ A*.
    - Tần số mô phỏng chuẩn 60 Hz.
    """
    def __init__(self):
        self.start_time = time.time()
        self.last_update = time.time()
        self.fps = 60.0

        # Danh sách kiện hàng trên băng chuyền
        self.packages: List[Dict[str, Any]] = [
            {"id": 101, "x": 80.0, "y": 155.0, "barcode": "PKG-84001", "conf": 0.98, "gate": 1, "status": "On_Belt"},
            {"id": 102, "x": 280.0, "y": 155.0, "barcode": "PKG-84002", "conf": 0.94, "gate": 2, "status": "On_Belt"},
            {"id": 103, "x": 460.0, "y": 155.0, "barcode": "PKG-84003", "conf": 0.96, "gate": 3, "status": "On_Belt"}
        ]
        self.next_pkg_id = 104

        # Trạng thái 3 Cổng phân loại IoT
        self.gates: List[Dict[str, Any]] = [
            {"id": 1, "name": "Cổng 1 (Bắc)", "status": "ACTIVE", "diverter_angle": 45.0, "target_province": "Hà Nội"},
            {"id": 2, "name": "Cổng 2 (Trung)", "status": "IDLE", "diverter_angle": 0.0, "target_province": "Đà Nẵng"},
            {"id": 3, "name": "Cổng 3 (Nam)", "status": "IDLE", "diverter_angle": 0.0, "target_province": "TP. HCM"}
        ]

        # Trạng thái Xe tự hành AMR
        self.amr: Dict[str, Any] = {
            "id": "AMR-01",
            "x": 520.0,
            "y": 340.0,
            "target_x": 720.0,
            "target_y": 170.0,
            "state": "NAVIGATING",
            "speed": 1.2,
            "battery": 96.5
        }

    def update_physics(self, dt: float = 1.0 / 60.0):
        """Cập nhật tọa độ vật lý cho 1 tick (frame)"""
        now = time.time()
        actual_dt = now - self.last_update
        if actual_dt > 0:
            self.fps = round(1.0 / actual_dt, 1)
        self.last_update = now

        # 1. Cập nhật bưu kiện trên băng chuyền
        conveyor_speed = 60.0 * dt  # pixel mỗi giây
        for pkg in self.packages:
            pkg["x"] += conveyor_speed
            # Khi chạm cuối băng tải (x > 560), quay lại đầu băng tải
            if pkg["x"] > 560.0:
                pkg["x"] = 42.0

        # 2. Cập nhật chuyển động xe AMR về đích
        dx = self.amr["target_x"] - self.amr["x"]
        dy = self.amr["target_y"] - self.amr["y"]
        dist = math.hypot(dx, dy)

        if dist < 5.0:
            # Đổi lộ trình tuần tra (Waypoints)
            if self.amr["target_x"] == 720.0:
                self.amr["target_x"] = 520.0
                self.amr["target_y"] = 340.0
            else:
                self.amr["target_x"] = 720.0
                self.amr["target_y"] = 170.0
        else:
            self.amr["x"] += (dx / dist) * 45.0 * dt
            self.amr["y"] += (dy / dist) * 45.0 * dt

    def spawn_package(self, barcode: str = None) -> Dict[str, Any]:
        """Tạo một kiện hàng mới trên đầu băng chuyền"""
        pkg_id = self.next_pkg_id
        self.next_pkg_id += 1
        if not barcode:
            barcode = f"PKG-WS-{pkg_id}"

        new_pkg = {
            "id": pkg_id,
            "x": 42.0,
            "y": 155.0,
            "barcode": barcode,
            "conf": 0.97,
            "gate": (pkg_id % 3) + 1,
            "status": "On_Belt"
        }
        self.packages.append(new_pkg)
        return new_pkg

    def set_gate_status(self, gate_id: int, status: str, angle: float = 0.0):
        for g in self.gates:
            if g["id"] == gate_id:
                g["status"] = status
                g["diverter_angle"] = angle
                break

    def get_state_snapshot(self) -> Dict[str, Any]:
        """Trả về snapshot gọn nhẹ phục vụ broadcast qua WebSocket"""
        return {
            "timestamp": round(time.time(), 3),
            "fps": min(self.fps, 60.0),
            "packages": self.packages,
            "gates": self.gates,
            "amr": self.amr
        }

# Singleton Instance
warehouse_simulation = WarehouseSimulationEngine()
