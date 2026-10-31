"""
API v1 Routers bundle.
"""
from fastapi import APIRouter
from app.api.v1.auth import router as auth_router
from app.api.v1.packages import router as packages_router
from app.api.v1.warehouse import router as warehouse_router
from app.api.v1.amr import router as amr_router
from app.api.v1.iot import router as iot_router
from app.api.v1.stats import router as stats_router

api_v1_router = APIRouter()
api_v1_router.include_router(auth_router, prefix="/auth", tags=["1. Xác thực & Phân quyền (UC-01, UC-02)"])
api_v1_router.include_router(packages_router, prefix="/packages", tags=["2. Kiện hàng & Inbound (UC-03)"])
api_v1_router.include_router(warehouse_router, prefix="/warehouse", tags=["3. Mặt bằng kho & Ô kệ (UC-10)"])
api_v1_router.include_router(amr_router, prefix="/amr", tags=["4. Điều phối Robot AMR (A* - UC-08)"])
api_v1_router.include_router(iot_router, prefix="/iot", tags=["5. Cổng phân loại cơ khí IoT (UC-07)"])
api_v1_router.include_router(stats_router, prefix="/stats", tags=["6. Thống kê & Báo cáo Năng suất (UC-11)"])

__all__ = ["api_v1_router"]
