---
name: database-design
description: Thiết kế cơ sở dữ liệu quan hệ chuẩn 3NF trên hệ quản trị MySQL cho Hệ thống AI Logistics Kho thông minh. Bao gồm 6 bảng thực thể, khóa ngoại, ràng buộc toàn vẹn, engine InnoDB và đánh chỉ mục (indexing).
---

# Database Design Skill — AI Smart Logistics (MySQL Edition)

## 1. MỤC TIÊU
Thiết kế cấu trúc cơ sở dữ liệu quan hệ đạt chuẩn dạng chuẩn 3 (3NF) trên hệ quản trị **MySQL Server** (Engine: `InnoDB`, Collation: `utf8mb4_unicode_ci`), đảm bảo tính toàn vẹn tham chiếu và tối ưu hóa tốc độ truy vấn thời gian thực cho hệ thống kho vận.

## 2. KẾT NỐI HỆ THỐNG (CONNECTION SPECIFICATION)
- **Hệ quản trị CSDL:** MySQL 8.0+ (hoặc MariaDB 10.4+ / XAMPP)
- **Driver kết nối Python:** `pymysql` kết hợp `cryptography`
- **Chuỗi kết nối SQLAlchemy 2.0:**
  `mysql+pymysql://<username>:<password>@<host>:<port>/<database_name>?charset=utf8mb4`
- **Lưu ý bảo mật:** Chuỗi kết nối được load động qua biến môi trường trong file `.env`, không bao giờ commit lên Git.

---

## 3. DANH MỤC CÁC BẢNG DỮ LIỆU CỐT LÕI (6 BẢNG MYSQL)

### 1. Bảng `users` (Quản lý người dùng & phân quyền)
```sql
CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    role ENUM('ADMIN', 'OPERATOR', 'VIEWER') NOT NULL DEFAULT 'OPERATOR',
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 2. Bảng `storage_locations` (Danh mục ô kệ kho bãi)
```sql
CREATE TABLE storage_locations (
    location_id INT AUTO_INCREMENT PRIMARY KEY,
    location_code VARCHAR(30) NOT NULL UNIQUE,  -- VD: 'RACK-A-01-02'
    zone VARCHAR(20) NOT NULL,                  -- Khu vực A, B, C
    grid_x INT NOT NULL,                        -- Tọa độ X trên lưới bản đồ kho 2D
    grid_y INT NOT NULL,                        -- Tọa độ Y trên lưới bản đồ kho 2D
    capacity_weight FLOAT NOT NULL,             -- Tải trọng tối đa (kg)
    is_occupied TINYINT(1) NOT NULL DEFAULT 0,  -- 0: Trống, 1: Đang chứa hàng
    INDEX idx_rack_zone (zone),
    INDEX idx_rack_occupied (is_occupied)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 3. Bảng `sorting_gates` (Danh mục cổng phân loại IoT)
```sql
CREATE TABLE sorting_gates (
    gate_id INT AUTO_INCREMENT PRIMARY KEY,
    gate_number INT NOT NULL UNIQUE,            -- Cổng 1, 2, 3...
    target_zone VARCHAR(50) NOT NULL,           -- Điểm đến: Miền Bắc, Miền Trung, Miền Nam
    conveyor_position_x FLOAT NOT NULL,         -- Tọa độ X kích hoạt trên băng tải
    status ENUM('IDLE', 'DEFLECTING', 'JAMMED', 'MAINTENANCE') NOT NULL DEFAULT 'IDLE'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 4. Bảng `packages` (Quản lý kiện hàng)
```sql
CREATE TABLE packages (
    package_id INT AUTO_INCREMENT PRIMARY KEY,
    barcode VARCHAR(64) NOT NULL UNIQUE,
    tracking_code VARCHAR(64),
    weight FLOAT,                               -- kg
    dimensions VARCHAR(50),                     -- Dài x Rộng x Cao (cm)
    destination_zone VARCHAR(50) NOT NULL,
    status ENUM('RECEIVED', 'ON_CONVEYOR', 'SORTED', 'STORED', 'DISPATCHED', 'ERROR') NOT NULL DEFAULT 'RECEIVED',
    current_location_id INT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (current_location_id) REFERENCES storage_locations(location_id) ON DELETE SET NULL,
    INDEX idx_package_barcode (barcode),
    INDEX idx_package_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 5. Bảng `tracking_sessions` (Nhật ký phiên truy vết AI)
```sql
CREATE TABLE tracking_sessions (
    session_id INT AUTO_INCREMENT PRIMARY KEY,
    package_id INT NOT NULL,
    assigned_track_id INT NOT NULL,             -- ID do thuật toán ByteTrack sinh ra
    confidence_score FLOAT NOT NULL,            -- Độ tin cậy trung bình của YOLO
    first_detected_at DATETIME NOT NULL,
    last_seen_at DATETIME NOT NULL,
    total_frames_tracked INT NOT NULL DEFAULT 0,
    occlusion_events_count INT NOT NULL DEFAULT 0,
    FOREIGN KEY (package_id) REFERENCES packages(package_id) ON DELETE CASCADE,
    INDEX idx_session_track_id (assigned_track_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 6. Bảng `system_logs` (Nhật ký sự kiện & Audit)
```sql
CREATE TABLE system_logs (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,            -- 'AUTH_LOGIN', 'SORT_TRIGGER', 'AMR_DISPATCH', 'GATE_JAM'
    description TEXT,
    user_id INT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL,
    INDEX idx_log_event (event_type),
    INDEX idx_log_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 4. CHECKLIST QUẢN TRỊ CSDL MYSQL
- [ ] Tất cả các bảng sử dụng Engine `InnoDB` để hỗ trợ giao dịch (ACID) và toàn vẹn khóa ngoại.
- [ ] Tất cả các cột khóa ngoại đều được đánh chỉ mục (Index) tự động hoặc tường minh.
- [ ] Bảng `packages` và `tracking_sessions` có index trên `barcode` và `assigned_track_id` để tối ưu truy vấn thời gian thực.
- [ ] Sử dụng SQLAlchemy ORM 2.0 cú pháp Declarative Base hiện đại, kết nối qua `mysql+pymysql`.
