---
name: code-review
description: Tiêu chuẩn đánh giá chất lượng mã nguồn, kiểm tra an toàn bảo mật, tính nhất quán kiến trúc và tối ưu hiệu năng trước khi sáp nhập (merge) code.
---

# Code Review & Quality Assurance Skill — AI Smart Logistics

## 1. MỤC TIÊU
Thực hiện đánh giá chéo mã nguồn để ngăn chặn lỗi tiềm ẩn, bảo vệ an toàn thông tin và duy trì cấu trúc dự án sạch sẽ theo chuẩn kỹ nghệ phần mềm.

## 2. NỘI DUNG RÀ SOÁT CỐT LÕI

### 2.1. Bảo mật & An toàn dữ liệu
- [ ] **Không lộ Secret:** Tuyệt đối không có mật khẩu, token, đường dẫn nhạy cảm được commit cứng trong code.
- [ ] **Data Sanitization:** Dữ liệu đầu vào từ người dùng hoặc camera phải được kiểm tra kiểu dữ liệu (Validation) qua Pydantic schemas.
- [ ] **Bảo vệ quyền truy cập:** Mọi endpoint quan trọng đều phải có dependency `Depends(get_current_active_user)` và kiểm tra role.

### 2.2. Hiệu năng & Tối ưu hóa
- [ ] Không có vòng lặp vô hạn hoặc block luồng async bằng hàm đồng bộ nặng (`cv2.waitKey` hoặc `time.sleep` trong async def).
- [ ] Quản lý bộ nhớ: Giải phóng các frame ảnh buffer của OpenCV khi không còn dùng để tránh rò rỉ RAM (Memory Leak).
- [ ] Truy vấn database: Tránh lỗi N+1 Query; sử dụng eager loading `joinedload` khi cần lấy kèm thông tin quan hệ.

### 2.3. Quy chuẩn viết code (Clean Code)
- [ ] Tên biến, hàm, class rõ nghĩa (tiếng Anh chuẩn kỹ thuật, comment giải thích nghiệp vụ bằng tiếng Việt hoặc tiếng Anh).
- [ ] Tuân thủ chuẩn PEP 8 cho mã nguồn Python.
- [ ] Mỗi module chỉ đảm nhiệm đúng 1 trách nhiệm duy nhất (Single Responsibility Principle).

## 3. CHECKLIST PHÊ DUYỆT (HUMAN GATE 4)
- [ ] Người review đã chạy thử mã nguồn cục bộ và không phát hiện lỗi Crash.
- [ ] Các thông điệp commit tuân thủ đúng quy tắc tách nhóm file của dự án.
- [ ] Không có file rác (`.DS_Store`, `__pycache__`, file log tạm) bị add vào commit.

