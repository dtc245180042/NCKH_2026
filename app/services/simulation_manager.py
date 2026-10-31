"""
Quản lý phiên mô phỏng thời gian thực cho kênh truyền WebSocket 60 FPS (UC-12)
Đồng bộ hóa trạng thái vật lý băng tải, bưu kiện, cổng IoT và robot AMR
"""
import asyncio
import time
from typing import List, Dict, Any, Optional


class SimulationManager:
    def __init__(self):
        self.is_running = True
        self.speed_multiplier = 1.0
        self.total_sorted = 0
        self.parcels: List[Dict[str, Any]] = []
        self.amr_x = 300.0
        self.amr_y = 200.0
        self.amr_dir = 1
        self.seq_id = 101
        self.track_id_seq = 1
        self.last_update = time.perf_counter()
        self.throughput_rate = 1150  # ~1.150 kiện/giờ/làn

        # Trạng thái 4 cổng phân loại
        self.gates = [
            {"gate_number": 1, "status": "IDLE", "arm_angle": 0.0, "is_active": False, "total_sorted": 0},
            {"gate_number": 2, "status": "IDLE", "arm_angle": 0.0, "is_active": False, "total_sorted": 0},
            {"gate_number": 3, "status": "IDLE", "arm_angle": 0.0, "is_active": False, "total_sorted": 0},
            {"gate_number": 4, "status": "IDLE", "arm_angle": 0.0, "is_active": False, "total_sorted": 0},
        ]

        self._spawn_timer = 0.0

    def spawn_parcel(self, destination: str = "Miền Bắc", postal_code: str = "100000") -> Dict[str, Any]:
        """Tạo mới một kiện hàng trên băng tải"""
        colors = {
            "Miền Bắc": "#38bdf8",
            "Miền Trung": "#f59e0b",
            "Miền Nam": "#10b981",
            "Quốc Tế": "#a855f7"
        }
        parcel = {
            "id": f"PKG-{self.seq_id:04d}",
            "track_id": self.track_id_seq,
            "x": 40.0,
            "y": 370.0 - 16.0,
            "status": "CONVEYING",
            "destination": destination,
            "color": colors.get(destination, "#38bdf8"),
            "confidence": 0.98,
            "speed_x": 135.0,
            "speed_y": 0.0,
            "is_diverted": False
        }
        self.seq_id += 1
        self.track_id_seq += 1
        self.parcels.append(parcel)
        return parcel

    def update_physics(self):
        """Cập nhật tọa độ vật lý theo delta-time phục vụ xuất 60 FPS"""
        now = time.perf_counter()
        dt = min(max(now - self.last_update, 0.001), 0.1) * self.speed_multiplier
        self.last_update = now

        if not self.is_running:
            return

        # Tự động spawn theo chu kỳ 2.2 giây
        self._spawn_timer += dt
        if self._spawn_timer >= 2.2:
            import random
            dests = ["Miền Bắc", "Miền Trung", "Miền Nam", "Quốc Tế"]
            self.spawn_parcel(random.choice(dests))
            self._spawn_timer = 0.0

        # Cập nhật AMR
        self.amr_x += self.amr_dir * 65.0 * dt
        if self.amr_x >= 950.0:
            self.amr_dir = -1
        elif self.amr_x <= 260.0:
            self.amr_dir = 1

        # Cập nhật các kiện hàng
        for i in range(len(self.parcels) - 1, -1, -1):
            p = self.parcels[i]
            p["x"] += p["speed_x"] * dt
            p["y"] += p["speed_y"] * dt

            # Giả lập rẽ cổng phân loại
            if not p["is_diverted"] and p["x"] >= 370.0:
                if p["destination"] == "Miền Bắc":
                    p["is_diverted"] = True
                    p["speed_x"] = 40.0
                    p["speed_y"] = 90.0
                    self.gates[0]["is_active"] = True
                    self.gates[0]["arm_angle"] = 0.785
                elif p["destination"] == "Miền Trung" and p["x"] >= 600.0:
                    p["is_diverted"] = True
                    p["speed_x"] = 40.0
                    p["speed_y"] = -90.0
                    self.gates[1]["is_active"] = True
                    self.gates[1]["arm_angle"] = -0.785

            # Kiểm tra đến cổng xuất Outbound
            if p["y"] >= 620.0 or p["y"] <= 140.0 or p["x"] >= 1060.0:
                self.total_sorted += 1
                self.parcels.pop(i)

    def get_current_state(self) -> Dict[str, Any]:
        """Tạo snapshot trạng thái đóng gói gửi qua WebSocket"""
        self.update_physics()
        return {
            "timestamp_ms": round(time.time() * 1000, 1),
            "fps": 60.0,
            "total_sorted": self.total_sorted,
            "active_parcels_count": len(self.parcels),
            "parcels": [
                {
                    "id": p["id"],
                    "track_id": p["track_id"],
                    "x": round(p["x"], 1),
                    "y": round(p["y"], 1),
                    "status": p["status"],
                    "destination": p["destination"],
                    "color": p["color"],
                    "confidence": p["confidence"]
                }
                for p in self.parcels
            ],
            "gates": self.gates,
            "amr_x": round(self.amr_x, 1),
            "amr_y": round(self.amr_y, 1),
            "throughput_rate_per_hour": self.throughput_rate
        }


# Singleton session manager
simulation_manager = SimulationManager()

