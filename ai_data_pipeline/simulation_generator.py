"""
simulation_generator.py — Môi trường sinh dữ liệu mô phỏng kho bãi 2D
Tác giả: Bùi Thị Loan | LOG-105
Dự án: NCKH SV2026-ICTU-08 | ICTU

Mô tả:
  Lớp WarehouseSimulationEnvironment dùng thư viện Pillow để tạo ảnh
  top-down (góc nhìn từ trên xuống) của nhà kho thông minh.
  Mỗi frame bao gồm:
    - Background sàn kho (grid ô gạch)
    - Các kệ hàng (shelf) bố trí theo hàng và cột
    - Các đối tượng ngẫu nhiên: package, pallet, vehicle, person
  Output: ảnh PIL.Image + danh sách annotation dạng YOLO
"""

import sys
import random
import math
from pathlib import Path
from typing import List, Dict, Tuple, Optional

from PIL import Image, ImageDraw, ImageFont

from .config import PIPELINE_CONFIG, CLASSES, SIM_CFG, DATASET_CFG
from .utils import xyxy_to_yolo

# Hằng số màu sắc môi trường
_BG_COLOR       = tuple(SIM_CFG["background_color_rgb"])     # Nền sàn
_SHELF_COLOR    = tuple(SIM_CFG["shelf_color_rgb"])           # Kệ hàng
_GRID_COLOR     = (200, 200, 200)                              # Lưới gạch
_SHADOW_COLOR   = (0, 0, 0, 40)                               # Bóng đổ (RGBA)

IMG_W = SIM_CFG["warehouse_width"]
IMG_H = SIM_CFG["warehouse_height"]


class Shelf:
    """Đại diện cho một kệ hàng cố định trong kho."""

    def __init__(self, x1: int, y1: int, x2: int, y2: int):
        self.x1, self.y1, self.x2, self.y2 = x1, y1, x2, y2

    @property
    def rect(self) -> Tuple[int, int, int, int]:
        return (self.x1, self.y1, self.x2, self.y2)


class WarehouseSimulationEnvironment:
    """
    Môi trường sinh dữ liệu ảnh mô phỏng nhà kho 2D (top-down view).

    Mỗi đối tượng được vẽ bằng Pillow với màu riêng biệt
    và trả về bounding box YOLO-format để gán nhãn tự động.

    Sử dụng:
        env = WarehouseSimulationEnvironment(seed=42)
        frame, annotations = env.generate_frame(
            target_counts={"package": 3, "pallet": 1, "vehicle": 1, "person": 1}
        )
        # frame: PIL.Image.Image (RGB, 640×640)
        # annotations: List[dict] với các key: class_id, cx, cy, bw, bh
    """

    def __init__(self, seed: int = 42):
        self.seed = seed
        self.rng = random.Random(seed)
        self._shelves: List[Shelf] = self._build_shelf_layout()

    # ------------------------------------------------------------------
    # Layout kho bãi
    # ------------------------------------------------------------------

    def _build_shelf_layout(self) -> List[Shelf]:
        """
        Xây dựng bố cục kệ hàng theo lưới hàng × cột.
        Lối đi (aisle) được giữ giữa các hàng kệ.
        """
        shelves = []
        num_rows = SIM_CFG["num_shelf_rows"]
        num_cols = SIM_CFG["num_shelf_cols"]
        aisle_w  = SIM_CFG["aisle_width"]

        margin_x = 30
        margin_y = 40
        usable_w = IMG_W - 2 * margin_x
        usable_h = IMG_H - 2 * margin_y

        # Tổng chiều rộng của aisle giữa cột: (num_cols-1) khe dọc + 1 aisle chính giữa
        shelf_w = (usable_w - aisle_w) // num_cols - 8
        shelf_h = (usable_h - aisle_w) // num_rows - 10

        for row in range(num_rows):
            for col in range(num_cols):
                # Khe ngang giữa các hàng = aisle_w // 2
                x1 = margin_x + col * (shelf_w + 8)
                y1 = margin_y + row * (shelf_h + 10)
                # Thêm khoảng trống aisle chính giữa (sau cột num_cols//2)
                if col >= num_cols // 2:
                    x1 += aisle_w
                x2 = x1 + shelf_w
                y2 = y1 + shelf_h
                shelves.append(Shelf(x1, y1, x2, y2))

        return shelves

    # ------------------------------------------------------------------
    # Vẽ background
    # ------------------------------------------------------------------

    def _draw_background(self, draw: ImageDraw.ImageDraw) -> None:
        """Vẽ nền sàn gạch (grid pattern)."""
        tile = 40  # pixel mỗi ô gạch
        for x in range(0, IMG_W, tile):
            draw.line([(x, 0), (x, IMG_H)], fill=_GRID_COLOR, width=1)
        for y in range(0, IMG_H, tile):
            draw.line([(0, y), (IMG_W, y)], fill=_GRID_COLOR, width=1)

    def _draw_shelves(self, draw: ImageDraw.ImageDraw) -> None:
        """Vẽ các kệ hàng cố định."""
        for shelf in self._shelves:
            # Kệ chính
            draw.rectangle(shelf.rect, fill=_SHELF_COLOR, outline=(80, 80, 80), width=2)
            # Vạch phân chia ngăn kệ (3 ngăn)
            x1, y1, x2, y2 = shelf.rect
            seg_h = (y2 - y1) // 3
            for k in range(1, 3):
                yy = y1 + k * seg_h
                draw.line([(x1 + 2, yy), (x2 - 2, yy)], fill=(100, 100, 100), width=1)

    # ------------------------------------------------------------------
    # Vẽ từng loại đối tượng
    # ------------------------------------------------------------------

    def _is_overlapping(
        self,
        new_box: Tuple[int, int, int, int],
        existing_boxes: List[Tuple[int, int, int, int]],
        min_iou: float = 0.15
    ) -> bool:
        """Kiểm tra xem box mới có đè lên các box đã vẽ quá ngưỡng không."""
        from .utils import compute_iou
        for box in existing_boxes:
            if compute_iou(new_box, box) > min_iou:
                return True
        return False

    def _find_free_position(
        self,
        w: int, h: int,
        placed_boxes: List[Tuple[int, int, int, int]],
        max_attempts: int = 30
    ) -> Optional[Tuple[int, int, int, int]]:
        """
        Tìm vị trí ngẫu nhiên không đè lên shelf và đối tượng đã vẽ.
        Trả về (x1, y1, x2, y2) hoặc None nếu không tìm được.
        """
        for _ in range(max_attempts):
            x1 = self.rng.randint(5, IMG_W - w - 5)
            y1 = self.rng.randint(5, IMG_H - h - 5)
            x2, y2 = x1 + w, y1 + h
            box = (x1, y1, x2, y2)

            # Không đặt trong kệ
            on_shelf = any(
                x1 < s.x2 and x2 > s.x1 and y1 < s.y2 and y2 > s.y1
                for s in self._shelves
            )
            if on_shelf:
                continue

            if not self._is_overlapping(box, placed_boxes):
                return box

        return None  # Không tìm được vị trí hợp lệ

    def _draw_package(
        self, draw: ImageDraw.ImageDraw, box: Tuple[int, int, int, int]
    ) -> None:
        """Vẽ kiện hàng (hình chữ nhật màu cam với dấu thập)."""
        x1, y1, x2, y2 = box
        color = tuple(CLASSES[0]["color_rgb"])
        draw.rectangle(box, fill=color, outline=(150, 60, 0), width=2)
        # Dấu thập (tape mark)
        cx, cy = (x1 + x2) // 2, (y1 + y2) // 2
        draw.line([(cx, y1 + 2), (cx, y2 - 2)], fill=(200, 80, 0), width=2)
        draw.line([(x1 + 2, cy), (x2 - 2, cy)], fill=(200, 80, 0), width=2)

    def _draw_pallet(
        self, draw: ImageDraw.ImageDraw, box: Tuple[int, int, int, int]
    ) -> None:
        """Vẽ pallet (hình chữ nhật nâu với các thanh ngang)."""
        x1, y1, x2, y2 = box
        color = tuple(CLASSES[1]["color_rgb"])
        draw.rectangle(box, fill=color, outline=(80, 50, 20), width=2)
        # 3 thanh ngang mô phỏng ván gỗ
        h3 = (y2 - y1) // 3
        for k in range(1, 3):
            yy = y1 + k * h3
            draw.line([(x1 + 3, yy), (x2 - 3, yy)], fill=(80, 50, 20), width=2)

    def _draw_vehicle(
        self, draw: ImageDraw.ImageDraw, box: Tuple[int, int, int, int]
    ) -> None:
        """Vẽ xe AMR/forklift (hình chữ nhật xanh dương với mũi tên hướng)."""
        x1, y1, x2, y2 = box
        color = tuple(CLASSES[2]["color_rgb"])
        draw.rectangle(box, fill=color, outline=(0, 60, 160), width=3)
        # Hình thang mũi tên phía trước
        cx = (x1 + x2) // 2
        arrow_pts = [(cx, y1 + 4), (x2 - 6, y1 + 16), (x1 + 6, y1 + 16)]
        draw.polygon(arrow_pts, fill=(0, 200, 255))
        # Bánh xe (4 hình tròn nhỏ ở 4 góc)
        r = 5
        for wx, wy in [(x1 + 6, y1 + 6), (x2 - 6, y1 + 6),
                        (x1 + 6, y2 - 6), (x2 - 6, y2 - 6)]:
            draw.ellipse([wx - r, wy - r, wx + r, wy + r], fill=(20, 20, 20))

    def _draw_person(
        self, draw: ImageDraw.ImageDraw, box: Tuple[int, int, int, int]
    ) -> None:
        """Vẽ người (thân hình stickman đơn giản — top-down)."""
        x1, y1, x2, y2 = box
        cx = (x1 + x2) // 2
        cy = (y1 + y2) // 2
        h  = y2 - y1
        w  = x2 - x1

        # Đầu
        r_head = max(6, w // 4)
        draw.ellipse(
            [cx - r_head, y1, cx + r_head, y1 + 2 * r_head],
            fill=(255, 220, 170), outline=(0, 0, 0), width=1
        )
        # Thân
        body_top = y1 + 2 * r_head
        body_bot = y2 - h // 5
        draw.rectangle(
            [cx - w // 3, body_top, cx + w // 3, body_bot],
            fill=tuple(CLASSES[3]["color_rgb"]), outline=(0, 80, 0), width=1
        )
        # Chân (2 đường thẳng)
        draw.line([(cx - w // 6, body_bot), (cx - w // 4, y2)], fill=(0, 80, 0), width=2)
        draw.line([(cx + w // 6, body_bot), (cx + w // 4, y2)], fill=(0, 80, 0), width=2)

    # ------------------------------------------------------------------
    # API chính
    # ------------------------------------------------------------------

    def generate_frame(
        self,
        target_counts: Dict[str, int]
    ) -> Tuple[Image.Image, List[Dict]]:
        """
        Sinh một frame ảnh kho bãi mô phỏng cùng với nhãn YOLO-format.

        Args:
            target_counts: Dict số lượng mỗi lớp cần vẽ,
                           ví dụ: {"package": 3, "pallet": 1, "vehicle": 1, "person": 1}

        Returns:
            frame      : PIL.Image.Image (RGB, 640×640)
            annotations: List[dict] với keys:
                           class_id (int), class_name (str),
                           cx, cy, bw, bh (float, YOLO-format)
        """
        # Tạo canvas
        frame = Image.new("RGB", (IMG_W, IMG_H), color=_BG_COLOR)
        draw  = ImageDraw.Draw(frame)

        # Vẽ nền + kệ
        self._draw_background(draw)
        self._draw_shelves(draw)

        annotations   : List[Dict]                 = []
        placed_boxes  : List[Tuple[int,int,int,int]] = []

        # Ánh xạ class_name → hàm vẽ
        draw_funcs = {
            "package": self._draw_package,
            "pallet" : self._draw_pallet,
            "vehicle": self._draw_vehicle,
            "person" : self._draw_person,
        }

        for cls_cfg in CLASSES:
            cls_name = cls_cfg["name"]
            cls_id   = cls_cfg["id"]
            count    = target_counts.get(cls_name, 0)

            for _ in range(count):
                # Kích thước đối tượng ngẫu nhiên trong dải cho phép
                obj_w = self.rng.randint(*cls_cfg["size_range_w"])
                obj_h = self.rng.randint(*cls_cfg["size_range_h"])

                box = self._find_free_position(obj_w, obj_h, placed_boxes)
                if box is None:
                    # Không đặt được — bỏ qua (hiếm xảy ra với kho 640×640)
                    continue

                # Vẽ đối tượng
                draw_funcs[cls_name](draw, box)
                placed_boxes.append(box)

                # Tính YOLO annotation
                cx, cy, bw, bh = xyxy_to_yolo(*box, IMG_W, IMG_H)
                annotations.append({
                    "class_id"  : cls_id,
                    "class_name": cls_name,
                    "cx": cx, "cy": cy,
                    "bw": bw, "bh": bh,
                    "box_xyxy"  : box,  # dùng nội bộ khi debug
                })

        return frame, annotations

    def preview_frame(
        self,
        target_counts: Optional[Dict[str, int]] = None,
        save_path: Optional[str] = None
    ) -> Image.Image:
        """
        Sinh và lưu một frame preview để kiểm tra trực quan.
        Mặc định vẽ 3 package + 1 pallet + 1 vehicle + 1 person.
        """
        if target_counts is None:
            target_counts = {"package": 3, "pallet": 1, "vehicle": 1, "person": 1}

        frame, anns = self.generate_frame(target_counts)

        # Vẽ overlay bounding box (màu vàng) + nhãn
        overlay = frame.copy()
        draw    = ImageDraw.Draw(overlay)
        for ann in anns:
            x1, y1, x2, y2 = ann["box_xyxy"]
            draw.rectangle([(x1, y1), (x2, y2)], outline=(255, 255, 0), width=2)
            draw.text((x1, max(0, y1 - 12)), ann["class_name"], fill=(255, 255, 0))

        if save_path:
            Path(save_path).parent.mkdir(parents=True, exist_ok=True)
            overlay.save(save_path)
            print(f"  [PREVIEW] {save_path}")

        return overlay


# ---------------------------------------------------------------------------
# Entry-point nhanh (python -m ai_data_pipeline.simulation_generator)
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    print("=== LOG-105: Simulation Generator smoke test ===")
    env = WarehouseSimulationEnvironment(seed=42)
    frame, anns = env.generate_frame({"package": 4, "pallet": 2, "vehicle": 1, "person": 1})
    print(f"Frame size   : {frame.size}")
    print(f"Annotations  : {len(anns)} objects")
    for a in anns:
        print(f"  {a['class_name']:8s} cls={a['class_id']} cx={a['cx']:.4f} cy={a['cy']:.4f} bw={a['bw']:.4f} bh={a['bh']:.4f}")

    # Lưu preview
    preview_path = "assets/preview_frame_test.png"
    env.preview_frame(save_path=preview_path)
    print("LOG-105 OK")
