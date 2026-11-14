import asyncio
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from app.api.v1.router import api_router
from app.core.config import settings
from app.services.simulation_engine import warehouse_simulation

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Khởi động Modbus TCP Server ngầm trên port 5020 (Trụ Cột 1)
    modbus_task = asyncio.create_task(warehouse_simulation.modbus_engine.start_server(host="127.0.0.1", port=5020))
    yield
    # Dọn dẹp tài nguyên khi tắt server
    await warehouse_simulation.modbus_engine.stop_server()
    modbus_task.cancel()

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS Middleware Configuration
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.BACKEND_CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Static Files & Frontend UI
STATIC_DIR = Path(__file__).resolve().parent / "static"
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# Gắn Router API v1
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/api/health", tags=["Health Check"])
def health_check():
    """Endpoint kiểm tra trạng thái hoạt động của hệ thống."""
    return {
        "status": "healthy",
        "project": settings.PROJECT_NAME,
        "timestamp": warehouse_simulation.fps,
        "environment": settings.ENVIRONMENT,
    }


@app.get("/", tags=["Root"])
def root():
    """Endpoint root API trả về metadata theo chuẩn ban đầu."""
    return {
        "message": f"Welcome to {settings.PROJECT_NAME} API",
        "docs_url": "/docs",
        "health_check": "/api/health",
        "app_ui": "/app",
    }


@app.get("/app", tags=["Frontend UI"])
def app_ui():
    """Phục vụ giao diện người dùng chính (Frontend Dashboard)."""
    return _serve_tab("tab-canvas")


def _serve_tab(tab_id: str) -> HTMLResponse:
    index_file = STATIC_DIR / "index.html"
    raw_html = index_file.read_text(encoding="utf-8")
    # Hiển thị Dashboard trực tiếp
    raw_html = raw_html.replace('id="auth-section" class="auth-split-container"', 'id="auth-section" class="auth-split-container" style="display: none;"')
    raw_html = raw_html.replace('id="dashboard-section" class="dashboard-layout" style="display: none;"', 'id="dashboard-section" class="dashboard-layout" style="display: flex;"')
    
    # Đổi tab mặc định
    raw_html = raw_html.replace('id="tab-canvas" class="tab-pane active"', 'id="tab-canvas" class="tab-pane"')
    raw_html = raw_html.replace('class="nav-tab active" data-tab="tab-canvas"', 'class="nav-tab" data-tab="tab-canvas"')
    raw_html = raw_html.replace(f'id="{tab_id}" class="tab-pane"', f'id="{tab_id}" class="tab-pane active"')
    raw_html = raw_html.replace(f'class="nav-tab" data-tab="{tab_id}"', f'class="nav-tab active" data-tab="{tab_id}"')
    return HTMLResponse(raw_html)


@app.get("/app/plc", tags=["Frontend UI"])
def app_ui_plc():
    return _serve_tab("tab-plc-rfid")


@app.get("/app/vision", tags=["Frontend UI"])
def app_ui_vision():
    return _serve_tab("tab-ai-vision")


@app.get("/app/iot", tags=["Frontend UI"])
def app_ui_iot():
    return _serve_tab("tab-iot-amr")


@app.get("/app/logs", tags=["Frontend UI"])
def app_ui_logs():
    return _serve_tab("tab-logs")
