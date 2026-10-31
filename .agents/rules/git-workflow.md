# Quy tắc Git & Quy trình Phát triển (Git & Workflow Rules) — AI Smart Logistics
# Áp dụng cho TẤT CẢ Antigravity agents và lập trình viên làm việc trong dự án này.

---

## 1. LUỒNG XỬ LÝ BẮT BUỘC — 6 BƯỚC TUẦN TỰ

Với MỌI yêu cầu phát triển tính năng mới, tối ưu hóa hoặc sửa lỗi (fix bug), agent và lập trình viên PHẢI tuân thủ nghiêm ngặt 6 bước:

```
[BƯỚC 1: Phân tích] ──> [BƯỚC 2: Tạo Branch] ──> [BƯỚC 3: Lập Kế hoạch Plan]
                                                               │
                                                       [HUMAN GATE 1]
                                                    (Chờ User duyệt Plan)
                                                               │
[BƯỚC 6: Merge/Push] <── [HUMAN GATE 2] <── [BƯỚC 5: Tự kiểm tra] <── [BƯỚC 4: Code & Commit]
                        (User test OK)
```

- **BƯỚC 1: Phân tích yêu cầu:** Đối chiếu với SRS, ma trận RTM (UC-01 đến UC-13). Nếu yêu cầu chưa rõ ràng, phải hỏi lại người dùng; TUYỆT ĐỐI KHÔNG tự suy đoán nghiệp vụ rồi code ngay.
- **BƯỚC 2: Kiểm tra & chuyển Feature Branch:** Kiểm tra nhánh hiện tại (`git branch --show-current`). Không bao giờ làm việc trực tiếp trên nhánh `main`.
- **BƯỚC 3: Tạo file kế hoạch:** Viết tài liệu kế hoạch chi tiết tại `docs/plans/<ten-tinh-nang>.md` theo mẫu `docs/plans/TEMPLATE.md`.  
  👉 **DỪNG VÀ CHỜ (HUMAN GATE 1):** Agent PHẢI dừng lại, thông báo cho người dùng và chờ phản hồi xác nhận kế hoạch trước khi bắt đầu viết mã nguồn.
- **BƯỚC 4: Lập trình & Tách nhóm Commit:** Thực thi mã nguồn theo kế hoạch đã duyệt. Commit riêng biệt từng nhóm file logic (xem quy tắc commit bên dưới), TUYỆT ĐỐI KHÔNG gộp chung tất cả vào 1 commit lớn (`git add .` rồi commit đại trà).
- **BƯỚC 5: Tự kiểm tra & Báo cáo kết quả:** Chạy kiểm thử nội bộ (syntax, unit test, benchmark, log chạy). Báo cáo rõ danh sách file thay đổi và kết quả tự kiểm tra.  
  👉 **DỪNG VÀ CHỜ (HUMAN GATE 2):** Chờ người dùng nghiệm thu / kiểm thử thực tế.
- **BƯỚC 6: Push / Pull Request / Merge:** CHỈ thực hiện khi người dùng ra lệnh rõ ràng.

---

## 2. ĐIỂM CHẶN CON NGƯỜI (HUMAN GATES BẮT BUỘC)

Agent PHẢI dừng và không được tự ý thực thi các bước tiếp theo tại 2 chốt chặn:
1. **Sau BƯỚC 3 (Gate 1):** Chờ người dùng phê duyệt Kế hoạch (`docs/plans/*.md`).
2. **Sau BƯỚC 5 (Gate 2):** Chờ người dùng xác nhận kết quả kiểm thử chạy thực tế trên máy.

**CÁC LỆNH CẤM TUYỆT ĐỐI KHÔNG TỰ CHẠY KHI CHƯA ĐƯỢC PHÉP:**
- `git push origin main` hoặc `git push --force`
- `git merge` vào nhánh `main`
- Xóa database hoặc xóa file dữ liệu mô phỏng / trọng số AI (`.pt`)

---

## 3. QUY TẮC PHÂN NHÁNH (BRANCH CONVENTION)

- Tiền tố nhánh hợp lệ:
  - `feat/<ten-chuc-nang>`: Phát triển tính năng mới (ví dụ: `feat/yolo-detection`, `feat/amr-a-star`, `feat/iot-gate-routing`)
  - `fix/<ten-loi>`: Sửa lỗi hệ thống (ví dụ: `fix/websocket-reconnect`, `fix/bytetrack-id-switch`)
  - `refactor/<ten-module>`: Tái cấu trúc mã nguồn, tối ưu hiệu năng
  - `docs/<ten-tai-lieu>`: Cập nhật tài liệu SRS, báo cáo, hướng dẫn
  - `test/<ten-module>`: Viết test case, bổ sung kịch bản kiểm thử
- **Nghiêm cấm:** Đặt tên nhánh tùy tiện như `test`, `dev`, `toan`, `temp`, `my-branch`.

---

## 4. QUY TẮC TÁCH COMMIT (COMMIT GRANULARITY)

Mỗi commit chỉ chứa một nhóm thay đổi logic duy nhất:
- **Nhóm 1 (Database / Schema):** `models/*.py`, `schemas/*.py`, migrations.
- **Nhóm 2 (AI Vision / Engine):** `services/ai_tracking.py`, `services/yolo_service.py`, `services/bytetrack/*.py`.
- **Nhóm 3 (Pathfinding & Robotics):** `services/a_star.py`, `services/amr_dispatcher.py`.
- **Nhóm 4 (Backend API & Router):** `api/*.py`, `core/*.py`, `main.py`.
- **Nhóm 5 (Frontend / Simulation Canvas):** `static/js/*.js`, `static/css/*.css`, `templates/*.html`.
- **Nhóm 6 (Tài liệu & Kế hoạch):** `docs/plans/*.md`, `docs/*.md`.

### Cú pháp thông điệp Commit:
Format chuẩn: `<type>(<scope>): <mô tả ngắn gọn bằng tiếng Việt hoặc tiếng Anh>`
- `feat(ai): tich hop thuat toan ByteTrack duy tri ID khi bi che khuat`
- `feat(amr): bo sung ham heuristic Chebyshev cho luoi 8 huong`
- `fix(websocket): xu ly timeout stream ket noi Canvas 2D`
- `docs(plan): lap ke hoach tich hop cong phan loai IoT UC-08`

