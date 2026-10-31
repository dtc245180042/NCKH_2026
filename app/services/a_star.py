"""
Thuật toán tìm đường tối ưu A* (A-Star Pathfinding) cho Robot tự hành AMR (UC-08)
Tuân thủ đặc tả kỹ thuật tại .agents/skills/amr-pathfinding-a-star/SKILL.md
- Hàm Heuristic Manhattan (4 hướng) & Chebyshev/Octile (8 hướng)
- Tránh va chạm động (Local Re-planning) và chống cắt góc (Corner-Cutting Prevention)
- Thời gian tính toán tối ưu < 10 ms trên lưới Occupancy Grid.
"""
import heapq
import time
from typing import List, Tuple, Dict, Set, Optional


class AStarNode:
    __slots__ = ('x', 'y', 'g', 'h', 'f', 'parent')

    def __init__(self, x: int, y: int, g: float = 0.0, h: float = 0.0, parent: Optional['AStarNode'] = None):
        self.x = x
        self.y = y
        self.g = g
        self.h = h
        self.f = g + h
        self.parent = parent

    def __lt__(self, other: 'AStarNode') -> bool:
        return self.f < other.f if self.f != other.f else self.h < other.h


class AStarPlanner:
    def __init__(self, width: int = 50, height: int = 50):
        self.width = width
        self.height = height
        # Ma trận tĩnh: 0 là ô trống có thể đi, 1 là vật cản ô kệ hoặc tường
        self.grid = [[0 for _ in range(height)] for _ in range(width)]
        self._init_warehouse_obstacles()

    def _init_warehouse_obstacles(self):
        """Khởi tạo các vật cản tĩnh: Dãy kệ kho và tường biên"""
        # Tường biên
        for x in range(self.width):
            self.grid[x][0] = 1
            self.grid[x][self.height - 1] = 1
        for y in range(self.height):
            self.grid[0][y] = 1
            self.grid[self.width - 1][y] = 1

        # Dãy kệ hàng A (Phía Bắc: y từ 6 đến 10, cách quãng theo bay)
        for x in range(10, 42, 6):
            for dx in range(4):
                for y in range(6, 11):
                    if x + dx < self.width:
                        self.grid[x + dx][y] = 1

        # Dãy kệ hàng B (Phía Nam: y từ 38 đến 42)
        for x in range(10, 42, 6):
            for dx in range(4):
                for y in range(38, 43):
                    if x + dx < self.width:
                        self.grid[x + dx][y] = 1

    def heuristic(self, x1: int, y1: int, x2: int, y2: int, mode: str = "manhattan") -> float:
        """
        Tính chi phí ước lượng Heuristic h(n)
        - Manhattan: Di chuyển 4 hướng
        - Chebyshev: Di chuyển 8 hướng có quay góc
        - Octile: Đường chéo chính xác theo căn bậc hai (sqrt(2))
        """
        dx = abs(x1 - x2)
        dy = abs(y1 - y2)

        if mode == "chebyshev":
            return float(max(dx, dy))
        elif mode == "octile":
            return (dx + dy) + (1.41421356 - 2.0) * min(dx, dy)
        else:
            # Mặc định Manhattan
            return float(dx + dy)

    def find_path(
        self,
        start: Tuple[int, int],
        goal: Tuple[int, int],
        heuristic_mode: str = "manhattan",
        allow_diagonal: bool = False,
        dynamic_obstacles: Optional[List[Tuple[int, int]]] = None
    ) -> Tuple[List[Tuple[int, int]], float, int, float]:
        """
        Thực thi thuật toán tìm đường A*
        Returns:
            path: Danh sách tọa độ các nút từ Start -> Goal
            total_cost: Chi phí quãng đường g(Goal)
            nodes_expanded: Số lượng nút đã xét
            execution_time_ms: Thời gian tính toán (mili-giây)
        """
        t_start = time.perf_counter()

        sx, sy = start
        gx, gy = goal

        # Kiểm tra tính hợp lệ của tọa độ điểm đầu và đích
        if not (0 <= sx < self.width and 0 <= sy < self.height):
            raise ValueError(f"Tọa độ Start ({sx}, {sy}) nằm ngoài bản đồ.")
        if not (0 <= gx < self.width and 0 <= gy < self.height):
            raise ValueError(f"Tọa độ Goal ({gx}, {gy}) nằm ngoài bản đồ.")

        # Tập vật cản động thời gian thực
        dyn_obs_set = set(dynamic_obstacles) if dynamic_obstacles else set()

        if self.grid[sx][sy] == 1 or start in dyn_obs_set:
            return [], 0.0, 0, (time.perf_counter() - t_start) * 1000.0
        if self.grid[gx][gy] == 1 or goal in dyn_obs_set:
            return [], 0.0, 0, (time.perf_counter() - t_start) * 1000.0

        # Định nghĩa các hướng di chuyển lân cận
        if allow_diagonal:
            # 8 hướng kèm chi phí (1.0 cho thẳng, 1.414 cho chéo)
            neighbors = [
                (0, 1, 1.0), (0, -1, 1.0), (1, 0, 1.0), (-1, 0, 1.0),
                (1, 1, 1.41421356), (1, -1, 1.41421356), (-1, 1, 1.41421356), (-1, -1, 1.41421356)
            ]
        else:
            # 4 hướng cơ bản (Manhattan)
            neighbors = [(0, 1, 1.0), (0, -1, 1.0), (1, 0, 1.0), (-1, 0, 1.0)]

        open_set: List[AStarNode] = []
        start_node = AStarNode(sx, sy, g=0.0, h=self.heuristic(sx, sy, gx, gy, heuristic_mode))
        heapq.heappush(open_set, start_node)

        # Bảng theo dõi chi phí g tối ưu tới từng tọa độ
        g_scores: Dict[Tuple[int, int], float] = {(sx, sy): 0.0}
        closed_set: Set[Tuple[int, int]] = set()
        nodes_expanded = 0

        goal_node: Optional[AStarNode] = None

        while open_set:
            current = heapq.heappop(open_set)
            curr_pos = (current.x, current.y)

            if curr_pos == (gx, gy):
                goal_node = current
                break

            if curr_pos in closed_set:
                continue

            closed_set.add(curr_pos)
            nodes_expanded += 1

            for dx, dy, move_cost in neighbors:
                nx, ny = current.x + dx, current.y + dy

                # Kiểm tra ranh giới bản đồ
                if not (0 <= nx < self.width and 0 <= ny < self.height):
                    continue

                # Kiểm tra vật cản tĩnh hoặc động
                if self.grid[nx][ny] == 1 or (nx, ny) in dyn_obs_set:
                    continue

                # Cơ chế chống cắt góc (Corner Cutting Prevention) khi đi chéo
                if dx != 0 and dy != 0:
                    if self.grid[current.x + dx][current.y] == 1 or self.grid[current.x][current.y + dy] == 1:
                        continue

                tentative_g = current.g + move_cost

                if (nx, ny) not in g_scores or tentative_g < g_scores[(nx, ny)]:
                    g_scores[(nx, ny)] = tentative_g
                    h_val = self.heuristic(nx, ny, gx, gy, heuristic_mode)
                    neighbor_node = AStarNode(nx, ny, g=tentative_g, h=h_val, parent=current)
                    heapq.heappush(open_set, neighbor_node)

        t_end = time.perf_counter()
        exec_ms = (t_end - t_start) * 1000.0

        if goal_node is None:
            return [], 0.0, nodes_expanded, exec_ms

        # Truy vết ngược đường đi từ Goal -> Start
        path: List[Tuple[int, int]] = []
        curr: Optional[AStarNode] = goal_node
        while curr:
            path.append((curr.x, curr.y))
            curr = curr.parent

        path.reverse()
        return path, goal_node.g, nodes_expanded, exec_ms


# Instance singleton phục vụ toàn hệ thống
amr_planner = AStarPlanner(width=50, height=50)
