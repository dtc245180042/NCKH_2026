# Kế hoạch Thực hiện: [Tên tính năng / Tên Bugfix]
- **Branch:** `feat/<ten-chuc-nang>` hoặc `fix/<ten-bug>`
- **Người thực hiện:** [Nguyễn Văn Toàn / Bùi Thị Loan / Bùi Duy Hà / Trần Quang Vinh]
- **Yêu cầu / Use Case liên quan:** [Ví dụ: UC-01, UC-08, UC-12, NFR-01...]
- **Trạng thái:** Chờ xác nhận từ người dùng (Human Gate 1)

---

## 1. Phân tích yêu cầu & Mục tiêu kỹ thuật
- **Mục tiêu chức năng:** [Mô tả chi tiết những gì cần đạt được, thuật toán áp dụng]
- **Luồng người dùng / Luồng dữ liệu (Data & User Flow):** [Các bước hệ thống và người dùng tương tác]
- **Ràng buộc hiệu năng:** [FPS, độ trễ ms, độ chính xác nhận diện...]

---

## 2. Danh sách File cần thay đổi (Kèm lý do)
| Đường dẫn File | Loại thay đổi (Thêm mới / Sửa) | Mục đích / Lý do kỹ thuật |
| :--- | :--- | :--- |
| `models/...` | Sửa / Thêm | Thêm bảng hoặc cột cơ sở dữ liệu quan hệ |
| `services/...` | Sửa / Thêm | Thuật toán AI, ByteTrack, A* hoặc logic điều phối |
| `api/...` | Sửa / Thêm | Endpoint REST API hoặc WebSocket stream handler |
| `static/...` | Sửa / Thêm | Giao diện đồ họa Canvas 2D, biểu đồ thời gian thực |
| `tests/...` | Thêm mới | Kịch bản kiểm thử tự động / Benchmark |

---

## 3. Kế hoạch Tách Commit (BẮT BUỘC TÁCH RIÊNG TỪNG NHÓM FILE)
- [ ] **Commit 1 (Database & Models):** `feat(models): ...`
- [ ] **Commit 2 (Core Logic & AI Services):** `feat(services): ...`
- [ ] **Commit 3 (API Endpoints & WebSocket):** `feat(api): ...`
- [ ] **Commit 4 (Frontend & Canvas UI):** `feat(ui): ...`
- [ ] **Commit 5 (Testing & Verification):** `test(...): ...`

---

## 4. Kế hoạch Tự Kiểm tra & Thực nghiệm (Self-Verification)
- [ ] Kiểm tra lỗi cú pháp (Syntax errors, import thiếu, type mismatch).
- [ ] Kiểm tra logic nghiệp vụ khớp với đặc tả SRS (UC-01 đến UC-13).
- [ ] Kiểm tra bảo mật: Không hardcode secret, API key trong mã nguồn.
- [ ] Chạy thử nghiệm local và đo lường FPS / Latency theo đúng chỉ tiêu.
- [ ] Cập nhật kết quả vào Bảng kịch bản kiểm thử (Phụ lục C).

---

> ⚠️ **CHỐT CHẶN (HUMAN GATE 1):** AI Agent PHẢI dừng tại đây và chờ người dùng gõ xác nhận duyệt kế hoạch trước khi bắt đầu viết code!

