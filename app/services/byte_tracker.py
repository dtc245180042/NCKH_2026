from typing import List, Tuple
from app.services.kalman_filter import KalmanFilter8D

class TrackState:
    New = 0
    Tracked = 1
    Lost = 2
    Removed = 3

class STrack:
    shared_kalman = KalmanFilter8D()
    _count = 0

    def __init__(self, tlwh: List[float], score: float):
        # tlwh: [x1, y1, width, height]
        self._tlwh = [float(v) for v in tlwh]
        self.score = float(score)
        self.kalman_filter = self.shared_kalman
        self.mean = None
        self.covariance = None
        self.is_activated = False

        self.track_id = 0
        self.state = TrackState.New
        self.frame_id = 0
        self.tracklet_len = 0

    @classmethod
    def next_id(cls) -> int:
        cls._count += 1
        return cls._count

    @property
    def tlwh(self) -> List[float]:
        if self.mean is None:
            return list(self._tlwh)
        cx, cy, a, h = self.mean[0], self.mean[1], self.mean[2], self.mean[3]
        w = a * h
        return [cx - w / 2, cy - h / 2, w, h]

    def activate(self, frame_id: int):
        self.track_id = self.next_id()
        cx = self._tlwh[0] + self._tlwh[2] / 2
        cy = self._tlwh[1] + self._tlwh[3] / 2
        a = self._tlwh[2] / max(1.0, self._tlwh[3])
        h = self._tlwh[3]

        self.mean, self.covariance = self.kalman_filter.initiate([cx, cy, a, h])
        self.state = TrackState.Tracked
        self.is_activated = True
        self.frame_id = frame_id

    def predict(self):
        if self.mean is not None:
            self.mean, self.covariance = self.kalman_filter.predict(self.mean, self.covariance)

    def update(self, new_track: 'STrack', frame_id: int):
        self.frame_id = frame_id
        self.tracklet_len += 1
        new_tlwh = new_track.tlwh
        cx = new_tlwh[0] + new_tlwh[2] / 2
        cy = new_tlwh[1] + new_tlwh[3] / 2
        a = new_tlwh[2] / max(1.0, new_tlwh[3])
        h = new_tlwh[3]

        self.mean, self.covariance = self.kalman_filter.update(self.mean, self.covariance, [cx, cy, a, h])
        self.state = TrackState.Tracked
        self.is_activated = True
        self.score = new_track.score

    def mark_lost(self):
        self.state = TrackState.Lost

    def mark_removed(self):
        self.state = TrackState.Removed


def compute_iou(box1: List[float], box2: List[float]) -> float:
    """Tính Intersection over Union giữa 2 bounding box [x, y, w, h]"""
    x1 = max(box1[0], box2[0])
    y1 = max(box1[1], box2[1])
    x2 = min(box1[0] + box1[2], box2[0] + box2[2])
    y2 = min(box1[1] + box1[3], box2[1] + box2[3])

    inter_w = max(0.0, x2 - x1)
    inter_h = max(0.0, y2 - y1)
    inter_area = inter_w * inter_h

    area1 = box1[2] * box1[3]
    area2 = box2[2] * box2[3]
    union_area = area1 + area2 - inter_area

    if union_area <= 0:
        return 0.0
    return inter_area / union_area


class ByteTracker:
    """
    ByteTrack giải thuật ghép đôi 2 giai đoạn (LOG-112).
    """
    def __init__(self, track_thresh: float = 0.6, match_thresh: float = 0.8, max_time_lost: int = 30):
        self.track_thresh = track_thresh
        self.match_thresh = match_thresh
        self.max_time_lost = max_time_lost
        self.tracked_stracks: List[STrack] = []
        self.lost_stracks: List[STrack] = []
        self.frame_id = 0

    def update(self, output_results: List[List[float]]) -> List[STrack]:
        """
        output_results: Danh sách [x1, y1, w, h, score]
        """
        self.frame_id += 1
        activated_stracks = []

        dets_high: List[STrack] = []
        dets_low: List[STrack] = []

        for det in output_results:
            score = det[4]
            box = det[:4]
            if score >= self.track_thresh:
                dets_high.append(STrack(box, score))
            elif score >= 0.1:
                dets_low.append(STrack(box, score))

        # Dự đoán bước tiếp theo cho các track hiện tại
        for t in self.tracked_stracks:
            t.predict()
        for t in self.lost_stracks:
            t.predict()

        # ==========================================================
        # GIAI ĐOẠN 1: Ghép đôi High Score Detections
        # ==========================================================
        matched_tracks = set()
        matched_dets = set()

        for t_idx, track in enumerate(self.tracked_stracks):
            best_iou = 0.0
            best_d_idx = -1
            for d_idx, det in enumerate(dets_high):
                if d_idx in matched_dets:
                    continue
                iou = compute_iou(track.tlwh, det.tlwh)
                if iou > best_iou:
                    best_iou = iou
                    best_d_idx = d_idx

            if best_iou >= (1.0 - self.match_thresh) and best_d_idx >= 0:
                track.update(dets_high[best_d_idx], self.frame_id)
                matched_tracks.add(t_idx)
                matched_dets.add(best_d_idx)

        unmatched_tracks = [t for i, t in enumerate(self.tracked_stracks) if i not in matched_tracks]
        unmatched_dets = [d for i, d in enumerate(dets_high) if i not in matched_dets]

        # ==========================================================
        # GIAI ĐOẠN 2: Ghép đôi Low Score Detections (Xử lý che khuất)
        # ==========================================================
        matched_tracks_second = set()
        matched_dets_low = set()

        for t_idx, track in enumerate(unmatched_tracks):
            best_iou = 0.0
            best_d_idx = -1
            for d_idx, det in enumerate(dets_low):
                if d_idx in matched_dets_low:
                    continue
                iou = compute_iou(track.tlwh, det.tlwh)
                if iou > best_iou:
                    best_iou = iou
                    best_d_idx = d_idx

            # Ngưỡng nới lỏng cho low-score nhưng vẫn đảm bảo tính tương đồng vị trí
            if best_iou >= 0.3 and best_d_idx >= 0:
                track.update(dets_low[best_d_idx], self.frame_id)
                matched_tracks_second.add(t_idx)
                matched_dets_low.add(best_d_idx)

        for i, t in enumerate(unmatched_tracks):
            if i not in matched_tracks_second:
                t.mark_lost()
                self.lost_stracks.append(t)

        # Kích hoạt detections mới
        for d in unmatched_dets:
            d.activate(self.frame_id)
            activated_stracks.append(d)

        self.tracked_stracks = [t for t in self.tracked_stracks if t.state == TrackState.Tracked] + activated_stracks
        self.lost_stracks = [t for t in self.lost_stracks if (self.frame_id - t.frame_id) <= self.max_time_lost]

        return [t for t in self.tracked_stracks if t.is_activated]
