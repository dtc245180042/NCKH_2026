# LỘ TRÌNH KỸ THUẬT PHÁT TRIỂN MÃ NGUỒN (CODING ROADMAP)
## HỆ THỐNG AI TRUY VẾT VÀ ĐIỀU PHỐI HÀNG HÓA TRONG KHO THÔNG MINH
**Đề tài:** SV2026-ICTU-08 | **Kiến trúc:** FastAPI + MySQL + YOLOv12 + ByteTrack + A* + Canvas 2D

---

## 1. NGUYÊN TẮC QUẢN LÝ MÃ NGUỒN VÀ TÀI NGUYÊN DỰ ÁN
1. **Chỉ đẩy lên Git những gì của chung cả nhóm dùng được:**
   - Mã nguồn chuẩn, cấu trúc CSDL dùng chung, tài liệu, tests.
   - Tuyệt đối KHÔNG đẩy cấu hình cá nhân, file `.env`, mật khẩu cá nhân, log máy cục bộ.
2. **Quy trình 3 bước:**
   - Mọi giai đoạn dưới đây đều phải: *Lập kế hoạch chi tiết* $\to$ *Dừng chờ User DUYỆT* $\to$ *Thực hiện trong phạm vi*.
3. **Kỷ luật Git:**
   - Không tự ý commit hoặc push khi chưa có lệnh tường minh từ User.

---

## 2. LỘ TRÌNH TRIỂN KHAI 6 GIAI ĐOẠN

```
[GIAI ĐOẠN 1] ──> [GIAI ĐOẠN 2] ──> [GIAI ĐOẠN 3] ──> [GIAI ĐOẠN 4] ──> [GIAI ĐOẠN 5] ──> [GIAI ĐOẠN 6]
 Khung FastAPI     CSDL MySQL 3NF    Thị giác AI        Điều phối AMR     WebSocket 60FPS   Kiểm thử 35 TC
 & Config .env     & Auth JWT        YOLOv12+ByteTrack  A* & Cổng IoT     & Canvas 2D UI    & Benchmark
```

---

### GIAI ĐOẠN 1: KHỞI TẠO KHUNG DỰ ÁN VÀ CẤU HÌNH (.ENV & CONFIG)
- **Mục tiêu:** Tạo bộ khung dự án FastAPI chuẩn, thiết lập file `.env.example` dùng chung cho nhóm và cấu hình nạp biến môi trường an toàn qua `pydantic-settings`.
- **File dự kiến tạo:**
  - `requirements.txt`: Khai báo các thư viện phụ thuộc (`fastapi`, `uvicorn`, `sqlalchemy`, `pymysql`, `cryptography`, `pydantic-settings`, `python-jose`, `passlib[bcrypt]`, `opencv-python`, `numpy`, `pytest`).
  - `.env.example`: Mẫu cấu hình dùng chung (không chứa mật khẩu thật):
    ```env
    PROJECT_NAME="AI Smart Logistics Tracking System"
    MYSQL_SERVER=localhost
    MYSQL_PORT=3306
    MYSQL_USER=root
    MYSQL_PASSWORD=your_password_here
    MYSQL_DB=ai_logistics_db
    SECRET_KEY=change_this_to_a_secure_random_key
    ALGORITHM=HS256
    ACCESS_TOKEN_EXPIRE_MINUTES=480
    ```
  - `app/core/config.py`: Module đọc biến môi trường, tự sinh URL kết nối `mysql+pymysql://`.

---

### GIAI ĐOẠN 2: THIẾT KẾ CƠ SỞ DỮ LIỆU MYSQL VÀ XÁC THỰC (AUTH)
- **Mục tiêu:** Cài đặt 6 bảng dữ liệu chuẩn 3NF trên MySQL bằng SQLAlchemy 2.0 Declarative Base; xây dựng module đăng nhập JWT và phân quyền 3 vai trò (Admin, Operator, Viewer).
- **File dự kiến tạo:**
  - `app/core/database.py`: Quản lý engine kết nối MySQL pool và SessionLocal generator.
  - `app/models/user.py`: Bảng `users` (mật khẩu mã hóa bcrypt).
  - `app/models/storage_location.py`: Bảng `storage_locations` (danh mục ô kệ, tọa độ X/Y).
  - `app/models/sorting_gate.py`: Bảng `sorting_gates` (cổng 1, 2, 3, vạch kích hoạt).
  - `app/models/package.py`: Bảng `packages` (mã vạch, điểm đến, trạng thái, liên kết ô kệ).
  - `app/models/tracking_session.py`: Bảng `tracking_sessions` (lưu ID từ ByteTrack, độ tin cậy).
  - `app/models/system_log.py`: Bảng `system_logs` (nhật ký kiểm toán sự kiện).
  - `app/core/security.py`: Hàm tạo và kiểm tra JWT token, hash mật khẩu.
  - `app/api/v1/auth.py`: Router `/api/v1/auth/login`, `/api/v1/auth/me`.

---

### GIAI ĐOẠN 3: THUẬT TOÁN THỊ GIÁC AI (YOLOV12 + BYTETRACK PIPELINE)
- **Mục tiêu:** Xây dựng module nhận diện đối tượng và thuật toán truy vết đa đối tượng ByteTrack (Kalman Filter 8D + Hungarian matching 2 giai đoạn), giải quyết bài toán che khuất.
- **File dự kiến tạo:**
  - `app/services/yolo_detector.py`: Tải trọng số `weights/yolo12n_logistics.pt`, tiền xử lý ảnh 640x640, lọc bounding box theo ngưỡng tin cậy.
  - `app/services/kalman_filter.py`: Bộ lọc Kalman 8 chiều $(x_c, y_c, a, h, v_x, v_y, v_a, v_h)$ dự đoán vị trí.
  - `app/services/byte_tracker.py`: Giải thuật ghép đôi 2 giai đoạn (High-score $\ge 0.6$ và Low-score $0.1 \le conf < 0.6$).
  - `app/services/ai_pipeline.py`: Tiếp nhận frame từ camera ảo, chạy detector $\to$ tracker $\to$ xuất danh sách active tracks.

---

### GIAI ĐOẠN 4: ĐIỀU PHỐI ROBOT AMR (A\*) VÀ ĐIỀU KHIỂN CỔNG IOT
- **Mục tiêu:** Cài đặt thuật toán tìm đường ngắn nhất A* trên lưới ô vuông bản đồ kho, tránh vật cản động; logic phân loại bưu kiện qua 3 cổng IoT và làn Re-check.
- **File dự kiến tạo:**
  - `app/services/a_star.py`: Thuật toán A* với hàm heuristic Manhattan cho 4 hướng và Chebyshev cho 8 hướng.
  - `app/services/amr_dispatcher.py`: Quản lý trạng thái xe AMR, cơ chế phanh an toàn và Local Re-planning khi gặp chướng ngại vật bất ngờ.
  - `app/services/sorting_controller.py`: Ánh xạ mã vùng bưu chính vào Cổng 1 (Miền Bắc), Cổng 2 (Miền Trung), Cổng 3 (Miền Nam), làn kiểm tra lại; xử lý ngoại lệ chống kẹt cổng (Anti-jam).
  - `app/api/v1/amr.py`, `app/api/v1/iot.py`: Các endpoint REST phục vụ điều khiển.

---

### GIAI ĐOẠN 5: ĐỘNG CƠ MÔ PHỎNG, WEBSOCKET VÀ CANVAS 2D UI
- **Mục tiêu:** Xây dựng kênh truyền dữ liệu thời gian thực 60 FPS qua WebSocket và giao diện trực quan hóa trên trình duyệt HTML5 Canvas 2D.
- **File dự kiến tạo:**
  - `app/services/simulation_engine.py`: Vòng lặp mô phỏng vật lý chuyển động kiện hàng trên băng chuyền và xe AMR.
  - `app/api/websocket.py`: Endpoint `/ws/simulation/stream` broadcast trạng thái kho bãi liên tục 60 FPS.
  - `app/static/index.html`: Dashboard giao diện điều hành.
  - `app/static/js/canvas_sim.js`: Dựng hình Canvas 2D mượt mà (băng chuyền, kiện hàng, vệt tracking ID, lộ trình AMR).
  - `app/static/js/dashboard.js`: Nhận dữ liệu WebSocket, cập nhật biểu đồ KPI thời gian thực.
  - `app/main.py`: Khởi chạy FastAPI application, mount static files và routers.

---

### GIAI ĐOẠN 6: BỘ KIỂM THỬ TỰ ĐỘNG & BÁO CÁO KẾT QUẢ THỰC NGHIỆM
- **Mục tiêu:** Kiểm thử toàn bộ 35 Test Cases (Phụ lục C) và xuất kết quả đo lường khoa học (FPS, độ trễ, MOTA, IDF1).
- **File dự kiến tạo:**
  - `tests/test_auth.py`: TC-01 đến TC-05.
  - `tests/test_warehouse.py`: TC-06 đến TC-13.
  - `tests/test_ai_tracking.py`: TC-14 đến TC-21.
  - `tests/test_iot_sorting.py`: TC-22 đến TC-27.
  - `tests/test_amr_a_star.py`: TC-28 đến TC-31.
  - `tests/test_canvas_websocket.py`: TC-32 đến TC-35.
  - `tests/benchmark_performance.py`: Đo FPS và Latency theo mật độ đối tượng.

