# Hệ thống AI Truy vết và Điều phối Hàng hóa trong Kho Thông minh (AI Smart Logistics)

> **Đề tài Nghiên cứu Khoa học Sinh viên — SV2026-ICTU-08**  
> **Trường Đại học Công nghệ Thông tin và Truyền thông – Đại học Thái Nguyên (ICTU)**  
> **Giảng viên hướng dẫn:** ThS. Phạm Thị Liên  
> **Nhóm sinh viên thực hiện:**
> - Nguyễn Văn Toàn (Chủ nhiệm đề tài)
> - Trần Thị Loan
> - Nguyễn Thị Thu Hà
> - Nguyễn Hồng Vinh

---

## 📌 Giới thiệu Đề tài
Đề tài nghiên cứu và xây dựng giải pháp tự động hóa kho bãi logistics thông minh với các mục tiêu và kế hoạch công nghệ:
1. **Thị giác máy tính (Kế hoạch):** Nghiên cứu tích hợp mô hình phát hiện đối tượng **YOLOv12n** kết hợp thuật toán truy vết đa đối tượng **ByteTrack** (bộ lọc Kalman 8D) hướng tới giải quyết bài toán che khuất (occlusion) trên băng chuyền phân loại.
2. **Điều phối Robot tự hành AMR (Mục tiêu):** Nghiên cứu thuật toán tìm đường ngắn nhất **A\*** (hàm heuristic Manhattan / Chebyshev) định hướng tích hợp cơ chế tránh va chạm động (Local Re-planning).
3. **Phân loại bưu kiện IoT (Mục tiêu):** Xây dựng logic điều khiển cần gạt cổng phân loại tự động dựa trên mã bưu chính và tọa độ kích hoạt.
4. **Hệ thống Backend & Trực quan hóa:** Xây dựng khung nền tảng **FastAPI** hiệu năng cao, CSDL **MySQL 8 (3NF)**; mục tiêu tương lai tích hợp kênh truyền **WebSocket 60 FPS** và giao diện mô phỏng đồ họa **HTML5 Canvas 2D**.

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
├── app/                          # Mã nguồn Backend FastAPI
│   ├── core/                    # Cấu hình hệ thống, bảo mật
│   └── main.py                  # Khởi chạy ứng dụng FastAPI
├── assets/                       # Sơ đồ kiến trúc, biểu đồ thực nghiệm mAP, FPS, PR-Curve
├── docs/                         # Hồ sơ tài liệu kỹ nghệ phần mềm
│   ├── plans/                   # Kế hoạch tính năng (Feature Plans) cho từng PR
│   ├── BAO_CAO_TONG_KET_...docx # Báo cáo tổng kết đề tài NCKH nộp nghiệm thu
│   └── ...
├── tests/                        # Bộ kiểm thử tự động độc lập
├── QUY_CHUAN_RULE_VA_SKILL.md    # Bộ quy chuẩn phát triển và quy trình tác nghiệp
├── DANH_SACH_VIEC_NHOM_CAN_LAM.md# Checklist các việc bắt buộc nhóm phải hoàn thành
├── NHAT_KY_THAY_DOI.md          # Nhật ký chi tiết các thay đổi trong báo cáo
├── Dockerfile                    # Cấu hình Docker multi-stage (Python 3.12-slim)
├── docker-compose.yml            # Điều phối FastAPI + MySQL 8
├── requirements.txt              # Danh mục gói phụ thuộc môi trường chạy
├── requirements-dev.txt          # Danh mục gói phụ thuộc môi trường kiểm thử
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

---

## 💻 Hướng dẫn Cài đặt & Khởi chạy Kỹ thuật

### 1. Yêu cầu Môi trường
- **Python:** 3.12+ (hoặc 3.13)
- **Cơ sở dữ liệu:** MySQL 8.0+
- **Docker & Docker Compose** (khuyến nghị cho môi trường đồng nhất)

### 2. Khởi chạy bằng Docker Compose (Khuyến nghị)
Hệ thống điều phối cả FastAPI Backend và MySQL 8.0 với cơ chế healthcheck:
```bash
# 1. Sao chép cấu hình môi trường mẫu
cp .env.example .env

# 2. Khởi động hệ thống (MySQL port nội bộ 3306 map ra port 3307 trên máy host)
docker compose up --build -d

# 3. Kiểm tra trạng thái dịch vụ
docker compose ps
```
- **FastAPI Swagger Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **API Health Check:** [http://localhost:8000/api/health](http://localhost:8000/api/health)

### 3. Khởi chạy Môi trường Cục bộ (Local Development)
```bash
# 1. Tạo và kích hoạt môi trường ảo
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

# 2. Cài đặt các gói phụ thuộc
pip install -r requirements.txt
pip install -r requirements-dev.txt

# 3. Tạo file cấu hình .env từ mẫu
cp .env.example .env

# 4. Khởi chạy server FastAPI
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 4. Thực thi Kiểm thử Tự động (Testing)
Bộ test độc lập không phụ thuộc vào trạng thái MySQL:
```bash
pytest tests/ -v
```

---

## 🏛️ Quy chuẩn Kiểm soát Quản trị (Governance & Git Rules)
Dự án áp dụng mô hình phân nhánh và cơ chế kiểm soát chất lượng nghiêm ngặt quy định tại [`AGENTS.md`](AGENTS.md) và [`.agents/rules/git-workflow.md`](.agents/rules/git-workflow.md):
- **Quy trình 3 bước bắt buộc:** Đề xuất (Chỉ đọc) $\to$ Dừng chờ User DUYỆT (Human Gate) $\to$ Thực hiện trong đúng phạm vi đã duyệt.
- **Tài nguyên chung:** Chỉ đẩy lên Git các mã nguồn chuẩn, CSDL dùng chung và tài liệu. Tuyệt đối **KHÔNG commit/push** cấu hình cá nhân, file `.env`, mật khẩu, token, dữ liệu tạm.
- **Kỷ luật nhánh:** Không bao giờ push trực tiếp lên `main` hay force push. Mọi thao tác `commit` và `push` phải có lệnh cho phép riêng từ Chủ nhiệm đề tài.

---

## 📚 Danh mục 11 Kỹ năng Chuyên sâu (Agent Skills)
Hệ thống tích hợp 11 kỹ năng chuẩn hóa trong thư mục `.agents/skills/`:
1. `ai-augmented-sdlc`: Quy trình SDLC tích hợp AI toàn diện và 5 Human Gates.
2. `requirements-analysis`: Đặc tả yêu cầu phần mềm IEEE 830, quản lý 13 Use Cases và RTM.
3. `database-design`: Thiết kế CSDL 6 bảng chuẩn 3NF trên MySQL, ràng buộc toàn vẹn và InnoDB.
4. `architecture-design`: Thiết kế kiến trúc phân tầng Layered Architecture và đường ống tích hợp.
5. `fastapi-pro`: Mẫu lập trình Backend FastAPI chuẩn mực, bất đồng bộ, Pydantic v2.
6. `yolov12-bytetrack-vision`: Đường ống thị giác AI YOLOv12n và theo dõi đa mục tiêu ByteTrack.
7. `amr-pathfinding-a-star`: Thuật toán A* tìm đường trên bản đồ lưới 2D cho Robot tự hành.
8. `iot-sorting-control`: Logic điều khiển cơ cấu phân loại cổng IoT và xử lý chống kẹt hàng.
9. `testing-verification`: Bộ khung kiểm thử 35 Test Cases và đo đạc MOTA, IDF1, FPS, Latency.
10. `code-review`: Tiêu chuẩn review mã nguồn, an toàn bảo mật trước khi hợp nhất code.
11. `documentation`: Quy chuẩn soạn thảo tài liệu kỹ thuật, SRS và báo cáo đề tài khoa học.
