from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from app.api.v1.router import api_router
from app.core.config import settings

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
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
    index_file = STATIC_DIR / "index.html"
    return FileResponse(str(index_file))
