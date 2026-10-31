"""
SQLAlchemy ORM Model: storage_locations (Bảng 3 trong thiết kế CSDL 3NF)
Quản lý vị trí ô kệ lưu kho bãi, tọa độ lưới Occupancy Grid và tải trọng (UC-10)
"""
from sqlalchemy import Column, Integer, String, Float, Boolean
from sqlalchemy.orm import relationship
from app.core.database import Base


class StorageLocation(Base):
    __tablename__ = "storage_locations"

    location_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    location_code = Column(String(30), unique=True, index=True, nullable=False)  # VD: RACK-A-01-02
    zone = Column(String(20), nullable=False)  # A (Bắc), B (Nam), C (Lưu chuyển)
    grid_x = Column(Integer, nullable=False)  # Tọa độ X trên lưới mặt bằng
    grid_y = Column(Integer, nullable=False)  # Tọa độ Y trên lưới mặt bằng
    capacity_weight = Column(Float, default=100.0, nullable=False)  # kg
    is_occupied = Column(Boolean, default=False, nullable=False)

    # Quan hệ với kiện hàng lưu giữ tại ô kệ này
    packages = relationship("Package", back_populates="storage_location")

    def __repr__(self):
        return f"<StorageLocation(code='{self.location_code}', zone='{self.zone}', occupied={self.is_occupied})>"

