"""
SQLAlchemy ORM Model: tracking_sessions (Bảng 5 trong thiết kế CSDL 3NF)
Nhật ký phiên truy vết AI đa đối tượng (YOLOv12n + ByteTrack Kalman 8D) (UC-04 & UC-05)
"""
from datetime import datetime
from sqlalchemy import Column, Integer, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class TrackingSession(Base):
    __tablename__ = "tracking_sessions"

    session_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    package_id = Column(Integer, ForeignKey("packages.package_id"), index=True, nullable=False)
    assigned_track_id = Column(Integer, index=True, nullable=False)  # ID do ByteTrack sinh ra
    confidence_score = Column(Float, default=0.95, nullable=False)  # Điểm tin cậy trung bình YOLO
    first_detected_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_seen_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    total_frames_tracked = Column(Integer, default=1, nullable=False)
    occlusion_events_count = Column(Integer, default=0, nullable=False)  # Số lần bị che khuất

    # Relationship
    package = relationship("Package", back_populates="tracking_sessions")

    def __repr__(self):
        return f"<TrackingSession(track_id={self.assigned_track_id}, pkg_id={self.package_id}, conf={self.confidence_score})>"

