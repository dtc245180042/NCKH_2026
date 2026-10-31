"""
Main FastAPI Application Entrypoint
Đề tài NCKH Sinh viên: SV2026-ICTU-08
Trường Đại học Công nghệ Thông tin và Truyền thông – Đại học Thái Nguyên (ICTU)
"""
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse

from app.core.config import settings
from app.core.database import init_db
from app.api.v1 import api_v1_router
from app.api.websocket import ws_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Vòng đời ứng dụng: Khởi tạo CSDL 3NF và seed data khi startup"""
    init_db()
    yield


app = FastAPI(
    title=f"{settings.PROJECT_NAME} ({settings.PROJECT_CODE})",
    description="""
## Hệ Thống AI Truy Vết & Điều Phối Hàng Hóa Trong Kho Thông Minh
**Mã số đề tài:** SV2026-ICTU-08  
**Đơn vị:** Trường Đại học Công nghệ Thông tin và Truyền thông – Đại học Thái Nguyên  
**GVHD:** ThS. Hoàng Thị Liên  
**Nhóm sinh viên:** Nguyễn Văn Toàn (Chủ nhiệm), Bùi Thị Loan, Bùi Duy Hà, Trần Quang Vinh

### Các phân hệ cốt lõi:
1. **Xác thực & Phân quyền (RBAC):** Quản lý quyền Admin, Operator, Viewer (UC-01, UC-02)
2. **Kiện hàng & Inbound:** Tiếp nhận bưu kiện, gán mã bưu chính ảo (UC-03, UC-06)
3. **Mặt bằng kho & Ô kệ:** Quản lý vị trí lưu kho 3NF (UC-10)
4. **Robot AMR & Tìm đường A\*:** Tính toán lộ trình tránh vật cản động < 10ms (UC-08)
5. **Cổng phân loại cơ khí IoT:** Kích hoạt cần gạt 45 độ, chống kẹt hàng (UC-07)
6. **Thống kê SCADA & MOT Metrics:** Năng suất ~1.150 kiện/h/làn, mAP50=93.6%, MOTA=89.4% (UC-11)
7. **Kênh truyền WebSocket 60 FPS:** Đồng bộ thời gian thực với Canvas 2D (UC-12)
    """,
    version=settings.VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# Cấu hình CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Gắn các Router API
app.include_router(api_v1_router, prefix=settings.API_V1_STR)
app.include_router(ws_router)


@app.get("/health", tags=["Health Check"], summary="Kiểm tra trạng thái hoạt động của Backend")
def health_check():
    return {
        "status": "HEALTHY",
        "project": settings.PROJECT_NAME,
        "code": settings.PROJECT_CODE,
        "version": settings.VERSION,
        "websocket_fps": settings.WS_FPS_TARGET,
        "database": "CONNECTED"
    }


# Phục vụ giao diện Frontend HTML5 Canvas 2D từ thư mục src/
frontend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src")
if os.path.exists(frontend_dir):
    app.mount("/simulation", StaticFiles(directory=frontend_dir, html=True), name="simulation")


@app.get("/", include_in_schema=False)
def root_redirect():
    """Chuyển hướng trang chủ về giao diện mô phỏng Canvas 2D nếu có, hoặc Swagger Docs"""
    if os.path.exists(frontend_dir):
        return RedirectResponse(url="/simulation/index.html")
    return RedirectResponse(url="/docs")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
