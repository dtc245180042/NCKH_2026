# ĐẶC TẢ YÊU CẦU PHẦN MỀM (SOFTWARE REQUIREMENTS SPECIFICATION - SRS)
## HỆ THỐNG AI TRUY VẾT VÀ ĐIỀU PHỐI HÀNG HÓA TRONG KHO THÔNG MINH (AI SMART LOGISTICS)
> **Mã số đề tài:** SV2026-ICTU-08  
> **Cơ quan chủ trì:** Trường Đại học Công nghệ Thông tin và Truyền thông – Đại học Thái Nguyên (ICTU)  
> **Giảng viên hướng dẫn:** ThS. Phạm Thị Liên  
> **Nhóm sinh viên nghiên cứu:** Nguyễn Văn Toàn (Chủ nhiệm), Trần Thị Loan, Nguyễn Thị Thu Hà, Nguyễn Hồng Vinh  
> **Chuẩn áp dụng:** IEEE Std 830-1998 (IEEE Recommended Practice for Software Requirements Specifications) & ISO/IEC/IEEE 29148:2018  
> **Phiên bản tài liệu:** 1.0 (Phát hành chính thức phục vụ nghiệm thu đề tài NCKH)

---

## MỤC LỤC TỔNG QUAN
1. [MỤC 1: GIỚI THIỆU (INTRODUCTION)](#mục-1-giới-thiệu-introduction)
   - 1.1 Mục đích tài liệu
   - 1.2 Phạm vi sản phẩm
   - 1.3 Thuật ngữ, từ viết tắt và định nghĩa
   - 1.4 Tài liệu tham chiếu
   - 1.5 Tổng quan cấu trúc tài liệu
2. [MỤC 2: MÔ TẢ TỔNG QUAN (OVERALL DESCRIPTION)](#mục-2-mô-tả-tổng-quan-overall-description)
   - 2.1 Bối cảnh và phối cảnh hệ thống (Product Perspective)
   - 2.2 Tóm tắt các chức năng chính (Product Functions)
   - 2.3 Đặc tính người dùng và các tác nhân (User Characteristics & Actors)
   - 2.4 Môi trường vận hành (Operating Environment)
   - 2.5 Ràng buộc thiết kế và triển khai (Design & Implementation Constraints)
   - 2.6 Giả định và sự phụ thuộc (Assumptions & Dependencies)
3. [MỤC 3: YÊU CẦU CHỨC NĂNG CỤ THỂ (SPECIFIC FUNCTIONAL REQUIREMENTS)](#mục-3-yêu-cầu-chức-năng-cụ-thể-specific-functional-requirements)
   - Đặc tả chi tiết 13 Use Cases (từ UC-01 đến UC-13)
4. [MỤC 4: YÊU CẦU PHI CHỨC NĂNG (NON-FUNCTIONAL REQUIREMENTS - NFR)](#mục-4-yêu-cầu-phi-chức-năng-non-functional-requirements---nfr)
   - 4.1 Hiệu năng và thời gian thực (Performance Requirements)
   - 4.2 Độ chính xác và tin cậy thuật toán AI (AI Accuracy & Robustness)
   - 4.3 An toàn và bảo mật thông tin (Security Requirements)
   - 4.4 Khả năng bảo trì và tương thích (Maintainability & Compatibility)
5. [MỤC 5: GIAO DIỆN HỆ THỐNG (SYSTEM INTERFACES)](#mục-5-giao-diện-hệ-thống-system-interfaces)
   - 5.1 Giao diện người dùng (User Interfaces - UI)
   - 5.2 Giao diện phần cứng (Hardware Interfaces)
   - 5.3 Giao diện phần mềm (Software Interfaces)
   - 5.4 Giao diện truyền thông (Communication Interfaces)
6. [MỤC 6: MA TRẬN TRUY VẾT YÊU CẦU (REQUIREMENT TRACEABILITY MATRIX - RTM)](#mục-6-ma-trận-truy-vết-yêu-cầu-requirement-traceability-matrix---rtm)

---

## MỤC 1: GIỚI THIỆU (INTRODUCTION)

### 1.1. Mục đích tài liệu (Purpose)
Tài liệu Đặc tả Yêu cầu Phần mềm (SRS) này xác định đầy đủ, tường minh và chính xác toàn bộ các yêu cầu chức năng (Functional Requirements - FR), yêu cầu phi chức năng (Non-Functional Requirements - NFR), ràng buộc kỹ thuật và giao diện tương tác cho dự án **"Hệ thống AI truy vết và điều phối hàng hóa trong kho thông minh"** (Đề tài SV2026-ICTU-08).

Tài liệu là cơ sở pháp lý kỹ thuật ràng buộc giữa nhóm sinh viên nghiên cứu, Giảng viên hướng dẫn và Hội đồng nghiệm thu cấp Trường; đồng thời định hướng cho việc thiết kế kiến trúc, phát triển mã nguồn, và xây dựng 35 kịch bản kiểm thử nghiệm thu (Phụ lục C).

### 1.2. Phạm vi sản phẩm (Product Scope)
Hệ thống **AI Smart Logistics** là một giải pháp tự động hóa tích hợp phục vụ trung tâm phân loại bưu chính và kho vận bưu điện thông minh, bao gồm 4 phân hệ chính:
1. **Phân hệ Thị giác AI (Computer Vision Pipeline):** Tích hợp mô hình nhận diện thế hệ mới **YOLOv12n** và giải thuật truy vết đa đối tượng **ByteTrack** (sử dụng bộ lọc Kalman 8D và cơ chế ghép đôi hai giai đoạn) giúp duy trì định danh kiện hàng liên tục, chống hiện tượng mất dấu khi bị che khuất tạm thời (occlusion).
2. **Phân hệ Phân loại Bưu chính IoT (IoT Sorting Control):** Tự động ánh xạ mã bưu điện 5 chữ số của Tổng công ty Bưu điện Việt Nam (VNPost) sang các cổng phân loại vật lý (Cổng 1 - Miền Bắc, Cổng 2 - Miền Trung, Cổng 3 - Miền Nam, Cổng 4 - Làn Re-check), điều khiển góc mở cần gạt $45^\circ$, và giám sát cảm biến chống kẹt hàng (Anti-jam).
3. **Phân hệ Điều phối Robot tự hành (AMR Dispatching):** Tìm đường di chuyển ngắn nhất trên lưới ô vuông 2D (Occupancy Grid Map) bằng thuật toán **A\*** (khoảng cách Manhattan/Chebyshev), tự động phát hiện vật cản bất ngờ và kích hoạt cơ chế Local Re-planning để tránh va chạm.
4. **Phân hệ Máy chủ Dịch vụ & Trực quan hóa (FastAPI & HTML5 Canvas 2D):** Máy chủ RESTful API phi đồng bộ, kênh truyền **WebSocket 60 FPS** phát sóng trực tiếp trạng thái băng chuyền và xe tự hành lên giao diện điều khiển đồ họa trên nền Web.

### 1.3. Thuật ngữ, từ viết tắt và định nghĩa (Definitions, Acronyms, Abbreviations)

| Thuật ngữ / Viết tắt | Tên đầy đủ / Định nghĩa tiếng Anh | Giải thích chi tiết trong ngữ cảnh đề tài |
|:---|:---|:---|
| **AMR** | Autonomous Mobile Robot | Robot tự hành vận chuyển pallet/kiện hàng trong khu vực lưu trữ kho bãi. |
| **ByteTrack** | Multi-Object Tracking by Associating Every Detection Box | Thuật toán truy vết đa đối tượng tận dụng cả hộp bao độ tin cậy thấp để giải quyết che khuất. |
| **Kalman Filter (8D)** | 8-Dimensional State Kalman Filter | Bộ lọc trạng thái tuyến tính ước lượng vector vị trí và vận tốc $(x_c, y_c, a, h, v_x, v_y, v_a, v_h)$. |
| **IoU** | Intersection over Union | Tỷ lệ diện tích giao nhau trên diện tích hợp nhau giữa 2 hộp bao dự đoán và thực tế. |
| **MOTA** | Multiple Object Tracking Accuracy | Chỉ số độ chính xác truy vết đa đối tượng tổng hợp (xét sai số bỏ sót, nhận nhầm và nhảy ID). |
| **IDF1** | Identification F1-Score | Tỷ lệ F1 đo lường khả năng duy trì đúng định danh đối tượng xuyên suốt thời gian di chuyển. |
| **ID Switch** | Identity Switch | Hiện tượng thuật toán gán nhầm mã định danh (Track ID) từ đối tượng này sang đối tượng khác. |
| **Virtual Attribution** | Gán nhãn ảo bưu chính | Cơ chế ánh xạ mã bưu chính giả lập từ kịch bản hoặc nhận diện bounding box mà không cần máy quét barcode quang học vật lý ngoài đời. |
| **Occupancy Grid** | Lưới ô vuông chiếm dụng | Bản đồ kho 2D rời rạc hóa thành các ô kích thước cố định mang giá trị 0 (trống) hoặc 1 (vật cản). |
| **RBAC** | Role-Based Access Control | Mô hình kiểm soát truy cập phân quyền người dùng theo vai trò (Admin, Operator, Viewer). |
| **RTM** | Requirement Traceability Matrix | Ma trận truy vết kiểm tra sự tương ứng từ yêu cầu sang thiết kế, mã nguồn và ca kiểm thử. |

### 1.4. Tài liệu tham chiếu (References)
1. **IEEE Std 830-1998:** *IEEE Recommended Practice for Software Requirements Specifications*, IEEE Computer Society, 1998.
2. **ISO/IEC/IEEE 29148:2018:** *Systems and software engineering — Life cycle processes — Requirements engineering*.
3. **Thuyết minh đề tài NCKH sinh viên SV2026-ICTU-08:** *Nghiên cứu, xây dựng hệ thống AI truy vết và điều phối hàng hóa trong kho thông minh*, ICTU, 2026.
4. **Báo cáo tổng kết đề tài NCKH:** `docs/BAO_CAO_TONG_KET_NCKH_ICTU_DA_SUA.docx`.
5. **Bộ quy chuẩn kỹ thuật Agent:** [AGENTS.md](file:///d:/NHIEN_CUU_KHOA_HOC/NCKH_2026/AGENTS.md) và [QUY_CHUAN_RULE_VA_SKILL.md](file:///d:/NHIEN_CUU_KHOA_HOC/NCKH_2026/QUY_CHUAN_RULE_VA_SKILL.md).

### 1.5. Tổng quan cấu trúc tài liệu (Overview)
Tài liệu được phân bổ thành 6 mục mạch lạc:
- **Mục 2:** Phác họa bức tranh toàn cảnh, đối tượng sử dụng, môi trường và các giả định vận hành.
- **Mục 3:** Trọng tâm tài liệu — đặc tả cấu trúc dữ liệu, luồng tương tác và tiêu chí nghiệm thu cho trọn vẹn 13 Use Cases.
- **Mục 4:** Thiết lập các chỉ số kỹ thuật định lượng (NFR) về độ trễ, FPS, mAP, MOTA, bảo mật.
- **Mục 5:** Mô tả các chuẩn giao tiếp vật lý, phần mềm và giao thức mạng.
- **Mục 6:** Bảng ma trận truy vết RTM đảm bảo tính kiểm thử được (verifiability).

---

## MỤC 2: MÔ TẢ TỔNG QUAN (OVERALL DESCRIPTION)

### 2.1. Bối cảnh và phối cảnh hệ thống (Product Perspective)
Hệ thống AI Smart Logistics là một mắt xích trung tâm kết nối giữa tầng điều hành kho bãi (WMS/SCADA) và tầng cơ sở hạ tầng phân loại tự động:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   GIAO DIỆN NGƯỜI DÙNG & ĐIỀU HÀNH                     │
│    - Dashboard Quản trị Web (KPIs, Sản lượng phân loại, Giám sát lỗi)   │
│    - Giao diện trực quan Canvas 2D thời gian thực (60 FPS WebSocket)   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP REST API / WebSocket
┌───────────────────────────────────▼────────────────────────────────────┐
│                  MÁY CHỦ TRUNG TÂM BACKEND (FASTAPI)                   │
│  - Middleware Xác thực JWT & Phân quyền RBAC                           │
│  - Dịch vụ Điều phối Cổng phân loại IoT (Virtual Attribution)          │
│  - Dịch vụ Tìm đường A* & Điều hướng Robot tự hành AMR                 │
│  - Quản lý trạng thái mô phỏng 60 FPS (Simulation Engine)              │
│  - ORM SQLAlchemy 2.0 & CSDL Quan hệ Chuẩn 3NF (MySQL / SQLite)        │
└───────────────────▲────────────────────────────────▲───────────────────┘
                    │                                │
┌───────────────────┴─────────────┐    ┌─────────────┴───────────────────┐
│     ĐƯỜNG ỐNG THỊ GIÁC AI       │    │     PHÂN HỆ THIẾT BỊ NGOẠI VI   │
│ - Luồng Camera Video Băng tải   │    │ - 03 Cổng phân loại Servo IoT    │
│ - Mô hình phát hiện YOLOv12n    │    │ - 01 Làn Re-check kiểm tra lại  │
│ - Thuật toán ByteTrack (8D KF)  │    │ - Cảm biến quang phản hồi lỗi   │
│ - Cơ chế xử lý che khuất        │    │ - Đội xe tự hành AMR trong kho  │
└─────────────────────────────────┘    └─────────────────────────────────┘
```

### 2.2. Tóm tắt các chức năng chính (Product Functions)
Hệ thống cung cấp trọn bộ **13 chức năng nghiệp vụ (13 Use Cases)** được chia thành 4 nhóm nghiệp vụ chính:

1. **Nhóm Quản trị & Xác thực (Security & Governance):**
   - **UC-01:** Đăng nhập và xác thực phiên người dùng bằng JSON Web Token (JWT).
   - **UC-02:** Quản lý danh mục người dùng và phân quyền RBAC (Admin, Operator, Viewer).
2. **Nhóm Nhập kho & Thị giác AI (Vision & Tracking):**
   - **UC-03:** Tiếp nhận và đăng ký thông tin kiện hàng vào hệ thống (Inbound).
   - **UC-04:** Phát hiện tự động 4 lớp đối tượng kho bãi (package, pallet, vehicle, person) bằng YOLOv12n.
   - **UC-05:** Truy vết đa đối tượng liên tục và duy trì định danh bằng ByteTrack (Kalman 8D).
3. **Nhóm Điều phối Bưu chính & Tự hành (Sorting & Robotics):**
   - **UC-06:** Ánh xạ mã vùng bưu chính (Virtual Attribution) sang cổng phân loại.
   - **UC-07:** Điều khiển mở cần gạt cổng phân loại cơ khí IoT theo vạch kích hoạt.
   - **UC-08:** Tìm đường di chuyển tối ưu và tránh vật cản động cho Robot AMR bằng thuật toán A*.
   - **UC-09:** Xử lý kiện hàng lỗi / mất nhãn và phát tín hiệu cảnh báo kẹt hàng (Anti-jam alert).
4. **Nhóm Quản lý Kho & Giám sát Vận hành (Monitoring & Analytics):**
   - **UC-10:** Quản lý sơ đồ mặt bằng ô kệ lưu kho và gợi ý vị trí lưu kho tối ưu.
   - **UC-11:** Thống kê năng suất, sản lượng phân loại và xuất báo cáo KPI theo ca.
   - **UC-12:** Trực quan hóa mô phỏng toàn bộ kho bãi trên nền tảng HTML5 Canvas 2D (60 FPS).
   - **UC-13:** Ghi nhận nhật ký sự kiện kiểm toán hệ thống (Audit Trail) và cảnh báo ngoại lệ.

### 2.3. Đặc tính người dùng và các tác nhân (User Characteristics & Actors)
- **Quản trị viên (Admin):** Có toàn quyền cấu hình tham số hệ thống, tạo tài khoản, phân quyền, xem nhật ký kiểm toán và xuất báo cáo tổng kết. Yêu cầu trình độ tin học khá.
- **Nhân viên vận hành (Operator):** Trực tiếp giám sát băng chuyền Canvas 2D, tiếp nhận kiện hàng, xử lý cảnh báo kẹt hàng và điều động lệnh cho xe AMR.
- **Người quan sát (Viewer):** Chỉ có quyền xem dashboard thống kê sản lượng và màn hình trực quan hóa, không được kích hoạt thao tác điều khiển.
- **Hệ thống Camera AI (AI Camera Agent):** Tác nhân tự động cấp luồng khung hình video để mô hình AI nhận diện và truy vết đối tượng.
- **Cổng phân loại IoT (IoT Sorting Gate):** Tác nhân phần cứng tiếp nhận tín hiệu điều khiển góc gạt $45^\circ$ và trả tín hiệu cảm biến phản hồi.
- **Robot tự hành AMR (AMR Agent):** Tác nhân tự động nhận tọa độ đích, thực thi di chuyển theo lộ trình A* và phản hồi trạng thái vật cản.

### 2.4. Môi trường vận hành (Operating Environment)
- **Hạ tầng máy chủ (Backend):**
  - Hệ điều hành: Linux (Ubuntu 22.04 LTS) hoặc Windows 10/11 64-bit.
  - Runtime: Python 3.10+ với FastAPI và Uvicorn ASGI Server.
  - Tăng tốc phần cứng AI: NVIDIA GPU với CUDA 11.8+ / 12.x hoặc CPU đa nhân có tập lệnh AVX-512.
  - Cơ sở dữ liệu: MySQL 8.0 (Engine InnoDB) hoặc SQLite 3 (dùng cho môi trường thử nghiệm và kiểm thử).
- **Trình duyệt phía người dùng (Client Web):**
  - Trình duyệt chuẩn HTML5/ES6: Google Chrome 90+, Microsoft Edge 90+, Mozilla Firefox 88+.
  - Màn hình hỗ trợ độ phân giải tối thiểu $1366 \times 768$, khuyến nghị Full HD ($1920 \times 1080$).

### 2.5. Ràng buộc thiết kế và triển khai (Design & Implementation Constraints)
1. **Kiến trúc phân tầng (Layered Architecture):** Mã nguồn Backend phải tuân thủ nghiêm ngặt mô hình phân tách trách nhiệm: `core` (cấu hình & bảo mật) $\rightarrow$ `models` (SQLAlchemy 3NF) $\rightarrow$ `schemas` (Pydantic v2 DTO) $\rightarrow$ `services` (Core Logic) $\rightarrow$ `api` (Endpoints).
2. **Kỷ luật bảo mật (Security First):** Tuyệt đối không hardcode mật khẩu, token, khóa bí mật trong mã nguồn; tất cả phải được nạp qua tệp `.env` sử dụng thư viện `pydantic-settings`.
3. **Mô hình dữ liệu chuẩn 3NF:** Toàn bộ 6 bảng cơ sở dữ liệu (`users`, `packages`, `storage_locations`, `sorting_gates`, `tracking_sessions`, `system_logs`) phải đạt dạng chuẩn 3NF, có ràng buộc khóa ngoại `ON DELETE RESTRICT` hoặc `CASCADE` hợp lệ.
4. **Tiêu chuẩn mã nguồn:** Tuân thủ hướng dẫn định dạng mã Python PEP 8 và tiêu chuẩn ECMAScript 6 cho giao diện Web.

### 2.6. Giả định và sự phụ thuộc (Assumptions & Dependencies)
1. **Giả định về dữ liệu mô phỏng (Sim-to-Real):** Do điều kiện phòng lab NCKH sinh viên, luồng camera băng chuyền được mô phỏng thông qua tập video tổng hợp 2.500 khung hình chuẩn hóa độ phân giải $640 \times 640$ pixel. Tọa độ trên Canvas 2D đại diện cho tọa độ không gian thực của nhà kho.
2. **Sự phụ thuộc vào mạng cục bộ:** Kênh truyền WebSocket yêu cầu mạng nội bộ LAN có độ trễ kết nối $\le 10$ ms để đảm bảo tần số làm mới 60 FPS mà không gây nghẽn bộ đệm trình duyệt.

---

## MỤC 3: YÊU CẦU CHỨC NĂNG CỤ THỂ (SPECIFIC FUNCTIONAL REQUIREMENTS)

### UC-01: Đăng nhập và xác thực người dùng (Auth JWT)
- **Tác nhân (Actor):** Admin, Operator, Viewer.
- **Mục tiêu:** Xác thực danh tính người dùng và cấp mã ủy quyền truy cập JSON Web Token (JWT).
- **Tiền điều kiện (Pre-conditions):** Tài khoản đã được tạo trên hệ thống và trạng thái `is_active = True`.
- **Hậu điều kiện (Post-conditions):** Người dùng nhận được `access_token` hợp lệ kèm thông tin vai trò (role) để truy cập các tài nguyên được bảo vệ.
- **Luồng sự kiện chính (Main Flow):**
  1. Người dùng gửi yêu cầu `POST /api/v1/auth/login` chứa `username` và `password`.
  2. Hệ thống tìm kiếm bản ghi trong bảng `users` theo `username`.
  3. Hệ thống so khớp mật khẩu bằng hàm băm `passlib.bcrypt.verify()`.
  4. Hệ thống kiểm tra cờ kích hoạt `is_active`.
  5. Hệ thống khởi tạo JWT access token ký bằng thuật toán HMAC-SHA256 (HS256) với thời hạn hết hạn (TTL mặc định 480 phút) chứa payload: `sub` (username), `role`, `user_id`.
  6. Hệ thống phản hồi mã HTTP 200 OK kèm JSON: `{"access_token": "...", "token_type": "bearer", "role": "..."}`.
- **Luồng ngoại lệ (Exception Flow):**
  - *E1 (Sai thông tin):* Sai username hoặc password $\rightarrow$ Trả về HTTP 401 Unauthorized (`"Sai tên đăng nhập hoặc mật khẩu"`).
  - *E2 (Tài khoản bị khóa):* `is_active = False` $\rightarrow$ Trả về HTTP 403 Forbidden (`"Tài khoản đang bị tạm khóa"`).
- **Tiêu chí nghiệm thu (Acceptance Criteria):** Thời gian xác thực mật khẩu $\le 100$ ms; Token bị từ chối ngay khi hết hạn hoặc bị chỉnh sửa chữ ký.

---

### UC-02: Phân quyền vai trò người dùng (RBAC)
- **Tác nhân (Actor):** Quản trị viên (Admin).
- **Mục tiêu:** Cấp phát, cập nhật hoặc thu hồi quyền truy cập của người dùng theo 3 vai trò: `ADMIN`, `OPERATOR`, `VIEWER`.
- **Tiền điều kiện:** Người dùng thực hiện phải có token xác thực với vai trò `ADMIN`.
- **Hậu điều kiện:** Bảng `users` được cập nhật, quyền hạn mới có hiệu lực ngay trong phiên làm việc kế tiếp.
- **Luồng sự kiện chính:**
  1. Admin gửi yêu cầu `GET /api/v1/auth/users` để xem danh sách tài khoản hiện tại.
  2. Admin gửi yêu cầu `POST /api/v1/auth/register` (hoặc cập nhật vai trò qua `PUT`) kèm: `username`, `full_name`, `role`, `password`.
  3. Hệ thống kiểm tra tính duy nhất của `username`.
  4. Hệ thống băm mật khẩu bằng `bcrypt` với cost factor $\ge 12$.
  5. Bản ghi mới được lưu vào CSDL; hệ thống ghi log sự kiện kiểm toán `USER_ROLE_ASSIGNED`.
- **Luồng ngoại lệ:**
  - *E1 (Không đủ quyền):* Người gọi không phải Admin $\rightarrow$ Middleware chặn và trả về HTTP 403 Forbidden.
  - *E2 (Trùng tên đăng nhập):* Username đã tồn tại $\rightarrow$ Trả về HTTP 400 Bad Request.
- **Tiêu chí nghiệm thu:** Mọi endpoint chỉnh sửa hệ thống bắt buộc phải kiểm tra `dependencies=[Depends(require_admin)]`.

---

### UC-03: Tiếp nhận kiện hàng nhập kho (Inbound Intake)
- **Tác nhân (Actor):** Nhân viên vận hành (Operator).
- **Mục tiêu:** Đăng ký thông tin bưu kiện mới vào hệ thống trước khi đưa lên băng chuyền phân loại.
- **Tiền điều kiện:** Kiện hàng có mã vạch (barcode) và địa chỉ đến rõ ràng.
- **Hậu điều kiện:** Kiện hàng được lưu vào bảng `packages` với trạng thái ban đầu `RECEIVED`.
- **Luồng sự kiện chính:**
  1. Operator quét mã vạch hoặc nhập liệu qua giao diện Web: mã bưu chính (`postal_code`), điểm đến (`destination_zone`), trọng lượng (`weight_kg`), kích thước (`width_cm`, `height_cm`, `length_cm`).
  2. Gửi yêu cầu `POST /api/v1/packages/`.
  3. Hệ thống tự động kiểm tra định dạng mã bưu chính 5 hoặc 6 chữ số theo chuẩn Bưu điện Việt Nam.
  4. Dữ liệu được ghi vào CSDL, khởi tạo thời gian `created_at`.
  5. Hệ thống trả về thông tin kiện hàng và sẵn sàng đưa lên băng chuyền.
- **Tiêu chí nghiệm thu:** Tiếp nhận và phản hồi thông tin kiện hàng trong thời gian $\le 50$ ms.

---

### UC-04: Phát hiện đối tượng kho bãi với YOLOv12n (Detection)
- **Tác nhân (Actor):** Hệ thống Camera AI (AI Camera Agent).
- **Mục tiêu:** Nhận diện và xác định vị trí tọa độ hộp bao (Bounding Box) của 4 lớp thực thể kho bãi (`package`, `pallet`, `vehicle`, `person`) trong từng khung hình video.
- **Tiền điều kiện:** Luồng video đầu vào đạt chuẩn $640 \times 640$ pixel, tốc độ tối thiểu 30 khung hình/giây.
- **Hậu điều kiện:** Trả về danh sách các hộp bao dự đoán $B_i = (x_1, y_1, x_2, y_2, conf, cls)$.
- **Luồng sự kiện chính:**
  1. Nhận khung hình từ bộ đệm camera.
  2. Đưa khung hình qua mạng nơ-ron học sâu tích chập **YOLOv12n**.
  3. Lọc bỏ các hộp bao có điểm tin cậy $conf < 0.1$.
  4. Áp dụng giải thuật Non-Maximum Suppression (NMS) với ngưỡng $IoU = 0.65$ để loại bỏ các hộp bao trùng lặp.
  5. Chuyển danh sách phát hiện sang Phân hệ Truy vết ByteTrack.
- **Tiêu chí nghiệm thu:**
  - Thời gian suy luận mô hình trên GPU: $t_{infer} \le 20$ ms/frame (tương đương $\ge 50$ FPS).
  - Độ chính xác trung bình mAP@0.5 trên tập kiểm thử: $\ge 90.0\%$.

---

### UC-05: Truy vết đa đối tượng liên tục với ByteTrack (Tracking)
- **Tác nhân (Actor):** Hệ thống Camera AI (AI Camera Agent).
- **Mục tiêu:** Gán và duy trì mã định danh duy nhất (`track_id`) cho từng kiện hàng khi di chuyển trên băng chuyền, giải quyết triệt để bài toán mất dấu do che khuất vật lý.
- **Tiền điều kiện:** Danh sách phát hiện từ UC-04 được chuyển sang.
- **Hậu điều kiện:** Danh sách các track tích cực (`active_tracks`) với tọa độ tâm $(x_c, y_c)$ và vận tốc di chuyển $(v_x, v_y)$.
- **Luồng sự kiện chính:**
  1. **Bước dự đoán (Predict):** Bộ lọc Kalman 8 chiều cập nhật vector trạng thái:
     $$\mathbf{x}_{k|k-1} = \mathbf{F} \mathbf{x}_{k-1|k-1}, \quad \mathbf{P}_{k|k-1} = \mathbf{F} \mathbf{P}_{k-1|k-1} \mathbf{F}^T + \mathbf{Q}$$
  2. **Ghép đôi giai đoạn 1 (First Association):**
     - Lọc các detection có độ tin cậy cao: $D_{high} = \{d_i \mid conf(d_i) \ge 0.6\}$.
     - Tính ma trận chi phí khoảng cách $1 - IoU$ với các tracklet hiện có.
     - Ghép đôi tối ưu bằng thuật toán Hungarian.
  3. **Ghép đôi giai đoạn 2 (Second Association - Xử lý che khuất):**
     - Gom các detection có độ tin cậy thấp: $D_{low} = \{d_j \mid 0.1 \le conf(d_j) < 0.6\}$.
     - Ghép đôi $D_{low}$ với các tracklet chưa được ghép ở giai đoạn 1. Hộp bao bị che khuất một phần vẫn được phục hồi đúng ID ban đầu.
  4. **Cập nhật trạng thái (Update):**
     - Cập nhật trạng thái Kalman cho các track ghép thành công.
     - Khởi tạo track mới cho detection $D_{high}$ chưa ghép sau 3 khung hình liên tiếp.
     - Xóa các track biến mất quá $N_{lost} = 30$ khung hình (tương đương 1 giây).
- **Tiêu chí nghiệm thu:**
  - Chỉ số MOTA đạt $\ge 80.0\%$; chỉ số IDF1 đạt $\ge 85.0\%$.
  - Tỷ lệ nhảy ID (ID switches) giảm tối thiểu $50\%$ so với giải thuật baseline SORT.

---

### UC-06: Ánh xạ mã vùng bưu chính (Virtual Attribution)
- **Tác nhân (Actor):** Phân hệ Logistics Engine.
- **Mục tiêu:** Ánh xạ mã bưu chính của kiện hàng sang số hiệu cổng phân loại tương ứng và ghi nhận vào phiên truy vết.
- **Tiền điều kiện:** Kiện hàng được phát hiện và có tọa độ di chuyển trên băng chuyền.
- **Hậu điều kiện:** Xác định cổng phân loại mục tiêu (`target_gate_id`).
- **Luồng sự kiện chính:**
  1. Bưu kiện đi vào vùng quan sát nhận diện ban đầu ($X \in [50, 150]$ pixel).
  2. Hệ thống lấy mã bưu chính từ thuộc tính kiện hàng và đối chiếu bảng định tuyến VNPost:
     - `100000` đến `180000` (Khu vực Miền Bắc - Hà Nội): Định tuyến sang **Cổng 1**.
     - `550000` đến `590000` (Khu vực Miền Trung - Đà Nẵng): Định tuyến sang **Cổng 2**.
     - `700000` đến `960000` (Khu vực Miền Nam - TP.HCM): Định tuyến sang **Cổng 3**.
     - Các mã khác hoặc không nhận diện được: Định tuyến sang **Cổng 4 (Làn Re-check)**.
  3. Cập nhật `assigned_gate_number` vào bản ghi `tracking_sessions` của phiên làm việc.
- **Tiêu chí nghiệm thu:** Thời gian ánh xạ $\le 5$ ms; 100% bưu kiện lỗi mã được gom về làn Re-check an toàn.

---

### UC-07: Phân loại hàng hóa tự động qua cổng IoT (Sorting Control)
- **Tác nhân (Actor):** Cổng phân loại cơ khí IoT (IoT Sorting Gate).
- **Mục tiêu:** Kích hoạt mở cần gạt cơ khí góc $45^\circ$ đẩy kiện hàng vào đúng máng trượt phân loại khi tọa độ kiện hàng chạm vạch kích hoạt.
- **Tiền điều kiện:** Kiện hàng đã được định tuyến ở UC-06 và đang di chuyển trên băng chuyền.
- **Hậu điều kiện:** Kiện hàng rơi vào máng phân loại, trạng thái kiện chuyển thành `SORTED`, cần gạt thu về vị trí $0^\circ$.
- **Luồng sự kiện chính:**
  1. Trục tọa độ $X$ của kiện hàng đạt vạch kích hoạt của cổng mục tiêu:
     $$|X_{package} - X_{gate}| \le \delta_{threshold} \quad (\delta = 5 \text{ pixel})$$
  2. Backend gửi tín hiệu kích hoạt: `POST /api/v1/iot/gates/{gate_number}/trigger`.
  3. Cần gạt servo mở ra một góc $45.0^\circ$, giữ trong khoảng thời gian $t_{deflect} = 1.2$ giây để dẫn hướng kiện hàng.
  4. Cảm biến quang tại miệng máng trượt nhận tín hiệu kiện đã rơi qua làn.
  5. Cần gạt thu về vị trí an toàn ($0^\circ$).
  6. Hệ thống tăng bộ đếm `total_diverted_count` thêm 1 và ghi nhật ký sự kiện `SORT_TRIGGER`.
- **Tiêu chí nghiệm thu:**
  - Tỷ lệ phân loại chính xác: $\ge 98.0\%$.
  - Góc mở cần gạt đạt chuẩn $45^\circ \pm 2^\circ$.

---

### UC-08: Tìm đường tối ưu cho Robot AMR (A* Pathfinding)
- **Tác nhân (Actor):** Robot tự hành AMR (AMR Agent).
- **Mục tiêu:** Tính toán đường đi ngắn nhất từ vị trí hiện tại đến kệ hàng đích trên bản đồ kho, tránh các vật cản tĩnh và động.
- **Tiền điều kiện:** Bản đồ kho được rời rạc hóa thành lưới ô vuông (Occupancy Grid); tọa độ xuất phát $(x_s, y_s)$ và tọa độ đích $(x_g, y_g)$ nằm trong vùng hợp lệ.
- **Hậu điều kiện:** Trả về danh sách các điểm nút tọa độ $[(x_0, y_0), (x_1, y_1), \dots, (x_n, y_n)]$ tối ưu cho robot di chuyển.
- **Luồng sự kiện chính:**
  1. Nhận lệnh vận chuyển từ hệ thống điều phối qua `POST /api/v1/amr/navigate`.
  2. Khởi tạo danh sách mở (`open_set`) chứa nút xuất phát với hàm chi phí:
     $$f(n) = g(n) + h(n)$$
     Trong đó $g(n)$ là chi phí thực tế từ điểm bắt đầu; $h(n)$ là hàm heuristic khoảng cách Manhattan (cho 4 hướng) hoặc Chebyshev (cho 8 hướng):
     $$h_{Manhattan}(n) = |x_n - x_g| + |y_n - y_g|$$
     $$h_{Chebyshev}(n) = \max(|x_n - x_g|, |y_n - y_g|)$$
  3. Lặp duyệt nút có $f(n)$ nhỏ nhất, mở rộng các nút lân cận không phải là vật cản (`grid[x][y] == 0`).
  4. Truy vết ngược đường đi khi đạt đích đến.
  5. **Cơ chế tránh va chạm động (Local Re-planning):** Trong quá trình di chuyển, nếu cảm biến khoảng cách của AMR phát hiện vật cản bất ngờ cách $< 1.5$ mét, robot lập tức phanh dừng an toàn, cập nhật tạm thời ô lưới đó thành vật cản (`grid = 1`), và gọi lại thuật toán A* để tính đường vòng mới.
- **Tiêu chí nghiệm thu:**
  - Thời gian tính toán đường đi trên lưới $50 \times 50$: $\le 10$ ms.
  - Robot dừng an toàn $100\%$ khi có vật cản đột xuất, không xảy ra va chạm phần mềm.

---

### UC-09: Xử lý kiện hàng sai sót & Cảnh báo kẹt cổng (Anti-jam Alert)
- **Tác nhân (Actor):** Cổng phân loại IoT, Nhân viên vận hành (Operator).
- **Mục tiêu:** Tự động phát hiện sự cố kẹt hàng tại cổng phân loại và chuyển bưu kiện không hợp lệ về làn Re-check an toàn.
- **Tiền điều kiện:** Cần gạt phân loại đã mở nhưng cảm biến phản hồi chưa xác nhận kiện đã lọt qua.
- **Hậu điều kiện:** Cổng chuyển sang trạng thái `JAMMED`, gửi cảnh báo trực quan trên Dashboard và tạm dừng băng chuyền nếu cần.
- **Luồng sự kiện chính:**
  1. Sau khi gửi lệnh mở cần gạt, hệ thống kích hoạt đồng hồ đếm ngược $t_{timeout} = 3.0$ giây.
  2. Nếu sau 3 giây cảm biến quang tại miệng máng không ghi nhận kiện hàng đi qua:
     - Hệ thống kích hoạt hàm `handle_anti_jam_alert()`.
     - Cập nhật trạng thái cổng thành `JAMMED`.
     - Ghi nhật ký cảnh báo lỗi `GATE_JAM_ALERT` vào bảng `system_logs`.
     - Kênh WebSocket broadcast gói tin cảnh báo màu đỏ đến giao diện Dashboard của Operator.
  3. Operator can thiệp gỡ kẹt thủ công, sau đó bấm nút "Xác nhận xử lý lỗi" trên màn hình để đưa cổng về trạng thái `IDLE`.
- **Tiêu chí nghiệm thu:** Phát hiện kẹt hàng và kích hoạt cảnh báo trong vòng đúng 3.0 giây; không gây hư hại cơ khí cho cần gạt servo.

---

### UC-10: Quản lý sơ đồ mặt bằng và ô kệ lưu kho (Storage Locations)
- **Tác nhân (Actor):** Nhân viên kho (Operator), Quản trị viên (Admin).
- **Mục tiêu:** Quản lý danh mục các ô kệ lưu trữ, tọa độ lưới, khả năng chịu tải và áp dụng giải thuật gợi ý vị trí lưu kho tối ưu.
- **Tiền điều kiện:** Đã khai báo danh mục ô kệ trong bảng `storage_locations`.
- **Hậu điều kiện:** Trả về danh sách vị trí trống phù hợp nhất cho kiện hàng.
- **Luồng sự kiện chính:**
  1. Người dùng truy vấn `GET /api/v1/warehouse/locations`.
  2. Khi có kiện hàng mới cần cất trữ, hệ thống áp dụng công thức tính điểm Heuristic có trọng số (Weighted Scoring):
     $$S(L) = w_1 \cdot \frac{1}{d(L, \text{gate})} + w_2 \cdot (C_{max} - W_{pkg}) + w_3 \cdot \text{ZonePriority}$$
     Trong đó hàng nặng ưu tiên tầng thấp; hàng chuyển phát nhanh ưu tiên gần cổng xuất.
  3. Hệ thống trả về vị trí ô kệ có điểm số $S(L)$ cao nhất và cập nhật trạng thái ô kệ thành `RESERVED`.
- **Tiêu chí nghiệm thu:** Thời gian gợi ý vị trí $\le 10$ ms; đảm bảo tuân thủ tuyệt đối quy tắc an toàn tải trọng kệ kho.

---

### UC-11: Báo cáo thống kê năng suất và sản lượng (KPIs & Metrics)
- **Tác nhân (Actor):** Quản trị viên (Admin), Quản lý kho.
- **Mục tiêu:** Thống kê các chỉ số hoạt động thời gian thực của trung tâm phân loại bưu chính.
- **Tiền điều kiện:** Hệ thống đã ghi nhận các sự kiện tiếp nhận, phân loại và truy vết.
- **Hậu điều kiện:** Xuất dữ liệu biểu đồ và bảng số liệu thống kê.
- **Luồng sự kiện chính:**
  1. Người dùng gửi yêu cầu `GET /api/v1/stats/overview`.
  2. Hệ thống thực hiện các phép truy vấn gom nhóm (aggregation queries) trên bảng `packages` và `sorting_gates`:
     - Tổng số kiện đã tiếp nhận (`total_received`).
     - Tổng số kiện phân loại thành công (`total_sorted`).
     - Số lượng phân loại chi tiết theo từng cổng (Miền Bắc, Miền Trung, Miền Nam, Re-check).
     - Năng suất phân loại trung bình: $\approx 1.100 - 1.200$ kiện/giờ/làn (hoặc $1.95$ giây/kiện khi tải đỉnh).
     - Tỷ lệ phân loại chính xác: $\text{Accuracy} = \frac{N_{sorted}}{N_{total}} \times 100\%$.
  3. Dữ liệu được định dạng JSON chuẩn để vẽ biểu đồ thanh (Bar Chart) và biểu đồ tròn (Donut Chart) trên Dashboard.
- **Tiêu chí nghiệm thu:** Phép tính tổng hợp dữ liệu toàn bộ ca làm việc (trên 10.000 bản ghi) phản hồi dưới 200 ms.

---

### UC-12: Trực quan hóa mô phỏng thời gian thực Canvas 2D (Simulation UI)
- **Tác nhân (Actor):** Tất cả người dùng (Admin, Operator, Viewer).
- **Mục tiêu:** Hiển thị trực quan toàn bộ chuyển động của băng tải, kiện hàng, vệt truy vết AI, các cổng phân loại và xe tự hành AMR trên nền tảng HTML5 Canvas 2D mượt mà.
- **Tiền điều kiện:** Trình duyệt hỗ trợ HTML5 Canvas và WebSocket; kết nối tới `/ws/simulation/stream` thành công.
- **Hậu điều kiện:** Màn hình mô phỏng tự động cập nhật liên tục 60 khung hình/giây.
- **Luồng sự kiện chính:**
  1. Trình duyệt mở kết nối WebSocket: `ws://localhost:8000/ws/simulation/stream`.
  2. Máy chủ Backend (Simulation Engine) khởi tạo vòng lặp phát sóng định kỳ mỗi $16.6$ ms ($1/60$ giây).
  3. Mỗi gói tin gửi về một Snapshot JSON chứa:
     - Danh sách kiện hàng: `[{id, x, y, barcode, zone, track_id, status}, ...]`.
     - Trạng thái 4 cổng phân loại: `[{gate: 1, angle: 45.0, status: "DEFLECTING"}, ...]`.
     - Vị trí và lộ trình xe AMR: `{amr_id: 1, x: 250, y: 300, battery: 92, path: [...]}`.
  4. Trình duyệt thực thi hàm `requestAnimationFrame()`:
     - Xóa nền canvas (`ctx.clearRect()`).
     - Vẽ băng chuyền và vạch phân chia làn.
     - Vẽ kiện hàng dưới dạng khối chữ nhật bo góc kèm nhãn mã vạch và màu sắc theo vùng miền.
     - Vẽ đường đuôi truy vết (Tracking Trail) thể hiện lịch sử di chuyển của Track ID.
     - Vẽ cần gạt cơ khí xoay góc tương ứng và hiển thị vị trí xe AMR.
- **Tiêu chí nghiệm thu:**
  - Tốc độ khung hình hiển thị: Duy trì ổn định $60 \text{ FPS} \pm 2 \text{ FPS}$.
  - Độ trễ truyền nhận từ máy chủ đến màn hình: $\le 50$ ms.

---

### UC-13: Giám sát trạng thái hoạt động và cảnh báo lỗi (System Audit & SCADA Logs)
- **Tác nhân (Actor):** Quản trị viên hệ thống (Admin).
- **Mục tiêu:** Thu thập, lưu trữ tập trung và hiển thị nhật ký các sự kiện trọng yếu, cảnh báo lỗi phần cứng, và lịch sử thao tác của người dùng.
- **Tiền điều kiện:** Hệ thống đang hoạt động và dịch vụ ghi log kích hoạt.
- **Hậu điều kiện:** Dữ liệu nhật ký được lưu trữ bất biến (Immutable Audit Log) trong bảng `system_logs`.
- **Luồng sự kiện chính:**
  1. Mọi sự kiện hệ thống (Đăng nhập, kích hoạt cổng gạt, kẹt hàng, robot tránh vật cản, thêm người dùng) tự động gọi `log_system_event()`.
  2. Bản ghi lưu trữ thời gian `timestamp`, loại sự kiện `event_type`, mô tả chi tiết `description`.
  3. Admin truy cập mục "Nhật ký hệ thống" (`GET /api/v1/stats/logs?limit=50`).
  4. Hệ thống hiển thị bảng sự kiện có màu sắc phân loại: Màu xanh (Thông tin bình thường), Màu vàng (Cảnh báo), Màu đỏ (Lỗi nghiêm trọng).
- **Tiêu chí nghiệm thu:** Ghi log bất đồng bộ, không làm nghẽn luồng xử lý chính; nhật ký lưu trữ tối thiểu 90 ngày.

---

## MỤC 4: YÊU CẦU PHI CHỨC NĂNG (NON-FUNCTIONAL REQUIREMENTS - NFR)

### 4.1. Hiệu năng và thời gian thực (Performance Requirements)
- **NFR-PER-01 (Thời gian suy luận AI):**
  - Thời gian suy luận của mô hình YOLOv12n trên GPU chuyên dụng: $t_{infer} \le 20$ ms/frame (tương đương $\ge 50$ FPS).
  - Khi chạy trên CPU đa nhân thông thường: Đạt tối thiểu $25$ FPS.
- **NFR-PER-02 (Tốc độ làm mới hiển thị):**
  - Giao diện HTML5 Canvas 2D duy trì hiển thị ổn định $60$ khung hình/giây (FPS) thông qua vòng lặp `requestAnimationFrame()`.
- **NFR-PER-03 (Độ trễ truyền thông WebSocket):**
  - Độ trễ truyền nhận gói tin trạng thái giữa Backend và Client Canvas qua WebSocket: $\le 50$ ms trên mạng cục bộ LAN.
- **NFR-PER-04 (Thời gian phản hồi API):**
  - $95\%$ các yêu cầu RESTful API (CRUD kiện hàng, ô kệ, đăng nhập) phản hồi trong vòng $\le 100$ ms.

### 4.2. Độ chính xác và tin cậy thuật toán AI (AI Accuracy & Robustness)
- **NFR-ACC-01 (Độ chính xác phát hiện YOLOv12n):**
  - Chỉ số độ chính xác trung bình mAP@0.5 trên tập dữ liệu kiểm thử độc lập: Đạt $\ge 90.0\%$ cho toàn bộ 4 lớp thực thể (`package`, `pallet`, `vehicle`, `person`).
- **NFR-ACC-02 (Độ ổn định truy vết ByteTrack):**
  - Chỉ số Multiple Object Tracking Accuracy (MOTA): Đạt $\ge 80.0\%$.
  - Chỉ số Identification F1-Score (IDF1): Đạt $\ge 85.0\%$.
  - Tỷ lệ nhảy mã định danh (ID Switches): Giảm thiểu tối thiểu $50\%$ so với giải thuật chuẩn cơ sở SORT.
- **NFR-ACC-03 (Chống rò rỉ dữ liệu Sim-to-Real):**
  - Tập dữ liệu video mô phỏng (2.500 frames) phải được phân chia Train/Val/Test theo chuỗi video độc lập (sequence-level split) theo tỷ lệ 70-20-10, ngăn chặn hoàn toàn hiện tượng rò rỉ khung hình tương tự (data leakage).

### 4.3. An toàn và bảo mật thông tin (Security Requirements)
- **NFR-SEC-01 (Mã hóa mật khẩu):**
  - Mật khẩu người dùng bắt buộc được mã hóa một chiều bằng giải thuật `bcrypt` với muối ngẫu nhiên (salt) và cost factor $\ge 12$. Tuyệt đối không lưu trữ mật khẩu dưới dạng văn bản thô (plain-text).
- **NFR-SEC-02 (Xác thực và Phân quyền):**
  - Mọi yêu cầu can thiệp hệ thống phải có Access Token JWT hợp lệ. Token được ký bảo vệ bằng khóa bí mật (`SECRET_KEY`) và thuật toán HS256, tự động hết hạn sau thời gian quy định.
- **NFR-SEC-03 (Không lưu trữ bí mật trong mã nguồn):**
  - Mọi tham số cấu hình nhạy cảm (DB password, JWT Secret Key, API credentials) bắt buộc được quản lý qua biến môi trường (`.env`), không đưa lên hệ thống quản lý phiên bản Git.

### 4.4. Khả năng bảo trì và tương thích (Maintainability & Compatibility)
- **NFR-MAI-01 (Độc lập Cơ sở dữ liệu):**
  - Sử dụng tầng trừu tượng SQLAlchemy 2.0 ORM, cho phép chuyển đổi linh hoạt và trong suốt giữa SQLite (môi trường kiểm thử cục bộ) và MySQL / PostgreSQL (môi trường máy chủ thực tế) mà không cần viết lại mã truy vấn.
- **NFR-MAI-02 (Container hóa ứng dụng):**
  - Toàn bộ ứng dụng Backend và cấu hình môi trường được đóng gói hoàn chỉnh trong `Dockerfile` và `docker-compose.yml`, cho phép triển khai chỉ với 1 câu lệnh duy nhất (`docker-compose up -d`).

---

## MỤC 5: GIAO DIỆN HỆ THỐNG (SYSTEM INTERFACES)

### 5.1. Giao diện người dùng (User Interfaces - UI)
- **Màn hình Dashboard Điều hành (Web UI):**
  - Xây dựng bằng HTML5, CSS3 hiện đại, bố cục lưới Responsive Design.
  - Khối KPI thời gian thực: Hiển thị sản lượng kiện hàng, số kiện đã phân loại, số cảnh báo kẹt hàng đang hoạt động.
  - Bảng điều khiển tác vụ: Tiếp nhận kiện hàng mới, điều khiển dừng khẩn cấp băng tải, thiết lập tham số cổng IoT.
- **Màn hình Trực quan hóa Băng chuyền (HTML5 Canvas 2D):**
  - Không gian đồ họa kích thước $900 \times 400$ pixel mô phỏng trực quan chuyển động thời gian thực của băng tải, vạch cổng gạt $45^\circ$, đường đuôi truy vết đa sắc màu cho từng Track ID, và robot AMR di chuyển theo lộ trình A*.

### 5.2. Giao diện phần cứng (Hardware Interfaces)
- **Cổng phân loại cơ khí IoT (Servo Actuators):**
  - Giao tiếp điều khiển động cơ servo qua tín hiệu xung PWM (Pulse Width Modulation) hoặc module relay điều khiển công nghiệp; góc quay $0^\circ$ (vị trí đóng) đến $45^\circ$ (vị trí gạt hàng).
- **Cảm biến quang học phát hiện bưu kiện (Photoelectric Sensors):**
  - Cảm biến thu phát hồng ngoại hoặc laser đặt tại các vạch kích hoạt và máng trượt phân loại; cung cấp tín hiệu số mức logic TTL (0V - không có vật, 5V/24V - phát hiện vật) để tính toán phản hồi chống kẹt hàng.
- **Robot tự hành AMR:**
  - Bộ điều khiển vi cơ điện tử onboard nhận tọa độ điểm đích qua giao thức Wi-Fi/MQTT và thực thi di chuyển bám quỹ đạo.

### 5.3. Giao diện phần mềm (Software Interfaces)
- **Hệ quản trị CSDL MySQL:** Giao tiếp qua thư viện `PyMySQL` và trình điều vận `mysql+pymysql://` với cơ chế quản lý Connection Pooling tối ưu kết nối đồng thời.
- **Thư viện Thị giác máy tính & Học sâu:** Sử dụng `Ultralytics YOLO` và `PyTorch` cho mạng YOLOv12n; thư viện `OpenCV (cv2)` cho các phép biến đổi ma trận ảnh, vẽ bounding box và xử lý luồng video.

### 5.4. Giao diện truyền thông (Communication Interfaces)
- **Giao thức RESTful API:**
  - Chuẩn HTTP/1.1 hoặc HTTP/2 qua cổng TCP 8000.
  - Định dạng trao đổi dữ liệu: `application/json` (UTF-8).
  - Tự động sinh tài liệu chuẩn OpenAPI 3.0 và Swagger UI tại đường dẫn `/docs`.
- **Giao thức WebSocket (RFC 6455):**
  - Endpoint: `/ws/simulation/stream`.
  - Cơ chế bắt tay (Handshake) chuẩn WebSocket qua cổng HTTP, nâng cấp kết nối sang kênh song công toàn phần (Full-Duplex) để truyền tải liên tục dữ liệu nhị phân hoặc chuỗi JSON 60 lần mỗi giây.

---

## MỤC 6: MA TRẬN TRUY VẾT YÊU CẦU (REQUIREMENT TRACEABILITY MATRIX - RTM)

Bảng ma trận truy vết dưới đây thiết lập mối liên kết chặt chẽ hai chiều giữa **13 Yêu cầu Chức năng (UC-01 đến UC-13)** với **Mô hình Dữ liệu (Models)**, **Dịch vụ Core (Services)**, **Cổng giao tiếp (API Endpoints)**, **Giao diện Người dùng (UI)** và **Kịch bản Kiểm thử Thực nghiệm (Test Cases)** tại Phụ lục C của Báo cáo tổng kết:

| Mã UC | Tên Chức năng Nghiệp vụ | Bảng CSDL (Models) | Module Dịch vụ (Services) | Cổng Giao tiếp (API Endpoint) | Thành phần Giao diện (UI) | Mã Test Case (Phụ lục C) |
|:---:|:---|:---|:---|:---|:---|:---:|
| **UC-01** | Đăng nhập & Xác thực JWT | `users` | `core/security.py` | `POST /api/v1/auth/login` | Modal Đăng nhập Web | TC-01, TC-02, TC-03 |
| **UC-02** | Quản lý & Phân quyền RBAC | `users` | `core/security.py` | `GET/POST /api/v1/auth/users` | Quản trị người dùng | TC-04, TC-05 |
| **UC-03** | Tiếp nhận kiện hàng nhập kho | `packages` | `api/v1/packages.py` | `POST /api/v1/packages/` | Form Nhập kiện hàng | TC-06, TC-07 |
| **UC-04** | Phát hiện đối tượng (YOLOv12n)| - | `services/yolo_detector.py`| Pipeline AI ngầm | Bounding Box Canvas 2D | TC-14, TC-15, TC-16 |
| **UC-05** | Truy vết đối tượng (ByteTrack)| `tracking_sessions`| `services/ai_pipeline.py` | Pipeline AI ngầm | Vệt Tracking ID Canvas | TC-17, TC-18, TC-19, TC-20 |
| **UC-06** | Ánh xạ mã bưu chính (Virtual) | `packages`, `tracking` | `services/sorting_service.py`| `resolve_target_gate()` | Nhãn vùng Canvas 2D | TC-08, TC-09 |
| **UC-07** | Phân loại hàng qua cổng IoT | `sorting_gates` | `services/sorting_service.py`| `POST /api/v1/iot/gates/{id}/trigger` | Cần gạt xoay $45^\circ$ Canvas | TC-10, TC-11 |
| **UC-08** | Tìm đường A* cho robot AMR | `storage_locations`| `services/a_star.py` | `POST /api/v1/amr/navigate` | Xe AMR & Vệt xanh Canvas | TC-22, TC-23, TC-24, TC-25 |
| **UC-09** | Chống kẹt hàng & Xử lý lỗi | `sorting_gates`, `logs`| `services/sorting_service.py`| `handle_anti_jam_alert()` | Cảnh báo đỏ Dashboard | TC-12, TC-13 |
| **UC-10** | Quản lý ô kệ lưu kho bãi | `storage_locations`| `api/v1/warehouse.py` | `GET/POST /api/v1/warehouse/...`| Sơ đồ kệ kho | TC-26, TC-27, TC-28 |
| **UC-11** | Báo cáo thống kê sản lượng | `packages`, `gates` | `api/v1/stats.py` | `GET /api/v1/stats/overview` | Biểu đồ KPI Dashboard | TC-29, TC-30, TC-31 |
| **UC-12** | Trực quan hóa Canvas 2D | Toàn bộ 6 bảng | `services/simulation_manager.py`| `GET /ws/simulation/stream` | Màn hình Canvas 60 FPS | TC-32, TC-33 |
| **UC-13** | Giám sát SCADA & Audit Logs | `system_logs` | `core/database.py` | `GET /api/v1/stats/logs` | Bảng sự kiện SCADA | TC-34, TC-35 |

---

## MỤC 7: KẾT LUẬN & CAM KẾT TUÂN THỦ

1. Bản tài liệu Đặc tả Yêu cầu Phần mềm (SRS) này được xây dựng chuẩn mực theo cấu trúc quốc tế **IEEE Std 830-1998**, phản ánh trung thực toàn diện bài toán nghiên cứu của đề tài **SV2026-ICTU-08**.
2. Toàn bộ 13 Use Cases và các ràng buộc hiệu năng (NFR) trong tài liệu này là tiêu chí tiên quyết để nhóm sinh viên triển khai mã nguồn tại nhánh `develop` và các nhánh chức năng, đồng thời là cơ sở trực tiếp cho phiên bảo vệ nghiệm thu trước Hội đồng Khoa học và Đào tạo cấp Trường.
3. Mọi thay đổi hay bổ sung yêu cầu nghiệp vụ bắt buộc phải thông qua sự phê duyệt của Giảng viên hướng dẫn và cập nhật phiên bản tài liệu theo đúng quy trình kiểm soát thay đổi phần mềm.

---
*(Hết tài liệu đặc tả SRS — Phiên bản 1.0)*

