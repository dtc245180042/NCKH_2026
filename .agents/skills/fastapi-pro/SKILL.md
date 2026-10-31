---
name: fastapi-pro
description: Mẫu lập trình Backend hiệu năng cao với FastAPI, WebSocket thời gian thực, Pydantic v2 và SQLAlchemy 2.0 cho Hệ thống AI Logistics.
---

# FastAPI Pro Skill — AI Smart Logistics

## 1. MỤC TIÊU
Hướng dẫn viết mã Backend đạt chuẩn: Type-safe, Asynchronous non-blocking, hỗ trợ kênh WebSocket truyền tải khung hình 60 FPS mượt mà.

## 2. PATTERNS CỐT LÕI

### 2.1. Cấu trúc thư mục chuẩn
```
app/
├── api/
│   ├── v1/
│   │   ├── auth.py          # Đăng nhập, JWT
│   │   ├── packages.py      # CRUD kiện hàng, nhập/xuất kho
│   │   ├── warehouse.py     # Ô kệ, layout mặt bằng
│   │   ├── amr.py           # Điều phối robot AMR (A*)
│   │   └── iot.py           # Kích hoạt cổng phân loại
│   └── websocket.py         # Kênh truyền nhận /ws/simulation/stream
├── core/
│   ├── config.py            # Settings với pydantic-settings
│   ├── security.py          # bcrypt, JWT helper
│   └── database.py          # Async/Sync SQLAlchemy engine & sessionmaker
├── models/                  # SQLAlchemy ORM models
├── schemas/                 # Pydantic v2 schemas (Create/Update/Response)
└── services/                # Business logic: Tracking, A*, Sorting
```

### 2.2. WebSocket Stream Pattern (Mô phỏng 60 FPS)
```python
@router.websocket("/ws/simulation/stream")
async def simulation_stream(websocket: WebSocket, session_manager: SimulationManager = Depends()):
    await websocket.accept()
    try:
        while True:
            # Lấy snapshot trạng thái kho mới nhất từ Engine
            state = await session_manager.get_current_state()
            await websocket.send_json(state)
            await asyncio.sleep(1 / 60)  # Giới hạn tốc độ khung hình 60 FPS
    except WebSocketDisconnect:
        logger.info("Client simulation disconnected")
```

### 2.3. Dependency Injection cho Database Session
```python
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

## 3. CHECKLIST KIỂM TRA MÃ NGUỒN FASTAPI
- [ ] Không sử dụng `time.sleep()` trong async endpoint; bắt buộc dùng `asyncio.sleep()`.
- [ ] Tất cả Request Payload và Response Model đều được định nghĩa qua Pydantic v2.
- [ ] Mật khẩu được mã hóa an toàn bằng `passlib[bcrypt]`.
- [ ] Swagger Docs tại `/docs` hiển thị đầy đủ schema và mô tả rõ ràng.

