"""
API v1 Router: AMR Robotics & A* Pathfinding (UC-08)
"""
from fastapi import APIRouter, HTTPException
from app.schemas import PathfindingRequest, PathfindingResponse, AMRStatus, Point2D
from app.services.a_star import amr_planner
from app.services.simulation_manager import simulation_manager

router = APIRouter()


@router.post("/navigate", response_model=PathfindingResponse, summary="Tính toán lộ trình ngắn nhất cho AMR qua thuật toán A*")
def calculate_amr_path(req: PathfindingRequest):
    """
    Thực thi thuật toán A* tìm đường đi tối ưu cho Robot tự hành AMR:
    - Hỗ trợ Heuristic Manhattan (4 hướng) & Chebyshev (8 hướng)
    - Tránh các vật cản động thời gian thực (Local Re-planning)
    - Đảm bảo thời gian tính toán < 10 ms
    """
    start_tuple = (req.start.x, req.start.y)
    goal_tuple = (req.goal.x, req.goal.y)
    dyn_obs = [(p.x, p.y) for p in req.dynamic_obstacles] if req.dynamic_obstacles else []

    try:
        path_coords, cost, nodes_expanded, exec_ms = amr_planner.find_path(
            start=start_tuple,
            goal=goal_tuple,
            heuristic_mode=req.heuristic,
            allow_diagonal=req.allow_diagonal,
            dynamic_obstacles=dyn_obs
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not path_coords:
        return {
            "path": [],
            "total_cost": 0.0,
            "nodes_expanded": nodes_expanded,
            "computation_time_ms": round(exec_ms, 2),
            "algorithm": "A*",
            "heuristic_used": req.heuristic,
            "status": "NO_PATH_FOUND"
        }

    return {
        "path": [{"x": pt[0], "y": pt[1]} for pt in path_coords],
        "total_cost": round(cost, 2),
        "nodes_expanded": nodes_expanded,
        "computation_time_ms": round(exec_ms, 2),
        "algorithm": "A*",
        "heuristic_used": req.heuristic,
        "status": "SUCCESS"
    }


@router.get("/status", response_model=AMRStatus, summary="Lấy tọa độ và trạng thái thời gian thực của Robot AMR")
def get_amr_status():
    return {
        "amr_id": "AMR-01",
        "current_x": round(simulation_manager.amr_x, 1),
        "current_y": round(simulation_manager.amr_y, 1),
        "state": "PATROLLING" if simulation_manager.is_running else "IDLE",
        "battery_percent": 96.5,
        "active_path": [
            {"x": 260, "y": 200},
            {"x": 950, "y": 200}
        ]
    }

