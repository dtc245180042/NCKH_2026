---
name: amr-pathfinding-a-star
description: Thuật toán tìm đường tối ưu A* (A-star) trên bản đồ lưới 2D cho robot tự hành AMR trong nhà kho thông minh, bao gồm hàm heuristic Manhattan/Chebyshev và cơ chế tránh va chạm động.
---

# AMR Pathfinding with A* Skill — AI Smart Logistics

## 1. MỤC TIÊU
Lập lịch đường đi ngắn nhất, an toàn và tối ưu thời gian tính toán cho xe tự hành AMR di chuyển lấy pallet và vận chuyển về các dãy kệ hàng.

## 2. NGUYÊN LÝ THUẬT TOÁN A*
Hàm đánh giá chi phí tổng thể tại nút $n$:
$$f(n) = g(n) + h(n)$$
Trong đó:
- $g(n)$: Chi phí thực tế đã đi từ điểm xuất phát (Start) đến nút hiện tại $n$.
- $h(n)$: Chi phí ước lượng heuristic từ nút $n$ đến điểm đích (Goal).

### Lựa chọn hàm Heuristic:
- **Di chuyển 4 hướng (Lên, Xuống, Trái, Phải):** Sử dụng khoảng cách Manhattan:
  $$h_1(n) = |x_n - x_{goal}| + |y_n - y_{goal}|$$
- **Di chuyển 8 hướng (kèm đường chéo):** Sử dụng khoảng cách Chebyshev hoặc Octile:
  $$h_\infty(n) = \max(|x_n - x_{goal}|, |y_n - y_{goal}|)$$

## 3. CƠ CHẾ TRÁNH VA CHẠM ĐỘNG (LOCAL RE-PLANNING)
Khi robot AMR đang di chuyển theo lộ trình màu xanh đã định sẵn và gặp vật cản bất ngờ (người đi bộ hoặc AMR khác):
1. **Dừng an toàn (Safety Stop):** Robot kích hoạt phanh an toàn ngay khi cảm biến khoảng cách báo vật cản $< 1.5$ mét.
2. **Chờ giải phóng vật cản:** Nếu sau 2 giây vật cản rời đi, robot tiếp tục hành trình cũ.
3. **Tái lập lịch đường đi (Local Re-planning):** Nếu vật cản tĩnh quá 3 giây, nút chứa vật cản được đánh dấu là không thể đi qua (`grid[x][y] = 1`), thuật toán A* được gọi lại với điểm xuất phát là tọa độ hiện tại của robot để tìm đường vòng tránh tối ưu.

## 4. CHECKLIST THUẬT TOÁN A*
- [ ] Thời gian tính toán lộ trình trên lưới $50 \times 50$ phải $\le 10$ ms.
- [ ] Không để xảy ra hiện tượng "cắt góc" (Corner Cutting) khi robot đi chéo qua góc tường nhọn.
- [ ] Lộ trình sinh ra phải trơn tru, hiển thị trực quan trên giao diện Canvas 2D.

