# 📚 THƯ VIỆN SKILLS — HỆ THỐNG AI KHO THÔNG MINH (AI SMART LOGISTICS)

Thư mục này chứa toàn bộ các **Skill** (tài liệu quy chuẩn kỹ thuật và quy trình tác nghiệp) được thiết kế chuyên biệt cho đề tài NCKH sinh viên **"Hệ thống AI truy vết và điều phối hàng hóa trong kho thông minh" (SV2026-ICTU-08)**.

---

## 🗂️ Danh mục Skills đã thiết lập

| STT | Tên Skill | Mô tả chức năng | Áp dụng cho phân hệ / module |
|:---:|:---|:---|:---|
| 1 | [`ai-augmented-sdlc`](./ai-augmented-sdlc/SKILL.md) | Khung phương pháp luận SDLC có AI trợ giúp, kiểm soát qua 5 Human Gates | Toàn bộ vòng đời đề tài (01/2026 – 12/2026) |
| 2 | [`requirements-analysis`](./requirements-analysis/SKILL.md) | Phân tích yêu cầu, xây dựng FR UC-01 đến UC-13, NFRs và RTM | `docs/requirements.md`, SRS IEEE 830 |
| 3 | [`architecture-design`](./architecture-design/SKILL.md) | Thiết kế kiến trúc đường ống End-to-End Pipeline và phân tầng | Toàn hệ thống, tích hợp AI + Backend + UI |
| 4 | [`database-design`](./database-design/SKILL.md) | Thiết kế mô hình CSDL quan hệ chuẩn 3NF (6 bảng dữ liệu cốt lõi) | `models/*.py`, ERD, database migration |
| 5 | [`fastapi-pro`](./fastapi-pro/SKILL.md) | Lập trình Backend FastAPI, WebSocket thời gian thực 60 FPS, Pydantic v2 | `app/api/*.py`, `app/core/*.py`, `app/main.py` |
| 6 | [`yolov12-bytetrack-vision`](./yolov12-bytetrack-vision/SKILL.md) | Đường ống Thị giác AI: YOLOv12n, ByteTrack Kalman 8D, giải quyết che khuất | `app/services/ai_tracking.py`, `weights/*.pt` |
| 7 | [`amr-pathfinding-a-star`](./amr-pathfinding-a-star/SKILL.md) | Thuật toán A* tìm đường ngắn nhất cho AMR, Manhattan/Chebyshev, tránh vật cản | `app/services/a_star.py`, `app/services/amr.py` |
| 8 | [`iot-sorting-control`](./iot-sorting-control/SKILL.md) | Logic điều khiển cổng phân loại IoT, gán mã bưu chính ảo, chống kẹt hàng | `app/services/sorting.py`, `app/api/iot.py` |
| 9 | [`testing-verification`](./testing-verification/SKILL.md) | Kiểm thử 35 kịch bản (Test Cases), đo chỉ số MOTA, IDF1, FPS, độ trễ | `tests/*.py`, Phụ lục C Báo cáo |
| 10 | [`code-review`](./code-review/SKILL.md) | Đánh giá chất lượng mã nguồn, kiểm tra an toàn bảo mật, PEP 8, Clean Code | Các Pull Requests, chuẩn bị sáp nhập code |
| 11 | [`documentation`](./documentation/SKILL.md) | Quy chuẩn tài liệu kỹ thuật SRS, RTM, Báo cáo tổng kết docx, slide và video demo | `docs/*.docx`, `docs/plans/*.md` |

---

## 🚀 Hướng dẫn kích hoạt & Sử dụng cùng Antigravity Agent

Khi cần thực hiện một tác vụ cụ thể, bạn chỉ cần yêu cầu Antigravity hoặc chỉ định skill tương ứng:
- Lập kế hoạch tính năng mới: `Đọc requirements-analysis và architecture-design để lập kế hoạch feat-amr`
- Phát triển API hoặc WebSocket: `Áp dụng fastapi-pro để viết router packages`
- Tinh chỉnh thuật toán AI: `Áp dụng yolov12-bytetrack-vision để xử lý che khuất khi tracking`
- Tối ưu đường đi Robot: `Áp dụng amr-pathfinding-a-star để tránh vật cản động`
- Kiểm thử và đo lường: `Áp dụng testing-verification để đo FPS và chạy 35 test cases`

