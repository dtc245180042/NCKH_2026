---
name: architecture-design
description: Thiết kế kiến trúc đường ống tích hợp (End-to-End Pipeline) và kiến trúc phân tầng (Layered Architecture) cho Hệ thống AI Logistics Kho thông minh.
---

# Architecture Design Skill — AI Smart Logistics

## 1. MỤC TIÊU
Xây dựng kiến trúc hệ thống module hóa, khớp nối chặt chẽ giữa 4 tầng:
```
[Tầng Thị giác AI] ──> [Tầng Logic Điều phối] ──> [Tầng Backend & API] ──> [Tầng Trực quan hóa]
(YOLOv12 + ByteTrack)  (Routing Heuristic + A*)   (FastAPI + WebSocket)     (HTML5 Canvas 2D)
```

## 2. CÁC PHÂN HỆ CỐT LÕI (CORE SUBSYSTEMS)

### 2.1. Phân hệ Thị giác Máy tính (AI Vision Subsystem)
- **Nhiệm vụ:** Nhận luồng khung hình từ OpenCV camera ảo, thực thi YOLOv12n suy luận bounding box, chuyển tập detections sang thuật toán ByteTrack để duy trì định danh `track_id` liên tục.
- **Dữ liệu đầu ra:** Danh sách đối tượng đang hoạt động kèm vị trí tâm `(x, y)`, vận tốc ước lượng từ Kalman Filter, và nhãn phân loại.

### 2.2. Phân hệ Logic Điều phối & Ra quyết định (Decision Engine)
- **Nhiệm vụ:**
  - Ánh xạ kiện hàng với mã vùng bưu chính (Virtual Attribution).
  - So sánh tọa độ kiện hàng với vạch kích hoạt (Trigger Line) của từng cổng phân loại.
  - Sinh lệnh điều khiển cổng IoT tương ứng (kèm góc mở 45 độ).
  - Lập lịch nhiệm vụ và gọi thuật toán A* tìm đường đi tối ưu cho Robot AMR.

### 2.3. Phân hệ Backend & Quản trị Cơ sở Dữ liệu (FastAPI & ORM)
- **Nhiệm vụ:** Cung cấp hệ thống RESTful API quản lý kiện hàng, vị trí ô kệ, người dùng, và kênh WebSocket đa luồng truyền nhận trạng thái mô phỏng liên tục 60 FPS.

### 2.4. Phân hệ Trực quan hóa Thời gian thực (HTML5 Canvas 2D)
- **Nhiệm vụ:** Kết xuất đồ họa 2D nhẹ nhàng, mượt mà trên trình duyệt mà không cần cài đặt phần mềm nặng máy (như ROS/Gazebo). Hiển thị băng chuyền, kiện hàng, vệt truy vết ID (tracking trails), cần gạt cổng và robot AMR di chuyển theo lộ trình màu xanh.

## 3. CHECKLIST KIẾN TRÚC (HUMAN GATE 2)
- [ ] Tách biệt rõ ràng luồng xử lý AI tính toán nặng khỏi luồng phục vụ Web/API để tránh nghẽn I/O.
- [ ] Giao tiếp giữa Engine mô phỏng và Frontend qua kênh WebSocket phi đồng bộ (Asynchronous).
- [ ] Cơ sở dữ liệu chuẩn hóa 3NF, có cơ chế lưu vết lịch sử phiên làm việc (Tracking Sessions).

