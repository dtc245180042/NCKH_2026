"""
config.py — Load cấu hình từ config.yaml
Tác giả: Bùi Thị Loan | LOG-105
"""

import os
import yaml
from pathlib import Path

# Đường dẫn tới config.yaml (cùng thư mục với file này)
_CONFIG_PATH = Path(__file__).parent / "config.yaml"


def load_config(path: str | Path = _CONFIG_PATH) -> dict:
    """Đọc và trả về toàn bộ cấu hình từ YAML."""
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


# Singleton — import một lần, dùng toàn project
PIPELINE_CONFIG: dict = load_config()

# Shortcut thường dùng
DATASET_CFG: dict = PIPELINE_CONFIG["dataset"]
SIM_CFG: dict = PIPELINE_CONFIG["simulation"]
TRAIN_CFG: dict = PIPELINE_CONFIG["training"]
MODEL_CFG: dict = PIPELINE_CONFIG["model"]
CLASSES: list[dict] = PIPELINE_CONFIG["classes"]
PATHS: dict = PIPELINE_CONFIG["paths"]
CLASS_NAMES: list[str] = [c["name"] for c in CLASSES]  # ['package','pallet','vehicle','person']
NUM_CLASSES: int = len(CLASS_NAMES)


if __name__ == "__main__":
    print("=== PIPELINE CONFIG LOADED ===")
    print(f"Total frames : {DATASET_CFG['total_frames']}")
    print(f"Classes      : {CLASS_NAMES}")
    print(f"Model target : mAP@0.5 = {MODEL_CFG['target_map50']*100:.1f}%")
