# Kế hoạch Thực hiện: Thiết kế và Lập trình Giao diện Mô phỏng HTML5 Canvas 2D mượt mà 60 FPS (Task LOG-119)
- **Mã Task:** LOG-119 (Sprint 5)
- **Branch:** `develop` (Tích hợp trung tâm theo chỉ định)
- **Người thực hiện:** Senior Frontend Engineer (Nguyễn Văn Toàn - Chủ nhiệm đề tài phụ trách tích hợp hệ thống)
- **Yêu cầu / Use Case liên quan:** UC-12 (Trực quan hóa mô phỏng thời gian thực Canvas 2D), NFR-01 (Hiệu năng 60 FPS, độ trễ < 50ms), UC-03 (Inbound), UC-07 (Cổng IoT)
- **Trạng thái:** Sẵn sàng triển khai (Human Gate 1 - Đã phê duyệt theo yêu cầu nhiệm vụ)

---

## 1. Phân tích yêu cầu & Mục tiêu kỹ thuật

### 1.1. Mục tiêu chức năng:
- Xây dựng giao diện web trực quan hóa mô phỏng 2D cho hệ thống kho thông minh (AI Smart Logistics).
- Thiết lập vòng lặp đồ họa chuẩn bằng `requestAnimationFrame` đảm bảo mượt mà 60 FPS với cơ chế đồng bộ theo thời gian thực (`delta-time`).
- Tích hợp bộ đếm FPS thời gian thực (Real-time FPS Counter, frame time tính theo mili-giây) hiển thị trực tiếp ở góc Canvas và thanh chỉ số.
- Thiết kế sơ đồ mặt bằng kho thông minh đầy đủ các phân khu:
  1. **Cổng tiếp nhận Inbound (Receiving Dock):** Nơi dỡ hàng, máy quét và cấp phát kiện hàng vào băng chuyền.
  2. **Hệ thống băng chuyền phân loại (Conveyor Belt Network):** Băng chuyền chính và các nhánh rẽ với họa tiết con lăn chuyển động mượt mà.
  3. **Cổng phân loại cơ khí IoT (Sorting Diverter Gates):** Cần gạt mở góc 45 độ tự động kích hoạt khi kiện hàng đi qua vạch cảm biến quang học (Trigger Line).
  4. **Cổng xuất hàng Outbound (Shipping Docks):** Các cửa xuất hàng phân theo vùng miền (Hà Nội, Đà Nẵng, TP.HCM, Quốc tế).
  5. **Khu vực ô kệ lưu kho (Storage Racks) & Robot tự hành AMR:** AMR di chuyển điều phối pallet trên sàn kho.
  6. **Hiển thị AI Vision giả lập:** Bounding Box YOLOv12, nhãn độ tin cậy, ByteTrack `track_id` và vệt truy vết (Tracking Trails).

### 1.2. Luồng dữ liệu (Data & User Flow):
1. Khởi tạo Canvas với tỉ lệ High-DPI (`window.devicePixelRatio`).
2. Vòng lặp `requestAnimationFrame` tính toán `deltaTime = (now - lastTime) / 1000`.
3. Cập nhật vị trí tọa độ các kiện hàng, cần gạt cổng phân loại, robot AMR dựa trên tốc độ và quãng đường.
4. Xóa Canvas và kết xuất đồ họa theo thứ tự phân tầng (Z-index): Nền kho -> Vạch kẻ/Ô kệ -> Băng chuyền -> Cần gạt/Cảm biến -> Robot AMR -> Kiện hàng & Tracking Trail -> Bounding Box AI -> HUD & Bộ đếm FPS.
5. Người dùng tương tác: Play/Pause, chỉnh tốc độ (0.5x, 1x, 2x, 4x), kích hoạt thêm kiện hàng thủ công, bật/tắt các lớp hiển thị (AI Bounding Box, Tracking Trails, Sensor Lines).

### 1.3. Ràng buộc hiệu năng & Quy chuẩn kỹ thuật:
- Đảm bảo ổn định **60 FPS** (frame time $\le 16.67$ ms), không giật lag (zero jank).
- Tối ưu hóa bộ nhớ: Hạn chế rác bộ nhớ (Garbage Collection pauses) trong render loop bằng cách tái sử dụng đối tượng và không cấp phát mảng tạm thời trong vòng lặp vẽ.
- Clean Code: Mã nguồn viết theo mô hình hướng đối tượng (OOP) module hóa, có JSDoc và chú thích chi tiết bằng tiếng Việt.

---

## 2. Danh sách File cần thay đổi (Kèm lý do)

| Đường dẫn File | Loại thay đổi | Mục đích / Lý do kỹ thuật |
| :--- | :--- | :--- |
| `docs/plans/feat-canvas-2d-simulation.md` | Thêm mới | Hồ sơ kế hoạch thực hiện theo chuẩn quy trình Git & Human Gate 1 |
| `src/index.html` | Thêm mới | Cấu trúc giao diện HTML5, Canvas viewport, thanh trạng thái FPS, bảng điều khiển SCADA |
| `src/styles.css` | Thêm mới | Thiết kế giao diện phong cách Dark Tech / Logistics Dashboard hiện đại, mượt mà |
| `src/main.js` | Thêm mới | Engine mô phỏng 60 FPS, vòng lặp `requestAnimationFrame`, tính toán FPS, hệ thống băng chuyền, kiện hàng, cổng IoT, robot AMR |

---

## 3. Kế hoạch Tách Commit (BẮT BUỘC TÁCH RIÊNG TỪNG NHÓM FILE)

- [ ] **Commit 1 (Tài liệu & Kế hoạch):** `docs(plan): lap ke hoach trien khai mo phong canvas 2d 60 fps task log-119`
- [ ] **Commit 2 (Frontend UI & Canvas 2D):** `feat(ui): thiet ke va lap trinh giao dien mo phong canvas 2d 60 fps (LOG-119)`

---

## 4. Kế hoạch Tự Kiểm tra & Thực nghiệm (Self-Verification)

- [ ] Kiểm tra lỗi cú pháp JavaScript / HTML5 / CSS3.
- [ ] Đo đạc FPS thực tế đạt chuẩn 60 FPS trên màn hình trình duyệt.
- [ ] Kiểm tra tính mượt mà của chuyển động băng tải, kiện hàng, cần gạt phân loại và robot AMR.
- [ ] Kiểm tra tính năng High-DPI Canvas không bị mờ nét trên màn hình Retina / 4K.
- [ ] Kiểm tra tương tác người dùng: Nút Play/Pause, thanh tốc độ, các switch bật/tắt lớp hiển thị AI.
