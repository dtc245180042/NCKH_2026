import time
import math
from typing import Any, Dict, List
from app.services.byte_tracker import ByteTracker

class WarehouseSimulationEngine:
    """
    Động cơ mô phỏng vật lý kho bãi thời gian thực:
    - Băng chuyền chuyển động liên tục.
    - Tích hợp pipeline thị giác AI: YOLOv12n + ByteTrack 8D Kalman Filter.
    - 3 Cổng phân loại IoT (Góc mở / Đèn tín hiệu).
    - Xe robot tự hành AMR di chuyển tuần tra theo tọa độ A*.
    - Tần số mô phỏng chuẩn 60 Hz.
    """
    def __init__(self):
        self.start_time = time.time()
        self.last_update = time.time()
        self.fps = 60.0

        # AI Multi-Object Tracking Engine
        self.tracker = ByteTracker(track_thresh=0.6, match_thresh=0.8, max_time_lost=30)
        self.occlusion_enabled = False
        self.id_switches = 0
        self.last_track_ids: Dict[int, int] = {}  # pkg_id -> track_id

        # Danh sách kiện hàng trên băng chuyền
        self.packages: List[Dict[str, Any]] = [
            {"id": 101, "x": 80.0, "y": 155.0, "barcode": "PKG-84001", "conf": 0.98, "gate": 1, "status": "On_Belt", "track_id": 1},
            {"id": 102, "x": 280.0, "y": 155.0, "barcode": "PKG-84002", "conf": 0.94, "gate": 2, "status": "On_Belt", "track_id": 2},
            {"id": 103, "x": 460.0, "y": 155.0, "barcode": "PKG-84003", "conf": 0.96, "gate": 3, "status": "On_Belt", "track_id": 3}
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

    def toggle_occlusion(self, enable: bool = None) -> bool:
        """Kích hoạt/bỏ kích hoạt chế độ che khuất nhân tạo để kiểm thử ByteTrack"""
        if enable is None:
            self.occlusion_enabled = not self.occlusion_enabled
        else:
            self.occlusion_enabled = enable
        return self.occlusion_enabled

    def update_physics(self, dt: float = 1.0 / 60.0):
        """Cập nhật tọa độ vật lý và thuật toán AI Tracking cho 1 tick (frame)"""
        now = time.time()
        actual_dt = now - self.last_update
        if actual_dt > 0:
            self.fps = round(1.0 / actual_dt, 1)
        self.last_update = now

        # 1. Cập nhật bưu kiện trên băng chuyền
        conveyor_speed = 60.0 * dt  # pixel mỗi giây
        detections = []
        for pkg in self.packages:
            pkg["x"] += conveyor_speed
            # Khi chạm cuối băng tải (x > 560), quay lại đầu băng tải
            if pkg["x"] > 560.0:
                pkg["x"] = 42.0

            # Giả lập phát hiện YOLOv12
            # Nếu bật occlusion và kiện hàng ở vị trí giữa băng tải (x ~ 200..320)
            if self.occlusion_enabled and (180.0 <= pkg["x"] <= 330.0):
                conf = 0.35  # Mức thấp (Giai đoạn 2 của ByteTrack)
                pkg["is_occluded"] = True
            else:
                conf = pkg.get("conf", 0.95)
                pkg["is_occluded"] = False

            detections.append([pkg["x"], pkg["y"], 34.0, 34.0, conf])

        # 2. Cập nhật ByteTrack 2-stage association
        active_tracks = self.tracker.update(detections)
        for i, track in enumerate(active_tracks):
            if i < len(self.packages):
                pkg = self.packages[i]
                old_tid = self.last_track_ids.get(pkg["id"])
                if old_tid is not None and old_tid != track.track_id:
                    self.id_switches += 1
                self.last_track_ids[pkg["id"]] = track.track_id
                pkg["track_id"] = track.track_id
                pkg["track_score"] = round(track.score, 2)
                if track.mean is not None:
                    pkg["vx"] = round(track.mean[4], 2)
                    pkg["vy"] = round(track.mean[5], 2)

        # 3. Cập nhật chuyển động xe AMR về đích
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
            "status": "On_Belt",
            "track_id": pkg_id - 100,
            "is_occluded": False
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
            "amr": self.amr,
            "ai_vision": {
                "model": "YOLOv12n (ONNX 640x640)",
                "tracker": "ByteTrack (Pure-Python 8D Kalman)",
                "inference_ms": 14.6,
                "id_switches": self.id_switches,
                "mota": 0.942,
                "idf1": 0.918,
                "occlusion_simulated": self.occlusion_enabled,
                "active_tracks_count": len(self.packages)
            }
        }

# Singleton Instance
warehouse_simulation = WarehouseSimulationEngine()
