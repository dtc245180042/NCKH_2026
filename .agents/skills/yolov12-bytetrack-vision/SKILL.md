---
name: yolov12-bytetrack-vision
description: Hướng dẫn cài đặt và tối ưu hóa đường ống Thị giác máy tính tích hợp mô hình phát hiện đối tượng YOLOv12n và thuật toán truy vết đa đối tượng ByteTrack trong môi trường kho thông minh.
---

# YOLOv12 + ByteTrack Vision Skill — AI Smart Logistics

## 1. MỤC TIÊU
Làm chủ và triển khai giải pháp thị giác máy tính: Phát hiện kiện hàng với độ chính xác cao và duy trì định danh `track_id` ổn định ngay cả khi xảy ra hiện tượng che khuất (occlusion).

## 2. NGUYÊN LÝ HOẠT ĐỘNG CỦA BYTETRACK

### 2.1. Vector trạng thái Kalman Filter (8 chiều)
Hệ thống sử dụng bộ lọc Kalman để dự đoán quỹ đạo chuyển động của bounding box trong không gian 2D:
$$\mathbf{x} = [x_c, y_c, a, h, v_x, v_y, v_a, v_h]^T$$
Trong đó: $(x_c, y_c)$ là tâm hộp, $a = w/h$ là tỷ lệ khung hình, $h$ là chiều cao, và $(v_x, v_y, v_a, v_h)$ là vận tốc tương ứng.

### 2.2. Cơ chế ghép đôi 2 giai đoạn (Two-stage Association)
Khác với SORT truyền thống chỉ lấy các hộp có độ tin cậy cao, ByteTrack tận dụng mọi bounding box:
1. **Giai đoạn 1 (High Score):** Lấy các detection có $conf \ge D_{high}$ (mặc định 0.6) ghép đôi với các quỹ đạo hiện có thông qua ma trận chi phí IoU và thuật toán Hungarian.
2. **Giai đoạn 2 (Low Score - Xử lý che khuất):** Lấy các detection có $D_{low} \le conf < D_{high}$ (mặc định $0.1 \le conf < 0.6$) ghép đôi với các quỹ đạo chưa được gán ở Giai đoạn 1. Các hộp này thường tương ứng với kiện hàng bị che khuất một phần bởi thanh chắn hoặc kiện hàng khác.
3. **Quản lý quỹ đạo:** Các quỹ đạo không được ghép đôi trong $N$ khung hình (mặc định 30 frames) sẽ được chuyển sang trạng thái `Lost` và sau đó xóa bỏ (`Removed`).

## 3. CHECKLIST KIỂM THỬ THỊ GIÁC AI
- [ ] Tệp trọng số mô hình lưu tại `weights/yolo12n_logistics.pt`.
- [ ] Thử nghiệm kịch bản che khuất: Kiện hàng bị che khuất $> 50\%$ diện tích nhưng không bị đổi mã ID (`ID Switch = 0`).
- [ ] Đo đạc và ghi nhận đầy đủ chỉ số: mAP@0.5, mAP@0.5:0.95, MOTA, IDF1, FPS suy luận.

