# BỘ TÀI LIỆU ĐẶC TẢ YÊU CẦU PHẦN MỀM (SRS - IEEE 830)
## HỆ THỐNG AI TRUY VẾT VÀ ĐIỀU PHỐI HÀNG HÓA TRONG KHO THÔNG MINH
**Đề tài NCKH Sinh viên:** SV2026-ICTU-08  
**Đơn vị:** Trường Đại học Công nghệ Thông tin và Truyền thông – Đại học Thái Nguyên (ICTU)  
**Nhánh Git:** `feature/docs/srs-ieee830-ha` | **Task Jira:** `LOG-104`

---

## 📌 Tổng quan Thư mục
Thư mục này chứa toàn bộ hồ sơ đặc tả yêu cầu phần mềm theo tiêu chuẩn quốc tế **IEEE Std 830-1998** và **ISO/IEC/IEEE 29148:2018**:

- [SRS_IEEE_830_SPECIFICATION.md](./SRS_IEEE_830_SPECIFICATION.md): Bản đặc tả hoàn chỉnh chi tiết 6 phần:
  1. **Mục 1 — Giới thiệu:** Mục đích, phạm vi, định nghĩa, tài liệu viện dẫn.
  2. **Mục 2 — Mô tả Tổng quan:** Bối cảnh hệ thống, 13 Use Cases, đặc tính người dùng, môi trường vận hành, ràng buộc Sim-to-Real.
  3. **Mục 3 — Yêu cầu Chức năng Cụ thể:** Đặc tả chi tiết từng Use Case từ UC-01 đến UC-13 (Tiền điều kiện, Luồng chính, Luồng phụ/Ngoại lệ, Tiêu chí nghiệm thu).
  4. **Mục 4 — Yêu cầu Phi chức năng:** Hiệu năng (YOLO $\le 20$ms, WebSocket 60 FPS, độ trễ $\le 50$ms), Độ chính xác (mAP $\ge 90\%$, MOTA $\ge 80\%$, IDF1 $\ge 85\%$), An toàn & Bảo mật (JWT, RBAC).
  5. **Mục 5 — Giao diện Hệ thống:** UI Canvas 2D, Phần cứng IoT/AMR, CSDL MySQL 3NF, Kênh truyền WebSocket 60 FPS.
  6. **Mục 6 — Ma trận Truy vết Yêu cầu (RTM):** Ánh xạ từ 13 Use Cases đến Models, API Endpoints, Canvas UI và 35 Test Cases (Phụ lục C).

---
> Tài liệu này là căn cứ pháp lý kỹ thuật ràng buộc cho các giai đoạn thiết kế kiến trúc, cài đặt mã nguồn và nghiệm thu đề tài trước Hội đồng cấp Trường.

