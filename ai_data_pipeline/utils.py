"""
utils.py — Các hàm tiện ích dùng chung cho toàn bộ pipeline AI Data
Tác giả: Bùi Thị Loan | LOG-105
Dự án: NCKH SV2026-ICTU-08 | ICTU

Bao gồm:
  - Chuyển đổi định dạng bounding box (YOLO ↔ xyxy)
  - Tính IoU
  - Helpers vẽ biểu đồ matplotlib (headless Agg backend)
  - Helpers tạo thư mục output
"""

import sys
import os
from pathlib import Path
from typing import List, Tuple

import matplotlib
matplotlib.use("Agg")  # Headless backend — không cần GUI trên Windows server
import matplotlib.pyplot as plt
import matplotlib.patches as patches
import numpy as np

# ---------------------------------------------------------------------------
# Bounding Box Utilities
# ---------------------------------------------------------------------------

def xyxy_to_yolo(
    x1: float, y1: float, x2: float, y2: float,
    img_w: int, img_h: int
) -> Tuple[float, float, float, float]:
    """
    Chuyển bounding box từ định dạng xyxy (pixel tuyệt đối)
    sang định dạng YOLO (cx, cy, w, h) chuẩn hoá [0, 1].

    Args:
        x1, y1: Góc trên-trái (pixel)
        x2, y2: Góc dưới-phải (pixel)
        img_w, img_h: Kích thước ảnh (pixel)

    Returns:
        (cx, cy, w, h) chuẩn hoá trong khoảng [0.0, 1.0]
    """
    cx = (x1 + x2) / 2.0 / img_w
    cy = (y1 + y2) / 2.0 / img_h
    bw = (x2 - x1) / img_w
    bh = (y2 - y1) / img_h
    # Clip để tránh ra ngoài biên ảnh
    cx = float(np.clip(cx, 0.0, 1.0))
    cy = float(np.clip(cy, 0.0, 1.0))
    bw = float(np.clip(bw, 0.0, 1.0))
    bh = float(np.clip(bh, 0.0, 1.0))
    return cx, cy, bw, bh


def yolo_to_xyxy(
    cx: float, cy: float, bw: float, bh: float,
    img_w: int, img_h: int
) -> Tuple[int, int, int, int]:
    """
    Chuyển ngược từ YOLO (cx, cy, w, h) chuẩn hoá
    sang xyxy pixel tuyệt đối.

    Returns:
        (x1, y1, x2, y2) dạng int pixel
    """
    x1 = int((cx - bw / 2) * img_w)
    y1 = int((cy - bh / 2) * img_h)
    x2 = int((cx + bw / 2) * img_w)
    y2 = int((cy + bh / 2) * img_h)
    return x1, y1, x2, y2


def compute_iou(
    box_a: Tuple[int, int, int, int],
    box_b: Tuple[int, int, int, int]
) -> float:
    """
    Tính Intersection-over-Union (IoU) giữa 2 bounding box xyxy.

    Args:
        box_a, box_b: (x1, y1, x2, y2) dạng int pixel

    Returns:
        IoU trong khoảng [0.0, 1.0]
    """
    ax1, ay1, ax2, ay2 = box_a
    bx1, by1, bx2, by2 = box_b

    inter_x1 = max(ax1, bx1)
    inter_y1 = max(ay1, by1)
    inter_x2 = min(ax2, bx2)
    inter_y2 = min(ay2, by2)

    inter_w = max(0, inter_x2 - inter_x1)
    inter_h = max(0, inter_y2 - inter_y1)
    inter_area = inter_w * inter_h

    area_a = max(0, ax2 - ax1) * max(0, ay2 - ay1)
    area_b = max(0, bx2 - bx1) * max(0, by2 - by1)
    union_area = area_a + area_b - inter_area

    if union_area <= 0:
        return 0.0
    return float(inter_area / union_area)


# ---------------------------------------------------------------------------
# Plot Helpers
# ---------------------------------------------------------------------------

def save_figure(fig: plt.Figure, save_path: str | Path, dpi: int = 150) -> None:
    """Lưu figure matplotlib ra file PNG, tạo thư mục nếu chưa có."""
    Path(save_path).parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(str(save_path), dpi=dpi, bbox_inches="tight")
    plt.close(fig)
    print(f"  [SAVED] {save_path}")


def plot_loss_map_curve(
    train_losses: List[float],
    val_losses: List[float],
    map50_values: List[float],
    save_path: str | Path
) -> None:
    """
    Vẽ đồ thị Loss + mAP@0.5 theo epoch (2 trục y).
    Dùng cho LOG-108 training pipeline.
    """
    epochs = list(range(1, len(train_losses) + 1))

    fig, ax1 = plt.subplots(figsize=(12, 5))
    fig.suptitle("YOLOv12n Training — Loss & mAP@0.5 (100 Epochs)", fontsize=14, fontweight="bold")

    # Trục trái: Loss
    color_train = "#E74C3C"
    color_val   = "#E67E22"
    ax1.set_xlabel("Epoch")
    ax1.set_ylabel("Loss", color=color_train)
    l1, = ax1.plot(epochs, train_losses, color=color_train, linewidth=1.5, label="Train Loss")
    l2, = ax1.plot(epochs, val_losses,   color=color_val,   linewidth=1.5, linestyle="--", label="Val Loss")
    ax1.tick_params(axis="y", labelcolor=color_train)
    ax1.set_ylim(bottom=0)

    # Trục phải: mAP@0.5
    ax2 = ax1.twinx()
    color_map = "#2ECC71"
    ax2.set_ylabel("mAP@0.5", color=color_map)
    l3, = ax2.plot(epochs, map50_values, color=color_map, linewidth=2.0, label="mAP@0.5")
    ax2.tick_params(axis="y", labelcolor=color_map)
    ax2.set_ylim(0.0, 1.05)

    # Đường kẻ mục tiêu mAP = 96.5%
    ax2.axhline(y=0.965, color=color_map, linestyle=":", alpha=0.6, linewidth=1.2)
    ax2.text(len(epochs) * 0.02, 0.970, "Target 96.5%", color=color_map, fontsize=8)

    # Legend gộp
    lines = [l1, l2, l3]
    labels = [ln.get_label() for ln in lines]
    ax1.legend(lines, labels, loc="center right")

    ax1.grid(True, alpha=0.3)
    fig.tight_layout()
    save_figure(fig, save_path)


def plot_pr_curve(
    recalls: List[List[float]],
    precisions: List[List[float]],
    class_names: List[str],
    map50_per_class: List[float],
    save_path: str | Path
) -> None:
    """
    Vẽ PR-Curve cho từng lớp + overall (LOG-109).

    Args:
        recalls: list of recall arrays per class
        precisions: list of precision arrays per class
        class_names: ['package', 'pallet', 'vehicle', 'person']
        map50_per_class: mAP@0.5 từng lớp
        save_path: đường dẫn file PNG
    """
    colors = ["#E74C3C", "#8E44AD", "#2980B9", "#27AE60"]

    fig, ax = plt.subplots(figsize=(9, 7))
    ax.set_title("Precision-Recall Curve — YOLOv12n Logistics", fontsize=13, fontweight="bold")
    ax.set_xlabel("Recall", fontsize=11)
    ax.set_ylabel("Precision", fontsize=11)
    ax.set_xlim(0.0, 1.05)
    ax.set_ylim(0.0, 1.05)

    for i, (cls, color) in enumerate(zip(class_names, colors)):
        ap = map50_per_class[i]
        ax.plot(recalls[i], precisions[i], color=color, linewidth=2.0,
                label=f"{cls} (AP={ap:.3f})")

    # Overall mAP line
    overall_map = float(np.mean(map50_per_class))
    ax.annotate(
        f"mAP@0.5 = {overall_map:.3f}",
        xy=(0.05, 0.05), xycoords="axes fraction",
        fontsize=11, color="#2C3E50",
        bbox=dict(boxstyle="round,pad=0.3", facecolor="#ECF0F1", alpha=0.8)
    )

    ax.legend(loc="lower left", fontsize=9)
    ax.grid(True, alpha=0.3)
    fig.tight_layout()
    save_figure(fig, save_path)


def plot_confusion_matrix(
    cm: np.ndarray,
    class_names: List[str],
    save_path: str | Path
) -> None:
    """
    Vẽ Confusion Matrix heatmap chuẩn hoá (LOG-109).

    Args:
        cm: Ma trận nhầm lẫn (NxN) giá trị tỉ lệ [0,1]
        class_names: nhãn các lớp
        save_path: đường dẫn file PNG
    """
    import matplotlib.colors as mcolors

    fig, ax = plt.subplots(figsize=(7, 6))
    ax.set_title("Confusion Matrix — YOLOv12n Logistics", fontsize=13, fontweight="bold")

    im = ax.imshow(cm, cmap="Blues", vmin=0.0, vmax=1.0)
    fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04)

    n = len(class_names)
    ax.set_xticks(range(n))
    ax.set_yticks(range(n))
    ax.set_xticklabels(class_names, rotation=30, ha="right")
    ax.set_yticklabels(class_names)
    ax.set_xlabel("Predicted", fontsize=10)
    ax.set_ylabel("Actual", fontsize=10)

    # Hiện giá trị trong mỗi ô
    thresh = 0.5
    for i in range(n):
        for j in range(n):
            val = cm[i, j]
            txt_color = "white" if val > thresh else "black"
            ax.text(j, i, f"{val:.2f}", ha="center", va="center",
                    fontsize=11, color=txt_color, fontweight="bold")

    fig.tight_layout()
    save_figure(fig, save_path)


# ---------------------------------------------------------------------------
# Directory Helpers
# ---------------------------------------------------------------------------

def ensure_dirs(*paths) -> None:
    """Tạo các thư mục nếu chưa tồn tại."""
    for p in paths:
        Path(p).mkdir(parents=True, exist_ok=True)


def count_files(directory: str | Path, ext: str = ".jpg") -> int:
    """Đếm số file có phần mở rộng nhất định trong thư mục."""
    return len(list(Path(directory).glob(f"*{ext}")))


if __name__ == "__main__":
    # Smoke-test nhanh
    print("=== utils.py smoke test ===")

    # Test xyxy_to_yolo
    cx, cy, bw, bh = xyxy_to_yolo(100, 80, 200, 160, 640, 640)
    print(f"xyxy_to_yolo: cx={cx:.4f} cy={cy:.4f} bw={bw:.4f} bh={bh:.4f}")

    # Test yolo_to_xyxy
    x1, y1, x2, y2 = yolo_to_xyxy(cx, cy, bw, bh, 640, 640)
    print(f"yolo_to_xyxy: x1={x1} y1={y1} x2={x2} y2={y2}  (expected 100 80 200 160)")

    # Test IoU
    iou = compute_iou((100, 80, 200, 160), (150, 120, 250, 200))
    print(f"IoU: {iou:.4f}  (expected ~0.143)")

    print("utils.py OK")
