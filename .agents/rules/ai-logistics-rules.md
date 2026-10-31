# Quy tắc Nghiệp vụ & Kỹ thuật Hệ thống AI Smart Logistics
# Áp dụng cho toàn bộ quá trình phát triển mã nguồn đề tài SV2026-ICTU-08.

---

## 1. NGUYÊN TẮC BẢO TOÀN DỮ LIỆU & THỰC NGHIỆM KHOA HỌC
1. **Tính trung thực số liệu:**
   - Tuyệt đối không bịa đặt hoặc làm giả các số liệu đo lường thực nghiệm (mAP, MOTA, IDF1, FPS, latency, số lần ID switch).
   - Khi có sự chênh lệch hoặc mâu thuẫn tính toán (như giữa năng suất theo giờ và thời gian xử lý đơn chiếc), phải ghi chú rõ ràng nguyên nhân và kiểm chứng lại bằng log thực tế.
2. **Quản lý dữ liệu mô phỏng (Synthetic Data):**
   - Phải phân biệt rõ ràng giữa tọa độ thế giới thực và tọa độ mô phỏng trên Canvas 2D / ma trận pixel.
   - Khi chia tập dữ liệu mô phỏng (Train/Val/Test), phải chia theo từng chuỗi video/kịch bản độc lập (sequence-level split) để tránh hiện tượng rò rỉ dữ liệu (data leakage) giữa các khung hình liền kề.

---

## 2. CHUẨN MỰC THUẬT TOÁN & KIẾN TRÚC HỆ THỐNG
1. **Phân hệ Thị giác AI (YOLOv12 & ByteTrack):**
   - Tách biệt rõ ràng giai đoạn phát hiện (Detection) và giai đoạn truy vết (Tracking).
   - Ngưỡng tin cậy (Confidence Threshold) cho ByteTrack phải được cấu hình tách biệt: Ngưỡng cao ($D_{high} \ge 0.6$) cho ghép đôi giai đoạn 1; Ngưỡng thấp ($D_{low} \in [0.1, 0.6)$) cho ghép đôi giai đoạn 2 để giải quyết bài toán che khuất (occlusion).
   - Bộ lọc Kalman phải duy trì trạng thái vector 8 chiều $(x_c, y_c, a, h, v_x, v_y, v_a, v_h)$ ổn định.
2. **Phân hệ Điều phối Robot AMR (A* Pathfinding):**
   - Bản đồ kho phải được mô hình hóa dưới dạng lưới ô vuông (Occupancy Grid Map).
   - Sử dụng khoảng cách Manhattan cho di chuyển 4 hướng và Chebyshev / Euclidean cho di chuyển 8 hướng có góc quay.
   - Cơ chế tránh va chạm động: Khi phát hiện vật cản bất ngờ, robot phải phát tín hiệu dừng an toàn trước, sau đó mới kích hoạt giải thuật Local Re-planning để tìm đường vòng.
3. **Phân hệ Điều khiển Cổng phân loại IoT (Sorting Gates):**
   - Ghi nhận cơ chế "Gán mã ảo (Virtual Attribution)": Trong môi trường mô phỏng, mã bưu chính và cổng phân loại được ánh xạ trực tiếp từ kịch bản hoặc nhận diện bounding box kiện hàng, tránh nhầm lẫn với việc quét quang học mã vạch vật lý ngoài đời thực.
   - Tín hiệu kích hoạt cổng phải đi kèm cảm biến phản hồi (feedback sensor) xác nhận kiện đã vào làn trước khi thu cần gạt về vị trí an toàn.

---

## 3. QUY CHUẨN AN TOÀN VÀ MÃ NGUỒN (SECURITY & CODE INTEGRITY)
1. **Không lưu trữ bí mật trong mã nguồn:**
   - Tuyệt đối không hardcode mật khẩu, JWT secret key, API key trong file mã nguồn. Tất cả phải được load qua biến môi trường (`.env`) sử dụng `pydantic-settings`.
2. **Kiểm soát phân quyền (RBAC):**
   - Mọi API endpoint thay đổi dữ liệu hoặc kích hoạt phần cứng phải được bảo vệ bởi middleware xác thực JWT và kiểm tra quyền hạn (Admin / Operator / Viewer).
3. **Hiệu năng thời gian thực:**
   - Kênh WebSocket truyền nhận dữ liệu giữa Backend và giao diện Canvas 2D phải duy trì độ trễ $< 50$ms và tốc độ ổn định 60 FPS.

