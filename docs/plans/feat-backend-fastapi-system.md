# Kế hoạch Thực hiện: Xây dựng Hệ thống Backend FastAPI, CSDL Chuẩn 3NF và WebSocket 60 FPS
- **Mã Task:** BACKEND-01 (Tích hợp hệ sinh thái AI Smart Logistics)
- **Branch:** `develop`
- **Người thực hiện:** Senior Fullstack / Backend Engineer (Nguyễn Văn Toàn - Chủ nhiệm đề tài)
- **Yêu cầu / Use Case liên quan:** Toàn bộ 13 Use Cases (UC-01 đến UC-13), đặc biệt:
  - UC-01, UC-02: Xác thực phân quyền RBAC & Quản lý User
  - UC-03: Tiếp nhận kiện hàng nhập kho (Inbound)
  - UC-06, UC-07: Gán nhãn ảo và điều phối cổng phân loại IoT
  - UC-08: Thuật toán tìm đường ngắn nhất A* cho Robot AMR
  - UC-10: Quản lý sơ đồ ô kệ lưu kho (Storage Locations)
  - UC-11: Thống kê năng suất và sản lượng
  - UC-12: Kênh truyền WebSocket 60 FPS đồng bộ Canvas 2D
  - Danh mục nhiệm vụ số 6 (DANH_SACH_VIEC_NHOM_CAN_LAM.md): Bổ sung `Dockerfile`
- **Trạng thái:** Đang triển khai (Human Gate 1 đã được phê duyệt theo chỉ đạo của nhóm trưởng)

---

## 1. Phân tích yêu cầu & Mục tiêu kỹ thuật

### 1.1. Mục tiêu chức năng:
- Xây dựng Backend chuẩn kiến trúc phân tầng (Layered Architecture): `api` -> `services` -> `schemas` -> `models` -> `core`.
- Khởi tạo hệ CSDL quan hệ chuẩn 3NF gồm đầy đủ **6 bảng thực thể**:
  1. `users` (Quản lý tài khoản, mật khẩu bcrypt, RBAC)
  2. `packages` (Quản lý kiện hàng, mã vạch, kích thước, trọng lượng, trạng thái)
  3. `storage_locations` (Danh mục ô kệ lưu kho bãi, tọa độ lưới, tải trọng)
  4. `sorting_gates` (Danh mục cổng phân loại IoT, vị trí băng tải, góc mở)
  5. `tracking_sessions` (Lưu nhật ký phiên truy vết AI ByteTrack và YOLO)
  6. `system_logs` (Nhật ký sự kiện điều phối SCADA, Audit trail)
- Cài đặt thuật toán tìm đường **A\*** (A-Star Pathfinding) cho robot tự hành AMR hỗ trợ hàm Heuristic Manhattan và Chebyshev.
- Cài đặt dịch vụ điều phối cổng phân loại IoT với cơ chế Virtual Attribution và chống kẹt hàng (Anti-Jam).
- Cài đặt kênh truyền thời gian thực **WebSocket `/ws/simulation/stream`** phát sóng trạng thái kho ở tốc độ 60 FPS (chu kỳ 16.6ms).
- Cung cấp trọn bộ RESTful API tài liệu hóa tự động qua Swagger UI (`/docs`).
- Tạo file `Dockerfile`, `docker-compose.yml`, `requirements.txt` và bộ unit test tự động.

### 1.2. Ràng buộc kỹ thuật & Quy chuẩn mã nguồn:
- Framework: **FastAPI (asyncio)**, **Pydantic v2**, **SQLAlchemy 2.0 ORM**.
- Bảo mật: Không hardcode mật khẩu, dùng biến môi trường qua `pydantic-settings`, mã hóa mật khẩu bcrypt, phân quyền RBAC.
- Hỗ trợ lưu trữ CSDL SQLite tự động cho chạy local/test và tương thích PostgreSQL trên production.

---

## 2. Danh sách File cần thay đổi & Thêm mới

| Đường dẫn File | Loại | Mục đích kỹ thuật |
| :--- | :--- | :--- |
| `docs/plans/feat-backend-fastapi-system.md` | Thêm mới | Bản kế hoạch kỹ thuật theo chuẩn Human Gate 1 |
| `app/core/config.py` | Thêm mới | Cấu hình biến môi trường với `pydantic-settings` |
| `app/core/database.py` | Thêm mới | Khởi tạo SQLAlchemy Engine, SessionLocal, Base và seed data |
| `app/core/security.py` | Thêm mới | Hàm băm bcrypt, tạo và xác thực JWT token |
| `app/models/*.py` | Thêm mới | Định nghĩa 6 bảng thực thể ORM chuẩn 3NF |
| `app/schemas/*.py` | Thêm mới | Định nghĩa các DTO Pydantic v2 cho request & response |
| `app/services/a_star.py` | Thêm mới | Giải thuật tìm đường tối ưu A* cho robot AMR |
| `app/services/sorting_service.py` | Thêm mới | Logic điều phối cổng IoT, chống kẹt hàng |
| `app/services/simulation_manager.py` | Thêm mới | Quản lý snapshot mô phỏng 60 FPS phục vụ WebSocket |
| `app/api/websocket.py` | Thêm mới | Endpoint WebSocket stream 60 FPS |
| `app/api/v1/*.py` | Thêm mới | Các REST API endpoints: auth, packages, warehouse, amr, iot, stats |
| `app/main.py` | Thêm mới | Ứng dụng FastAPI chính, tích hợp CORS, router, lifespan |
| `requirements.txt` | Thêm mới | Danh sách thư viện Python cần thiết |
| `Dockerfile` | Thêm mới | Container hóa ứng dụng đáp ứng mục 6 checklist nộp |
| `docker-compose.yml` | Thêm mới | File cấu hình triển khai nhanh |
| `tests/test_api.py` | Thêm mới | Bộ kiểm thử chức năng tự động |

---

## 3. Kế hoạch Tách Commit (Tuân thủ Commit Granularity)

- [ ] **Commit 1 (Tài liệu):** `docs(plan): lap ke hoach xay dung backend fastapi va csdl 3nf`
- [ ] **Commit 2 (Models & Database):** `feat(models): thiet ke csdl quan he 3nf 6 bang va khoi tao sqlalchemy orm`
- [ ] **Commit 3 (Schemas & Core Services):** `feat(services): cai dat thuat toan a-star amr, logic phan loai iot va schemas`
- [ ] **Commit 4 (API & WebSocket):** `feat(api): xay dung rest api endpoints va websocket stream 60 fps`
- [ ] **Commit 5 (Docker, Tests & Build):** `feat(deploy): bo sung dockerfile, docker-compose, requirements va test suite`

---

## 4. Kế hoạch Tự Kiểm tra & Thực nghiệm (Self-Verification)

- [ ] Kiểm tra tính toàn vẹn cú pháp các module Python.
- [ ] Kiểm tra tạo bảng CSDL tự động và nạp dữ liệu mẫu ban đầu (Seed data).
- [ ] Chạy thử nghiệm giải thuật A* tìm đường tránh vật cản với thời gian tính toán $< 10$ ms.
- [ ] Kiểm tra endpoint WebSocket stream và các REST API endpoints qua test suite.
