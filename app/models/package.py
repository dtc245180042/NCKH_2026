"""
SQLAlchemy ORM Model: packages (Bảng 2 trong thiết kế CSDL 3NF)
Quản lý thông tin bưu kiện, mã bưu chính ảo, kích thước, tải trọng và trạng thái (UC-03)
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class Package(Base):
    __tablename__ = "packages"

    package_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    barcode = Column(String(64), unique=True, index=True, nullable=False)
    tracking_code = Column(String(64), index=True, nullable=True)
    weight = Column(Float, default=1.0, nullable=False)  # kg
    dimensions = Column(String(50), default="30x25x20", nullable=False)  # Dài x Rộng x Cao cm
    destination_zone = Column(String(50), nullable=False)  # Miền Bắc, Miền Trung, Miền Nam, Quốc Tế
    postal_code = Column(String(20), default="100000", nullable=False)

    # Trạng thái vòng đời kiện hàng:
    # 'RECEIVED' (Đã nhận Inbound) -> 'ON_CONVEYOR' -> 'SORTED' -> 'STORED' -> 'DISPATCHED' | 'ERROR'
    status = Column(String(30), default="RECEIVED", index=True, nullable=False)

    current_location_id = Column(Integer, ForeignKey("storage_locations.location_id"), index=True, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    storage_location = relationship("StorageLocation", back_populates="packages")
    tracking_sessions = relationship("TrackingSession", back_populates="package", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Package(id={self.package_id}, barcode='{self.barcode}', dest='{self.destination_zone}', status='{self.status}')>"

