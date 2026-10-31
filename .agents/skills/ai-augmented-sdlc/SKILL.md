---
name: ai-augmented-sdlc
description: Quy trình AI-Augmented SDLC toàn diện cho Hệ thống AI truy vết và điều phối hàng hóa trong kho thông minh (Đề tài SV2026-ICTU-08). Tích hợp 13 Use Cases từ SRS, 5 Human Gates, và phân công vai trò nhóm sinh viên.
---

# AI-Augmented SDLC — AI Smart Logistics Tracking System

> **Đề tài NCKH Sinh viên: SV2026-ICTU-08 | GVHD: ThS. Phạm Thị Liên**  
> **Nhóm thực hiện:** Nguyễn Văn Toàn (Chủ nhiệm), Trần Thị Loan, Nguyễn Thị Thu Hà, Nguyễn Hồng Vinh

---

## 1. TỔNG QUAN PHƯƠNG PHÁP LUẬN

Quy trình AI-Augmented SDLC kết hợp năng lực hỗ trợ tạo sinh của Antigravity Agent với khả năng kiểm soát chất lượng của con người thông qua các **Human Gates (Chốt chặn con người)**:

```
[Requirements] ──> [Architecture] ──> [Database] ──> [Implementation] ──> [Testing] ──> [Review] ──> [Docs & Defense]
      │                   │                 │                 │                │             │              │
  [Gate 1]            [Gate 2]          [Gate 2]          [Gate 3]         [Gate 3]      [Gate 4]       [Gate 5]
 Nhóm duyệt          GVHD duyệt        GVHD duyệt        Code Review       Chạy Test    Bảo mật &      Nghiệm thu
 Requirements       Kiến trúc         Mô hình CSDL      từng commit       thực tế      Hiệu năng      Hội đồng
```

---

## 2. ÁNH XẠ ACTORS VÀ 13 USE CASES (TỪ SRS ĐỀ TÀI)

| Mã Use Case | Tên Chức Năng Nghiệp Vụ | Actor Đảm Nhiệm | Skill Phụ Trách |
|:---:|:---|:---:|:---|
| **UC-01** | Đăng nhập và phân quyền hệ thống (RBAC) | Quản trị viên, Nhân viên | `fastapi-pro`, `database-design` |
| **UC-02** | Quản lý tài khoản và danh mục người dùng | Quản trị viên | `fastapi-pro`, `database-design` |
| **UC-03** | Tiếp nhận kiện hàng nhập kho (Inbound) | Nhân viên kho | `fastapi-pro`, `database-design` |
| **UC-04** | Nhận diện đối tượng tự động (YOLOv12n) | Hệ thống Camera AI | `yolov12-bytetrack-vision` |
| **UC-05** | Truy vết kiện hàng đa đối tượng (ByteTrack) | Hệ thống Camera AI | `yolov12-bytetrack-vision` |
| **UC-06** | Gán nhãn ảo và đối chiếu mã bưu chính | Phân hệ Logistics Engine | `iot-sorting-control` |
| **UC-07** | Phân loại hàng hóa tự động qua cổng IoT | Cổng phân loại cơ khí / IoT | `iot-sorting-control` |
| **UC-08** | Tìm đường tối ưu cho robot AMR (A* Pathfinding)| Robot tự hành AMR | `amr-pathfinding-a-star` |
| **UC-09** | Xử lý kiện hàng sai sót / không nhãn | Nhân viên vận hành | `iot-sorting-control`, `fastapi-pro` |
| **UC-10** | Quản lý sơ đồ mặt bằng và ô kệ lưu kho | Nhân viên kho | `database-design`, `fastapi-pro` |
| **UC-11** | Báo cáo thống kê năng suất và sản lượng | Quản trị viên, Quản lý | `fastapi-pro`, `documentation` |
| **UC-12** | Trực quan hóa mô phỏng thời gian thực Canvas 2D| Tất cả người dùng | `fastapi-pro` (WebSocket), Canvas UI |
| **UC-13** | Giám sát trạng thái hoạt động và cảnh báo lỗi | Quản trị viên hệ thống | `fastapi-pro`, `testing-verification` |

---

## 3. CÁC GIAI ĐOẠN SDLC VÀ NHIỆM VỤ CỦA SKILLS

### Giai đoạn 1: Phân tích Yêu cầu (Requirements Analysis)
- **Skill:** `.agents/skills/requirements-analysis/SKILL.md`
- **Nhiệm vụ:** Đọc tài liệu thuyết minh, phân loại FR/NFR, xây dựng User Stories, Acceptance Criteria và Ma trận truy vết RTM.
- **Human Gate 1:** Nhóm nghiên cứu duyệt toàn bộ yêu cầu, đảm bảo bao phủ đầy đủ UC-01 đến UC-13.

### Giai đoạn 2: Thiết kế Kiến trúc & Cơ sở dữ liệu (Design Phase)
- **Skills:** `.agents/skills/architecture-design/SKILL.md`, `.agents/skills/database-design/SKILL.md`
- **Nhiệm vụ:** Thiết kế đường ống tích hợp (AI Pipeline, WebSocket 60 FPS, REST API) và mô hình dữ liệu quan hệ 3NF (6 bảng thực thể).
- **Human Gate 2:** GVHD duyệt sơ đồ kiến trúc và ERD trước khi cài đặt.

### Giai đoạn 3: Phát triển Mã nguồn (Implementation Phase)
- **Skills:** `.agents/skills/fastapi-pro/SKILL.md`, `.agents/skills/yolov12-bytetrack-vision/SKILL.md`, `.agents/skills/amr-pathfinding-a-star/SKILL.md`, `.agents/skills/iot-sorting-control/SKILL.md`
- **Nhiệm vụ:** Cài đặt mã nguồn theo nguyên tắc tách nhỏ commit, không hardcode secret, tuân thủ đúng thuật toán đã thiết kế.

### Giai đoạn 4: Kiểm thử & Đánh giá (Testing & Verification)
- **Skill:** `.agents/skills/testing-verification/SKILL.md`
- **Nhiệm vụ:** Thực thi 35 Test Cases chức năng (Phụ lục C), đo đạc chỉ số MOT (MOTA, IDF1, ID switches), benchmark FPS và độ trễ.
- **Human Gate 3:** Nhóm tự chạy test trên máy local và xác nhận kết quả pass thực tế.

### Giai đoạn 5: Đánh giá Chất lượng & Bảo mật (Code Review & Security)
- **Skill:** `.agents/skills/code-review/SKILL.md`
- **Nhiệm vụ:** Rà soát code smells, kiểm tra JWT middleware, kiểm tra rò rỉ dữ liệu (data leakage) trong tập dataset.
- **Human Gate 4:** Kiểm tra danh mục bảo mật, loại bỏ hoàn toàn mật khẩu mặc định.

### Giai đoạn 6: Hoàn thiện Hồ sơ & Nghiệm thu (Documentation)
- **Skill:** `.agents/skills/documentation/SKILL.md`
- **Nhiệm vụ:** Cập nhật tài liệu SRS IEEE 830, bản báo cáo tổng kết docx, slide và video demo bảo vệ Hội đồng.
- **Human Gate 5:** Phê duyệt chính thức từ Hội đồng nghiệm thu cấp Trường.

