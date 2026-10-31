# Quy tắc Kiểm soát Bắt buộc — Antigravity Agent Control Rules
# Tham chiếu gốc: AGENTS.md tại thư mục gốc dự án.

## NGUYÊN TẮC BẤT DI BẤT DỊCH
1. **User là người kiểm soát tối cao:** Mọi hành động sửa file, tạo file, commit, push đều phải qua quy trình: Đề xuất $\to$ Chờ User duyệt ("DUYỆT" / "OK, làm đi") $\to$ Thực thi trong phạm vi.
2. **Kỷ luật Git:** Cấm tuyệt đối tự ý `git commit`, `git push`, `git merge`, `git reset`... Push là lệnh riêng biệt, phải có sự đồng ý tường minh mới được chạy.
3. **Chỉ đẩy lên Git những gì của chung cả nhóm dùng được:** Tuyệt đối không đẩy lên Git các cấu hình cá nhân, file `.env`, mật khẩu cá nhân, file nháp không liên quan.
4. **Không xóa, không ghi đè file gốc:** Giữ nguyên dữ liệu gốc, tạo bản sao khi chỉnh sửa tài liệu.
5. **Trung thực số liệu:** Không bịa đặt mAP, MOTA, FPS, số test case, kết quả thực nghiệm.

