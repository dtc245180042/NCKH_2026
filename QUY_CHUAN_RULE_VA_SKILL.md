# BỘ QUY CHUẨN QUY TẮC (RULES) VÀ KỸ NĂNG (SKILLS) CHO ANTIGRAVITY AGENT

> **Dự án:** Nghiên cứu, xây dựng hệ thống AI truy vết và điều phối hàng hóa trong kho thông minh  
> **Mã số đề tài:** SV2026-ICTU-08  
> **Đơn vị:** Trường Đại học Công nghệ Thông tin và Truyền thông – Đại học Thái Nguyên (ICTU)  
> **Căn cứ kế thừa:** Chuẩn hóa và nâng cấp từ mô hình AI-Augmented SDLC mẫu tại `e:\KHO\mau`.

---

## 1. NGUYÊN LÝ THIẾT KẾ HỆ THỐNG QUY TẮC & KỸ NĂNG

Dựa trên cấu trúc chuẩn từ thư mục mẫu `e:\KHO\mau`, hệ thống điều khiển Antigravity được thiết kế theo 2 trụ cột cốt lõi:

```
                      HỆ THỐNG ĐIỀU KHIỂN ANTIGRAVITY
                                    │
         ┌──────────────────────────┴──────────────────────────┐
         ▼                                                     ▼
  CÁC QUY TẮC BẮT BUỘC (RULES)                        CÁC KỸ NĂNG TÁC NGHIỆP (SKILLS)
  Thư mục: `.agents/rules/`                            Thư mục: `.agents/skills/`
  - Luôn luôn được nạp (Always-On)                    - Nạp theo nhu cầu (Progressive Disclosure)
  - Đặt ra ranh giới và chốt chặn (Gates)            - Cung cấp Best Practices, Code Patterns
  - Kiểm soát hành vi Agent không đi chệch hướng       - Hướng dẫn thực thi từng nghiệp vụ cụ thể
```

---

## 2. QUY CHUẨN CÁC QUY TẮC (RULES) TRONG `.agents/rules/`

### 2.1. Quy tắc Git & Luồng phát triển (`.agents/rules/git-workflow.md`)
Quy định luồng làm việc 6 bước bắt buộc, đảm bảo mọi thay đổi mã nguồn đều được kiểm soát bởi con người:

1. **Bước 1 (Phân tích yêu cầu):** Đọc yêu cầu, đối chiếu với 13 Use Cases (UC-01 đến UC-13). Nếu chưa rõ ràng, phải hỏi lại người dùng, **cấm tự đoán rồi code ngay**.
2. **Bước 2 (Kiểm tra Branch):** Tạo hoặc chuyển sang đúng feature branch:
   - `feat/<ten-chuc-nang>` | `fix/<ten-bug>` | `refactor/<ten-module>` | `docs/<ten-tai-lieu>` | `test/<ten-module>`
   - **Tuyệt đối cấm** làm việc trực tiếp trên nhánh `main`.
3. **Bước 3 (Lập kế hoạch Plan):** Viết file kế hoạch chi tiết tại `docs/plans/<ten-tinh-nang>.md` theo mẫu `docs/plans/TEMPLATE.md`.  
   👉 **HUMAN GATE 1 (BẮT BUỘC):** Agent phải dừng lại, xuất thông báo và chờ người dùng gõ xác nhận đồng ý kế hoạch trước khi viết code.
4. **Bước 4 (Viết Code & Tách Commit):** Viết code theo kế hoạch đã duyệt. Commit riêng từng nhóm file logic:
   - Nhóm 1: Models & Database
   - Nhóm 2: Core Logic & AI Engine (YOLO/ByteTrack/A*)
   - Nhóm 3: Backend API & WebSocket
   - Nhóm 4: Frontend UI (HTML5 Canvas 2D)
   - Nhóm 5: Tests & Docs
5. **Bước 5 (Tự kiểm tra & Báo cáo):** Chạy kiểm thử syntax, unit test, đo FPS/latency và báo cáo danh sách file thay đổi.  
   👉 **HUMAN GATE 2 (BẮT BUỘC):** Dừng lại chờ người dùng test thực tế trên máy và xác nhận OK.
6. **Bước 6 (Merge/Push):** CHỈ thực hiện khi người dùng ra lệnh rõ ràng.

### 2.2. Quy tắc Nghiệp vụ & Kỹ thuật Logistics (`.agents/rules/ai-logistics-rules.md`)
- **Bảo toàn tính trung thực số liệu:** Không bao giờ bịa đặt các chỉ số mAP, MOTA, IDF1, FPS, latency. Mọi con số đều phải đo đạc từ môi trường mô phỏng thực tế.
- **Ranh giới Sim-to-Real:** Phân định rõ ràng giữa tọa độ thế giới ảo và tọa độ thực tế; chia tập dữ liệu mô phỏng theo chuỗi video (sequence-level split) để chống rò rỉ dữ liệu (data leakage).
- **An toàn mã nguồn:** Không hardcode mật khẩu mặc định, API keys, JWT secrets trong mã nguồn; sử dụng biến môi trường qua `pydantic-settings`.

---

## 3. BỘ KỸ NĂNG TÁC NGHIỆP (SKILLS) TRONG `.agents/skills/`

Hệ thống cung cấp trọn bộ **11 Skills chuyên biệt** bao phủ toàn bộ vòng đời phát triển dự án AI Smart Logistics:

| STT | Mã Skill | Thư mục lưu trữ | Phạm vi trách nhiệm chính |
|:---:|:---|:---|:---|
| 1 | `ai-augmented-sdlc` | `.agents/skills/ai-augmented-sdlc/SKILL.md` | Khung phương pháp luận kết nối SRS, 13 Use Cases và 5 chốt chặn Human Gates |
| 2 | `requirements-analysis` | `.agents/skills/requirements-analysis/SKILL.md` | Phân tích yêu cầu, xây dựng FR, NFR, User Stories, Acceptance Criteria và RTM |
| 3 | `architecture-design` | `.agents/skills/architecture-design/SKILL.md` | Thiết kế đường ống tích hợp (AI Pipeline, WebSocket 60 FPS, Canvas 2D, REST API) |
| 4 | `database-design` | `.agents/skills/database-design/SKILL.md` | Thiết kế CSDL quan hệ chuẩn 3NF gồm 6 bảng thực thể, tối ưu chỉ mục khóa ngoại |
| 5 | `fastapi-pro` | `.agents/skills/fastapi-pro/SKILL.md` | Mẫu lập trình Backend FastAPI async, WebSocket streaming, Pydantic v2, JWT |
| 6 | `yolov12-bytetrack-vision`| `.agents/skills/yolov12-bytetrack-vision/SKILL.md`| Tối ưu đường ống thị giác máy tính: YOLOv12n, ByteTrack Kalman 8D, giải quyết che khuất |
| 7 | `amr-pathfinding-a-star` | `.agents/skills/amr-pathfinding-a-star/SKILL.md` | Thuật toán tìm đường ngắn nhất A*, hàm khoảng cách Manhattan/Chebyshev, tránh vật cản |
| 8 | `iot-sorting-control` | `.agents/skills/iot-sorting-control/SKILL.md` | Logic điều phối cổng phân loại IoT, gán mã bưu chính ảo, cơ chế chống kẹt hàng |
| 9 | `testing-verification` | `.agents/skills/testing-verification/SKILL.md` | Khung kiểm thử 35 test cases (Phụ lục C), tính toán MOTA, IDF1, đo tải FPS & latency |
| 10 | `code-review` | `.agents/skills/code-review/SKILL.md` | Tiêu chuẩn rà soát code smells, kiểm tra an toàn bảo mật, PEP 8 trước khi merge |
| 11 | `documentation` | `.agents/skills/documentation/SKILL.md` | Tiêu chuẩn hoàn thiện tài liệu SRS IEEE 830, Báo cáo tổng kết docx, slide và video demo |

---

## 4. QUY TRÌNH ÁP DỤNG TRONG THỰC TẾ

Khi bắt đầu một công việc mới trong dự án, lập trình viên và Antigravity Agent sẽ phối hợp qua luồng sau:

### Tình huống 1: Phát triển một tính năng mới (Ví dụ: Thêm cơ chế tránh va chạm động cho Robot AMR)
1. **Lập trình viên yêu cầu:**  
   `"Hãy tạo nhánh và lập kế hoạch tính năng tránh va chạm động cho AMR theo Use Case UC-08"`
2. **Agent kích hoạt Skill:**  
   Agent đọc `.agents/rules/git-workflow.md` và `.agents/skills/amr-pathfinding-a-star/SKILL.md`.
3. **Agent tạo Branch & Plan:**  
   Tạo nhánh `feat/amr-dynamic-obstacle` và tạo file `docs/plans/feat-amr-dynamic-obstacle.md`.
4. **Agent dừng tại Human Gate 1:**  
   Agent thông báo: *"Đã tạo kế hoạch tính năng tại docs/plans/feat-amr-dynamic-obstacle.md. Xin mời bạn duyệt kế hoạch trước khi bắt đầu viết mã."*
5. **Người dùng phê duyệt:**  
   Người dùng đọc plan và phản hồi: `"Đồng ý với kế hoạch, tiến hành code đi"`.
6. **Agent viết code & tách commit:**  
   Agent viết giải thuật trong `app/services/a_star.py` và commit tách biệt:
   - Commit 1: `feat(amr): bo sung co che phat hien vat can va re-planning A*`
   - Commit 2: `test(amr): them test case kiem tra tranh vat can dong`
7. **Agent dừng tại Human Gate 2:**  
   Agent thông báo kết quả chạy test và chờ người dùng xác nhận nghiệm thu trước khi merge.

---

## 5. CẤU TRÚC THƯ MỤC CHUẨN ĐÃ THIẾT LẬP

```
e:\KHO\
├── .agents/
│   ├── rules/
│   │   ├── git-workflow.md               # 6 bước quy trình Git và Human Gates
│   │   └── ai-logistics-rules.md         # Quy tắc kỹ thuật và tính trung thực dữ liệu
│   └── skills/
│       ├── README.md                     # Mục lục và hướng dẫn kích hoạt skills
│       ├── ai-augmented-sdlc/SKILL.md    # Master SDLC, ánh xạ 13 Use Cases
│       ├── requirements-analysis/SKILL.md# Phân tích FR/NFR/User Stories
│       ├── architecture-design/SKILL.md  # Thiết kế End-to-End Pipeline
│       ├── database-design/SKILL.md      # Thiết kế CSDL quan hệ 3NF (6 bảng)
│       ├── fastapi-pro/SKILL.md          # Lập trình FastAPI + WebSocket 60 FPS
│       ├── yolov12-bytetrack-vision/SKILL.md # Thị giác AI YOLOv12 + ByteTrack
│       ├── amr-pathfinding-a-star/SKILL.md   # Thuật toán A* cho Robot AMR
│       ├── iot-sorting-control/SKILL.md  # Điều khiển cổng phân loại IoT
│       ├── testing-verification/SKILL.md # Kiểm thử 35 test cases, MOT metrics
│       ├── code-review/SKILL.md          # Đánh giá chất lượng và bảo mật code
│       └── documentation/SKILL.md        # Tiêu chuẩn tài liệu và nghiệm thu
├── docs/
│   ├── plans/
│   │   └── TEMPLATE.md                   # Mẫu kế hoạch tính năng cho Human Gate 1
│   ├── BAO_CAO_TONG_KET_NCKH_ICTU_DA_SUA.docx
│   └── ...
├── assets/                               # Sơ đồ và biểu đồ thực nghiệm
├── QUY_CHUAN_RULE_VA_SKILL.md            # Tài liệu tổng thể này
├── DANH_SACH_VIEC_NHOM_CAN_LAM.md        # Checklist việc cần làm trước khi nộp
└── NHAT_KY_THAY_DOI.md                   # Nhật ký chi tiết các thay đổi
```

