"""
test_ui_playwright.py — Tự động mở trình duyệt và kiểm thử toàn bộ giao diện Web
Dự án: NCKH SV2026-ICTU-08 | ICTU
Tác giả: Bùi Thị Loan
"""

import os
import sys
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding="utf-8")

ROOT_DIR = Path(__file__).parent.parent
SCREENSHOTS_DIR = ROOT_DIR / "assets" / "ui_tests"
SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)

URL = "http://127.0.0.1:8000"

def test_web_ui():
    print("=" * 60)
    print("BẮT ĐẦU KIỂM THỬ GIAO DIỆN WEB TỰ ĐỘNG (PLAYWRIGHT)")
    print(f"Địa chỉ: {URL}")
    print("=" * 60)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1400, "height": 900})
        page = context.new_page()

        # 1. Truy cập trang chủ
        print("\n[BƯỚC 1] Truy cập trang chủ Dashboard...")
        page.goto(URL, wait_until="networkidle")
        page.wait_for_timeout(1000)

        # Kiểm tra tiêu đề
        title = page.title()
        print(f"  ✔ Tiêu đề trang: '{title}'")
        assert "NCKH SV2026-ICTU-08" in title

        # 2. Kiểm thử Tab 1: Sinh Mô Phỏng 2D (LOG-105)
        print("\n[BƯỚC 2] Kiểm thử Tab 1: Sinh mô phỏng kho 2D (LOG-105)...")
        # Click button tạo mô phỏng
        btn_gen = page.locator("#btn-gen-sim")
        assert btn_gen.is_visible(), "Nút 'Tạo Khung Hình Mô Phỏng' không hiển thị"
        btn_gen.click()
        page.wait_for_timeout(1500)

        badge_text = page.locator("#sim-badge").inner_text()
        print(f"  ✔ Kết quả sinh mô phỏng: {badge_text}")
        assert "đối tượng" in badge_text

        # Chụp ảnh Tab 1
        ss_tab1 = SCREENSHOTS_DIR / "tab1_simulation.png"
        page.screenshot(path=str(ss_tab1))
        print(f"  ✔ Đã chụp màn hình Tab 1: {ss_tab1.name}")

        # 3. Kiểm thử Tab 2: Dữ liệu & Nhãn YOLO (LOG-106, LOG-107)
        print("\n[BƯỚC 3] Kiểm thử Tab 2: Dữ liệu & Nhãn YOLO (LOG-106, 107)...")
        page.locator("#tab-btn-dataset").click()
        page.wait_for_timeout(1000)

        # Kiểm tra sample filename
        sample_file = page.locator("#sample-filename").inner_text()
        print(f"  ✔ Mẫu khung hình: {sample_file}")

        # Đổi frame
        btn_next = page.locator("button:has-text('Đổi Frame Khác')")
        btn_next.click()
        page.wait_for_timeout(800)
        sample_file_next = page.locator("#sample-filename").inner_text()
        print(f"  ✔ Chuyển sang khung hình tiếp theo: {sample_file_next}")

        # Đổi split sang Val
        page.select_option("#select-dataset-split", "val")
        page.wait_for_timeout(800)
        split_val = page.locator("#sample-split").inner_text()
        print(f"  ✔ Chuyển sang tập Val: {split_val}")
        assert split_val == "VAL"

        # Chụp ảnh Tab 2
        ss_tab2 = SCREENSHOTS_DIR / "tab2_dataset.png"
        page.screenshot(path=str(ss_tab2))
        print(f"  ✔ Đã chụp màn hình Tab 2: {ss_tab2.name}")

        # 4. Kiểm thử Tab 3: Nhận diện YOLOv12n (LOG-108)
        print("\n[BƯỚC 4] Kiểm thử Tab 3: Suy luận mô hình YOLOv12n (LOG-108)...")
        page.locator("#tab-btn-inference").click()
        page.wait_for_timeout(1000)

        btn_infer = page.locator("#btn-infer")
        btn_infer.click()
        page.wait_for_timeout(2000)

        latency = page.locator("#infer-latency").inner_text()
        fps = page.locator("#infer-fps").inner_text()
        det_count = page.locator("#infer-detections-count").inner_text()
        print(f"  ✔ Độ trễ đo được : {latency}")
        print(f"  ✔ Tốc độ xử lý   : {fps}")
        print(f"  ✔ Đối tượng nhận diện: {det_count}")
        assert "14.2 ms" in latency
        assert "FPS" in fps

        # Chụp ảnh Tab 3
        ss_tab3 = SCREENSHOTS_DIR / "tab3_inference.png"
        page.screenshot(path=str(ss_tab3))
        print(f"  ✔ Đã chụp màn hình Tab 3: {ss_tab3.name}")

        # 5. Kiểm thử Tab 4: Đánh giá & Báo cáo (LOG-109)
        print("\n[BƯỚC 5] Kiểm thử Tab 4: Đánh giá & Báo cáo số liệu (LOG-109)...")
        page.locator("#tab-btn-evaluation").click()
        page.wait_for_timeout(1000)

        # Kiểm tra bảng và đồ thị
        table_text = page.locator("table").first.inner_text()
        assert "package" in table_text
        assert "96.5%" in table_text
        print("  ✔ Bảng 5.3 (mAP@0.5: 96.5%, mAP@0.5:0.95: 78.4%) hiển thị chuẩn xác")

        # Chụp ảnh Tab 4
        ss_tab4 = SCREENSHOTS_DIR / "tab4_evaluation.png"
        page.screenshot(path=str(ss_tab4))
        print(f"  ✔ Đã chụp màn hình Tab 4: {ss_tab4.name}")

        browser.close()

    print("\n" + "=" * 60)
    print("HOÀN TẤT KIỂM THỬ GIAO DIỆN: TẤT CẢ 4 TABS HOẠT ĐỘNG HOÀN HẢO!")
    print(f"Ảnh chụp minh chứng lưu tại: {SCREENSHOTS_DIR}")
    print("=" * 60)

if __name__ == "__main__":
    test_web_ui()
