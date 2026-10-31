"""
SQLAlchemy ORM Model: system_logs (Bảng 6 trong thiết kế CSDL 3NF)
Nhật ký sự kiện điều phối thời gian thực SCADA & Audit trail (UC-13)
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class SystemLog(Base):
    __tablename__ = "system_logs"

    log_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    # Event Types: 'AUTH_LOGIN', 'INBOUND_RECEIVE', 'SORT_TRIGGER', 'AMR_DISPATCH', 'GATE_JAM', 'SYSTEM_INFO'
    event_type = Column(String(50), index=True, nullable=False)
    description = Column(Text, nullable=False)
    user_id = Column(Integer, ForeignKey("users.user_id"), index=True, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True, nullable=False)

    # Relationship
    user = relationship("User", back_populates="logs")

    def __repr__(self):
        return f"<SystemLog(id={self.log_id}, type='{self.event_type}', time='{self.created_at}')>"

