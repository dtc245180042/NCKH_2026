"""
Pydantic v2 schemas: AMR Robotics & A* Pathfinding (UC-08)
"""
from typing import List, Tuple, Optional
from pydantic import BaseModel, Field


class Point2D(BaseModel):
    x: int = Field(..., description="Tọa độ X trên lưới")
    y: int = Field(..., description="Tọa độ Y trên lưới")


class PathfindingRequest(BaseModel):
    start: Point2D
    goal: Point2D
    heuristic: str = Field(default="manhattan", example="manhattan")  # "manhattan" hoặc "chebyshev"
    allow_diagonal: bool = Field(default=False, description="Cho phép di chuyển 8 hướng")
    dynamic_obstacles: Optional[List[Point2D]] = Field(default=[], description="Vật cản động phát hiện thời gian thực")


class PathfindingResponse(BaseModel):
    path: List[Point2D]
    total_cost: float
    nodes_expanded: int
    computation_time_ms: float
    algorithm: str = "A*"
    heuristic_used: str
    status: str = "SUCCESS"  # SUCCESS hoặc NO_PATH_FOUND


class AMRStatus(BaseModel):
    amr_id: str = "AMR-01"
    current_x: float
    current_y: float
    state: str = "PATROLLING"  # "IDLE", "PATROLLING", "NAVIGATING", "BLOCKED"
    battery_percent: float = 95.0
    active_path: List[Point2D] = []

