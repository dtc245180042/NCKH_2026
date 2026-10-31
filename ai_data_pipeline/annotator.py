"""
annotator.py — Tự sinh và gán nhãn 2.500 frame video mô phỏng kho bãi
Tác giả: Bùi Thị Loan | LOG-106
Dự án: NCKH SV2026-ICTU-08 | ICTU

Mô tả:
  Lớp DatasetAnnotator:
    1. Dùng WarehouseSimulationEnvironment để sinh ảnh 640×640.
    2. Chia 50 sequences × 50 frames, mỗi sequence có seed riêng.
    3. Phân bổ số instance theo từng lớp sao cho khớp CHÍNH XÁC
       với Bảng 5.2 báo cáo NCKH (train/val/test).
    4. Lưu ảnh JPEG + file nhãn YOLO (.txt) vào cấu trúc thư mục chuẩn.

Cấu trúc output:
  data/
    images/
      train/  seq00_frame000.jpg ... seq34_frame049.jpg  (1750 file)
      val/    seq35_frame000.jpg ... seq44_frame049.jpg  (500 file)
      test/   seq45_frame000.jpg ... seq49_frame049.jpg  (250 file)
    labels/
      train/  *.txt
      val/    *.txt
      test/   *.txt
"""

import sys
import math
import random
import time
from pathlib import Path
from typing import Dict, List, Tuple

from .config import PIPELINE_CONFIG, DATASET_CFG, CLASSES, PATHS, CLASS_NAMES
from .simulation_generator import WarehouseSimulationEnvironment
from .utils import ensure_dirs

# ------------------------------------------------------------------
# Hằng số từ config
# ------------------------------------------------------------------
TOTAL_FRAMES     = DATASET_CFG["total_frames"]        # 2500
NUM_SEQUENCES    = DATASET_CFG["num_sequences"]        # 50
FRAMES_PER_SEQ   = DATASET_CFG["frames_per_sequence"]  # 50
IMG_W            = DATASET_CFG["image_width"]          # 640
IMG_H            = DATASET_CFG["image_height"]         # 640

INSTANCE_COUNTS  = DATASET_CFG["instance_counts"]

# Ánh xạ split_name → dải sequence
SPLIT_RANGES = {
    "train": (0,  34),   # 35 sequences
    "val"  : (35, 44),   # 10 sequences
    "test" : (45, 49),   #  5 sequences
}


class DatasetAnnotator:
    """
    Sinh và gán nhãn tự động 2.500 frame ảnh mô phỏng.

    Đảm bảo số lượng instance từng lớp khớp CHÍNH XÁC với Bảng 5.2 NCKH.
    Chiến lược phân bổ:
      - Với mỗi split, tính tổng số instance mỗi lớp cần đạt.
      - Chia đều cho số frames trong split → số instances trung bình/frame.
      - Frame cuối mỗi split nhận phần còn lại để tổng = target.
    """

    def __init__(self, output_root: str = "data", verbose: bool = True):
        self.output_root = Path(output_root)
        self.verbose     = verbose

        # Tạo thư mục output
        for split in ("train", "val", "test"):
            ensure_dirs(
                self.output_root / "images" / split,
                self.output_root / "labels" / split,
            )

    # ------------------------------------------------------------------
    # Phân bổ instance
    # ------------------------------------------------------------------

    def _compute_per_frame_counts(
        self, split: str
    ) -> List[Dict[str, int]]:
        """
        Tính số lượng instance từng lớp cho mỗi frame trong split,
        sao cho tổng cộng khớp đúng với Bảng 5.2.

        Returns:
            List có độ dài = số frame của split;
            mỗi phần tử là dict {class_name: count}.
        """
        seq_start, seq_end = SPLIT_RANGES[split]
        num_seqs  = seq_end - seq_start + 1
        num_frames = num_seqs * FRAMES_PER_SEQ

        targets: Dict[str, int] = INSTANCE_COUNTS[split]

        per_frame_counts: List[Dict[str, int]] = [
            {cls: 0 for cls in CLASS_NAMES} for _ in range(num_frames)
        ]

        for cls in CLASS_NAMES:
            total_needed = targets[cls]
            base   = total_needed // num_frames
            extra  = total_needed  % num_frames

            for idx in range(num_frames):
                per_frame_counts[idx][cls] = base + (1 if idx < extra else 0)

        return per_frame_counts

    # ------------------------------------------------------------------
    # Sinh một frame
    # ------------------------------------------------------------------

    def _generate_and_save_frame(
        self,
        seq_id   : int,
        frame_idx: int,
        split    : str,
        counts   : Dict[str, int],
        env      : WarehouseSimulationEnvironment,
    ) -> int:
        """
        Sinh 1 frame + nhãn, lưu vào disk.
        Trả về tổng số instances đã gán nhãn.
        """
        frame, annotations = env.generate_frame(counts)

        stem      = f"seq{seq_id:02d}_frame{frame_idx:03d}"
        img_path  = self.output_root / "images" / split / f"{stem}.jpg"
        lbl_path  = self.output_root / "labels" / split / f"{stem}.txt"

        # Lưu ảnh JPEG (quality 90 — cân bằng dung lượng / chất lượng)
        frame.save(str(img_path), format="JPEG", quality=90)

        # Lưu nhãn YOLO
        lines = []
        for ann in annotations:
            lines.append(
                f"{ann['class_id']} {ann['cx']:.6f} {ann['cy']:.6f} "
                f"{ann['bw']:.6f} {ann['bh']:.6f}"
            )
        lbl_path.write_text("\n".join(lines), encoding="utf-8")

        return len(annotations)

    # ------------------------------------------------------------------
    # API chính
    # ------------------------------------------------------------------

    def generate_split(self, split: str) -> Dict[str, int]:
        """
        Sinh toàn bộ dữ liệu cho một split (train / val / test).

        Returns:
            summary dict: {"frames": int, per_class_counts...}
        """
        assert split in ("train", "val", "test"), f"Split không hợp lệ: {split}"

        seq_start, seq_end = SPLIT_RANGES[split]
        per_frame_counts   = self._compute_per_frame_counts(split)

        frame_global_idx = 0
        summary_counts   = {cls: 0 for cls in CLASS_NAMES}
        total_frames_done = 0

        t0 = time.time()

        for seq_id in range(seq_start, seq_end + 1):
            # Mỗi sequence có seed riêng → đảm bảo reproducibility
            env = WarehouseSimulationEnvironment(
                seed=PIPELINE_CONFIG["simulation"]["random_seed_base"] + seq_id
            )

            for fi in range(FRAMES_PER_SEQ):
                counts = per_frame_counts[frame_global_idx]
                n_inst = self._generate_and_save_frame(
                    seq_id=seq_id, frame_idx=fi,
                    split=split, counts=counts, env=env
                )

                for cls in CLASS_NAMES:
                    summary_counts[cls] += counts[cls]

                frame_global_idx  += 1
                total_frames_done += 1

                if self.verbose and total_frames_done % 100 == 0:
                    elapsed = time.time() - t0
                    print(
                        f"  [{split.upper()}] {total_frames_done} frames done "
                        f"| {elapsed:.1f}s elapsed"
                    )

        elapsed = time.time() - t0
        summary = {"frames": total_frames_done, **summary_counts}

        if self.verbose:
            print(f"\n  [{split.upper()}] DONE: {total_frames_done} frames in {elapsed:.1f}s")
            print(f"  Instance counts : {summary_counts}")
            expected = INSTANCE_COUNTS[split]
            ok = all(summary_counts[c] == expected[c] for c in CLASS_NAMES)
            print(f"  Match Bảng 5.2  : {'OK' if ok else 'FAIL'}")
            if not ok:
                for c in CLASS_NAMES:
                    if summary_counts[c] != expected[c]:
                        print(f"    {c}: got {summary_counts[c]}, expected {expected[c]}")

        return summary

    def generate_all(self) -> Dict[str, Dict]:
        """
        Sinh toàn bộ dataset (train + val + test).
        Tổng: 2.500 frames / 13.530 instances.
        """
        sys.stdout.reconfigure(encoding="utf-8")
        print("=" * 60)
        print("LOG-106: Tu sinh va gan nhan 2500 frames 4 lop YOLO")
        print("=" * 60)

        results = {}
        grand_total_frames    = 0
        grand_total_instances = 0

        for split in ("train", "val", "test"):
            print(f"\n--- Generating {split.upper()} split ---")
            summary = self.generate_split(split)
            results[split] = summary
            grand_total_frames    += summary["frames"]
            grand_total_instances += sum(summary[c] for c in CLASS_NAMES)

        print("\n" + "=" * 60)
        print(f"GRAND TOTAL: {grand_total_frames} frames | "
              f"{grand_total_instances} instances")
        print(f"Expected   : {TOTAL_FRAMES} frames | "
              f"{INSTANCE_COUNTS['overall']['total']} instances")
        overall_ok = (
            grand_total_frames    == TOTAL_FRAMES and
            grand_total_instances == INSTANCE_COUNTS["overall"]["total"]
        )
        print(f"Match Bảng 5.2 Overall: {'OK' if overall_ok else 'FAIL'}")
        print("=" * 60)

        return results

    # ------------------------------------------------------------------
    # Verify
    # ------------------------------------------------------------------

    def verify_counts(self) -> bool:
        """
        Kiểm tra số file thực tế trên disk khớp với config.
        Dùng sau khi generate_all() hoàn thành.
        """
        ok = True
        expected_frames = {"train": 1750, "val": 500, "test": 250}

        for split, exp_count in expected_frames.items():
            img_dir = self.output_root / "images" / split
            lbl_dir = self.output_root / "labels" / split
            n_img   = len(list(img_dir.glob("*.jpg")))
            n_lbl   = len(list(lbl_dir.glob("*.txt")))

            if n_img != exp_count or n_lbl != exp_count:
                print(f"  [FAIL] {split}: images={n_img}, labels={n_lbl}, expected={exp_count}")
                ok = False
            else:
                print(f"  [OK]   {split}: {n_img} images + {n_lbl} labels")

        return ok


# ---------------------------------------------------------------------------
# Entry-point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")

    annotator = DatasetAnnotator(output_root="data", verbose=True)
    results   = annotator.generate_all()

    print("\n--- Verify file counts on disk ---")
    annotator.verify_counts()
