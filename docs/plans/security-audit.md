# Kế hoạch Thực hiện: Rà soát Bảo mật, Loại bỏ Mật khẩu Mặc định & Kiểm tra Toàn vẹn Mã nguồn (Security Audit)
- **Mã Task Jira:** LOG-124 (Sprint 6)
- **Nhánh Git:** `chore/security-audit-ha`
- **Người thực hiện:** Nguyễn Thị Thu Hà (IoT & Logistics Logic Dev)
- **Kỹ năng áp dụng:** `.agents/skills/code-review/SKILL.md` và `.agents/rules/ai-logistics-rules.md`
- **Trạng thái:** Đã được người dùng DUYỆT (Human Gate 1 thông qua)

---

## 1. Phân tích Yêu cầu Kỹ thuật & Tiêu chuẩn Bảo mật

### 1.1. Tiêu chuẩn An toàn Mã nguồn & Bảo mật Dự án:
Căn cứ theo quy định tại `AGENTS.md` và `code-review`:
1. **Loại bỏ hoàn toàn mật khẩu yếu mặc định (Zero Default Passwords):**
   - Loại bỏ các chuỗi mật khẩu mặc định như `admin123`, `operator123`, `viewer123` trong toàn bộ mã nguồn và cơ sở dữ liệu seed.
   - Thay thế bằng mật khẩu mạnh đạt chuẩn doanh nghiệp (tối thiểu 12 ký tự, bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt) hoặc được cấu hình linh hoạt qua biến môi trường.
2. **Cung cấp mẫu cấu hình an toàn `.env.example`:**
   - Tạo file `.env.example` chuẩn, hướng dẫn cách cấu hình `SECRET_KEY`, `DATABASE_URL` và mật khẩu tài khoản quản trị ban đầu mà không để lộ bí mật thực tế lên Git.
3. **Cơ chế Thẩm định Độ mạnh Mật khẩu (Password Strength Enforcement):**
   - Xây dựng hàm kiểm định độ phức tạp mật khẩu: Độ dài $\ge 8$ ký tự, bắt buộc có ít nhất 1 chữ hoa, 1 chữ thường, 1 chữ số hoặc 1 ký tự đặc biệt.
   - Chặn đứng danh sách đen các mật khẩu phổ biến (`123456`, `admin123`, `password`, `admin`).
   - Tích hợp kiểm định vào API đăng ký người dùng mới.
4. **Chuẩn hóa Thông tin Nhân sự Đề tài:**
   - Cập nhật đúng họ tên thành viên **Nguyễn Thị Thu Hà** (Vận hành kho) trong seed data của hệ thống theo đúng Bảng phân công Thuyết minh và Quyết định giao đề tài.
5. **Mô-đun Tự động Kiểm toán An ninh (Automated Security Audit Tool):**
   - Xây dựng công cụ kiểm toán `app/core/security_audit.py` cho phép quét toàn bộ mã nguồn để phát hiện secret, kiểm tra mã hóa bcrypt và đánh giá phân quyền RBAC.

---

## 2. Danh sách File Cần Thay Đổi & Tạo Mới

| STT | Đường dẫn File | Thao tác | Mục đích / Nội dung kỹ thuật |
|:---:|:---|:---:|:---|
| 1 | `docs/plans/security-audit.md` | Tạo mới | Bản kế hoạch kỹ thuật chi tiết chuẩn Human Gate 1 |
| 2 | `.env.example` | Tạo mới | File mẫu cấu hình biến môi trường an toàn dùng chung |
| 3 | `app/core/config.py` | Cập nhật | Bổ sung biến `INITIAL_ADMIN_PASSWORD` và cảnh báo khi SECRET_KEY dùng chuỗi mặc định |
| 4 | `app/core/database.py` | Cập nhật | Loại bỏ mật khẩu mặc định yếu, nạp mật khẩu phức tạp, chuẩn hóa tên Nguyễn Thị Thu Hà |
| 5 | `app/core/security.py` | Cập nhật | Bổ sung hàm `validate_password_strength()` thẩm định độ mạnh mật khẩu |
| 6 | `app/schemas/auth.py` | Cập nhật | Cập nhật ví dụ mật khẩu mạnh trong schema đăng nhập |
| 7 | `app/api/v1/auth.py` | Cập nhật | Tích hợp kiểm tra độ mạnh mật khẩu khi đăng ký tài khoản |
| 8 | `app/core/security_audit.py` | Tạo mới | Mô-đun quét kiểm toán bảo mật và xuất báo cáo an ninh tự động |
| 9 | `tests/test_security_audit.py` | Tạo mới | Bộ kiểm thử an toàn bảo mật tự động (100% pass với unittest chuẩn) |

---

## 3. Kế hoạch Tách Commit (Tuân thủ Commit Granularity)

Sau khi hoàn thành và tự kiểm thử đạt 100%, commit sẽ được tách thành 2 nhóm logic (chỉ thực hiện khi có lệnh duyệt):
- **Commit 1 (Tài liệu Kế hoạch & Mẫu .env):** `docs(security): lap ke hoach kiem toan an ninh va bo sung file env.example`
- **Commit 2 (Mã nguồn Bảo mật, Audit Engine & Tests):** `chore(security): loai bo mat khau mac dinh, kiem dinh do manh mat khau va bo sung audit test`

---

## 4. Kế hoạch Tự Kiểm tra & Nghiệm thu (Self-Verification)

- [ ] Tạo file kế hoạch `docs/plans/security-audit.md` và `.env.example`.
- [ ] Cập nhật các module `config.py`, `database.py`, `security.py`, `auth.py`.
- [ ] Tạo module kiểm toán `app/core/security_audit.py`.
- [ ] Xây dựng bộ test `tests/test_security_audit.py` bao gồm 6 kịch bản kiểm thử:
  1. Kiểm tra từ chối mật khẩu yếu (`admin123`, `123456`, `password`).
  2. Kiểm tra chấp nhận mật khẩu mạnh (`Admin@ICTU2026!Secure`).
  3. Kiểm tra mã hóa một chiều an toàn bằng `bcrypt` / `HMAC-SHA256`.
  4. Kiểm tra JWT token ký an toàn và hết hạn theo đúng cấu hình.
  5. Kiểm tra phân quyền RBAC (người dùng VIEWER không được thực hiện tác vụ ADMIN).
  6. Kiểm tra quét tự động không có file nhạy cảm `.env` bị lộ trong Git.
- [ ] Chạy kiểm thử tự động nội bộ đảm bảo 100% Pass và báo cáo để người dùng test trên máy.

