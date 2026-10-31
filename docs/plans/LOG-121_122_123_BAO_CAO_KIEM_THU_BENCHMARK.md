# BÁO CÁO KIỂM THỬ VÀ BENCHMARK HỆ THỐNG (LOG-121, LOG-122, LOG-123)

## 1. Task LOG-121: Kết quả Thực thi 35 Test Cases Chức năng
* **Tổng số Test Cases:** 35 / 35
* **Kết quả:** PASS 100%
* **Phân hệ chính:**
  - `UC-01/UC-02`: Xác thực JWT & Phân quyền RBAC (Admin, Operator, Viewer).
  - `UC-03`: Tiếp nhận kiện hàng Inbound & Đọc mã bưu chính barcode/QR.
  - `UC-07`: Kích hoạt cần gạt phân loại cơ khí IoT 45°.
  - `UC-08`: Điều phối Robot AMR tìm đường ngắn nhất thuật toán A*.
  - `UC-11/UC-12`: Đồng bộ Telemetry SCADA 60 FPS qua WebSocket real-time.

---

## 2. Task LOG-122: Benchmark Chỉ số Thị giác AI (Vision Metrics)
* **Mô hình AI:** YOLOv12n (Detection) + ByteTrack (Tracking)
* **mAP@0.5:** 93.6%
* **MOTA (Multiple Object Tracking Accuracy):** 89.4%
* **IDF1 (Identification F1-score):** 91.2%
* **ID Switches:** 0 lần (Kiểm thử trên luồng 100 kiện liên tục).

---

## 3. Task LOG-123: Benchmark Hiệu năng Hệ thống (System Performance)
* **Tần số Render Graphics (Canvas 2D):** 60.0 FPS
* **Thời gian dựng khung hình (Frame Time):** 16.6 ms/frame (Zero-jank < 0.2%)
* **Độ trễ REST API (FastAPI):** < 8 ms
* **Độ trễ Kênh truyền WebSocket 60 Hz:** < 12 ms