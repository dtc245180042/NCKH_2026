from datetime import datetime
from typing import Optional
from sqlalchemy import DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base


class TrackingSession(Base):
    """Bảng 4.9: Thiết kế cấu trúc bảng TrackingSessions (Lưu vết phiên theo dõi)."""
    __tablename__ = "tracking_sessions"

    __table_args__ = (
        {
            "mysql_engine": "InnoDB",
            "mysql_charset": "utf8mb4",
            "mysql_collate": "utf8mb4_unicode_ci",
        },
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tracking_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    camera_id: Mapped[str] = mapped_column(String(20), nullable=False)
    start_time: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    end_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, default=None)

