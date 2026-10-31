# KẾ HOẠCH PHÂN CÔNG CÔNG VIỆC VÀ CODE (CHUẨN JIRA AGILE)
## HỆ THỐNG AI TRUY VẾT VÀ ĐIỀU PHỐI HÀNG HÓA TRONG KHO THÔNG MINH
**Mã đề tài:** SV2026-ICTU-08 | **Dự án Jira Key:** `LOG` (Logistics Optimization & Guidance)

---

## 1. NGUYÊN TẮC PHÂN CÔNG THEO NĂNG LỰC & MỨC ĐỘ KHÓ

Phân bổ công việc được thiết kế theo đúng yêu cầu: **Nguyễn Văn Toàn** (Chủ nhiệm / Kiến trúc sư trưởng) nắm toàn bộ kỹ năng và chịu trách nhiệm các phần thuật toán khó nhất; **Bùi Thị Loan**, **Trần Quang Vinh**, **Bùi Duy Hà** đảm nhiệm các phân hệ chuyên biệt với độ phức tạp phù hợp:

```
                               NGUYỄN VĂN TOÀN
               (Lead Architect / Full-Stack & Core Algorithm)
          ┌───────────────────────────┼───────────────────────────┐
          ▼                           ▼                           ▼
    BÙI THỊ LOAN                 BÙI DUY HÀ                TRẦN QUANG VINH
  (AI Data & Modeling)        (IoT & Dispatching)       (Frontend & QA Testing)
  - Dataset video mô phỏng    - Logic cổng phân loại     - Giao diện Canvas 2D
  - Huấn luyện YOLOv12n       - Ánh xạ mã vùng bưu điện  - WebSocket Dashboard
  - Biểu đồ PR, mAP, Loss     - Cảm biến chống kẹt hàng  - Chạy 35 Test Cases
  - Quản lý tệp trọng số      - Tích hợp lệnh gọi AMR    - Đo đạc FPS, Latency
```

### Chi tiết phân vai và kỹ năng yêu cầu (Skill Mapping):

| Thành viên | Vai trò Jira | Độ khó | Trách nhiệm chính & Module Code | Skills Antigravity áp dụng |
|:---|:---|:---:|:---|:---|
| **Nguyễn Văn Toàn** | Project Lead / Core AI & Backend | **Cực khó (Rất cao)** | 1. Tích hợp thuật toán **ByteTrack** (bộ lọc Kalman 8D, Hungarian matching 2 giai đoạn, xử lý che khuất).<br>2. Thuật toán tìm đường **A\*** cho Robot AMR (tránh vật cản động, Local Re-planning).<br>3. Kiến trúc Backend **FastAPI** bất đồng bộ & **WebSocket Stream** 60 FPS.<br>4. Thiết kế CSDL 3NF và tích hợp toàn hệ thống. | `yolov12-bytetrack-vision`<br>`amr-pathfinding-a-star`<br>`fastapi-pro`<br>`architecture-design`<br>`ai-augmented-sdlc` |
| **Bùi Thị Loan** | AI Data Specialist | **Trung bình - Khó** | 1. Tự sinh dữ liệu mô phỏng (Synthetic Data 2.500 frames).<br>2. Gán nhãn Bounding Box và chia tập Train/Val/Test chống rò rỉ dữ liệu.<br>3. Chạy thực nghiệm huấn luyện YOLOv12n (100 Epochs).<br>4. Xuất các bảng số liệu mAP, Loss, PR-Curve. | `yolov12-bytetrack-vision`<br>`requirements-analysis` |
| **Bùi Duy Hà** | IoT & Logistics Logic Dev | **Vừa phải** | 1. Logic phân loại cổng IoT (Sorting Gates 1, 2, 3).<br>2. Cơ chế gán mã bưu chính ảo (Virtual Attribution).<br>3. Cơ chế xử lý hàng lỗi về làn Re-check.<br>4. Xử lý ngoại lệ cảm biến và báo kẹt cổng (Anti-jam alert). | `iot-sorting-control`<br>`fastapi-pro` |
| **Trần Quang Vinh**| Frontend & QA Engineer | **Vừa phải** | 1. Kết xuất đồ họa mô phỏng **HTML5 Canvas 2D** mượt mà 60 FPS.<br>2. Xây dựng Dashboard hiển thị KPI và biểu đồ thời gian thực.<br>3. Thực thi và ghi log **35 Test Cases chức năng** (Phụ lục C).<br>4. Đo đạc benchmark hiệu năng (FPS, độ trễ ms, MOT metrics). | `testing-verification`<br>`code-review`<br>`documentation` |

---

## 2. DANH MỤC EPICS VÀ SPRINTS THEO CHUẨN JIRA

Dự án được chia thành **5 Epics lớn** trải dài trên **6 Sprints** (mỗi Sprint dài ~2 tháng, khớp 100% với Bảng tiến độ Thuyết minh đề tài):

- **EPIC 1 (`LOG-EPIC-01`):** Kiến trúc hệ thống, Quản trị và Cơ sở dữ liệu
- **EPIC 2 (`LOG-EPIC-02`):** Thu thập Dữ liệu và Huấn luyện Mô hình YOLOv12n
- **EPIC 3 (`LOG-EPIC-03`):** Phân hệ Thị giác AI Truy vết Đa đối tượng ByteTrack
- **EPIC 4 (`LOG-EPIC-04`):** Điều khiển Cổng phân loại IoT và Điều phối Robot AMR
- **EPIC 5 (`LOG-EPIC-05`):** Giao diện Canvas 2D, Kiểm thử Thực nghiệm và Báo cáo

---

## 3. BẢNG PHÂN CÔNG CHI TIẾT CÁC TASK JIRA (JIRA BACKLOG)

| Mã Issue | Loại | Tên Task (Summary) | Người làm | Ước lượng (SP) | Độ ưu tiên | Sprint | Nhánh Git (`Branch`) |
|:---:|:---:|:---|:---:|:---:|:---:|:---:|:---|
| **LOG-101** | Task | Khởi tạo khung dự án FastAPI, cấu hình Docker, Git rules và 11 Skills | **Toàn** | 5 | Highest | Sprint 1 | `feat/project-setup` |
| **LOG-102** | Task | Thiết kế mô hình CSDL quan hệ 3NF (6 bảng) và cài đặt SQLAlchemy 2.0 ORM | **Toàn** | 5 | High | Sprint 1 | `feat/database-models` |
| **LOG-103** | Task | Xây dựng phân hệ Xác thực (Auth) JWT và phân quyền người dùng RBAC (UC-01, UC-02) | **Toàn** | 5 | High | Sprint 1 | `feat/auth-jwt-rbac` |
| **LOG-104** | Story| Khảo sát quy trình nghiệp vụ bưu chính và lập tài liệu đặc tả SRS IEEE 830 | Hà | 3 | Medium | Sprint 1 | `docs/srs-ieee830` |
| **LOG-105** | Story| Thiết lập môi trường sinh dữ liệu mô phỏng 2D/3D băng chuyền kho bãi | Loan | 5 | High | Sprint 2 | `feat/simulation-generator` |
| **LOG-106** | Task | Tự sinh và gán nhãn 2.500 khung hình video (4 classes: package, pallet, vehicle, person) | Loan | 8 | High | Sprint 2 | `feat/dataset-annotation` |
| **LOG-107** | Task | Chia tập dữ liệu 70-20-10 theo chuỗi video độc lập (sequence-level split) chống data leakage | Loan | 3 | Medium | Sprint 2 | `feat/dataset-split` |
| **LOG-108** | Task | Cài đặt pipeline huấn luyện mô hình YOLOv12n trên GPU với PyTorch & Ultralytics | Loan | 8 | High | Sprint 3 | `feat/yolo12-training` |
| **LOG-109** | Task | Đánh giá mô hình YOLOv12n, xuất đồグラフ Loss, PR-Curve và bảng Ablation Study | Loan | 5 | Medium | Sprint 3 | `feat/yolo12-eval` |
| **LOG-110** | Story| Xây dựng kênh truyền WebSocket `/ws/simulation/stream` phục vụ stream dữ liệu 60 FPS | **Toàn** | 8 | Highest | Sprint 3 | `feat/websocket-stream` |
| **LOG-111** | Story| Cài đặt bộ lọc Kalman Filter 8 chiều ước lượng chuyển động trong ByteTrack | **Toàn** | 8 | Highest | Sprint 4 | `feat/kalman-8d` |
| **LOG-112** | Task | Cài đặt cơ chế ghép đôi 2 giai đoạn (Two-stage Association) giải quyết che khuất vật lý | **Toàn** | 13 | Highest | Sprint 4 | `feat/bytetrack-matching` |
| **LOG-113** | Task | Tích hợp đường ống liên hoàn YOLOv12n + ByteTrack xuất ra `track_id` thời gian thực | **Toàn** | 8 | Highest | Sprint 4 | `feat/ai-tracking-pipeline` |
| **LOG-114** | Story| Lập trình logic điều khiển Cổng phân loại IoT theo mã vùng bưu chính (UC-06, UC-07) | Hà | 5 | High | Sprint 4 | `feat/iot-gate-routing` |
| **LOG-115** | Task | Cài đặt cơ chế cảm biến phản hồi và xử lý chống kẹt hàng (Anti-jam alert) (UC-09) | Hà | 5 | Medium | Sprint 4 | `feat/iot-antijam` |
| **LOG-116** | Story| Xây dựng thuật toán tìm đường ngắn nhất A* trên lưới ô vuông bản đồ kho (UC-08) | **Toàn** | 8 | Highest | Sprint 5 | `feat/a-star-pathfinding` |
| **LOG-117** | Task | Cài đặt cơ chế tránh vật cản động (Local Re-planning) và dừng an toàn cho Robot AMR | **Toàn** | 8 | Highest | Sprint 5 | `feat/amr-obstacle-avoid` |
| **LOG-118** | Task | Lập trình thuật toán Heuristic tính điểm gợi ý vị trí lưu kho tối ưu cho kiện hàng | **Toàn** | 5 | High | Sprint 5 | `feat/rack-suggestion` |
| **LOG-119** | Story| Thiết kế và lập trình giao diện mô phỏng HTML5 Canvas 2D mượt mà 60 FPS (UC-12) | Vinh | 8 | High | Sprint 5 | `feat/canvas-simulation-ui` |
| **LOG-120** | Task | Xây dựng Dashboard thống kê sản lượng phân loại và trạng thái cổng thời gian thực | Vinh | 5 | Medium | Sprint 5 | `feat/dashboard-kpi` |
| **LOG-121** | Task | Viết bộ kiểm thử tự động và thực thi 35 Test Cases chức năng (Bảng Phụ lục C) | Vinh | 8 | High | Sprint 6 | `test/35-test-cases` |
| **LOG-122** | Task | Đo đạc bộ chỉ số chuẩn quốc tế MOT Challenge: MOTA, IDF1, đếm số lần ID Switches | Vinh | 5 | High | Sprint 6 | `test/mot-benchmark` |
| **LOG-123** | Task | Đo đạc hiệu năng: Tốc độ FPS và Độ trễ (Latency) theo mật độ đối tượng đồng thời | Vinh | 5 | Medium | Sprint 6 | `test/fps-latency-benchmark` |
| **LOG-124** | Task | Rà soát bảo mật, loại bỏ mật khẩu mặc định, kiểm tra toàn vẹn mã nguồn trước merge | Hà | 3 | Medium | Sprint 6 | `chore/security-audit` |
| **LOG-125** | Story| Hoàn thiện Báo cáo tổng kết NCKH Word 64 trang, xử lý các thẻ bôi vàng | **Toàn** | 8 | Highest | Sprint 6 | `docs/final-report-docx` |
| **LOG-126** | Task | Chuẩn bị slide PowerPoint 18 trang và quay video demo 3 phút minh chứng đề tài | Cả nhóm | 5 | High | Sprint 6 | `docs/slide-video-demo` |

---

## 4. QUY TRÌNH PHỐI HỢP MÃ NGUỒN TRÊN GIT (DOD - DEFINITION OF DONE)

Mọi thành viên đều phải tuân thủ nghiêm ngặt quy trình đã quy định tại `.agents/rules/git-workflow.md`:

1. **Nhận Task từ Jira:**
   - Kéo Task từ cột `To Do` sang `In Progress`.
   - Tạo nhánh từ `develop`: `git checkout develop && git pull && git checkout -b feat/<ten-task>`.
2. **Lập Kế hoạch (Human Gate 1):**
   - Viết file `docs/plans/feat-<ten-task>.md` theo mẫu `TEMPLATE.md`.
   - Đưa cho **Nguyễn Văn Toàn** (Lead) duyệt kế hoạch trước khi bắt đầu viết code.
3. **Thực hiện Code & Commit:**
   - Tách commit riêng biệt theo từng nhóm file.
   - Không hardcode mật khẩu, token, đường dẫn tuyệt đối.
4. **Kiểm thử cục bộ (Human Gate 2):**
   - Chạy test case trên máy local đảm bảo Pass 100%.
   - Đo đạc thông số thực tế, không tự bịa đặt số liệu.
5. **Mở Pull Request (PR):**
   - Mở PR từ `feat/<ten-task>` vào nhánh `develop`.
   - Gắn Toàn và 1 thành viên khác vào review. Khi có 2 Approve mới được merge vào `develop`.

---

## 5. HƯỚNG DẪN IMPORT DANH SÁCH TASK VÀO JIRA BẰNG 1 CLICK

Tệp [`jira_import_backlog.csv`](./jira_import_backlog.csv) đã được chuẩn bị sẵn theo đúng cấu trúc tiêu chuẩn của Atlassian Jira.

### Các bước thực hiện:
1. Đăng nhập vào Jira Cloud / Jira Software của nhóm: `https://<ten-truong-hoac-nhom>.atlassian.net`
2. Chọn dự án của bạn (ví dụ dự án Scrum key `LOG`).
3. Bấm vào biểu tượng **Cài đặt (Bánh răng)** ở góc trên bên phải $\to$ chọn **System** (hoặc vào menu Project Settings $\to$ Import Issues).
4. Chọn **External System Import** $\to$ Chọn **CSV**.
5. Tải file [`jira_import_backlog.csv`](file:///e:/KHO/jira_import_backlog.csv) lên.
6. Ánh xạ các trường (Fields Mapping):
   - `Summary` $\to$ Summary
   - `Issue Type` $\to$ Issue Type
   - `Description` $\to$ Description
   - `Assignee` $\to$ Assignee
   - `Priority` $\to$ Priority
   - `Story Points` $\to$ Story Points
   - `Sprint` $\to$ Sprint
   - `Epic Name` $\to$ Epic Name
7. Bấm **Begin Import** $\to$ Toàn bộ 26 User Stories, Tasks, Spikes sẽ tự động xuất hiện trên Jira Scrum Board của nhóm!
