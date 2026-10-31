import math
from typing import List, Tuple

class KalmanFilter8D:
    """
    Bộ lọc Kalman 8 chiều ước lượng chuyển động tuyến tính (LOG-111).
    Triển khai bằng thư viện chuẩn Python (Pure-Python) tối ưu hiệu năng cao,
    hoàn toàn độc lập, không phụ thuộc thư viện bên ngoài.
    Vector trạng thái: [cx, cy, a, h, vx, vy, va, vh]
    """
    def __init__(self):
        self.std_weight_position = 1.0 / 20
        self.std_weight_velocity = 1.0 / 160

    def initiate(self, measurement: List[float]) -> Tuple[List[float], List[List[float]]]:
        """measurement: [cx, cy, a, h]"""
        mean = [measurement[0], measurement[1], measurement[2], measurement[3], 0.0, 0.0, 0.0, 0.0]
        h = max(1.0, measurement[3])
        std = [
            2 * self.std_weight_position * h,
            2 * self.std_weight_position * h,
            1e-2,
            2 * self.std_weight_position * h,
            10 * self.std_weight_velocity * h,
            10 * self.std_weight_velocity * h,
            1e-5,
            10 * self.std_weight_velocity * h,
        ]
        cov = [[(std[i] ** 2 if i == j else 0.0) for j in range(8)] for i in range(8)]
        return mean, cov

    def predict(self, mean: List[float], cov: List[List[float]]) -> Tuple[List[float], List[List[float]]]:
        """x' = F * x; F cập nhật vị trí theo vận tốc: x += vx, y += vy"""
        new_mean = list(mean)
        new_mean[0] += mean[4]
        new_mean[1] += mean[5]
        new_mean[2] += mean[6]
        new_mean[3] += mean[7]

        # Cập nhật hiệp phương sai (thêm nhiễu hệ thống)
        new_cov = [row[:] for row in cov]
        h = max(1.0, mean[3])
        std_p = self.std_weight_position * h
        std_v = self.std_weight_velocity * h

        for i in range(4):
            new_cov[i][i] += (std_p ** 2)
            new_cov[i + 4][i + 4] += (std_v ** 2)

        return new_mean, new_cov

    def update(self, mean: List[float], cov: List[List[float]], measurement: List[float]) -> Tuple[List[float], List[List[float]]]:
        """Cập nhật ước lượng với đo đạc mới"""
        new_mean = list(mean)
        # Hệ số Kalman Gain rút gọn cho chuyển động thẳng đều
        alpha = 0.6  # Tỷ trọng giữa đo đạc và dự đoán
        for i in range(4):
            diff = measurement[i] - mean[i]
            new_mean[i] += alpha * diff
            new_mean[i + 4] = 0.8 * new_mean[i + 4] + 0.2 * diff

        new_cov = [row[:] for row in cov]
        for i in range(8):
            new_cov[i][i] *= (1.0 - alpha * 0.5)

        return new_mean, new_cov
