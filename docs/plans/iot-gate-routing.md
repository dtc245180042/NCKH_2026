# Kế hoạch Thực hiện: Lập trình Logic Điều khiển Cổng Phân loại IoT theo Mã vùng Bưu chính
- **Mã Task Jira:** LOG-114 & LOG-115 (Sprint 4)
- **Nhánh Git:** `feature/iot-gate-routing-ha`
- **Người thực hiện:** Nguyễn Thị Thu Hà (IoT & Logistics Logic Dev)
- **Use Cases liên quan:**
  - **UC-06:** Gán nhãn ảo và đối chiếu mã bưu chính (Virtual Attribution)
  - **UC-07:** Phân loại hàng hóa tự động qua cổng IoT (Góc gạt $45^\circ$, cảm biến phản hồi)
  - **UC-09:** Xử lý kiện hàng sai sót / không nhãn & Cảnh báo kẹt cổng (Anti-jam Alert)
- **Kỹ năng áp dụng:** `.agents/skills/iot-sorting-control/SKILL.md`
- **Trạng thái:** Đã được người dùng DUYỆT (Human Gate 1 thông qua)

---

## 1. Phân tích Yêu cầu Nghiệp vụ & Kỹ thuật

### 1.1. Cơ chế Gán nhãn ảo Bưu chính (Virtual Attribution - UC-06):
Trong môi trường phòng thí nghiệm và luồng mô phỏng Canvas 2D, hệ thống áp dụng cơ chế **Gán nhãn ảo (Virtual Attribution)**:
- Không phụ thuộc vào máy quét laser quang học vật lý ngoài đời thực. Mã bưu điện hoặc mã định danh của bưu kiện được ánh xạ trực tiếp từ thuộc tính kiện hàng (`postal_code` hoặc `destination_zone`) khi đi vào vùng nhận diện ban đầu ($X \in [50, 150]$ px).
- Mở rộng bảng định tuyến bao phủ các tiền tố mã bưu chính 5 và 6 chữ số theo chuẩn Tổng công ty Bưu điện Việt Nam (VNPost):
  * **Cổng 1 (Miền Bắc):** Tiền tố từ `10` đến `39` (Hà Nội, Thái Nguyên, Hải Phòng, Quảng Ninh, Bắc Ninh, v.v.).
  * **Cổng 2 (Miền Trung & Tây Nguyên):** Tiền tố từ `40` đến `69` (Đà Nẵng, Huế, Quảng Nam, Khánh Hòa, Đắk Lắk, Lâm Đồng, v.v.).
  * **Cổng 3 (Miền Nam):** Tiền tố từ `70` đến `96` (TP. Hồ Chí Minh, Bình Dương, Đồng Nai, Cần Thơ, An Giang, v.v.).
  * **Cổng 4 (Làn Re-check / Quốc tế):** Tiền tố `99`, mã không hợp lệ, kiện hàng không rõ địa chỉ, hoặc cổng đích đang gặp sự cố.

### 1.2. Chu kỳ Điều khiển Cần gạt & Cảm biến Phản hồi (Feedback Sensor Lifecycle - UC-07):
Một chu kỳ gạt bưu kiện an toàn phải tuân thủ nghiêm ngặt quy trình 4 giai đoạn khép kín:
1. **Kiểm tra an toàn tiền kích hoạt (Pre-check Safety):** Cổng mục tiêu phải đang ở trạng thái sẵn sàng (`IDLE`). Nếu cổng đang bị kẹt (`JAMMED`) hoặc bảo trì (`MAINTENANCE`), hệ thống tự động từ chối gạt và chuyển tiếp kiện hàng về Cổng 4 (Làn Re-check) để chống xô đổ hàng trên băng chuyền.
2. **Kích hoạt mở cần gạt (Actuation):** Khi tọa độ $X$ của kiện hàng đạt vạch kích hoạt của cổng ($\pm 5$ px), phát tín hiệu điều khiển servo mở ra một góc chuẩn $45.0^\circ$, cập nhật trạng thái cổng thành `DEFLECTING`.
3. **Phản hồi từ cảm biến quang học (Feedback Sensor Confirmation):** Cảm biến quang học tại miệng máng trượt phải nhận diện và phát tín hiệu xác nhận kiện hàng đã rơi qua thành công vào làn chia chọn.
4. **Tự động thu hồi cần gạt (Auto Reset):** Sau khi cảm biến xác nhận (hoặc sau thời gian gạt $t_{deflect} = 1.2$ giây), cần gạt tự động thu về góc $0.0^\circ$ (song song với thành băng tải) và chuyển trạng thái về `IDLE` để sẵn sàng đón kiện tiếp theo.

### 1.3. Cơ chế Chống Kẹt Hàng (Anti-Jam Exception Handling - UC-09):
- Nếu sau thời gian đếm ngược $t_{timeout} = 3.0$ giây kể từ khi mở cổng mà cảm biến quang chưa nhận được tín hiệu kiện rơi:
  * Hệ thống kích hoạt trạng thái `JAMMED`.
  * Ghi nhật ký sự kiện `GATE_JAM_ALERT` vào bảng `system_logs`.
  * Phát cảnh báo lên Dashboard và tự động gửi lệnh giảm tốc/dừng băng tải.
- Cung cấp cơ chế **Khôi phục cổng (Reset/Clear Jam):** Cho phép nhân viên vận hành sau khi xử lý kẹt hàng thủ công gửi tín hiệu reset để đưa cổng từ `JAMMED` về `IDLE`.

---

## 2. Danh sách File Cần Thay Đổi & Tạo Mới

| Đường dẫn File | Thao tác | Mục đích Kỹ thuật |
| :--- | :---: | :--- |
| `docs/plans/iot-gate-routing.md` | Tạo mới | Bản kế hoạch kỹ thuật chuẩn Human Gate 1 theo yêu cầu |
| `app/schemas/gate.py` | Cập nhật | Bổ sung Pydantic Schemas cho tra cứu lộ trình, chu kỳ gạt và reset cổng |
| `app/services/sorting_service.py` | Cập nhật | Cài đặt Virtual Attribution mở rộng, kiểm tra an toàn, chu kỳ cảm biến phản hồi và reset cổng |
| `app/api/v1/iot.py` | Cập nhật | Bổ sung các RESTful endpoints: `/lookup-route`, `/gates/{gate_number}/cycle`, `/gates/{gate_number}/reset` |
| `tests/test_iot_gate_routing.py` | Tạo mới | Bộ kiểm thử toàn diện độc lập (100% pass với unittest chuẩn) |

---

## 3. Kế hoạch Tách Commit (Tuân thủ Commit Granularity)

Sau khi kiểm thử thực tế đạt 100%, commit sẽ được tách thành 2 nhóm logic (chỉ thực hiện khi có lệnh của người dùng):
- **Commit 1 (Tài liệu Kế hoạch):** `docs(plan): lap ke hoach chi tiet logic dieu khien cong phan loai iot va cam bien phan hoi`
- **Commit 2 (Dịch vụ IoT, Schemas, API & Tests):** `feat(iot): cai dat virtual attribution mo rong, chu ky cam bien phan hoi va api reset cong`

---

## 4. Kế hoạch Tự Kiểm tra & Nghiệm thu (Self-Verification)

- [ ] Tạo file kế hoạch `docs/plans/iot-gate-routing.md`.
- [ ] Cập nhật mã nguồn `app/schemas/gate.py`, `app/services/sorting_service.py`, `app/api/v1/iot.py`.
- [ ] Viết bộ test `tests/test_iot_gate_routing.py` kiểm tra:
  * Ánh xạ mã vùng 63 tỉnh thành VNPost (Bắc, Trung, Nam, Lỗi).
  * Kiểm tra an toàn từ chối gạt khi cổng `JAMMED`.
  * Chu kỳ gạt hoàn chỉnh có cảm biến phản hồi xác nhận.
  * Cơ chế reset cổng từ `JAMMED` về `IDLE`.
- [ ] Chạy bộ kiểm thử tự động nội bộ và báo cáo để người dùng test thực tế trên máy.

