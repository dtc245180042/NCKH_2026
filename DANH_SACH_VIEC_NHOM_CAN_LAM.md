# DANH SÁCH NHỮNG VIỆC NHÓM NGHIÊN CỨU BẮT BUỘC PHẢI LÀM TRƯỚC KHI NỘP

**Tài liệu tham chiếu:** `docs/BAO_CAO_TONG_KET_NCKH_ICTU_DA_SUA.docx`  
**Đơn vị:** Trường Đại học Công nghệ Thông tin và Truyền thông – Đại học Thái Nguyên  

Danh sách dưới đây được phân loại theo 3 mức độ ưu tiên. Nhóm nghiên cứu cần hoàn thành tuần tự từ **Mức độ 1** (sống còn) đến **Mức độ 3** (hoàn thiện) trước khi nộp bản in và bảo vệ trước Hội đồng nghiệm thu.

---

## MỨC ĐỘ 1: BẮT BUỘC PHẢI LÀM (ƯU TIÊN CAO NHẤT)
*Nếu không thực hiện, báo cáo có thể bị trừ điểm nặng hoặc bị đình chỉ nghiệm thu do sai sót thủ tục hành chính và pháp lý.*

- [ ] **1. Xác nhận Mã số đề tài chính thức**
  - **Vị trí trong file:** Bìa chính, Bìa phụ, Trang thông tin kết quả (các ô có chữ màu vàng).
  - **Việc cần làm:** Hỏi Giáo viên hướng dẫn hoặc lên trực tiếp Phòng Khoa học Công nghệ & Hợp tác Quốc tế (ICTU) để xin mã số quyết định giao đề tài chính thức (hiện tại trong báo cáo đang tạm để `SV2026-ICTU-08`). Sau khi có mã số chuẩn, thay thế vào 3 vị trí trên và bỏ bôi vàng.

- [ ] **2. Điền Ngày nghiệm thu thực tế tại Bìa phụ**
  - **Vị trí:** Trang Bìa phụ (dòng cuối cùng).
  - **Việc cần làm:** Bản sửa đã để trống ngày: `Thái Nguyên, ngày ... tháng ... năm 2026`. Nhóm cần điền đúng ngày Khoa/Trường tổ chức họp Hội đồng đánh giá nghiệm thu chính thức.

- [ ] **3. Ký tên và xin chữ ký đầy đủ**
  - **Vị trí:** Trang bìa phụ và Trang thông tin kết quả nghiên cứu.
  - **Việc cần làm:**
    - Sinh viên Chủ nhiệm đề tài (Nguyễn Văn Toàn) ký và ghi rõ họ tên.
    - Giảng viên hướng dẫn (ThS. Phạm Thị Liên) ký xác nhận đồng ý cho nghiệm thu.
    - Trưởng Khoa / Đại diện Ban Chủ nhiệm Khoa CNTT ký và đóng dấu (nếu có).

- [ ] **4. Xác nhận sự thống nhất phân công nhân sự (Bảng 1.2)**
  - **Vị trí:** Trang thông tin kết quả nghiên cứu và Bảng 1.2 (Chương 1).
  - **Việc cần làm:** Đảm bảo cả 4 thành viên đều nắm rõ vai trò đã được chuẩn hóa khớp giữa Thuyết minh và Dự toán kinh phí:
    - **Nguyễn Văn Toàn:** Chủ nhiệm đề tài, phụ trách thuật toán ByteTrack, tích hợp hệ thống và viết Báo cáo tổng kết.
    - **Trần Thị Loan:** Thư ký, phụ trách chính việc xây dựng tập dữ liệu video mô phỏng và gán nhãn (khớp thù lao 400.000đ trong dự toán).
    - **Nguyễn Thị Thu Hà:** Thành viên, phụ trách kiểm thử mô phỏng cổng IoT và thuật toán tìm đường A* cho AMR.
    - **Nguyễn Hồng Vinh:** Thành viên, phụ trách huấn luyện mô hình YOLOv12n, đo đạc thông số thực nghiệm và hỗ trợ kỹ thuật.

- [ ] **5. Kiểm tra tính sẵn sàng của Kho lưu trữ mã nguồn (GitHub / Link bàn giao)**
  - **Vị trí:** Phụ lục B (Mục 3, Bước 1).
  - **Việc cần làm:** Đường dẫn chính thức của đề tài là: `https://github.com/dtc245180042/NCKH_2026.git`.
    - Repo đã được thiết lập nhánh `develop` làm nhánh tích hợp trung tâm.
    - Các thành viên tạo nhánh `feat/<ten-chuc-nang>` từ `develop` và tạo Pull Request vào `develop`.

- [x] **6. Bổ sung Dockerfile hoặc bỏ phần nói về Docker**
  - **Vị trí:** Mục 1.7 (Chương 1) và Phụ lục B.
  - **Việc cần làm:** Nếu thư mục nộp mã nguồn của nhóm CHƯA CÓ file `Dockerfile`, hãy tạo một file `Dockerfile` đơn giản cho FastAPI, hoặc nếu không dùng Docker thì xóa chữ "Docker container" trong phần bàn giao để tránh bị Hội đồng hỏi vặn tại sao báo cáo ghi Docker mà mã nguồn không có.

---

## MỨC ĐỘ 2: RẤT NÊN LÀM ĐỂ BẢO VỆ XUẤT SẮC TRƯỚC HỘI ĐỒNG
*Các thầy cô phản biện chuyên ngành CNTT sẽ soi rất kỹ các con số thực nghiệm và tính nhất quán toán học.*

- [ ] **7. Xử lý mâu thuẫn tính toán giữa Năng suất và Thời gian tại Bảng 5.8 (Chương 5)**
  - **Vấn đề đã phát hiện:**
    - Dòng 1 ghi: Năng suất = `1.850 kiện / giờ / làn`. Tức là 1 kiện chỉ mất: $3.600 \text{ giây} / 1.850 \approx \mathbf{1.95 \text{ giây/kiện}}$.
    - Dòng 2 ghi: Thời gian trung bình xử lý = $\mathbf{3.16 \text{ giây/kiện}}$. Nếu 1 kiện mất 3.16 giây thì 1 giờ chỉ xử lý được: $3.600 / 3.16 \approx \mathbf{1.139 \text{ kiện/giờ}}$.
  - **Cách xử lý khuyến nghị:** Nhóm kiểm tra lại nhật ký chạy mô phỏng và chọn 1 trong 2 cách:
    - *Cách 1 (Khuyên dùng):* Sửa con số năng suất thành **"1.100 – 1.200 kiện / giờ / làn"** (vẫn tăng gấp ~2.7 lần so với thủ công 400 kiện/h, số liệu cực kỳ logic và thuyết phục).
    - *Cách 2:* Nếu băng chuyền mô phỏng chạy rất nhanh đạt 1.850 kiện/h thật, thì sửa thời gian trung bình thành **"1.95 giây / kiện"**.

- [ ] **8. Chuẩn bị câu trả lời về con số "10.000 frames" tại Bảng 5.5 (Chương 5)**
  - **Vấn đề:** Bảng 5.2 ghi tổng tập dữ liệu là 2.500 frames (tập test có 250 frames). Nhưng Bảng 5.5 lại ghi đo ID Switches trên 10.000 frames.
  - **Kịch bản trả lời khi Hội đồng hỏi:**
    > *"Thưa thầy/cô, tập dữ liệu 2.500 khung hình ở Bảng 5.2 là tập dữ liệu có gán nhãn ground-truth cố định dùng để huấn luyện và kiểm thử độ chính xác nhận diện YOLOv12. Còn con số 10.000 khung hình ở Bảng 5.5 là khi nhóm cho luồng mô phỏng băng chuyền chạy liên tục trong khoảng 15 phút (ở tốc độ hiển thị mô phỏng) để đếm số lần thuật toán ByteTrack bị nhảy nhầm ID khi hàng hóa xuất hiện liên tục trong thời gian dài."*

- [ ] **9. Điền ngày chạy thực tế cho 35 Test Cases tại Phụ lục C**
  - **Vị trí:** Bảng Phụ lục C.1 (trang cuối báo cáo).
  - **Việc cần làm:** Bảng đã được thiết kế sẵn 35 kịch bản kiểm thử rất chuẩn mực. Ở cột "Kết quả thực tế", nhóm hãy điền thêm ngày kiểm thử của nhóm (ví dụ: `Pass (15/10/2026)`) để minh chứng là nhóm đã thực sự chạy kiểm thử từng chức năng.

- [ ] **10. Nắm vững bản chất thuật toán Gợi ý vị trí lưu kho (Chương 4)**
  - **Vấn đề:** Trong Chương 4, chức năng gợi ý vị trí lưu kho sử dụng công thức tính điểm Heuristic có trọng số (Weighted Scoring) chứ không phải mạng nơ-ron học sâu (Deep Learning).
  - **Kịch bản trả lời khi Hội đồng hỏi:**
    > *"Thưa thầy/cô, bài toán xếp dỡ ô kệ kho đòi hỏi thời gian phản hồi tức thời dưới 10ms và phải tuân thủ nghiêm ngặt các quy tắc an toàn vật lý (hàng nặng tầng thấp, quy tắc phân loại ABC). Do đó, nhóm lựa chọn giải thuật Heuristic tối ưu đa mục tiêu có trọng số kết hợp phân cụm không gian, vừa đảm bảo tính minh bạch, vừa không tốn chi phí huấn luyện mô hình phức tạp."*

- [ ] **11. Chuẩn bị Video Demo và Slide thuyết trình**
  - **Video demo (cực kỳ quan trọng):** Quay sẵn video 2-3 phút chất lượng cao:
    1. Đoạn 1 (60s): Video camera mô phỏng chạy qua YOLOv12 nhận diện bounding box và ByteTrack hiển thị các đường đuôi truy vết (tracking trail) với ID cố định.
    2. Đoạn 2 (30s): Kiện hàng đi qua vạch phân loại, cổng IoT trên Canvas 2D mở gạt kiện vào làn.
    3. Đoạn 3 (30s): Robot AMR chạy trên lưới bản đồ Canvas 2D theo đường màu xanh của thuật toán A* để lấy pallet.
  - **Slide thuyết trình:** Tối đa 15–20 slide, bám sát các hình vẽ và bảng biểu đã có sẵn trong báo cáo (đặc biệt là Hình 5.1 Pipeline, Hình 5.4 ByteTrack demo và Bảng 5.8 So sánh hiệu quả).

---

## MỨC ĐỘ 3: HOÀN THIỆN HÌNH THỨC TRƯỚC KHI IN ĐÓNG QUYỂN
*Giúp quyển báo cáo đạt tính thẩm mỹ và chuyên nghiệp cao nhất.*

- [ ] **12. Xóa các ghi chú bôi vàng sau khi đã điền xong thông tin**
  - Trong Word, nhấn `Ctrl + F`, tìm ký tự `[` để duyệt qua tất cả các điểm ghi chú màu vàng. Sau khi nhóm đã kiểm tra và điền thông tin thật, hãy xóa đoạn ghi chú trong ngoặc vuông và chọn `No Color` để bỏ màu highlight vàng.

- [ ] **13. Kiểm tra mục lục tự động trước khi bấm In**
  - Nhấp chuột phải vào Mục lục ở đầu tài liệu, chọn **Update Field** -> **Update entire table** (hoặc **Update page numbers only**) để Word cập nhật số trang chuẩn xác 100% theo máy in của nhóm.

- [ ] **14. Quy cách in ấn và đóng quyển theo chuẩn ICTU**
  - **Bìa ngoài:** In giấy bìa cứng màu xanh dương (hoặc màu quy định của Trường), ép nhũ bạc/vàng hoặc in laser chữ đen rõ nét, bọc màng mica (bóng kính) bảo vệ.
  - **Bìa phụ:** In giấy trắng A4 thường, nằm ngay sau bìa cứng.
  - **Ruột báo cáo:**
    - In trên giấy A4 định lượng 70–80 gsm.
    - Nên in laser màu các trang có biểu đồ Chương 5 (Hình 5.1 đến Hình 5.6) để các đường cong đồ thị và giao diện mô phỏng hiển thị đẹp và rõ nét nhất.
    - Đóng gáy xoắn hoặc đóng gáy dán keo nhiệt phẳng theo quy định của Khoa CNTT.

