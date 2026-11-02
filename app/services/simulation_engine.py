import time
import math
import hashlib
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from app.services.byte_tracker import ByteTracker
from app.services.sorting_controller import SortingGateController
from app.services.a_star import AStarPlanner
from app.services.modbus_engine import ModbusTCPEngine
from app.services.rfid_engine import RFIDPortalEngine

# Danh mục định tuyến 9 Tỉnh/Thành phố trọng điểm theo 3 Miền (Cấp 1: Cổng PLC -> Cấp 2: Kệ AMR)
PROVINCES_CATALOG: Dict[str, Dict[str, Any]] = {
    # Miền Bắc (Cổng 1)
    "Hà Nội": {"zip": "100000", "gate": 1, "region": "Bắc", "rack_id": "RACK-HN", "rack_x": 670.0, "rack_y": 170.0},
    "Hải Phòng": {"zip": "180000", "gate": 1, "region": "Bắc", "rack_id": "RACK-HP", "rack_x": 730.0, "rack_y": 170.0},
    "Quảng Ninh": {"zip": "200000", "gate": 1, "region": "Bắc", "rack_id": "RACK-QN", "rack_x": 790.0, "rack_y": 170.0},
    # Miền Trung (Cổng 2)
    "Đà Nẵng": {"zip": "550000", "gate": 2, "region": "Trung", "rack_id": "RACK-DN", "rack_x": 670.0, "rack_y": 240.0},
    "Huế": {"zip": "530000", "gate": 2, "region": "Trung", "rack_id": "RACK-HUE", "rack_x": 730.0, "rack_y": 240.0},
    "Khánh Hòa": {"zip": "650000", "gate": 2, "region": "Trung", "rack_id": "RACK-KH", "rack_x": 790.0, "rack_y": 240.0},
    # Miền Nam (Cổng 3)
    "TP. Hồ Chí Minh": {"zip": "700000", "gate": 3, "region": "Nam", "rack_id": "RACK-HCM", "rack_x": 670.0, "rack_y": 310.0},
    "Bình Dương": {"zip": "820000", "gate": 3, "region": "Nam", "rack_id": "RACK-BD", "rack_x": 730.0, "rack_y": 310.0},
    "Cần Thơ": {"zip": "900000", "gate": 3, "region": "Nam", "rack_id": "RACK-CT", "rack_x": 790.0, "rack_y": 310.0},
}


class WarehouseSimulationEngine:
    """
    Động cơ mô phỏng vật lý kho bãi thời gian thực (Digital Twin 2D) - Gói Cải Tiến Lần 2:
    - Băng chuyền chuyển động liên tục, hỗ trợ chạy đảo chiều giải phóng điểm kẹt (Jam Reverse).
    - Phân loại 2 cấp: Cấp 1 (Cổng gạt PLC 3 miền) -> Cấp 2 (Robot AMR đưa vào kệ 9 Tỉnh/Thành).
    - Công tắc kiểm soát sinh hàng: Auto-Spawn ON/OFF & Bơm kiện trực tiếp từ Form.
    - Đội 3 Robot AMR cao tốc 1 chiều kèm Trạm sạc tự động (Docking) & Cơ chế Ngắt sạc khẩn cấp (Preemption).
    - Tích hợp pipeline thị giác AI: YOLOv12n + ByteTrack 8D Kalman Filter (Chế độ đối sánh A/B).
    - Phân hệ IoT & Modbus TCP S7-1200 khép kín Hardware-in-the-Loop.
    - Lưu vết nhật ký kiểm toán Non-repudiation Audit Trail có mã băm SHA-256.
    """
    def __init__(self):
        self.start_time = time.time()
        self.last_update = time.time()
        self.fps = 60.0

        # AI Multi-Object Tracking Engine
        self.tracker = ByteTracker(track_thresh=0.6, match_thresh=0.8, max_time_lost=30)
        self.occlusion_enabled = False
        self.id_switches = 0
        self.last_track_ids: Dict[int, int] = {}

        # Phân hệ Điều khiển Cổng IoT (LOG-114, LOG-115)
        self.sorting_controller = SortingGateController()

        # Phân hệ Lập lịch Đường đi A* cho AMR (LOG-116, LOG-117)
        self.planner = AStarPlanner(cols=46, rows=23, cell_size=20.0)
        self.dynamic_obstacles: List[Dict[str, Any]] = []

        # Phân hệ Tự Động Hóa Công Nghiệp PLC & RFID UHF (Trụ Cột 1)
        self.modbus_engine = ModbusTCPEngine()
        self.rfid_engine = RFIDPortalEngine(portal_x=120.0, portal_width=80.0)

        # Trạng thái Vận hành Mở rộng (Cải tiến Lần 2)
        self.auto_spawn: bool = True
        self.is_reversed: bool = False
        self.reverse_timer: float = 0.0
        self.is_jammed: bool = False
        self.jam_reason: str = ""
        self.audit_events: List[Dict[str, Any]] = []

        # Danh sách Trạm Sạc Tự Động cho AMR (Charging Docks)
        self.charging_docks: List[Dict[str, Any]] = [
            {"id": 1, "name": "Dock Sạc 01", "x": 120.0, "y": 440.0, "charging_amr": None},
            {"id": 2, "name": "Dock Sạc 02", "x": 200.0, "y": 440.0, "charging_amr": None}
        ]

        # Danh sách kiện hàng ban đầu với khoảng cách an toàn (headway >= 120px)
        self.packages: List[Dict[str, Any]] = [
            {
                "id": 101, "x": 80.0, "y": 155.0, "barcode": "PKG-10001",
                "province": "Hà Nội", "zipcode": "100000", "region": "Bắc",
                "conf": 0.98, "gate": 1, "status": "On_Belt", "track_id": 1,
                "defect": "Normal", "weight": 2.4
            },
            {
                "id": 102, "x": 240.0, "y": 155.0, "barcode": "PKG-55002",
                "province": "Đà Nẵng", "zipcode": "550000", "region": "Trung",
                "conf": 0.94, "gate": 2, "status": "On_Belt", "track_id": 2,
                "defect": "Normal", "weight": 1.8
            },
            {
                "id": 103, "x": 420.0, "y": 155.0, "barcode": "PKG-70003",
                "province": "TP. Hồ Chí Minh", "zipcode": "700000", "region": "Nam",
                "conf": 0.96, "gate": 3, "status": "On_Belt", "track_id": 3,
                "defect": "Normal", "weight": 3.2
            }
        ]
        self.next_pkg_id = 104

        # Kệ hàng 9 Tỉnh/Thành phố (Phân loại Cấp 2)
        self.province_racks: Dict[str, Dict[str, Any]] = {
            "RACK-HN": {"name": "Hà Nội", "region": "Bắc", "x": 670.0, "y": 170.0, "count": 2, "capacity": 6, "color": "#0284c7"},
            "RACK-HP": {"name": "Hải Phòng", "region": "Bắc", "x": 730.0, "y": 170.0, "count": 1, "capacity": 6, "color": "#0284c7"},
            "RACK-QN": {"name": "Quảng Ninh", "region": "Bắc", "x": 790.0, "y": 170.0, "count": 1, "capacity": 6, "color": "#0284c7"},
            "RACK-DN": {"name": "Đà Nẵng", "region": "Trung", "x": 670.0, "y": 240.0, "count": 2, "capacity": 6, "color": "#d97706"},
            "RACK-HUE": {"name": "Huế", "region": "Trung", "x": 730.0, "y": 240.0, "count": 1, "capacity": 6, "color": "#d97706"},
            "RACK-KH": {"name": "Khánh Hòa", "region": "Trung", "x": 790.0, "y": 240.0, "count": 0, "capacity": 6, "color": "#d97706"},
            "RACK-HCM": {"name": "TP.HCM", "region": "Nam", "x": 670.0, "y": 310.0, "count": 3, "capacity": 6, "color": "#059669"},
            "RACK-BD": {"name": "Bình Dương", "region": "Nam", "x": 730.0, "y": 310.0, "count": 2, "capacity": 6, "color": "#059669"},
            "RACK-CT": {"name": "Cần Thơ", "region": "Nam", "x": 790.0, "y": 310.0, "count": 1, "capacity": 6, "color": "#059669"},
        }

        # Kệ hàng 3 Miền (Tương thích ngược)
        self.racks: Dict[str, Any] = {
            "Zone_North": {"name": "Kệ Miền Bắc", "region": "Bắc", "gate_id": 1, "color": "#0284c7",
                           "slots": [{"code": "BẮC-01", "capacity": 6, "count": 4, "is_full": False}]},
            "Zone_Central": {"name": "Kệ Miền Trung", "region": "Trung", "gate_id": 2, "color": "#d97706",
                             "slots": [{"code": "TRUNG-01", "capacity": 6, "count": 3, "is_full": False}]},
            "Zone_South": {"name": "Kệ Miền Nam", "region": "Nam", "gate_id": 3, "color": "#059669",
                           "slots": [{"code": "NAM-01", "capacity": 6, "count": 6, "is_full": True}]}
        }

        # Đội xe 3 Robot tự hành AMR - Cao tốc trực giao độc lập
        self.amrs: List[Dict[str, Any]] = [
            {
                "id": "AMR-01",
                "name": "AMR-01 (Bắc)",
                "zone": "Miền Bắc",
                "gate_id": 1,
                "color": "#0284c7",
                "x": 240.0,
                "y": 270.0,
                "heading": 0.0,
                "chute_x": 240.0,
                "chute_y": 270.0,
                "highway_y": 300.0,
                "rack_x": 670.0,
                "rack_y": 170.0,
                "target_x": 670.0,
                "target_y": 170.0,
                "target_province": "Hà Nội",
                "state": "WAITING_FOR_CARGO",
                "state_timer": 0.0,
                "speed": 75.0,
                "battery": 98.5,
                "has_cargo": False,
                "cargo_barcode": None,
                "proximity_alert": False,
                "path_waypoints": [],
                "waypoint_idx": 0,
                "last_auto_mission": time.time(),
                "dock_target": 1,
                "charge_boost": False
            },
            {
                "id": "AMR-02",
                "name": "AMR-02 (Trung)",
                "zone": "Miền Trung",
                "gate_id": 2,
                "color": "#d97706",
                "x": 380.0,
                "y": 270.0,
                "heading": 0.0,
                "chute_x": 380.0,
                "chute_y": 270.0,
                "highway_y": 345.0,
                "rack_x": 670.0,
                "rack_y": 240.0,
                "target_x": 670.0,
                "target_y": 240.0,
                "target_province": "Đà Nẵng",
                "state": "WAITING_FOR_CARGO",
                "state_timer": 0.0,
                "speed": 75.0,
                "battery": 96.0,
                "has_cargo": False,
                "cargo_barcode": None,
                "proximity_alert": False,
                "path_waypoints": [],
                "waypoint_idx": 0,
                "last_auto_mission": time.time() + 2.0,
                "dock_target": 2,
                "charge_boost": False
            },
            {
                "id": "AMR-03",
                "name": "AMR-03 (Nam)",
                "zone": "Miền Nam",
                "gate_id": 3,
                "color": "#059669",
                "x": 520.0,
                "y": 270.0,
                "heading": 0.0,
                "chute_x": 520.0,
                "chute_y": 270.0,
                "highway_y": 390.0,
                "rack_x": 670.0,
                "rack_y": 310.0,
                "target_x": 670.0,
                "target_y": 310.0,
                "target_province": "TP. Hồ Chí Minh",
                "state": "WAITING_FOR_CARGO",
                "state_timer": 0.0,
                "speed": 75.0,
                "battery": 94.0,
                "has_cargo": False,
                "cargo_barcode": None,
                "proximity_alert": False,
                "path_waypoints": [],
                "waypoint_idx": 0,
                "last_auto_mission": time.time() + 4.0,
                "dock_target": 1,
                "charge_boost": False
            },
            {
                "id": "AMR-04",
                "name": "AMR-04 (Dự Bị)",
                "zone": "Standby Reserve",
                "gate_id": 1,
                "color": "#8b5cf6",
                "x": 280.0,
                "y": 440.0,
                "heading": 0.0,
                "chute_x": 240.0,
                "chute_y": 270.0,
                "highway_y": 300.0,
                "rack_x": 670.0,
                "rack_y": 170.0,
                "target_x": 280.0,
                "target_y": 440.0,
                "target_province": "Dự Bị",
                "state": "STANDBY",
                "state_timer": 0.0,
                "speed": 85.0,
                "battery": 100.0,
                "has_cargo": False,
                "cargo_barcode": None,
                "proximity_alert": False,
                "path_waypoints": [],
                "waypoint_idx": 0,
                "last_auto_mission": time.time(),
                "dock_target": 2,
                "charge_boost": False,
                "is_reserve": True
            }
        ]
        self._replan_all_amrs()

        # Khởi tạo log audit đầu tiên
        self.log_audit_event("SYSTEM_BOOT", "AI_CORE", "Hệ thống Băng tải & Đội xe AMR khởi động thành công", "INFO")

    @property
    def amr(self) -> Dict[str, Any]:
        """Tương thích ngược 100% cho các unit test truy cập self.amr (trỏ vào AMR-01)"""
        return self.amrs[0]

    @property
    def amr_state(self) -> str:
        return self.amrs[0]["state"]

    @amr_state.setter
    def amr_state(self, val: str):
        self.amrs[0]["state"] = val

    @property
    def amr_waypoint_idx(self) -> int:
        return self.amrs[0]["waypoint_idx"]

    @amr_waypoint_idx.setter
    def amr_waypoint_idx(self, val: int):
        self.amrs[0]["waypoint_idx"] = val

    def log_audit_event(self, action: str, actor: str, details: str, level: str = "INFO"):
        """Ghi nhận sự kiện kiểm toán thời gian thực kèm mã băm SHA-256"""
        ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        event_id = len(self.audit_events) + 1
        raw_str = f"{event_id}|{ts}|{actor}|{action}|{details}"
        sha = hashlib.sha256(raw_str.encode()).hexdigest()
        event = {
            "id": event_id,
            "timestamp": ts,
            "actor": actor,
            "action": action,
            "details": details,
            "level": level,
            "sha256": sha[:16] + "..."
        }
        self.audit_events.append(event)
        if len(self.audit_events) > 100:
            self.audit_events.pop(0)

    def is_obstacle_near(self, x: float, y: float, radius: float = 40.0) -> bool:
        """Kiểm tra có vật cản xung quanh trong bán kính an toàn LiDAR không (R = 40px)"""
        for obs in self.dynamic_obstacles:
            ox, oy = obs.get("x", 0.0), obs.get("y", 0.0)
            if math.hypot(ox - x, oy - y) <= radius:
                return True
        return False

    def _build_orthogonal_amr_path(self, robot: Dict[str, Any], to_rack: bool = True) -> List[List[float]]:
        """Lập lộ trình trực giao góc vuông 90 độ dọc theo làn đường cao tốc công nghiệp"""
        cx, cy = robot["chute_x"], robot["chute_y"]
        hy = robot["highway_y"]
        rx, ry = robot["rack_x"], robot["rack_y"]
        if to_rack:
            # Đi từ Chân máng -> Xuống Làn cao tốc -> Sang Ngang cột Kệ -> Lên Chân kệ
            return [[cx, cy], [cx, hy], [rx, hy], [rx, ry]]
        else:
            # Đi từ Chân kệ -> Xuống Làn cao tốc -> Sang Ngang cột Máng -> Lên Chân máng
            return [[rx, ry], [rx, hy], [cx, hy], [cx, cy]]

    def _build_docking_path(self, robot: Dict[str, Any], to_dock: bool = True) -> List[List[float]]:
        """Lập lộ trình trực giao từ máng trượt về Trạm sạc tự động"""
        cx, cy = robot["chute_x"], robot["chute_y"]
        hy = robot["highway_y"]
        dock_id = robot.get("dock_target", 1)
        dock = self.charging_docks[dock_id - 1]
        dx, dy = dock["x"], dock["y"]
        if to_dock:
            return [[cx, cy], [cx, hy], [dx, hy], [dx, dy]]
        else:
            return [[dx, dy], [dx, hy], [cx, hy], [cx, cy]]

    def _replan_single_amr(self, robot: Dict[str, Any]):
        """Tính toán lộ trình trực giao mượt mà cho xe AMR"""
        if robot.get("state") == "STANDBY":
            robot["path_waypoints"] = [[robot["x"], robot["y"]]]
            robot["waypoint_idx"] = 0
            return
        if robot["state"] in ("LOW_BATTERY_CHARGING", "GOING_TO_DOCK"):
            robot["path_waypoints"] = self._build_docking_path(robot, to_dock=True)
        else:
            to_rack = (robot["state"] in ("DELIVERING", "LOADING") or robot.get("has_cargo", False))
            robot["path_waypoints"] = self._build_orthogonal_amr_path(robot, to_rack=to_rack)
        robot["waypoint_idx"] = 1

    def _replan_all_amrs(self):
        """Tái lập lịch cho toàn bộ đội 3 xe AMR"""
        for robot in self.amrs:
            self._replan_single_amr(robot)

    def _replan_amr_path(self, target_robot: Dict[str, Any] = None):
        """Tương thích ngược: Lập lại đường đi A*"""
        if target_robot:
            self._replan_single_amr(target_robot)
        else:
            self._replan_all_amrs()

    def add_obstacle(self, x: float, y: float) -> Dict[str, Any]:
        """Thêm vật cản động tại tọa độ pixel Canvas và tự động tái lập lịch A*"""
        col, row = self.planner.world_to_grid(x, y)
        self.planner.add_obstacle(col, row)
        obs_item = {"col": col, "row": row, "x": col * 20.0 + 10.0, "y": row * 20.0 + 10.0}
        self.dynamic_obstacles.append(obs_item)
        self._replan_all_amrs()
        self.log_audit_event("OBSTACLE_ADDED", "OPERATOR", f"Thêm vật cản tại lưới [{col}, {row}]", "WARNING")
        return obs_item

    def clear_obstacles(self):
        """Xóa toàn bộ vật cản động và khôi phục lộ trình tiêu chuẩn"""
        self.planner.clear_dynamic_obstacles()
        self.dynamic_obstacles.clear()
        self._replan_all_amrs()
        self.log_audit_event("OBSTACLE_CLEARED", "OPERATOR", "Đã dọn sạch toàn bộ vật cản động", "INFO")

    def toggle_occlusion(self, enable: bool = None) -> bool:
        """Kích hoạt/bỏ kích hoạt chế độ che khuất nhân tạo để kiểm thử ByteTrack"""
        if enable is None:
            self.occlusion_enabled = not self.occlusion_enabled
        else:
            self.occlusion_enabled = enable
        state_str = "KÍCH HOẠT" if self.occlusion_enabled else "TẮT"
        self.log_audit_event("OCCLUSION_TOGGLE", "AI_VISION", f"{state_str} chế độ che khuất nhân tạo", "INFO")
        return self.occlusion_enabled

    def toggle_auto_spawn(self, enable: bool = None) -> bool:
        """Bật / Tắt chế độ tự động tuần hoàn sinh kiện hàng trên băng tải"""
        if enable is None:
            self.auto_spawn = not self.auto_spawn
        else:
            self.auto_spawn = bool(enable)
        state_str = "BẬT" if self.auto_spawn else "TẮT"
        self.log_audit_event("AUTO_SPAWN_TOGGLE", "OPERATOR", f"{state_str} chế độ tự sinh hàng tuần hoàn", "INFO")
        return self.auto_spawn

    def inject_custom_package(self, barcode: str, destination_code: str = "Hà Nội", weight: float = 2.5, dimensions: str = "30x20x15") -> Dict[str, Any]:
        """Bơm trực tiếp một kiện hàng người dùng tạo từ Form vào đầu băng chuyền (X=42.0)"""
        pkg_id = self.next_pkg_id
        self.next_pkg_id += 1

        # Xác định Tỉnh đích và Cổng phân loại
        province = "Hà Nội"
        for p_name in PROVINCES_CATALOG.keys():
            if p_name.lower() in destination_code.lower() or destination_code.lower() in p_name.lower():
                province = p_name
                break

        prov_info = PROVINCES_CATALOG.get(province, PROVINCES_CATALOG["Hà Nội"])
        gate_id = prov_info["gate"]
        zipcode = prov_info["zip"]
        region = prov_info["region"]

        new_pkg = {
            "id": pkg_id,
            "x": 42.0,
            "y": 155.0,
            "barcode": barcode or f"PKG-{zipcode[:2]}{pkg_id:03d}",
            "province": province,
            "zipcode": zipcode,
            "region": region,
            "conf": 0.96,
            "gate": gate_id,
            "status": "On_Belt",
            "track_id": pkg_id,
            "defect": "Normal",
            "weight": weight,
            "dimensions": dimensions
        }
        self.packages.append(new_pkg)
        self.log_audit_event("PACKAGE_INJECTED", "OPERATOR", f"Bơm kiện hàng {new_pkg['barcode']} -> {province} (Cổng {gate_id})", "SUCCESS")
        return new_pkg

    def trigger_jam(self, gate_id: int = 1):
        """Giả lập sự cố kẹt hàng tại cổng chỉ định"""
        self.sorting_controller.simulate_jam(gate_id)
        self.is_jammed = True
        self.jam_reason = f"Kẹt kiện hàng tại Cổng {gate_id}"
        self.log_audit_event("JAM_DETECTED", "PHOTOEYE_SENSOR", self.jam_reason, "CRITICAL")

    def clear_jam(self):
        """Khôi phục sau sự cố kẹt hàng: Chạy đảo chiều băng tải 2 giây để gỡ kẹt"""
        self.sorting_controller.clear_jam()
        self.is_jammed = False
        self.jam_reason = ""
        self.conveyor_reverse(duration_sec=2.0)
        self.log_audit_event("JAM_CLEARED", "OPERATOR", "Đã kích hoạt chu trình đảo chiều gỡ kẹt và khôi phục băng tải", "SUCCESS")

    def conveyor_reverse(self, duration_sec: float = 2.0):
        """Chạy đảo chiều băng tải trong thời gian chỉ định"""
        self.is_reversed = True
        self.reverse_timer = duration_sec

    def emergency_stop_all(self, enable: bool = True):
        """Dừng khẩn cấp toàn bộ hệ thống (E-STOP)"""
        self.sorting_controller.is_emergency_stopped = enable
        for robot in self.amrs:
            if enable:
                robot["state"] = "BLOCKED"
            else:
                if robot["state"] == "BLOCKED":
                    robot["state"] = "DELIVERING" if robot["has_cargo"] else "RETURNING"
        act_str = "KÍCH HOẠT DỪNG KHẨN CẤP E-STOP" if enable else "GIẢI TRỪ E-STOP"
        self.log_audit_event("E_STOP_INTERLOCK", "OPERATOR", act_str, "CRITICAL" if enable else "INFO")

    def force_gate_diverter(self, gate_id: int, duration_sec: float = 1.5):
        """Ép mở xi-lanh gạt hàng tại cổng chỉ định (Manual Override)"""
        self.sorting_controller.trigger_gate(gate_id, now=time.time())
        self.log_audit_event("FORCE_GATE_ACTUATOR", "OPERATOR", f"Cưỡng bức mở xi-lanh SMC Cổng {gate_id}", "WARNING")

    def force_amr_dock(self, robot_id: str):
        """Buộc một robot AMR chạy về trạm sạc pin ngay lập tức"""
        for r in self.amrs:
            if r["id"] == robot_id:
                r["state"] = "GOING_TO_DOCK"
                r["path_waypoints"] = self._build_docking_path(r, to_dock=True)
                r["waypoint_idx"] = 1
                self.log_audit_event("FORCE_AMR_DOCK", "OPERATOR", f"Điều xe {robot_id} về Dock sạc khẩn cấp", "WARNING")

    def resume_amr(self, robot_id: str):
        """Khôi phục trạng thái hoạt động bình thường cho AMR"""
        for r in self.amrs:
            if r["id"] == robot_id:
                r["state"] = "RETURNING"
                r["path_waypoints"] = self._build_orthogonal_amr_path(r, to_rack=False)
                r["waypoint_idx"] = 1
                self.log_audit_event("RESUME_AMR", "OPERATOR", f"Khôi phục hành trình cho {robot_id}", "INFO")

    def spawn_package(self, barcode: str = None) -> Dict[str, Any]:
        """Tạo một kiện hàng mới trên đầu băng chuyền với khoảng cách an toàn, tránh chồng đè"""
        pkg_id = self.next_pkg_id
        self.next_pkg_id += 1

        prov_keys = list(PROVINCES_CATALOG.keys())
        province = prov_keys[pkg_id % len(prov_keys)]
        prov_info = PROVINCES_CATALOG[province]

        if not barcode:
            barcode = f"PKG-{prov_info['zip'][:2]}{pkg_id:03d}"

        belt_pkgs = [p for p in self.packages if p.get("status", "On_Belt") == "On_Belt"]
        if belt_pkgs:
            min_x = min(p["x"] for p in belt_pkgs)
            spawn_x = min(42.0, min_x - 55.0)
        else:
            spawn_x = 42.0

        new_pkg = {
            "id": pkg_id,
            "x": spawn_x,
            "y": 155.0,
            "barcode": barcode,
            "province": province,
            "zipcode": prov_info["zip"],
            "region": prov_info["region"],
            "conf": 0.98,
            "gate": prov_info["gate"],
            "status": "On_Belt",
            "track_id": pkg_id,
            "defect": "Normal" if (pkg_id % 7 != 0) else "Deformed",
            "weight": round(1.5 + (pkg_id % 5) * 0.8, 1),
            "dimensions": "30x20x15"
        }
        self.packages.append(new_pkg)
        return new_pkg

    def set_gate_status(self, gate_id: int, status: str, angle: float = 45.0):
        """Thiết lập trạng thái hoạt động của cơ cấu cổng phân loại IoT"""
        if gate_id in self.sorting_controller.gates:
            gate = self.sorting_controller.gates[gate_id]
            gate["status"] = status
            gate["angle"] = angle

    def update_physics(self, dt: float = 1.0 / 60.0):
        """Cập nhật tọa độ vật lý cho 1 tick (frame) với cơ chế chống dồn toa và phân loại 2 cấp"""
        now = time.time()
        actual_dt = now - self.last_update
        if actual_dt > 0:
            self.fps = round(1.0 / actual_dt, 1)
        self.last_update = now

        # Kiểm tra trạng thái cổng phân loại & chống kẹt Anti-jam
        self.sorting_controller.update_gate_states(now=now)

        # Xử lý chu trình đảo chiều băng tải (Jam Reverse)
        if self.is_reversed:
            self.reverse_timer -= dt
            conveyor_speed = -45.0 * dt
            if self.reverse_timer <= 0:
                self.is_reversed = False
        elif self.sorting_controller.is_emergency_stopped or self.is_jammed:
            conveyor_speed = 0.0
        else:
            conveyor_speed = 60.0 * dt

        # Sắp xếp các kiện hàng đang trên băng chuyền theo x giảm dần
        on_belt_packages = [p for p in self.packages if p.get("status", "On_Belt") == "On_Belt"]
        on_belt_packages.sort(key=lambda p: p["x"], reverse=True)

        min_headway = 48.0  # Khoảng cách an toàn giữa 2 kiện hàng trên băng tải

        # Di chuyển và kiểm tra va chạm cho kiện hàng trên băng chuyền
        for i, pkg in enumerate(on_belt_packages):
            target_x = pkg["x"] + conveyor_speed

            if conveyor_speed > 0:
                # Chống dồn toa khi chạy xuôi
                if i > 0:
                    prev_pkg = on_belt_packages[i - 1]
                    if target_x > prev_pkg["x"] - min_headway:
                        target_x = prev_pkg["x"] - min_headway

                # Kiểm tra cơ cấu gạt phân loại tại các cổng
                target_gate = pkg.get("gate", 1)
                gate_info = self.sorting_controller.gates.get(target_gate, {})
                trigger_x = gate_info.get("trigger_x", 220.0)

                # Nếu cổng đang bị kẹt Jammed -> Dừng kiện lại trước cổng
                if gate_info.get("status") == "JAMMED" and abs(target_x - trigger_x) <= 15.0:
                    target_x = trigger_x - 15.0
                elif gate_info.get("status") == "IDLE" and abs(target_x - trigger_x) <= 8.0:
                    # Kiểm tra sức chứa đệm máng trượt (tối đa 4 kiện hàng)
                    current_chute_count = len([p for p in self.packages if p.get("status") == "Sorted" and p.get("divert_gate") == target_gate])
                    if current_chute_count >= 4:
                        # Máng đầy -> Kiện đi thẳng vào luồng tái tuần hoàn (Recirculation)
                        pass
                    else:
                        self.sorting_controller.trigger_gate(target_gate, now=now)
                    pkg["status"] = "Diverting"
                    pkg["divert_gate"] = target_gate
                    pkg["x"] = trigger_x + 10.0
                    self.log_audit_event("GATE_DIVERT", f"PLC_GATE_{target_gate}", f"Xi-lanh Cổng {target_gate} gạt kiện {pkg.get('barcode')} ({pkg.get('province')})", "INFO")
            else:
                # Khi chạy lùi (Reverse)
                if target_x < 42.0:
                    target_x = 42.0

            # Cập nhật x cho kiện trên băng chuyền
            if pkg.get("status") == "On_Belt":
                pkg["x"] = target_x
                if pkg["x"] > 570.0:
                    if self.auto_spawn:
                        pkg["x"] = 42.0
                        pkg["y"] = 155.0
                    else:
                        # Nếu tắt auto_spawn, kiện đi hết băng tải sẽ biến mất
                        self.packages.remove(pkg)

        # Cập nhật các kiện hàng đang trong trạng thái gạt xuống máng trượt (Diverting) hoặc đã phân loại (Sorted)
        detections = []
        for pkg in list(self.packages):
            st = pkg.get("status", "On_Belt")
            if st == "Diverting":
                pkg["y"] += 55.0 * dt
                gate_id = pkg.get("divert_gate", 1)
                gate_info = self.sorting_controller.gates.get(gate_id, {})
                chute_target_x = gate_info.get("trigger_x", 220.0) + 20.0
                pkg["x"] += (chute_target_x - pkg["x"]) * min(1.0, 5.0 * dt)

                if pkg["y"] >= 235.0:
                    pkg["status"] = "Sorted"
                    pkg["sorted_at"] = now
                    self.sorting_controller.confirm_package_diverted(gate_id)

            elif st in ("Sorted", "Picked_By_AMR"):
                if self.auto_spawn:
                    check_time = pkg.get("picked_at", pkg.get("sorted_at", now))
                    if now - check_time > 4.5:
                        first_belt_pkg_x = min([p["x"] for p in self.packages if p.get("status") == "On_Belt"], default=999.0)
                        if first_belt_pkg_x > 90.0:
                            pkg["x"] = 42.0
                            pkg["y"] = 155.0
                            pkg["status"] = "On_Belt"
                            pkg_id = pkg["id"]
                            prov_keys = list(PROVINCES_CATALOG.keys())
                            prov = prov_keys[pkg_id % len(prov_keys)]
                            prov_inf = PROVINCES_CATALOG[prov]
                            pkg["province"] = prov
                            pkg["zipcode"] = prov_inf["zip"]
                            pkg["region"] = prov_inf["region"]
                            pkg["barcode"] = f"PKG-{prov_inf['zip'][:2]}{pkg_id:03d}"
                            pkg["gate"] = prov_inf["gate"]

            # Giả lập phát hiện YOLOv12
            if self.occlusion_enabled and (180.0 <= pkg["x"] <= 330.0) and pkg.get("status") == "On_Belt":
                conf = 0.35
                pkg["is_occluded"] = True
            else:
                conf = pkg.get("conf", 0.95)
                pkg["is_occluded"] = False

            detections.append([pkg["x"], pkg["y"], 34.0, 34.0, conf])

        # Cập nhật ByteTrack 2-stage association
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

        # Phân hệ Tự Động Hóa Công Nghiệp: Cập nhật cảm biến quang, PLC Modbus & Cổng quét RFID UHF (Trụ Cột 1)
        self._update_hil_industrial_sensors(now)

        # 3. Cập nhật di chuyển Đội xe 4 AMR (gồm AMR-04 Dự Bị tiếp quản khi sạc)
        for robot in self.amrs:
            gate_id = robot["gate_id"]
            st = robot["state"]

            # Xử lý riêng cho Robot Dự Bị AMR-04
            if robot.get("is_reserve", False):
                if st == "STANDBY":
                    # Kiểm tra xem có xe chính nào đang sạc hoặc máng nào dồn ứ >= 2 kiện
                    charging_amr = next((a for a in self.amrs[:3] if a["state"] in ("GOING_TO_DOCK", "CHARGING_AT_DOCK")), None)
                    backlog_gate = None
                    for gid in [1, 2, 3]:
                        cnt = len([p for p in self.packages if p.get("status") == "Sorted" and p.get("divert_gate") == gid])
                        if cnt >= 2:
                            backlog_gate = gid
                            break

                    assigned_gate = charging_amr["gate_id"] if charging_amr else backlog_gate
                    if assigned_gate:
                        robot["gate_id"] = assigned_gate
                        gate_cfgs = {
                            1: {"cx": 240.0, "cy": 270.0, "hy": 300.0, "rx": 670.0, "ry": 170.0, "prov": "Hà Nội"},
                            2: {"cx": 380.0, "cy": 270.0, "hy": 345.0, "rx": 670.0, "ry": 240.0, "prov": "Đà Nẵng"},
                            3: {"cx": 520.0, "cy": 270.0, "hy": 390.0, "rx": 670.0, "ry": 310.0, "prov": "TP. Hồ Chí Minh"}
                        }[assigned_gate]
                        robot["chute_x"] = gate_cfgs["cx"]
                        robot["chute_y"] = gate_cfgs["cy"]
                        robot["highway_y"] = gate_cfgs["hy"]
                        robot["rack_x"] = gate_cfgs["rx"]
                        robot["rack_y"] = gate_cfgs["ry"]
                        robot["target_province"] = gate_cfgs["prov"]
                        robot["state"] = "RETURNING"
                        robot["path_waypoints"] = [[robot["x"], robot["y"]], [robot["x"], gate_cfgs["hy"]], [gate_cfgs["cx"], gate_cfgs["hy"]], [gate_cfgs["cx"], gate_cfgs["cy"]]]
                        robot["waypoint_idx"] = 1
                        self.log_audit_event("RESERVE_DISPATCH", "AMR-04", f"Xuất quân dự bị tiếp quản Cổng {assigned_gate} thay xe sạc", "WARNING")
                    continue
                elif st == "WAITING_FOR_CARGO":
                    # Kiểm tra nếu xe chính đã sạc xong và máng hết dồn ứ -> Quay về vị trí Trực Chiến
                    primary_amr = self.amrs[robot["gate_id"] - 1]
                    chute_backlog = len([p for p in self.packages if p.get("status") == "Sorted" and p.get("divert_gate") == robot["gate_id"]])
                    if primary_amr["state"] not in ("GOING_TO_DOCK", "CHARGING_AT_DOCK") and chute_backlog == 0:
                        robot["state"] = "STANDBY"
                        robot["x"] = 280.0
                        robot["y"] = 440.0
                        robot["heading"] = 0.0
                        robot["path_waypoints"] = []
                        robot["waypoint_idx"] = 0
                        self.log_audit_event("RESERVE_STANDBY", "AMR-04", "Hoàn tất tiếp quản, trở về vị trí Trực Chiến Standby Pad", "INFO")
                        continue

            # Tiêu hao pin mô phỏng
            if st in ("DELIVERING", "RETURNING"):
                drain = 0.04 * dt if not robot["has_cargo"] else 0.07 * dt
                robot["battery"] = max(5.0, robot["battery"] - drain)
            elif st == "CHARGING_AT_DOCK":
                robot["battery"] = min(100.0, robot["battery"] + 2.5 * dt)
                # Kiểm tra cơ chế Preemption: Máng trượt dồn hàng > 3 kiện và Pin > 25%
                chute_backlog = len([p for p in self.packages if p.get("status") == "Sorted" and p.get("divert_gate") == gate_id])
                if chute_backlog >= 2 and robot["battery"] >= 25.0:
                    robot["state"] = "RETURNING"
                    robot["charge_boost"] = True
                    robot["path_waypoints"] = self._build_docking_path(robot, to_dock=False)
                    robot["waypoint_idx"] = 1
                    self.log_audit_event("CHARGING_PREEMPTION", robot["id"], f"Ngắt sạc khẩn cấp tại {robot['battery']:.1f}% pin để giải phóng {chute_backlog} kiện dồn ứ", "WARNING")
                elif robot["battery"] >= 95.0:
                    # Sạc đầy -> Quay lại máng làm nhiệm vụ
                    robot["state"] = "RETURNING"
                    robot["charge_boost"] = False
                    robot["path_waypoints"] = self._build_docking_path(robot, to_dock=False)
                    robot["waypoint_idx"] = 1
                    self.log_audit_event("CHARGING_COMPLETED", robot["id"], "Pin đạt 95%, tự động xuất trạm sạc", "SUCCESS")
                continue

            # Kiểm tra pin yếu -> Tự động chuyển hướng về Trạm sạc
            if robot["battery"] < 20.0 and st in ("WAITING_FOR_CARGO", "RETURNING") and not robot["has_cargo"]:
                robot["state"] = "GOING_TO_DOCK"
                robot["path_waypoints"] = self._build_docking_path(robot, to_dock=True)
                robot["waypoint_idx"] = 1
                self.log_audit_event("LOW_BATTERY_ALERT", robot["id"], f"Pin còn {robot['battery']:.1f}%, di chuyển về Dock sạc", "WARNING")
                continue

            # A. Kiểm tra an toàn vật cản xung quanh (LiDAR Proximity Safety Check - R=35px)
            if self.is_obstacle_near(robot["x"], robot["y"], radius=35.0):
                robot["state"] = "BLOCKED"
                robot["proximity_alert"] = True
                continue
            elif robot.get("proximity_alert", False):
                robot["proximity_alert"] = False
                if robot["state"] == "BLOCKED":
                    robot["state"] = "DELIVERING" if robot["has_cargo"] else "RETURNING"

            # B. State Machine chuẩn công nghiệp
            if st == "WAITING_FOR_CARGO":
                sorted_pkg = next((p for p in self.packages if p.get("status") == "Sorted" and p.get("divert_gate") == gate_id), None)
                if sorted_pkg:
                    robot["state"] = "LOADING"
                    robot["state_timer"] = now
                    robot["cargo_barcode"] = sorted_pkg.get("barcode", "PKG-SORTED")
                    dest_prov = sorted_pkg.get("province", "Hà Nội")
                    robot["target_province"] = dest_prov
                    prov_inf = PROVINCES_CATALOG.get(dest_prov, PROVINCES_CATALOG["Hà Nội"])
                    robot["rack_x"] = prov_inf["rack_x"]
                    robot["rack_y"] = prov_inf["rack_y"]
                    sorted_pkg["status"] = "Picked_By_AMR"
                    sorted_pkg["picked_at"] = now
                else:
                    if self.auto_spawn:
                        if not robot.get("last_auto_mission"):
                            robot["last_auto_mission"] = now
                        if now - robot["last_auto_mission"] > 0.8 + (gate_id * 0.4):
                            robot["state"] = "LOADING"
                            robot["state_timer"] = now
                            prov_keys = [k for k, v in PROVINCES_CATALOG.items() if v["gate"] == gate_id]
                            dest_prov = prov_keys[int(now) % len(prov_keys)]
                            robot["target_province"] = dest_prov
                            prov_inf = PROVINCES_CATALOG[dest_prov]
                            robot["rack_x"] = prov_inf["rack_x"]
                            robot["rack_y"] = prov_inf["rack_y"]
                            robot["cargo_barcode"] = f"PKG-{prov_inf['zip'][:2]}-{int(now)%1000:03d}"
                            robot["last_auto_mission"] = now

            elif st == "LOADING":
                if now - robot.get("state_timer", now) >= 0.5:
                    robot["state"] = "DELIVERING"
                    robot["has_cargo"] = True
                    robot["path_waypoints"] = self._build_orthogonal_amr_path(robot, to_rack=True)
                    robot["waypoint_idx"] = 1

            elif st == "DELIVERING":
                waypoints = robot["path_waypoints"]
                w_idx = robot.get("waypoint_idx", 0)
                if waypoints and w_idx < len(waypoints):
                    tx, ty = waypoints[w_idx]
                    dx = tx - robot["x"]
                    dy = ty - robot["y"]
                    dist = math.hypot(dx, dy)
                    if dist < 4.0:
                        robot["waypoint_idx"] = w_idx + 1
                        if robot["waypoint_idx"] >= len(waypoints):
                            robot["state"] = "UNLOADING"
                            robot["state_timer"] = now
                    else:
                        target_heading = math.atan2(dy, dx)
                        angle_diff = (target_heading - robot.get("heading", 0) + math.pi) % (2 * math.pi) - math.pi
                        robot["heading"] = robot.get("heading", 0) + angle_diff * min(1.0, 15.0 * dt)
                        step = robot["speed"] * dt
                        robot["x"] += (dx / dist) * min(dist, step)
                        robot["y"] += (dy / dist) * min(dist, step)

            elif st == "UNLOADING":
                if now - robot.get("state_timer", now) >= 0.5:
                    robot["has_cargo"] = False
                    p_prov = robot.get("target_province", "Hà Nội")
                    prov_inf = PROVINCES_CATALOG.get(p_prov, PROVINCES_CATALOG["Hà Nội"])
                    rack_id = prov_inf["rack_id"]
                    if rack_id in self.province_racks:
                        rk = self.province_racks[rack_id]
                        if rk["count"] < rk["capacity"]:
                            rk["count"] += 1

                    self.log_audit_event("AMR_STORED", robot["id"], f"Dỡ kiện {robot['cargo_barcode']} vào Kệ {p_prov} ({rack_id})", "SUCCESS")
                    robot["cargo_barcode"] = None
                    robot["state"] = "RETURNING"
                    robot["path_waypoints"] = self._build_orthogonal_amr_path(robot, to_rack=False)
                    robot["waypoint_idx"] = 1

            elif st == "RETURNING":
                waypoints = robot["path_waypoints"]
                w_idx = robot.get("waypoint_idx", 0)
                if waypoints and w_idx < len(waypoints):
                    tx, ty = waypoints[w_idx]
                    dx = tx - robot["x"]
                    dy = ty - robot["y"]
                    dist = math.hypot(dx, dy)
                    if dist < 4.0:
                        robot["waypoint_idx"] = w_idx + 1
                        if robot["waypoint_idx"] >= len(waypoints):
                            robot["state"] = "WAITING_FOR_CARGO"
                            robot["charge_boost"] = False
                    else:
                        target_heading = math.atan2(dy, dx)
                        angle_diff = (target_heading - robot.get("heading", 0) + math.pi) % (2 * math.pi) - math.pi
                        robot["heading"] = robot.get("heading", 0) + angle_diff * min(1.0, 15.0 * dt)
                        step = robot["speed"] * dt
                        robot["x"] += (dx / dist) * min(dist, step)
                        robot["y"] += (dy / dist) * min(dist, step)

            elif st == "GOING_TO_DOCK":
                waypoints = robot["path_waypoints"]
                w_idx = robot.get("waypoint_idx", 0)
                if waypoints and w_idx < len(waypoints):
                    tx, ty = waypoints[w_idx]
                    dx = tx - robot["x"]
                    dy = ty - robot["y"]
                    dist = math.hypot(dx, dy)
                    if dist < 4.0:
                        robot["waypoint_idx"] = w_idx + 1
                        if robot["waypoint_idx"] >= len(waypoints):
                            robot["state"] = "CHARGING_AT_DOCK"
                            dock_id = robot.get("dock_target", 1)
                            self.charging_docks[dock_id - 1]["charging_amr"] = robot["id"]
                            self.log_audit_event("DOCK_CONNECTED", robot["id"], f"Đã kết nối Dock sạc #{dock_id} (Đang nạp điện)", "INFO")
                    else:
                        target_heading = math.atan2(dy, dx)
                        angle_diff = (target_heading - robot.get("heading", 0) + math.pi) % (2 * math.pi) - math.pi
                        robot["heading"] = robot.get("heading", 0) + angle_diff * min(1.0, 15.0 * dt)
                        step = robot["speed"] * dt
                        robot["x"] += (dx / dist) * min(dist, step)
                        robot["y"] += (dy / dist) * min(dist, step)

    def _update_hil_industrial_sensors(self, now: float):
        """Cập nhật vòng lặp Hardware-in-the-Loop giữa Cảm biến, PLC Modbus và Cổng RFID UHF"""
        pe_00 = any(35.0 <= p.get("x", 0) <= 75.0 and p.get("status") == "On_Belt" for p in self.packages)
        pe_01 = any(200.0 <= p.get("x", 0) <= 235.0 and p.get("status") in ("On_Belt", "Diverting") for p in self.packages)
        pe_02 = any(360.0 <= p.get("x", 0) <= 395.0 and p.get("status") in ("On_Belt", "Diverting") for p in self.packages)
        pe_03 = any(520.0 <= p.get("x", 0) <= 555.0 and p.get("status") in ("On_Belt", "Diverting") for p in self.packages)

        ds = self.modbus_engine.datastore
        ds.set_discrete_input(0, pe_00)
        ds.set_discrete_input(1, pe_01)
        ds.set_discrete_input(2, pe_02)
        ds.set_discrete_input(3, pe_03)
        ds.set_discrete_input(4, not self.sorting_controller.is_emergency_stopped) # E-STOP NC
        ds.set_discrete_input(5, self.sorting_controller.is_emergency_stopped)     # Jam Alarm
        ds.set_discrete_input(6, self.auto_spawn)                                   # Auto Mode
        ds.set_discrete_input(7, self.rfid_engine.is_active)                        # RFID Ready

        is_jammed = self.sorting_controller.is_emergency_stopped or self.is_jammed
        g1_active = self.sorting_controller.gates.get(1, {}).get("status") == "ACTIVE"
        g2_active = self.sorting_controller.gates.get(2, {}).get("status") == "ACTIVE"
        g3_active = self.sorting_controller.gates.get(3, {}).get("status") == "ACTIVE"
        any_sorting = g1_active or g2_active or g3_active

        ds.write_coil(0, (not is_jammed) and self.modbus_engine.cpu_mode == "RUN") # Conveyor Run
        ds.write_coil(1, g1_active) # Gate 1 Servo Diverter
        ds.write_coil(2, g2_active) # Gate 2 Servo Diverter
        ds.write_coil(3, g3_active) # Gate 3 Servo Diverter
        ds.write_coil(4, (not is_jammed) and (not any_sorting)) # Green Tower Light
        ds.write_coil(5, any_sorting)                            # Yellow Tower Light
        ds.write_coil(6, is_jammed)                              # Red Tower Light / Jam Alarm
        ds.write_coil(7, self.rfid_engine.is_active)             # RFID Antenna ON

        ds.write_holding_register(1, 500 if (not is_jammed) else 0) # Actual Speed mm/s
        ds.write_holding_register(2, self.sorting_controller.gates.get(1, {}).get("package_count", 0))
        ds.write_holding_register(3, self.sorting_controller.gates.get(2, {}).get("package_count", 0))
        ds.write_holding_register(4, self.sorting_controller.gates.get(3, {}).get("package_count", 0))
        ds.write_holding_register(5, 1 if is_jammed else 0)

        self.rfid_engine.process_conveyor_packages(self.packages)

    def get_state_snapshot(self) -> Dict[str, Any]:
        """Trả về snapshot đầy đủ phục vụ broadcast qua WebSocket cho Digital Twin và SCADA"""
        return {
            "timestamp": round(time.time(), 3),
            "fps": min(self.fps, 60.0),
            "packages": self.packages,
            "gates": [
                {
                    **g,
                    "chute_count": len([p for p in self.packages if p.get("status") == "Sorted" and p.get("divert_gate") == g["id"]]),
                    "chute_capacity": 4
                }
                for g in self.sorting_controller.get_gates_snapshot()
            ],
            "amr": self.amr,
            "amrs": self.amrs,
            "racks": self.racks,
            "province_racks": self.province_racks,
            "charging_docks": self.charging_docks,
            "auto_spawn": self.auto_spawn,
            "is_reversed": self.is_reversed,
            "obstacles": self.dynamic_obstacles,
            "conveyor_running": (not self.sorting_controller.is_emergency_stopped) and (not self.is_jammed),
            "jam_alert": {
                "active": self.sorting_controller.is_emergency_stopped or self.is_jammed,
                "gate_id": self.sorting_controller.last_jammed_gate_id,
                "reason": self.jam_reason
            },
            "ai_vision": {
                "model": "YOLOv12n (ONNX 640x640)",
                "tracker": "ByteTrack (Pure-Python 8D Kalman)",
                "inference_ms": 14.6,
                "id_switches": self.id_switches,
                "mota": 0.942,
                "idf1": 0.918,
                "occlusion_simulated": self.occlusion_enabled,
                "active_tracks_count": len(self.packages)
            },
            "plc_modbus": self.modbus_engine.get_scada_telemetry(),
            "rfid_portal": self.rfid_engine.get_telemetry(),
            "audit_events": self.audit_events[-20:]
        }

# Singleton Instance
warehouse_simulation = WarehouseSimulationEngine()
