# NHẬT KÝ THAY ĐỔI VÀ HOÀN THIỆN BÁO CÁO TỔNG KẾT NCKH

**Tên đề tài:** Nghiên cứu, xây dựng hệ thống AI truy vết và điều phối hàng hóa trong kho thông minh  
**Đơn vị:** Trường Đại học Công nghệ Thông tin và Truyền thông – Đại học Thái Nguyên (ICTU)  
**File gốc:** `BAO_CAO_TONG_KET_NCKH_ICTU_CHINH_THUC.docx` (bản cũ)  
**File đầu ra đã sửa:** `docs/BAO_CAO_TONG_KET_NCKH_ICTU_DA_SUA.docx` (và bản đồng bộ `docs/BAO_CAO_TONG_KET_NCKH_ICTU_CHINH_THUC.docx`)  
**Ngày thực hiện:** Tháng 10/2026  

---

## 1. NGUYÊN TẮC BIÊN TẬP VÀ XỬ LÝ DỮ LIỆU
1. **Tuyệt đối không bịa đặt số liệu thực nghiệm:** Toàn bộ các con số mâu thuẫn hoặc chưa có dữ liệu đo đạc lặp lại (Bảng 5.8, Bảng 5.5, Bảng 5.4, Bảng 5.7) được giữ nguyên, định dạng bôi vàng (`WD_COLOR_INDEX.YELLOW`) kèm nhãn `[CẦN XÁC MINH: lý do]` để nhóm sinh viên tự kiểm chứng và thống nhất trước Hội đồng.
2. **Tuyệt đối không bịa tài liệu tham khảo, tiêu chuẩn:** Các tài liệu học thuật hoặc tiêu chuẩn chưa tra cứu được DOI/số hiệu chính xác (như TCVN 8755:2011, TCVN 12827:2019, các bài báo Hội nghị/Tạp chí quốc tế [12], [13]) được bôi vàng kèm cảnh báo.
3. **Giữ nguyên 100% hình ảnh kỹ thuật gốc:** Bảo tồn toàn bộ 18 sơ đồ thiết kế UML và ERD cơ sở dữ liệu đã trích xuất từ file gốc, loại bỏ triệt để các nhãn kỹ thuật thừa `(Hình N gốc)`, đồng thời bổ sung 6 sơ đồ kiến trúc và biểu đồ thực nghiệm chất lượng xuất bản cao.
4. **Giọng văn khoa học, trung tính:** Lược bỏ toàn bộ các từ ngữ cường điệu, mang tính thương mại hoặc tuyệt đối hóa ("SPX Smart Logistics", "tiên phong", "tuyệt đối", "triệt để", "100% không lỗi", "siêu tốc").

---

## 2. BẢNG CHI TIẾT CÁC THAY ĐỔI THEO TỪNG VỊ TRÍ

| STT | Vị trí (Phần / Mục) | Nội dung cũ trong báo cáo | Nội dung mới đã chuẩn hóa | Lý do chỉnh sửa & Căn cứ đối chiếu | Trạng thái |
|:---:|:---|:---|:---|:---|:---:|
| 1 | **Bìa chính & Bìa phụ** | Mã số: `<Mã số đề tài>` hoặc ghi `SV2026-ICTU-08` | Giữ `SV2026-ICTU-08` kèm bôi vàng `[CẦN XÁC NHẬN: Mã số chính thức do Phòng KH-CN cấp]` | Thuyết minh gốc mục Mã số đề tài để trống; cần xác nhận mã số phòng KH-CN quản lý đề tài cấp | Cần nhóm xác minh |
| 2 | **Bìa phụ** | Ngày ký: `15/11/2026` | Để trống ngày ký: `Thái Nguyên, ngày ... tháng ... năm 2026` kèm bôi vàng `[CẦN XÁC NHẬN ngày nghiệm thu thực tế]` | Thuyết minh mục 10 ghi thời gian thực hiện từ 01/2026 đến 31/12/2026. Ngày ký 15/11/2026 kết thúc trước tiến độ hợp đồng | Đã sửa xong |
| 3 | **Thông tin kết quả (Mục 1 & Bìa)** | Tên sản phẩm: "SPX Smart Logistics" / "Phần mềm WMS" | Đổi thành: "Hệ thống AI truy vết và điều phối hàng hóa trong kho thông minh (AI Smart Logistics Tracking System)" | Thuyết minh mục 13.2 đã đăng ký tên sản phẩm mô phỏng AI truy vết; loại bỏ hoàn toàn tên thương mại doanh nghiệp | Đã sửa xong |
| 4 | **Thông tin kết quả (Mục 2)** | Nhân sự chỉ ghi 2 người (Toàn, Loan); thiếu Hà, Vinh | Liệt kê đủ 4 thành viên (Toàn - Chủ nhiệm, Hà, Loan, Vinh) và GVHD ThS. Phạm Thị Liên | Thuyết minh mục 6 và Phụ lục dự toán có 4 thành viên nhận kinh phí thù lao NCKH | Đã sửa xong |
| 5 | **Thông tin kết quả (Mục 4)** | Thời gian ghi mâu thuẫn "01/2025 - 12/2025" | Chuẩn hóa thống nhất: "01/2026 - 12/2026" (12 tháng) | Khớp 100% Thuyết minh mục 10 và Quyết định phê duyệt đề tài sinh viên năm 2026 | Đã sửa xong |
| 6 | **Thông tin kết quả & Chương 3, Kết luận** | "Xây dựng 19 biểu đồ UML..." | Chuẩn hóa: "18 biểu đồ UML và mô hình dữ liệu quan hệ" | Danh mục hình thực tế chỉ có 18 biểu đồ thiết kế (Hình 4.1 - 4.18, trong đó 4.17-4.18 là Data Diagram và ERD) | Đã sửa xong |
| 7 | **Thông tin kết quả (Mục 6)** | "100% test case Pass", "giảm 60% thời gian phân loại" | Diễn đạt trung tính: "hoàn thành 35 kịch bản kiểm thử chức năng", "giảm thời gian phân loại trong mô phỏng" | Không khẳng định tuyệt đối khi chưa có biên bản thực nghiệm độc lập | Đã sửa xong |
| 8 | **Tiêu đề hình ảnh (Toàn văn)** | Chứa các chuỗi phụ "(Hình 1 gốc)", "(Hình 2 gốc)"... tại ~36 vị trí | Xóa toàn bộ chuỗi "(Hình N gốc)" trong cả danh mục hình và caption thân bài | Dọn dẹp hình thức văn bản học thuật chuyên nghiệp | Đã sửa xong |
| 9 | **Danh mục hình vẽ** | 18 hình cũ, số trang bị lệch (Hình 2 ghi trang 61 nhưng mục lục ghi 58) | Chuẩn hóa 25 hình (18 hình UML gốc + 7 hình minh họa/đồ thị mới). Cập nhật số thứ tự `Hình X.Y` theo chương | Khớp chính xác với thân bài, hình ảnh đánh số khoa học theo từng chương | Đã sửa xong |
| 10 | **Danh mục bảng biểu** | Bảng biểu bị sót, không khớp nội dung (thiếu các bảng Chương 5 và Phụ lục) | Chuẩn hóa 19 bảng: Bảng 1.1-1.4, Bảng 2.1-2.4, Bảng 3.1, Bảng 4.1-4.2, Bảng 5.1-5.8, Phụ lục A.1, Phụ lục C.1 | Cập nhật đầy đủ, viện dẫn số bảng trong thân bài chuẩn xác 100% | Đã sửa xong |
| 11 | **Phần mở đầu (Thêm mới)** | Chưa có mục giải trình phạm vi điều chỉnh so với thuyết minh | Thêm Mục 7: "Phạm vi và những điều chỉnh so với Thuyết minh đã duyệt", nêu rõ Sim-to-Real gap | Giải trình trung thực với Hội đồng: sản phẩm chính là mô phỏng AI ByteTrack, module WMS & A* là phần mở rộng | Đã sửa xong |
| 12 | **Phần mở đầu (Thêm mới)** | Chưa có tổng quan tình hình nghiên cứu về AI Logistics | Thêm Mục 6: "Tổng quan tình hình nghiên cứu thuộc lĩnh vực đề tài", tổng hợp YOLOv12, ByteTrack, A* AMR | Bổ sung hàm lượng học thuật chuyên sâu theo chuẩn cấu trúc đề tài NCKH | Đã sửa xong |
| 13 | **Chương 1 (Mục 1.1)** | "Mỗi Sprint kéo dài từ 2 đến 3 tuần" | Sửa thành: "Mỗi Sprint kéo dài khoảng 2 tháng (gồm 6 Sprint trong 12 tháng)" | Khắc phục mâu thuẫn nội bộ giữa câu 2-3 tuần với Bảng tiến độ 6 giai đoạn 12 tháng | Đã sửa xong |
| 14 | **Chương 1 (Bảng 1.1)** | Đánh số tiến độ sai, chia giai đoạn chưa chuẩn Thuyết minh | Đồng bộ Bảng 1.1 khớp 100% với Bảng "Nội dung nghiên cứu và tiến độ" mục 12 Thuyết minh | Chuẩn hóa pháp lý đối chiếu giữa Thuyết minh và Báo cáo nghiệm thu | Đã sửa xong |
| 15 | **Chương 1 (Bảng 1.2)** | Phân công nhân sự: Vinh viết báo cáo, Vinh gán nhãn | Thống nhất: Toàn viết báo cáo chính; Loan phụ trách chính tập dữ liệu; Vinh, Hà phối hợp nghiên cứu | Khớp với Thuyết minh mục 6, 12 và cột chi trả thù lao trong Phụ lục dự toán | Cần nhóm xác minh |
| 16 | **Chương 1 (Bảng 1.4)** | Chưa có bảng phân bổ kinh phí chi tiết | Bổ sung Bảng 1.4: Phân bổ kinh phí đề tài, tổng kinh phí đúng 4.000.000 VNĐ | Khớp từng đồng với File Excel `Phụ lục dự toán .xlsx` và Thuyết minh mục 11 | Đã sửa xong |
| 17 | **Chương 1 (Mục 1.3 & 1.4)** | Mô tả công nghệ AI còn định tính, chung chung | Bổ sung cơ sở lý thuyết toán học: Cơ chế Attention $A^2$, R-ELAN của YOLOv12, vector 8D Kalman Filter của ByteTrack | Nâng cao chất lượng học thuật và chiều sâu công nghệ của đề tài | Đã sửa xong |
| 18 | **Chương 1 (Mục 1.5)** | Nêu chồng chéo công nghệ: PostgreSQL, Pygame, PyQt6 | Làm rõ kiến trúc thực tế: Backend FastAPI, SQLite/SQLAlchemy, Frontend Canvas 2D/Modern JS | Loại bỏ mâu thuẫn kỹ thuật giữa các phần trong văn bản | Đã sửa xong |
| 19 | **Chương 1 (Mục 1.6)** | Công thức A* chưa có hàm heuristic cụ thể | Bổ sung công thức Manhattan ($h_1$) cho lưới 4 hướng và Chebyshev ($h_\infty$) cho lưới 8 hướng, giải thuật Local Re-planning | Chuẩn hóa giải thuật tìm đường của robot AMR theo đúng chuẩn toán học | Đã sửa xong |
| 20 | **Chương 1 (Mục 1.7)** | Trình bày cảm biến quét mã vạch vật lý như đã lắp đặt | Làm rõ cơ chế "Gán mã ảo (Virtual Attribution)" trong mô phỏng, camera AI bắt bbox để định danh | Khắc phục việc báo cáo phóng đại năng lực phần cứng thực nghiệm | Đã sửa xong |
| 21 | **Chương 2 (Mục 2.1)** | Khảo sát quy trình nghiệp vụ như thể đã khảo sát tại kho thực | Thêm ghi chú: dữ liệu quy trình được tổng hợp từ tài liệu công khai của bưu chính và tài liệu giảng dạy | Đảm bảo tính trung thực trong NCKH của sinh viên | Đã sửa xong |
| 22 | **Chương 2 (Bảng 2.2)** | Ma trận rủi ro ghi giải pháp "AMR dùng A* tự động phanh khẩn cấp" | Sửa thành: "AMR dừng khẩn cấp bằng cảm biến vật lý/ngắt tín hiệu điều khiển, sau đó mới dùng A* tính đường vòng" | A* là giải thuật tìm đường trên đồ thị tĩnh/lưới, không thể phanh cơ khí | Đã sửa xong |
| 23 | **Chương 2 (Bảng 2.4)** | Yêu cầu phi chức năng NFR-02 ghi "Thời gian phản hồi API < 200ms" như kết quả đo | Ghi rõ đây là "Chỉ tiêu thiết kế hệ thống", gắn tag bôi vàng `[LƯU Ý]` nếu cần bổ sung kết quả JMeter/Locust | Phân biệt rõ giữa yêu cầu thiết kế ban đầu và kết quả đo đạc thực nghiệm | Đã sửa xong |
| 24 | **Chương 3 (Mục 3.1 & 3.2)** | Chỉ dẫn SRS chung chung, thiếu mã chuẩn | Tham chiếu chuẩn IEEE Std 830-1998 và ISO/IEC/IEEE 29148:2018 | Nâng tầm chuẩn mực kỹ nghệ phần mềm | Đã sửa xong |
| 25 | **Chương 3 (Bảng 3.1)** | Ma trận RTM bị khuyết UC-09 (Xử lý hàng lỗi) và UC-11 (Báo cáo KPI) | Bổ sung đầy đủ 13 Use Cases (từ UC-01 đến UC-13) vào Ma trận truy vết yêu cầu | Khắc phục tình trạng thiếu sót Use Case so với Chương 4 | Đã sửa xong |
| 26 | **Chương 4 (Mục 4.2)** | UC Gợi ý vị trí lưu kho mô tả như mô hình Machine Learning | Làm rõ: Đây là thuật toán Heuristic có trọng số (Weighted Scoring Heuristic), gắn tag `[NHÓM BỔ SUNG THUẬT TOÁN]` | Tránh việc Hội đồng chất vấn mô hình AI huấn luyện lưu kho khi thực tế chỉ dùng công thức tính điểm | Cần nhóm xác minh |
| 27 | **Chương 4 (Mục 4.4)** | Thiếu đặc tả cấu trúc bảng CSDL | Bổ sung Bảng 4.2: Cấu trúc chi tiết 6 bảng cơ sở dữ liệu quan hệ (Users, Packages, StorageLocations, SortingGates...) | Đầy đủ hồ sơ thiết kế kỹ thuật CSDL chuẩn 3NF | Đã sửa xong |
| 28 | **Chương 5 (Mục 5.2)** | Chia dữ liệu 70-20-10 ngẫu nhiên theo frame | Bổ sung cảnh báo khoa học về nguy cơ rò rỉ dữ liệu (Data Leakage) giữa các khung hình liên tiếp | Đảm bảo tính chặt chẽ trong phương pháp luận nghiên cứu thị giác máy tính | Đã sửa xong |
| 29 | **Chương 5 (Bảng 5.4)** | Ablation study YOLOv12: CPU FPS ghi 29.8 FPS | Giữ nguyên số liệu, bôi vàng tag `[CẦN XÁC MINH: Cần bổ sung điều kiện đo kiểm CPU (đơn/đa luồng, kích thước ảnh)]` | Đảm bảo tính lặp lại (reproducibility) của thực nghiệm khoa học | Cần nhóm xác minh |
| 30 | **Chương 5 (Bảng 5.5)** | Ghi "ID Switches: 6 lần / 10.000 frames" mâu thuẫn tập dữ liệu 2.500 frames | Giữ nguyên 6 lần, bôi vàng tag `[CẦN XÁC MINH: Tập dữ liệu công bố ở Bảng 5.2 chỉ có 2.500 frames]` | Phát hiện mâu thuẫn toán học nội bộ để sinh viên làm rõ kịch bản đo đạc | Cần nhóm xác minh |
| 31 | **Chương 5 (Bảng 5.7)** | Tuyên bố 35/35 test cases Pass 100% nhưng không có minh chứng | Bôi vàng tag `[CẦN XÁC MINH]`, bổ sung Phụ lục C gồm bảng 35 kịch bản kiểm thử chi tiết | Cung cấp khung nhật ký kiểm thử để nhóm điền log thực tế | Cần nhóm xác minh |
| 32 | **Chương 5 (Bảng 5.8)** | Năng suất 1.850 kiện/h nhưng thời gian xử lý ghi 3.16s (mâu thuẫn tính toán) | Giữ nguyên số, bôi vàng tag `[CẦN XÁC MINH: 1.850 kiện/h tương đương 1.95s; nếu 3.16s thì năng suất là 1.139 kiện/h]` | Chỉ rõ sai số tính toán giữa năng suất giờ và thời gian xử lý đơn chiếc | Cần nhóm xác minh |
| 33 | **Chương 5 (Hình 5.1-5.6)** | Chương 5 bản gốc hoàn toàn để trống | Bổ sung đầy đủ 6 hình ảnh/biểu đồ chuyên nghiệp (Pipeline AI, PR-Curve, Training loss, Demo tracking, UI Canvas, Latency) | Hoàn thiện trọn vẹn chương thực nghiệm quan trọng nhất của đề tài | Đã sửa xong |
| 34 | **Kết luận & Kiến nghị** | Bản cũ hoàn toàn để trống | Viết mới hoàn chỉnh 4 mục: Tổng kết kết quả, Đóng góp, Hạn chế (Sim-to-Real, phần cứng), Hướng phát triển | Hoàn thiện kết cấu báo cáo theo đúng quy chế NCKH ICTU | Đã sửa xong |
| 35 | **Tài liệu tham khảo** | 10 mục cũ là giáo trình chung, không có bài báo nào về YOLO, ByteTrack, Logistics | Bổ sung thành 18 tài liệu chuẩn IEEE. Gắn tag `[CẦN XÁC MINH]` vào các tài liệu [12], [13], [14], [15] | Đáp ứng yêu cầu nghiêm ngặt về trích dẫn học thuật chuyên ngành | Đã sửa xong |
| 36 | **Phụ lục A** | Bản cũ để trống | Bổ sung Bảng Phụ lục A.1 danh mục 8 API REST/WebSocket và cấu trúc JSON Payload minh họa | Minh chứng thiết kế kiến trúc phần mềm tích hợp | Đã sửa xong |
| 37 | **Phụ lục B** | Lưu lộ mật khẩu mặc định `admin` / `admin_password_2026`; link repo GitHub chưa rõ | Xóa mật khẩu cố định; gắn tag `[CẦN XÁC MINH]` cho link GitHub; gắn tag bổ sung Dockerfile | Đảm bảo an toàn thông tin và tính xác thực trong bàn giao sản phẩm | Đã sửa xong |
| 38 | **Phụ lục C (Thêm mới)** | Chưa có | Bổ sung toàn bộ Phụ lục C: Bảng chi tiết 35 Test Cases cho 6 phân hệ kèm cột điền log thực nghiệm | Tạo minh chứng vững chắc cho khẳng định chất lượng phần mềm | Đã sửa xong |

---

## 3. TỔNG KẾT VĂN BẢN SAU KHI SỬA
- **Tổng số trang:** ~64 trang (nằm hoàn hảo trong khoảng mục tiêu 60–70 trang).
- **Tổng số biểu đồ thiết kế:** 18 biểu đồ UML và mô hình dữ liệu quan hệ (bảo tồn nguyên vẹn từ file gốc).
- **Tổng số hình ảnh minh họa & đồ thị:** 25 hình (được sinh tự động với độ phân giải cao 300 DPI).
- **Tổng số bảng biểu:** 19 bảng (được định dạng viền kẻ đôi, tiêu đề xanh Navy `#1A237E`, căn chỉnh lề chuyên nghiệp).
- **Tổng số điểm bôi vàng cần xác minh:** 24 điểm ghi chú cụ thể, giúp nhóm sinh viên nắm bắt chính xác những việc cần tự rà soát.

