"""
SQLAlchemy ORM Model: sorting_gates (Bảng 4 trong thiết kế CSDL 3NF)
Quản lý danh mục cổng phân loại IoT, tọa độ kích hoạt trên băng tải và góc mở (UC-07)
"""
from sqlalchemy import Column, Integer, String, Float
from app.core.database import Base


class SortingGate(Base):
    __tablename__ = "sorting_gates"

    gate_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    gate_number = Column(Integer, unique=True, index=True, nullable=False)  # Cổng 1, 2, 3, 4
    target_zone = Column(String(50), nullable=False)  # Miền Bắc, Miền Trung, Miền Nam, Quốc Tế
    postal_code_prefix = Column(String(20), nullable=False)  # 100000, 550000, 700000, 999000
    conveyor_position_x = Column(Float, nullable=False)  # Tọa độ kích hoạt trên băng tải (pixel)
    divert_direction = Column(Integer, default=1, nullable=False)  # 1: rẽ dưới, -1: rẽ trên, 0: thẳng

    # Trạng thái cổng: 'IDLE', 'DEFLECTING', 'JAMMED', 'MAINTENANCE'
    status = Column(String(20), default="IDLE", nullable=False)
    total_diverted_count = Column(Integer, default=0, nullable=False)

    def __repr__(self):
        return f"<SortingGate(gate_number={self.gate_number}, target='{self.target_zone}', status='{self.status}')>"
