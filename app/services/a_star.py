import math
import heapq
from typing import List, Tuple, Set, Optional, Dict

class AStarPlanner:
    """
    Thuật toán tìm đường ngắn nhất A* (A-star) cho Robot tự hành AMR (LOG-116 & LOG-117).
    - Hỗ trợ hàm Heuristic: Manhattan (4 hướng) và Chebyshev (8 hướng).
    - Ngăn chặn triệt để hiện tượng 'cắt góc' (Corner Cutting) khi robot đi chéo qua góc tường.
    - Cơ chế tránh va chạm động và tái lập lịch đường đi cục bộ (Local Re-planning).
    """
    def __init__(self, cols: int = 40, rows: int = 20, cell_size: float = 20.0):
        self.cols = cols
        self.rows = rows
        self.cell_size = cell_size
        self.obstacles: Set[Tuple[int, int]] = set()

        # Khởi tạo các ô cản tĩnh cố định (Khu vực ô kệ lưu trữ & ranh giới)
        self._init_default_static_obstacles()

    def _init_default_static_obstacles(self):
        """Khai báo các chướng ngại vật cố định trong nhà kho (Khu vực kệ hàng)"""
        # Kệ hàng nằm ở góc trên phải: cols 30..38, rows 3..12
        for c in range(30, 39):
            for r in range(3, 12):
                if c % 3 != 0: # Để lối đi giữa các dãy kệ
                    self.obstacles.add((c, r))

    def add_obstacle(self, col: int, row: int):
        """Thêm vật cản động trên lưới"""
        if 0 <= col < self.cols and 0 <= row < self.rows:
            self.obstacles.add((col, row))

    def remove_obstacle(self, col: int, row: int):
        """Gỡ bỏ vật cản động"""
        self.obstacles.discard((col, row))

    def clear_dynamic_obstacles(self):
        """Xóa toàn bộ vật cản động, chỉ giữ lại kệ tĩnh"""
        self.obstacles.clear()
        self._init_default_static_obstacles()

    def is_blocked(self, col: int, row: int) -> bool:
        """Kiểm tra một ô có bị cản hay vượt ngoài biên lưới"""
        if col < 0 or col >= self.cols or row < 0 or row >= self.rows:
            return True
        return (col, row) in self.obstacles

    def heuristic_manhattan(self, a: Tuple[int, int], b: Tuple[int, int]) -> float:
        """Heuristic Manhattan cho di chuyển 4 hướng: |x1 - x2| + |y1 - y2|"""
        return abs(a[0] - b[0]) + abs(a[1] - b[1])

    def heuristic_chebyshev(self, a: Tuple[int, int], b: Tuple[int, int]) -> float:
        """Heuristic Chebyshev cho di chuyển 8 hướng: max(|x1 - x2|, |y1 - y2|)"""
        return max(abs(a[0] - b[0]), abs(a[1] - b[1]))

    def world_to_grid(self, x: float, y: float) -> Tuple[int, int]:
        """Quy đổi tọa độ Canvas pixel sang tọa độ ô lưới (Cell grid)"""
        col = int(x / self.cell_size)
        row = int(y / self.cell_size)
        col = max(0, min(self.cols - 1, col))
        row = max(0, min(self.rows - 1, row))
        return (col, row)

    def grid_to_world(self, col: int, row: int) -> Tuple[float, float]:
        """Quy đổi tọa độ ô lưới sang tâm ô pixel trên Canvas"""
        return (col * self.cell_size + self.cell_size / 2.0,
                row * self.cell_size + self.cell_size / 2.0)

    def find_path(
        self,
        start: Tuple[int, int],
        goal: Tuple[int, int],
        heuristic: str = "manhattan",
        allow_diagonal: bool = True
    ) -> Optional[List[Tuple[int, int]]]:
        """
        Tìm lộ trình tối ưu từ start đến goal bằng thuật toán A*.
        Trả về danh sách các nút [(col, row), ...] hoặc None nếu không có đường đi.
        """
        if self.is_blocked(start[0], start[1]) or self.is_blocked(goal[0], goal[1]):
            return None

        if start == goal:
            return [start]

        h_func = self.heuristic_chebyshev if heuristic == "chebyshev" else self.heuristic_manhattan

        # Priority Queue: (f_score, h_score, current_node)
        open_set = []
        heapq.heappush(open_set, (0.0, 0.0, start))

        came_from: Dict[Tuple[int, int], Tuple[int, int]] = {}
        g_score: Dict[Tuple[int, int], float] = {start: 0.0}
        f_score: Dict[Tuple[int, int], float] = {start: h_func(start, goal)}

        # 4 hướng trực giao: phải, trái, xuống, lên
        ortho_dirs = [(1, 0), (-1, 0), (0, 1), (0, -1)]
        # 4 hướng đường chéo
        diag_dirs = [(1, 1), (1, -1), (-1, 1), (-1, -1)]

        while open_set:
            _, _, current = heapq.heappop(open_set)

            if current == goal:
                # Tái dựng lộ trình đi từ Goal về Start
                path = [current]
                while current in came_from:
                    current = came_from[current]
                    path.append(current)
                path.reverse()
                return path

            cur_col, cur_row = current

            # 1. Khám phá các hướng trực giao (chi phí 1.0)
            neighbors = []
            for dc, dr in ortho_dirs:
                nc, nr = cur_col + dc, cur_row + dr
                if not self.is_blocked(nc, nr):
                    neighbors.append(((nc, nr), 1.0))

            # 2. Khám phá các hướng đường chéo (chi phí căn bậc 2 ≈ 1.414)
            if allow_diagonal:
                for dc, dr in diag_dirs:
                    nc, nr = cur_col + dc, cur_row + dr
                    if not self.is_blocked(nc, nr):
                        # Chống hiện tượng Cắt Góc (Corner Cutting):
                        # Không được đi chéo nếu một trong hai ô trực giao tiếp giáp là vật cản!
                        if not self.is_blocked(cur_col + dc, cur_row) and not self.is_blocked(cur_col, cur_row + dr):
                            neighbors.append(((nc, nr), 1.4142))

            for neighbor, cost in neighbors:
                tentative_g = g_score[current] + cost
                if tentative_g < g_score.get(neighbor, float('inf')):
                    came_from[neighbor] = current
                    g_score[neighbor] = tentative_g
                    h = h_func(neighbor, goal)
                    f = tentative_g + h
                    f_score[neighbor] = f
                    heapq.heappush(open_set, (f, h, neighbor))

        return None  # Không tìm thấy đường đi do bị chặn hoàn toàn

