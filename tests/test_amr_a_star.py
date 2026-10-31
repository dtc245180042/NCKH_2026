import time
import pytest
from app.services.a_star import AStarPlanner

def test_a_star_pathfinding_basic():
    """Kiểm thử thuật toán A* tìm đường đi từ điểm xuất phát đến đích"""
    planner = AStarPlanner(cols=30, rows=20)
    start = (5, 5)
    goal = (15, 5)

    path = planner.find_path(start, goal, heuristic="manhattan", allow_diagonal=False)
    assert path is not None
    assert path[0] == start
    assert path[-1] == goal
    assert len(path) == 11  # 10 bước di chuyển


def test_a_star_manhattan_vs_chebyshev():
    """Kiểm thử sự khác biệt giữa heuristic Manhattan (4 hướng) và Chebyshev (8 hướng)"""
    planner = AStarPlanner(cols=30, rows=20)
    start = (2, 2)
    goal = (8, 8)

    # 4 hướng trực giao: đường đi dạng bậc thang Manhattan
    path_4dir = planner.find_path(start, goal, heuristic="manhattan", allow_diagonal=False)
    assert path_4dir is not None
    assert len(path_4dir) == 13  # 6 bước X + 6 bước Y + 1 điểm đầu

    # 8 hướng (kèm đường chéo): đường chéo ngắn hơn
    path_8dir = planner.find_path(start, goal, heuristic="chebyshev", allow_diagonal=True)
    assert path_8dir is not None
    assert len(path_8dir) == 7   # 6 bước chéo + 1 điểm đầu
    assert len(path_8dir) < len(path_4dir)


def test_corner_cutting_prevention():
    """
    Kiểm thử chống hiện tượng Cắt Góc (Corner Cutting):
    Nếu ô (3, 2) là tường cản, robot ở (2, 2) không được phép đi chéo qua góc nhọn tới (3, 3)
    nếu đường góc vuông bị chắn.
    """
    planner = AStarPlanner(cols=20, rows=20)
    # Xóa vật cản mặc định để tạo tình huống cô lập
    planner.obstacles.clear()

    # Tạo tường chữ L chắn một bên
    planner.add_obstacle(3, 2)
    planner.add_obstacle(2, 3)

    start = (2, 2)
    goal = (3, 3)

    # Đi chéo trực tiếp từ (2,2) đến (3,3) bị cấm vì cả 2 ô kề (3,2) và (2,3) đều là tường
    path = planner.find_path(start, goal, allow_diagonal=True)
    assert path is not None
    # Robot buộc phải đi vòng chứ không được cắt góc
    assert (3, 3) not in path[1:2]


def test_dynamic_obstacle_avoidance_and_replanning():
    """
    Kiểm thử cơ chế tránh vật cản động và Local Re-planning (LOG-117):
    - Đặt chướng ngại vật ngay trên lộ trình ban đầu.
    - Gọi lại thuật toán A* và kiểm tra lộ trình mới vòng qua vật cản.
    """
    planner = AStarPlanner(cols=30, rows=20)
    start = (5, 10)
    goal = (15, 10)

    # 1. Đường đi thẳng ban đầu
    orig_path = planner.find_path(start, goal)
    assert (10, 10) in orig_path

    # 2. Xuất hiện vật cản động tại (10, 10)
    planner.add_obstacle(10, 10)
    new_path = planner.find_path(start, goal)

    assert new_path is not None
    assert (10, 10) not in new_path, "Lộ trình mới không được đi qua ô đã bị vật cản chiếm!"
    assert new_path[-1] == goal


def test_a_star_latency_benchmark():
    """Kiểm tra hiệu năng tính toán lộ trình A* đạt chuẩn NFR (<= 10ms)"""
    planner = AStarPlanner(cols=50, rows=50)
    start = (0, 0)
    goal = (45, 45)

    t0 = time.perf_counter()
    path = planner.find_path(start, goal, heuristic="chebyshev", allow_diagonal=True)
    elapsed_ms = (time.perf_counter() - t0) * 1000.0

    assert path is not None
    assert elapsed_ms < 10.0, f"A* tính toán quá chậm ({elapsed_ms:.2f} ms > 10 ms)"

