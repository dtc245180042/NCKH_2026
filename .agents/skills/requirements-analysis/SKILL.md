---
name: requirements-analysis
description: Kỹ nghệ yêu cầu phần mềm cho Hệ thống AI Logistics Kho thông minh. Phân tích yêu cầu chức năng (UC-01 đến UC-13), yêu cầu phi chức năng (NFR), xây dựng User Stories, Acceptance Criteria và Ma trận truy vết (RTM).
---

# Requirements Analysis Skill — AI Smart Logistics

## 1. MỤC TIÊU
Chuyển hóa các yêu cầu từ Thuyết minh đề tài NCKH đã duyệt thành đặc tả yêu cầu phần mềm (SRS) chuẩn hóa theo định dạng IEEE 830 / ISO/IEC/IEEE 29148.

## 2. NGUYÊN TẮC PHÂN TÍCH
- Đảm bảo tính khả thi và bao phủ trọn vẹn 13 Use Cases cốt lõi.
- Phân định ranh giới rõ ràng giữa **Mục tiêu thiết kế hệ thống** (Target Specification) và **Kết quả đo kiểm thực nghiệm** (Empirical Results).
- Giữ vững tính khách quan: Nêu rõ khoảng cách giữa mô phỏng và thực địa (Sim-to-Real gap).

## 3. DANH MỤC YÊU CẦU PHI CHỨC NĂNG (NFR)
- **NFR-PER-01 (Thời gian suy luận AI):** Tốc độ phát hiện YOLOv12n đạt $\le 20$ ms/khung hình trên GPU (tối thiểu 50 FPS) và $\ge 25$ FPS trên CPU thông thường.
- **NFR-PER-02 (Tốc độ dựng hình trực quan):** Giao diện Canvas 2D duy trì hiển thị ổn định 60 FPS, độ trễ truyền nhận WebSocket $\le 50$ ms.
- **NFR-ACC-01 (Độ chính xác phát hiện):** Chỉ số mAP@0.5 đạt trên 90% cho 4 lớp thực thể kho bãi (package, pallet, vehicle, person).
- **NFR-ACC-02 (Độ ổn định truy vết):** Chỉ số MOTA đạt trên 80%, IDF1 trên 85%, tỷ lệ nhảy ID (ID Switches) giảm tối thiểu 50% so với giải pháp baseline SORT.
- **NFR-SEC-01 (Bảo mật & Phân quyền):** Mọi thao tác quản trị và kích hoạt phân loại phải được xác thực bằng JWT, mật khẩu mã hóa bcrypt, không lưu trữ thông tin nhạy cảm trong mã nguồn.

## 4. CHECKLIST NGHIỆM THU YÊU CẦU (HUMAN GATE 1)
- [ ] Tất cả 13 Use Cases đều có mã định danh, actor phụ trách và kết quả mong đợi.
- [ ] Ma trận truy vết yêu cầu (RTM) liên kết chính xác từ FR sang màn hình giao diện, API và Test Case.
- [ ] Các chỉ tiêu hiệu năng được ghi nhận dưới dạng "Mục tiêu thiết kế", không khẳng định tuyệt đối trước khi chạy test.

