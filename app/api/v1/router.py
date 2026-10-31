from fastapi import APIRouter
from app.api.v1.endpoints import auth, packages, simulation_ws, users, analytics

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(packages.router)
api_router.include_router(simulation_ws.router)
api_router.include_router(analytics.router)
