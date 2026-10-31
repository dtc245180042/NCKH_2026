from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.router import api_router
from app.core.config import settings

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS Middleware Configuration (Tuần thủ bảo mật: Đọc từ biến môi trường, không dùng '*')
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.BACKEND_CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Gắn Router API v1
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/api/health", tags=["Health Check"])
def health_check():
    """Endpoint kiểm tra trạng thái hoạt động của hệ thống.
    
    Hoàn toàn độc lập, không phụ thuộc vào trạng thái kết nối MySQL.
    """
    return {
        "status": "healthy",
        "project": settings.PROJECT_NAME,
        "environment": settings.ENVIRONMENT,
    }


@app.get("/", tags=["Root"])
def root():
    return {
        "message": f"Welcome to {settings.PROJECT_NAME} API",
        "docs_url": "/docs",
        "health_check": "/api/health",
    }
