---
name: testing-verification
description: Khung kiểm thử hệ thống phần mềm và đo đạc thực nghiệm AI Logistics, bao gồm 35 kịch bản kiểm thử chức năng (Test Cases), bộ chỉ số MOT Challenge và bài đo kiểm hiệu năng (FPS & Latency).
---

# Testing & Verification Skill — AI Smart Logistics

## 1. MỤC TIÊU
Đảm bảo chất lượng toàn diện của sản phẩm phần mềm trước khi nghiệm thu, cung cấp minh chứng thực nghiệm xác thực và có thể lặp lại (Reproducible).

## 2. CÁC CẤP ĐỘ KIỂM THỬ

### 2.1. Kiểm thử chức năng (35 Functional Test Cases — Phụ lục C)
Bao gồm 35 kịch bản trải đều trên 6 phân hệ:
1. **Phân hệ Xác thực & Quản trị (TC-01 đến TC-05):** Đăng nhập JWT, kiểm tra quyền RBAC, token hết hạn, đăng xuất.
2. **Phân hệ Vận hành kho bãi (TC-06 đến TC-13):** Tạo kiện Inbound, quét barcode, cập nhật kích thước, lọc kiện, xuất kho Outbound, gán ô kệ.
3. **Phân hệ Thị giác AI (TC-14 đến TC-21):** Nhận diện kiện đơn/đa, nhận diện pallet, nhận diện xe AMR, truy vết không che khuất, truy vết che khuất nhẹ/nặng, tái định danh sau biến mất.
4. **Phân hệ Cổng phân loại IoT (TC-22 đến TC-27):** Kích hoạt cổng 1, cổng 2, cổng 3, xử lý hàng lỗi, đóng cổng tự động, cảnh báo chống kẹt hàng.
5. **Phân hệ Điều phối Robot AMR (TC-28 đến TC-31):** Tìm đường A* bản đồ trống, tránh vật cản tĩnh, tái lập lịch tránh vật cản động, điều phối đa robot.
6. **Phân hệ Báo cáo & Dashboard Canvas 2D (TC-32 đến TC-35):** Kết nối WebSocket, duy trì 60 FPS Canvas 2D, nhảy số biểu đồ KPI thời gian thực, hiển thị cảnh báo đỏ khi có lỗi.

### 2.2. Đo đạc bộ chỉ số chuẩn quốc tế MOT Challenge
- **MOTA (Multiple Object Tracking Accuracy):**
  $$\text{MOTA} = 1 - \frac{\sum (FN + FP + IDSW)}{\sum GT}$$
- **IDF1 (Identification F1-score):**
  $$\text{IDF1} = \frac{2 \cdot IDTP}{2 \cdot IDTP + IDFP + IDFN}$$
- **ID Switches (IDSW):** Đếm số lần 1 kiện hàng bị đổi sang mã ID mới trong suốt hành trình trên băng tải.

## 3. CHECKLIST KIỂM THỬ THỰC TẾ (HUMAN GATE 3)
- [ ] Chạy kiểm thử tự động với `pytest tests/` đạt 100% test units.
- [ ] Điền kết quả log thực tế và ngày chạy vào cột "Kết quả thực tế" tại Phụ lục C của Báo cáo.
- [ ] Đo đạc và ghi hình video minh chứng kiểm thử để trình chiếu trước Hội đồng.

