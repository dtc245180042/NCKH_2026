# Hệ thống AI Truy vết và Điều phối Hàng hóa trong Kho Thông minh (AI Smart Logistics)

> **Đề tài Nghiên cứu Khoa học Sinh viên — SV2026-ICTU-08**  
> **Trường Đại học Công nghệ Thông tin và Truyền thông – Đại học Thái Nguyên (ICTU)**  
> **Giảng viên hướng dẫn:** ThS. Hoàng Thị Liên  
> **Nhóm sinh viên thực hiện:**
> - Nguyễn Văn Toàn (Chủ nhiệm đề tài)
> - Bùi Thị Loan
> - Bùi Duy Hà
> - Trần Quang Vinh

---

## 📌 Giới thiệu Đề tài
Dự án nghiên cứu và phát triển giải pháp tự động hóa kho bãi logistics thông minh kết hợp giữa:
1. **Thị giác máy tính thế hệ mới:** Mô hình phát hiện đối tượng **YOLOv12n** kết hợp thuật toán truy vết đa đối tượng **ByteTrack** (bộ lọc Kalman 8D) giải quyết triệt để bài toán che khuất (occlusion) trên băng chuyền phân loại.
2. **Điều phối Robot tự hành AMR:** Thuật toán tìm đường ngắn nhất **A\*** (hàm heuristic Manhattan / Chebyshev) tích hợp cơ chế tránh va chạm động (Local Re-planning).
3. **Phân loại bưu kiện IoT:** Logic điều khiển cần gạt cổng phân loại tự động dựa trên mã bưu chính và tọa độ kích hoạt.
4. **Hệ thống Backend & Trực quan hóa:** **FastAPI** phi đồng bộ kết hợp kênh truyền **WebSocket 60 FPS** và giao diện mô phỏng đồ họa **HTML5 Canvas 2D**.

---

## 🌳 Quy tắc Phân nhánh Git (Branching Strategy)
Dự án áp dụng mô hình Git-flow có chốt chặn kiểm soát chất lượng (Human Gates):
- `main`: Nhánh chính thức, chỉ chứa phiên bản đã nghiệm thu, bảo vệ nghiêm ngặt.
- `develop`: **Nhánh phát triển tích hợp trung tâm** để các thành viên tạo Pull Request và merge code vào.
- `feat/<ten-chuc-nang>`: Nhánh phát triển tính năng mới từ `develop`.
- `fix/<ten-bug>`: Nhánh sửa lỗi hệ thống.

*Xem chi tiết quy chuẩn tại [QUY_CHUAN_RULE_VA_SKILL.md](./QUY_CHUAN_RULE_VA_SKILL.md) và [.agents/rules/git-workflow.md](./.agents/rules/git-workflow.md).*

---

## 🛠️ Cấu trúc Thư mục Dự án

```
NCKH_2026/
├── .agents/                      # Quy tắc và Kỹ năng hỗ trợ cho Antigravity AI Agent
│   ├── rules/                   # Quy tắc bắt buộc: Git workflow, bảo toàn số liệu
│   └── skills/                  # 11 kỹ năng chuyên môn: AI SDLC, YOLOv12, A*, FastAPI...
├── assets/                       # Sơ đồ kiến trúc, biểu đồ thực nghiệm mAP, FPS, PR-Curve
├── docs/                         # Hồ sơ tài liệu kỹ nghệ phần mềm
│   ├── plans/                   # Kế hoạch tính năng (Feature Plans) cho từng PR
│   ├── BAO_CAO_TONG_KET_...docx # Báo cáo tổng kết đề tài NCKH nộp nghiệm thu
│   └── ...
├── QUY_CHUAN_RULE_VA_SKILL.md    # Bộ quy chuẩn phát triển và quy trình tác nghiệp
├── DANH_SACH_VIEC_NHOM_CAN_LAM.md# Checklist các việc bắt buộc nhóm phải hoàn thành
├── NHAT_KY_THAY_DOI.md          # Nhật ký chi tiết các thay đổi trong báo cáo
└── README.md                     # Tài liệu giới thiệu dự án
```

---

## 🚀 Hướng dẫn Bắt đầu Nhanh (Dành cho Thành viên)

### 1. Clone mã nguồn và chuyển sang nhánh `develop`:
```bash
git clone https://github.com/dtc245180042/NCKH_2026.git
cd NCKH_2026
git checkout develop
```

### 2. Tạo nhánh tính năng mới khi làm việc:
```bash
git checkout -b feat/<ten-tinh-nang>
```

### 3. Tạo kế hoạch và commit theo nhóm file:
- Tạo kế hoạch tại `docs/plans/feat-<ten-tinh-nang>.md` theo mẫu `docs/plans/TEMPLATE.md`.
- Commit riêng biệt từng nhóm file (models, services, api, ui).
- Mở Pull Request vào nhánh `develop`.
