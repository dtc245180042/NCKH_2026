---
name: database-design
description: Thiết kế cơ sở dữ liệu quan hệ chuẩn 3NF (PostgreSQL/SQLite) cho Hệ thống AI Logistics Kho thông minh. Bao gồm 6 bảng thực thể, khóa ngoại, ràng buộc toàn vẹn và đánh chỉ mục (indexing).
---

# Database Design Skill — AI Smart Logistics

## 1. MỤC TIÊU
Thiết kế cấu trúc cơ sở dữ liệu quan hệ đạt chuẩn dạng chuẩn 3 (3NF), đảm bảo tính toàn vẹn tham chiếu, tối ưu hóa tốc độ truy vấn thời gian thực cho hệ thống kho vận.

## 2. DANH MỤC CÁC BẢNG DỮ LIỆU CỐT LÕI (6 BẢNG)

### 1. Bảng `users` (Quản lý người dùng & phân quyền)
- `user_id` (PK, Integer, Auto Increment)
- `username` (VARCHAR(50), Unique, Not Null)
- `hashed_password` (VARCHAR(255), Not Null — bcrypt)
- `full_name` (VARCHAR(100))
- `role` (VARCHAR(20), Enum: 'ADMIN', 'OPERATOR', 'VIEWER')
- `is_active` (Boolean, Default True)
- `created_at` (DateTime, Default Now)

### 2. Bảng `packages` (Quản lý kiện hàng)
- `package_id` (PK, Integer, Auto Increment)
- `barcode` (VARCHAR(64), Unique, Not Null)
- `tracking_code` (VARCHAR(64), Index)
- `weight` (Float — kg)
- `dimensions` (VARCHAR(50) — Dài x Rộng x Cao cm)
- `destination_zone` (VARCHAR(50) — Miền Bắc, Miền Trung, Miền Nam)
- `status` (VARCHAR(30), Enum: 'RECEIVED', 'ON_CONVEYOR', 'SORTED', 'STORED', 'DISPATCHED', 'ERROR')
- `current_location_id` (FK -> storage_locations.location_id, Nullable)
- `created_at`, `updated_at` (DateTime)

### 3. Bảng `storage_locations` (Danh mục ô kệ kho bãi)
- `location_id` (PK, Integer, Auto Increment)
- `location_code` (VARCHAR(30), Unique, Not Null — VD: 'RACK-A-01-02')
- `zone` (VARCHAR(20) — Khu vực A, B, C)
- `grid_x`, `grid_y` (Integer — Tọa độ trên lưới bản đồ kho)
- `capacity_weight` (Float — Tải trọng tối đa kg)
- `is_occupied` (Boolean, Default False)

### 4. Bảng `sorting_gates` (Danh mục cổng phân loại IoT)
- `gate_id` (PK, Integer, Auto Increment)
- `gate_number` (Integer, Unique — Cổng 1, 2, 3...)
- `target_zone` (VARCHAR(50) — Điểm đến tương ứng)
- `conveyor_position_x` (Float — Tọa độ kích hoạt trên băng tải)
- `status` (VARCHAR(20), Enum: 'IDLE', 'DEFLECTING', 'JAMMED', 'MAINTENANCE')

### 5. Bảng `tracking_sessions` (Nhật ký phiên truy vết AI)
- `session_id` (PK, Integer, Auto Increment)
- `package_id` (FK -> packages.package_id)
- `assigned_track_id` (Integer — ID sinh ra bởi ByteTrack)
- `confidence_score` (Float — Độ tin cậy trung bình của YOLO)
- `first_detected_at`, `last_seen_at` (DateTime)
- `total_frames_tracked` (Integer)
- `occlusion_events_count` (Integer, Default 0)

### 6. Bảng `system_logs` (Nhật ký sự kiện & Audit)
- `log_id` (PK, Integer, Auto Increment)
- `event_type` (VARCHAR(50) — 'AUTH_LOGIN', 'SORT_TRIGGER', 'AMR_DISPATCH', 'GATE_JAM')
- `description` (Text)
- `user_id` (FK -> users.user_id, Nullable)
- `created_at` (DateTime, Index)

## 3. CHECKLIST KIỂM SOÁT CƠ SỞ DỮ LIỆU
- [ ] Tất cả các trường Foreign Key đều có chỉ mục (Index) để tối ưu tốc độ JOIN.
- [ ] Bảng `packages` và `tracking_sessions` có index trên `barcode` và `assigned_track_id`.
- [ ] Sử dụng SQLAlchemy ORM 2.0 cú pháp Declarative Base hiện đại, hỗ trợ cả SQLite (môi trường dev/demo) và PostgreSQL (môi trường production).

