# Kế hoạch Thực hiện: Cơ chế Cảm biến Phản hồi và Xử lý Chống Kẹt Hàng (Anti-Jam Alert & Safety Interlocking)
- **Mã Task Jira:** LOG-115 (Sprint 4)
- **Nhánh Git:** `feat/iot-antijam-ha`
- **Người thực hiện:** Nguyễn Thị Thu Hà (IoT & Logistics Logic Dev)
- **Use Cases liên quan:**
  - **UC-09:** Xử lý kiện hàng sai sót / không nhãn & Cảnh báo kẹt cổng (Anti-jam Alert, Safe Stop, Conveyor Interlocking)
  - **UC-07:** Phân loại hàng hóa tự động qua cổng IoT (Góc gạt $45^\circ$, cảm biến quang học phản hồi)
  - **UC-13:** Giám sát trạng thái hoạt động và cảnh báo lỗi (SCADA Logs & Audit Trail)
- **Kỹ năng áp dụng:** `.agents/skills/iot-sorting-control/SKILL.md`
- **Trạng thái:** Đã được người dùng DUYỆT (Human Gate 1 thông qua)

---

## 1. Phân tích Yêu cầu Kỹ thuật Phần cứng & Nghiệp vụ IoT

### 1.1. Quy chuẩn Cảm biến Phản hồi & Đồng hồ Giám sát (Watchdog Timer):
- **Phần cứng cảm biến:** Tại mỗi miệng máng trượt phân loại (Chute Entry), lắp đặt cặp cảm biến quang điện thu phát hồng ngoại/laser (Photoelectric Through-Beam Sensor) kết nối qua bộ điều khiển PLC / Vi điều khiển IoT.
- **Tín hiệu số logic:**
  * Mức `HIGH` (hoặc ngắt quang): Kiện hàng đang rơi qua miệng máng.
  * Mức `LOW`: Miệng máng thông thoáng, không có vật cản.
- **Đồng hồ đếm lùi giám sát (Jam Watchdog Timer):**
  * Khi phát lệnh kích hoạt servo mở cần gạt $45^\circ$, hệ thống khởi tạo đồng hồ giám sát $t_{open}$.
  * Ngưỡng thời gian an toàn tối đa: $t_{timeout} = 3.0$ giây.
  * Nếu trong vòng $3.0$ giây cảm biến quang không ghi nhận xung phản hồi kiện hàng đã lọt qua, hệ thống nhận diện **sự cố kẹt hàng vật lý (Mechanical Jamming)**.

### 1.2. Khóa Liên động Dừng Băng tải (Conveyor Safety Interlocking):
- Khi cổng rơi vào trạng thái `JAMMED`:
  * Hệ thống phát tín hiệu khóa liên động (Interlock Signal) tự động giảm tốc độ băng chuyền chính từ $135$ px/s về $0$ px/s (`CONVEYOR_HALT`).
  * Mục đích: Ngăn ngừa dòng kiện hàng phía sau tiếp tục đâm dồn vào vị trí kẹt, chống xô đổ bưu kiện và chống cháy động cơ băng tải.
  * Trạng thái cổng được chốt cứng thành `JAMMED`, từ chối nhận bất kỳ lệnh mở cần gạt nào tiếp theo.

### 1.3. Phân cấp Mức độ Sự cố & Dừng Khẩn cấp (Severity Hierarchy & Emergency Stop):
1. **Mức độ 1 (WARNING - Cảnh báo sớm):** Cảm biến trễ từ $2.0\text{s}$ đến $3.0\text{s}$ $\rightarrow$ Hiển thị nhấp nháy màu vàng trên Dashboard của Operator.
2. **Mức độ 2 (JAMMED - Kẹt cổng đơn lẻ):** Quá $3.0\text{s}$ $\rightarrow$ Dừng cổng tương ứng, khóa liên động băng tải, kích hoạt chuông/đèn báo động đỏ SCADA.
3. **Mức độ 3 (CRITICAL - Dừng toàn hệ thống):** Khi có từ 2 cổng kẹt đồng thời hoặc khi Operator nhấn nút Dừng khẩn cấp (*Emergency Stop Button*) $\rightarrow$ Ngắt toàn bộ cơ cấu chấp hành và dừng ngay lập tức toàn bộ dây chuyền phân loại.

### 1.4. Quy trình Khôi phục & Đo lường MTTR (Mean Time to Recovery):
- Sau khi nhân viên vận hành can thiệp xử lý kẹt tại hiện trường, thực hiện thao tác **Xác nhận giải quyết sự cố (Resolve & Clear Jam)** qua giao diện Dashboard:
  * Nhập nguyên nhân sự cố: Bưu kiện rách bao bì, quá khổ, méo mó, ngoại vật rơi vào máng...
  * Hệ thống ghi nhận thời điểm hoàn thành $t_{resolved}$, tính toán thời gian gián đoạn $\Delta t = t_{resolved} - t_{jammed}$ (tính bằng giây).
  * Đưa trạng thái cổng về `IDLE`, giải phóng khóa liên động băng tải, cho phép dây chuyền tiếp tục vận hành bình thường.
  * Tích lũy số liệu vào chỉ số **MTTR (Mean Time to Recovery)** để phục vụ đánh giá KPI vận hành kho bãi.

---

## 2. Danh sách File Cần Thay Đổi & Tạo Mới

| Đường dẫn File | Thao tác | Mục đích Kỹ thuật |
| :--- | :---: | :--- |
| `docs/plans/iot-antijam.md` | Tạo mới | Bản kế hoạch kỹ thuật chi tiết chuẩn Human Gate 1 |
| `app/core/config.py` | Cập nhật | Bổ sung fallback cấu hình Pydantic v2 chạy ổn định trên Python 3.14 |
| `app/schemas/gate.py` | Cập nhật | Bổ sung Schemas: WatchdogScan, EmergencyStop, JamResolve, AntiJamMetrics |
| `app/schemas/__init__.py` | Cập nhật | Xuất đồng bộ các Pydantic Schemas mới |
| `app/services/sorting_service.py` | Cập nhật | Bổ sung Jam Watchdog, khóa liên động dừng băng chuyền, quy trình xử lý sự cố & đo lường MTTR |
| `app/api/v1/iot.py` | Cập nhật | Thêm các REST endpoints: `/antijam/watchdog-scan`, `/antijam/emergency-stop`, `/antijam/resolve`, `/antijam/metrics` |
| `tests/test_iot_antijam.py` | Tạo mới | Bộ kiểm thử đơn vị chuyên sâu cho toàn bộ kịch bản kẹt hàng, dừng khẩn cấp và khôi phục MTTR |

---

## 3. Kế hoạch Tách Commit (Tuân thủ Commit Granularity)

Sau khi hoàn thành và kiểm thử đạt kết quả 100%, commit sẽ được tách thành 2 nhóm logic (chỉ thực hiện khi có lệnh duyệt):
- **Commit 1 (Tài liệu Kế hoạch):** `docs(plan): lap ke hoach co che cam bien phan hoi va chong ket hang uc-09`
- **Commit 2 (Mã nguồn Anti-jam & Bộ Kiểm thử):** `feat(iot): cai dat jam watchdog, khoa lien dong dung bang tai va tinh chi so mttr`

---

## 4. Kế hoạch Tự Kiểm tra & Nghiệm thu (Self-Verification)

- [ ] Tạo file kế hoạch kỹ thuật `docs/plans/iot-antijam.md`.
- [ ] Cài đặt mã nguồn trong `app/core/config.py`, `app/schemas/gate.py`, `app/services/sorting_service.py`, `app/api/v1/iot.py`.
- [ ] Viết bộ test `tests/test_iot_antijam.py` bao gồm 6 kịch bản kiểm thử:
  1. Giám sát Watchdog phát hiện kẹt cổng sau 3 giây timeout.
  2. Kích hoạt khóa liên động dừng băng tải an toàn khi có sự cố.
  3. Kích hoạt lệnh Dừng khẩn cấp toàn bộ hệ thống (Emergency Stop).
  4. Quy trình khôi phục cổng sau gỡ kẹt và mở khóa liên động.
  5. Tính toán chính xác thời gian gián đoạn và chỉ số MTTR.
  6. Ghi log kiểm toán đầy đủ vào bảng `system_logs`.
- [ ] Chạy kiểm thử tự động nội bộ đảm bảo 100% Pass và báo cáo để người dùng test trên máy.

