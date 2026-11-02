"""
dataset_splitter.py — Chia tập dữ liệu theo chuỗi video (sequence-level split)
Tác giả: Bùi Thị Loan | LOG-107
Dự án: NCKH SV2026-ICTU-08 | ICTU

Mô tả:
  SequenceDatasetSplitter thực hiện sequence-level split (KHÔNG phải frame-level)
  để CHỐNG DATA LEAKAGE giữa các tập train/val/test.

  Nguyên tắc: Frames trong cùng một chuỗi video (sequence) luôn nằm
  trong cùng một split. Điều này đảm bảo mô hình không "nhìn thấy"
  các frame gần giống nhau ở cả train và val/test.

  Phân chia (khớp config.yaml):
    Train : sequence 00–34  →  35 sequences × 50 frames = 1.750 frames
    Val   : sequence 35–44  →  10 sequences × 50 frames =   500 frames
    Test  : sequence 45–49  →   5 sequences × 50 frames =   250 frames

  Output chính: data/data.yaml (Ultralytics-compatible)
"""

import sys
import os
import yaml
from pathlib import Path
from typing import Dict, List, Set, Tuple

from .config import PIPELINE_CONFIG, DATASET_CFG, PATHS, CLASS_NAMES, NUM_CLASSES
from .utils import ensure_dirs, count_files

# ------------------------------------------------------------------
# Hằng số
# ------------------------------------------------------------------
_SPLIT_SEQ_RANGES = {
    "train": (0,  34),
    "val"  : (35, 44),
    "test" : (45, 49),
}
_FRAMES_PER_SEQ = DATASET_CFG["frames_per_sequence"]   # 50


class SequenceDatasetSplitter:
    """
    Kiểm tra và xác nhận tính đúng đắn của sequence-level split đã được
    DatasetAnnotator tạo ra; đồng thời sinh file data.yaml chuẩn Ultralytics.

    Lưu ý: Splitter KHÔNG di chuyển file — DatasetAnnotator đã đặt file
    vào đúng thư mục (train/val/test). Splitter chỉ VERIFY và sinh data.yaml.
    """

    def __init__(self, data_root: str = "data"):
        self.data_root = Path(data_root)

    # ------------------------------------------------------------------
    # Sequence → Split mapping
    # ------------------------------------------------------------------

    @staticmethod
    def get_sequences_for_split(split: str) -> List[int]:
        """Trả về danh sách seq_id thuộc split."""
        start, end = _SPLIT_SEQ_RANGES[split]
        return list(range(start, end + 1))

    @staticmethod
    def get_split_for_sequence(seq_id: int) -> str:
        """Trả về tên split ('train'/'val'/'test') của một sequence."""
        for split, (start, end) in _SPLIT_SEQ_RANGES.items():
            if start <= seq_id <= end:
                return split
        raise ValueError(f"seq_id {seq_id} ngoài dải hợp lệ 0–49")

    @staticmethod
    def extract_seq_id_from_filename(filename: str) -> int:
        """
        Trích seq_id từ tên file chuẩn 'seq{XX}_frame{YYY}.jpg/.txt'.
        Ví dụ: 'seq07_frame023.jpg' → 7
        """
        stem = Path(filename).stem   # 'seq07_frame023'
        parts = stem.split("_")      # ['seq07', 'frame023']
        assert parts[0].startswith("seq"), f"Tên file không đúng chuẩn: {filename}"
        return int(parts[0][3:])     # int('07') = 7

    # ------------------------------------------------------------------
    # Verify no leakage
    # ------------------------------------------------------------------

    def verify_no_leakage(self) -> bool:
        """
        Kiểm tra KHÔNG có data leakage:
          - Không sequence nào xuất hiện ở hơn 1 split.
          - Mỗi file nằm đúng thư mục split của sequence đó.

        Returns:
            True nếu không có leakage, False nếu phát hiện lỗi.
        """
        print("\n=== Verify No Data Leakage ===")
        seq_to_splits: Dict[int, Set[str]] = {}
        errors = []

        for split in ("train", "val", "test"):
            img_dir = self.data_root / "images" / split
            if not img_dir.exists():
                print(f"  [WARN] {img_dir} chưa tồn tại — bỏ qua split {split}")
                continue

            for img_file in sorted(img_dir.glob("*.jpg")):
                try:
                    seq_id = self.extract_seq_id_from_filename(img_file.name)
                except (AssertionError, ValueError, IndexError) as e:
                    errors.append(f"File name error: {img_file.name} — {e}")
                    continue

                # Ghi nhận split của sequence này
                if seq_id not in seq_to_splits:
                    seq_to_splits[seq_id] = set()
                seq_to_splits[seq_id].add(split)

                # Kiểm tra seq_id có đúng split không
                expected_split = self.get_split_for_sequence(seq_id)
                if expected_split != split:
                    errors.append(
                        f"LEAKAGE: {img_file.name} nằm trong '{split}' "
                        f"nhưng seq{seq_id:02d} thuộc '{expected_split}'"
                    )

        # Kiểm tra không sequence nào ở nhiều split
        for seq_id, splits in seq_to_splits.items():
            if len(splits) > 1:
                errors.append(
                    f"LEAKAGE: seq{seq_id:02d} xuất hiện ở cả {splits}"
                )

        if errors:
            print(f"  [FAIL] Phát hiện {len(errors)} lỗi:")
            for err in errors:
                print(f"    - {err}")
            return False

        print(f"  [OK] Kiểm tra {len(seq_to_splits)} sequences — "
              f"KHÔNG phát hiện data leakage")
        return True

    # ------------------------------------------------------------------
    # Verify frame counts
    # ------------------------------------------------------------------

    def verify_frame_counts(self) -> bool:
        """
        Kiểm tra số lượng file ảnh + nhãn khớp với Bảng 5.2.
        """
        print("\n=== Verify Frame Counts (Bảng 5.2) ===")
        expected = {"train": 1750, "val": 500, "test": 250}
        ok = True

        for split, exp in expected.items():
            img_dir = self.data_root / "images" / split
            lbl_dir = self.data_root / "labels" / split
            n_img   = count_files(img_dir, ".jpg") if img_dir.exists() else 0
            n_lbl   = count_files(lbl_dir, ".txt") if lbl_dir.exists() else 0

            status = "OK" if (n_img == exp and n_lbl == exp) else "FAIL"
            print(f"  [{status}] {split:5s}: images={n_img:4d}, labels={n_lbl:4d}, expected={exp}")
            if status == "FAIL":
                ok = False

        total_img = sum(
            count_files(self.data_root / "images" / s, ".jpg") for s in expected
        )
        print(f"  Total images: {total_img} (expected 2500)")
        return ok

    # ------------------------------------------------------------------
    # Sinh data.yaml
    # ------------------------------------------------------------------

    def generate_data_yaml(self, save_path: str = None) -> Path:
        """
        Sinh file data.yaml tương thích Ultralytics YOLO.

        Format chuẩn:
            path: ../data
            train: images/train
            val:   images/val
            test:  images/test
            nc: 4
            names: ['package', 'pallet', 'vehicle', 'person']

        Args:
            save_path: Đường dẫn lưu file. Mặc định = data/data.yaml
        Returns:
            Path tới file data.yaml đã tạo.
        """
        if save_path is None:
            save_path = self.data_root / "data.yaml"
        save_path = Path(save_path)

        # Đường dẫn tương đối từ thư mục gốc dự án
        data_yaml_content = {
            "path" : str(self.data_root.resolve()),  # absolute path để Ultralytics tìm đúng
            "train": "images/train",
            "val"  : "images/val",
            "test" : "images/test",
            "nc"   : NUM_CLASSES,
            "names": CLASS_NAMES,
        }

        # Thêm comment metadata
        header_comment = (
            "# data.yaml — Ultralytics YOLO Dataset Config\n"
            "# Du an: NCKH SV2026-ICTU-08 | ICTU\n"
            "# Tac gia: Bui Thi Loan (LOG-107)\n"
            "# Split: sequence-level (chong data leakage)\n"
            "# Train: seq00-34 (1750 frames) | Val: seq35-44 (500) | Test: seq45-49 (250)\n"
        )

        ensure_dirs(save_path.parent)
        with open(save_path, "w", encoding="utf-8") as f:
            f.write(header_comment)
            yaml.dump(data_yaml_content, f, default_flow_style=False, allow_unicode=True)

        print(f"\n  [SAVED] {save_path}")
        return save_path

    # ------------------------------------------------------------------
    # Báo cáo tổng hợp
    # ------------------------------------------------------------------

    def report(self) -> Dict:
        """
        Tạo báo cáo tổng hợp: frame counts + sequence distribution.
        """
        report_data = {"splits": {}}

        for split in ("train", "val", "test"):
            seqs     = self.get_sequences_for_split(split)
            img_dir  = self.data_root / "images" / split
            n_frames = count_files(img_dir, ".jpg") if img_dir.exists() else 0
            report_data["splits"][split] = {
                "sequences"         : seqs,
                "num_sequences"     : len(seqs),
                "num_frames"        : n_frames,
                "expected_frames"   : len(seqs) * _FRAMES_PER_SEQ,
            }

        return report_data

    def run(self) -> bool:
        """
        Chạy toàn bộ: verify frame counts → verify no leakage → sinh data.yaml.

        Returns:
            True nếu tất cả kiểm tra pass.
        """
        sys.stdout.reconfigure(encoding="utf-8")
        print("=" * 60)
        print("LOG-107: Sequence-level split 70-20-10 chong data leakage")
        print("=" * 60)

        count_ok   = self.verify_frame_counts()
        leakage_ok = self.verify_no_leakage()

        yaml_path = self.generate_data_yaml()

        # In báo cáo phân phối
        rpt = self.report()
        print("\n=== Sequence Distribution ===")
        for split, info in rpt["splits"].items():
            seq_range = f"seq{info['sequences'][0]:02d}–seq{info['sequences'][-1]:02d}"
            print(
                f"  {split:5s}: {info['num_sequences']:2d} sequences "
                f"({seq_range}) → {info['num_frames']} frames"
            )

        all_ok = count_ok and leakage_ok
        print(f"\n{'='*60}")
        print(f"LOG-107 STATUS: {'PASS' if all_ok else 'FAIL'}")
        print(f"{'='*60}")

        return all_ok


# ---------------------------------------------------------------------------
# Entry-point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    splitter = SequenceDatasetSplitter(data_root="data")
    splitter.run()
