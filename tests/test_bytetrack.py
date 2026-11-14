import math
import pytest
from app.services.kalman_filter import KalmanFilter8D
from app.services.byte_tracker import ByteTracker, STrack

def test_kalman_filter_8d_predict_and_update():
    """Kiểm tra bộ lọc Kalman 8 chiều dự đoán chuyển động tuyến tính (LOG-111)"""
    kf = KalmanFilter8D()
    measurement = [100.0, 100.0, 1.2, 50.0]  # [cx, cy, a, h]
    mean, cov = kf.initiate(measurement)

    assert len(mean) == 8
    assert len(cov) == 8 and len(cov[0]) == 8
    assert math.isclose(mean[0], 100.0, rel_tol=1e-5)

    # Dự đoán bước tiếp theo
    pred_mean, pred_cov = kf.predict(mean, cov)
    assert len(pred_mean) == 8

    # Cập nhật với đo đạc mới (bưu kiện dịch chuyển sang phải 10px)
    new_meas = [110.0, 100.0, 1.2, 50.0]
    updated_mean, updated_cov = kf.update(pred_mean, pred_cov, new_meas)
    assert updated_mean[0] > 100.0


def test_bytetrack_two_stage_matching_and_occlusion():
    """
    Kiểm tra thuật toán ByteTrack ghép đôi 2 giai đoạn (LOG-112):
    - Frame 1: Bưu kiện xuất hiện với độ tin cậy cao (0.95) -> Sinh Track ID mới.
    - Frame 2: Bưu kiện bị che khuất một phần, conf giảm xuống mức thấp (0.35) -> Ghép đôi Giai đoạn 2 thành công và GIỮ NGUYÊN Track ID.
    - Không phát sinh hiện tượng ID Switch.
    """
    tracker = ByteTracker(track_thresh=0.6)

    # Frame 1: Phát hiện rõ nét [x1, y1, w, h, conf]
    f1_detections = [[50.0, 150.0, 40.0, 40.0, 0.95]]
    tracks_f1 = tracker.update(f1_detections)
    assert len(tracks_f1) == 1
    track_id_initial = tracks_f1[0].track_id

    # Frame 2: Bưu kiện di chuyển sang x=60 nhưng bị bóng mờ/che khuất (conf = 0.35 - mức thấp)
    f2_detections = [[60.0, 150.0, 40.0, 40.0, 0.35]]
    tracks_f2 = tracker.update(f2_detections)
    assert len(tracks_f2) == 1
    # Bắt buộc phải duy trì ID ban đầu qua cơ chế Giai đoạn 2 (Low-score matching)
    assert tracks_f2[0].track_id == track_id_initial, "Lỗi ID Switch: Bị đổi ID khi bưu kiện bị che khuất!"
