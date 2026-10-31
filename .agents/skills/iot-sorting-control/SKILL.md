---
name: iot-sorting-control
description: Điều khiển logic cơ cấu phân loại cổng IoT, ánh xạ mã vùng bưu chính (Virtual Attribution), đồng bộ băng tải và xử lý ngoại lệ chống kẹt hàng.
---

# IoT Smart Sorting Control Skill — AI Smart Logistics

## 1. MỤC TIÊU
Thực thi chính xác logic kích hoạt các cổng phân loại (Sorting Gates) trên băng chuyền logistics dựa trên kết quả truy vết từ camera AI và mã bưu chính của từng kiện hàng.

## 2. QUY TRÌNH ĐIỀU PHỐI PHÂN LOẠI
1. **Tiếp nhận & Ánh xạ điểm đến (Routing Lookup):**
   - Kiện hàng đi qua camera AI được cấp `track_id`.
   - Hệ thống tra cứu mã bưu chính / mã vạch ảo (Virtual Barcode) để xác định cổng đến:
     - Miền Bắc $\to$ Cổng số 1 (Gate 1)
     - Miền Trung $\to$ Cổng số 2 (Gate 2)
     - Miền Nam $\to$ Cổng số 3 (Gate 3)
     - Hàng không đọc được / Hàng lỗi $\to$ Không kích hoạt cổng, trôi thẳng về Làn kiểm tra lại (Re-check Lane)
2. **Kích hoạt cổng phân loại (Gate Trigger):**
   - Khi tọa độ $x$ của kiện hàng chạm vạch kích hoạt (Trigger Threshold Line) của cổng đích:
   - Phát tín hiệu mở cần gạt góc 45 độ hướng kiện hàng vào làn trượt.
3. **Phản hồi cảm biến & Thu hồi cần gạt (Feedback & Reset):**
   - Cảm biến quang học tại cửa làn trượt xác nhận kiện hàng đã rơi vào làn an toàn.
   - Cơ cấu cần gạt tự động thu về vị trí 0 độ song song với thành băng tải để không cản trở kiện hàng kế tiếp.

## 3. CƠ CHẾ CHỐNG KẸT HÀNG (ANTI-JAM EXCEPTION HANDLING)
- Nếu sau 3 giây kể từ khi mở cổng mà cảm biến cửa làn không nhận được kiện hàng:
  - Hệ thống phát cảnh báo `GATE_JAM_ALERT` lên Dashboard (giao diện đổi màu đỏ và phát âm thanh).
  - Tự động dừng động cơ băng tải để bảo vệ cơ khí và tránh xô đổ hàng hóa.

## 4. CHECKLIST PHÂN HỆ IOT
- [ ] Tỷ lệ chia chọn đúng đích đạt $\ge 99\%$ trên luồng mô phỏng.
- [ ] Thời gian trễ phát tín hiệu kích hoạt $\le 50$ ms.
- [ ] Mọi sự kiện kích hoạt và ngoại lệ đều được ghi log vào bảng `system_logs`.

