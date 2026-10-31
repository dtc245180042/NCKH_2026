import math
from typing import Any, Dict, List, Optional, Tuple

class StorageHeuristicEngine:
    """
    Thuật toán Xếp chỗ Lưu kho Thông minh dựa trên phân tích ABC (LOG-118).
    - Phân loại hàng hóa theo tần suất quay vòng (Turnover Frequency):
      * Hạng A (Fast-moving, >= 70%): Bố trí tại Zone A (Gần băng tải nhất).
      * Hạng B (Medium-moving, ~ 20%): Bố trí tại Zone B (Khoảng cách trung bình).
      * Hạng C (Slow-moving, ~ 10%): Bố trí tại Zone C (Sâu trong kho).
    - Tối thiểu hóa quãng đường di chuyển của xe tự hành AMR.
    - Cơ chế tràn vùng linh hoạt (Overflow fallback) khi các ô kệ trong vùng ưu tiên bị đầy.
    """
    def __init__(self, dropoff_point: Tuple[float, float] = (520.0, 160.0)):
        # Điểm nhận hàng từ băng tải của AMR (drop-off point)
        self.dropoff_x, self.dropoff_y = dropoff_point

        # Tọa độ mặc định của các ô kệ trên bản đồ Digital Twin (X, Y)
        self.slot_coords: Dict[str, Tuple[float, float]] = {
            # Zone A: Cực gần băng tải (X: 650..730, Y: 60..100)
            "LOC-A01": (650.0, 60.0),  "LOC-A02": (690.0, 60.0),
            "LOC-A03": (730.0, 60.0),  "LOC-A04": (770.0, 60.0),
            "LOC-A05": (650.0, 100.0), "LOC-A06": (690.0, 100.0),
            "LOC-A07": (730.0, 100.0), "LOC-A08": (770.0, 100.0),

            # Zone B: Khoảng cách trung bình (X: 650..770, Y: 150..190)
            "LOC-B01": (650.0, 150.0), "LOC-B02": (690.0, 150.0),
            "LOC-B03": (730.0, 150.0), "LOC-B04": (770.0, 150.0),
            "LOC-B05": (650.0, 190.0), "LOC-B06": (690.0, 190.0),
            "LOC-B07": (730.0, 190.0), "LOC-B08": (770.0, 190.0),

            # Zone C: Sâu nhất trong kho (X: 650..770, Y: 240..280)
            "LOC-C01": (650.0, 240.0), "LOC-C02": (690.0, 240.0),
            "LOC-C03": (730.0, 240.0), "LOC-C04": (770.0, 240.0),
            "LOC-C05": (650.0, 280.0), "LOC-C06": (690.0, 280.0),
            "LOC-C07": (730.0, 280.0), "LOC-C08": (770.0, 280.0),
        }

    def classify_abc(self, weight: float, destination_code: str, turnover_hint: Optional[str] = None) -> str:
        """
        Phân loại bưu kiện theo phương pháp ABC:
        - turnover_hint = 'HIGH' / 'A' -> Nhóm A
        - turnover_hint = 'MEDIUM' / 'B' -> Nhóm B
        - turnover_hint = 'LOW' / 'C' -> Nhóm C
        Quy tắc dự phòng (Heuristic inference):
        - Bưu kiện nhẹ (< 3.0 kg) hoặc các trung tâm lớn (HN, HCM) có tần suất luân chuyển cao -> Nhóm A
        - Bưu kiện 3.0kg .. 10.0kg -> Nhóm B
        - Bưu kiện nặng > 10.0kg hoặc hàng cồng kềnh -> Nhóm C (Lưu trữ cố định, ít di chuyển)
        """
        if turnover_hint:
            hint = turnover_hint.upper().strip()
            if hint in ("A", "HIGH", "FAST"):
                return "Zone A"
            elif hint in ("B", "MEDIUM", "MED"):
                return "Zone B"
            elif hint in ("C", "LOW", "SLOW"):
                return "Zone C"

        # Tự động suy diễn Heuristic
        dest_upper = destination_code.upper()
        if weight <= 3.0 or ("HN" in dest_upper or "HCM" in dest_upper or "10" in dest_upper or "70" in dest_upper):
            return "Zone A"
        elif weight <= 10.0:
            return "Zone B"
        else:
            return "Zone C"

    def calculate_distance(self, slot_code: str) -> float:
        """Tính khoảng cách Euclidean từ điểm thả hàng tới ô kệ"""
        sx, sy = self.slot_coords.get(slot_code, (700.0, 150.0))
        return math.hypot(sx - self.dropoff_x, sy - self.dropoff_y)

    def recommend_slot(
        self,
        package_weight: float,
        destination_code: str,
        available_locations: List[Dict[str, Any]],
        turnover_hint: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Gợi ý ô kệ tối ưu cho bưu kiện:
        1. Phân loại bưu kiện sang Zone ưu tiên (Zone A, B, hoặc C).
        2. Lọc các ô kệ còn dung tích (is_full == False và current_count < capacity).
        3. Chọn ô trong Zone ưu tiên có khoảng cách ngắn nhất đến xe AMR.
        4. Cơ chế tràn vùng (Overflow): Nếu Zone mục tiêu đã kín chỗ, tự động tìm ô gần nhất ở Zone kế cận.
        """
        target_zone = self.classify_abc(package_weight, destination_code, turnover_hint)

        # Thứ tự ưu tiên vùng:
        # Nếu target_zone là A: ưu tiên A -> B -> C
        # Nếu target_zone là B: ưu tiên B -> A -> C
        # Nếu target_zone là C: ưu tiên C -> B -> A
        if target_zone == "Zone A":
            zone_priority = ["Zone A", "Zone B", "Zone C"]
        elif target_zone == "Zone B":
            zone_priority = ["Zone B", "Zone A", "Zone C"]
        else:
            zone_priority = ["Zone C", "Zone B", "Zone A"]

        for zone in zone_priority:
            # Lọc các ô kệ còn chỗ thuộc vùng này
            candidate_slots = [
                loc for loc in available_locations
                if loc.get("zone") == zone
                and not loc.get("is_full", False)
                and loc.get("current_count", 0) < loc.get("capacity", 1)
            ]

            if candidate_slots:
                # Sắp xếp theo khoảng cách di chuyển tăng dần (gần nhất chọn trước)
                candidate_slots.sort(key=lambda s: self.calculate_distance(s.get("code", "")))
                best_slot = candidate_slots[0]
                best_slot["distance_meters"] = round(self.calculate_distance(best_slot.get("code", "")) * 0.05, 2)
                best_slot["recommended_zone"] = zone
                best_slot["target_zone"] = target_zone
                best_slot["is_overflow"] = (zone != target_zone)
                return best_slot

        return None  # Toàn bộ kho đã đầy

# Singleton
storage_heuristic = StorageHeuristicEngine()

