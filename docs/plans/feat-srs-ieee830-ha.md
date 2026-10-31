# Kế hoạch Thực hiện: Khảo sát Nghiệp vụ Bưu chính & Xây dựng Đặc tả SRS Chuẩn IEEE 830
- **Mã Task Jira:** LOG-104 (Sprint 1)
- **Nhánh Git:** `feature/docs/srs-ieee830-ha`
- **Người thực hiện:** Nguyễn Thị Thu Hà (IoT & Logistics Logic Dev)
- **Use Cases liên quan:** Toàn bộ 13 Use Cases (UC-01 đến UC-13), đặc biệt trọng tâm phân hệ IoT & Logistics (UC-06, UC-07, UC-09).
- **Trạng thái:** Đã được người dùng DUYỆT (Human Gate 1 thông qua)

---

## 1. Phân tích Yêu cầu & Mục tiêu Kỹ thuật

### 1.1. Mục tiêu chức năng:
1. Xây dựng tài liệu Đặc tả Yêu cầu Phần mềm (SRS - Software Requirements Specification) hoàn chỉnh theo tiêu chuẩn quốc tế **IEEE Std 830-1998** / **ISO/IEC/IEEE 29148**.
2. Chi tiết hóa toàn bộ 13 Use Cases (UC-01 đến UC-13) từ mức khái niệm đến luồng sự kiện chi tiết (Main flow, Alternative flow, Exception flow, Acceptance Criteria).
3. Định lượng hóa các yêu cầu phi chức năng (NFR): Thời gian suy luận YOLOv12n $\le 20$ms, tần số quét WebSocket 60 FPS, độ trễ truyền thông $\le 50$ms, độ chính xác mAP@0.5 $\ge 90\%$, chỉ số MOTA $\ge 80\%$, IDF1 $\ge 85\%$.
4. Thiết lập Ma trận truy vết yêu cầu (RTM - Requirement Traceability Matrix) liên kết 13 Use Cases với kiến trúc phân tầng Backend FastAPI, giao diện trực quan Canvas 2D, và 35 Test Cases kiểm thử thực nghiệm (Phụ lục C).
5. Rà soát và kiểm thử đơn vị độc lập phân hệ điều phối cổng phân loại IoT (`app/services/sorting_service.py`), cơ chế Virtual Attribution bưu chính Việt Nam và cảnh báo chống kẹt hàng (Anti-jam alert).

---

## 2. Danh sách File Cần Tạo Mới & Kiểm Thử

| Đường dẫn File | Thao tác | Mục đích / Nội dung |
| :--- | :---: | :--- |
| `docs/plans/feat-srs-ieee830-ha.md` | Tạo mới | Bản kế hoạch kỹ thuật chuẩn Human Gate 1 |
| `docs/srs-ieee830/README.md` | Tạo mới | Giới thiệu cấu trúc hồ sơ đặc tả yêu cầu SRS |
| `docs/srs-ieee830/SRS_IEEE_830_SPECIFICATION.md` | Tạo mới | Tài liệu đặc tả yêu cầu phần mềm hoàn chỉnh chuẩn IEEE 830 |
| `tests/test_sorting_logic.py` | Tạo mới | Bộ kiểm thử chức năng phân loại bưu chính và xử lý ngoại lệ kẹt hàng IoT |

---

## 3. Quy chuẩn Nghiệp vụ Bưu chính Áp dụng (VNPost Virtual Attribution)

- **Mã bưu chính Miền Bắc (`100000` - `180000`):** Định tuyến Cổng phân loại 1 (Hà Nội & các tỉnh phía Bắc).
- **Mã bưu chính Miền Trung (`550000` - `590000`):** Định tuyến Cổng phân loại 2 (Đà Nẵng & miền Trung - Tây Nguyên).
- **Mã bưu chính Miền Nam (`700000` - `960000`):** Định tuyến Cổng phân loại 3 (TP.HCM & các tỉnh Nam Bộ).
- **Mã bưu chính Quốc Tế / Lỗi quét / Không xác định (`999000` hoặc khác):** Định tuyến Cổng số 4 (Làn Re-check / Kiểm tra thủ công).
- **Cơ chế chống kẹt hàng (Anti-Jam Logic):** Cảm biến quang học tại cửa xả làn phản hồi trạng thái trong vòng 3.0 giây. Nếu quá thời gian chưa nhận tín hiệu, kích hoạt trạng thái `JAMMED`, gửi cảnh báo SCADA khẩn cấp và tạm dừng băng chuyền.

---

## 4. Kế hoạch Kiểm thử & Tự Xác Minh (Self-Verification)

- [x] Tạo file kế hoạch kỹ thuật.
- [ ] Soạn thảo đầy đủ 6 phần tài liệu chuẩn IEEE 830 tại `docs/srs-ieee830/`.
- [ ] Chạy bộ kiểm thử tự động `pytest tests/test_sorting_logic.py` đảm bảo Pass 100%.
- [ ] Báo cáo kết quả và dừng tại Human Gate 2 (chờ người dùng kiểm thử, tuyệt đối không commit/push).

