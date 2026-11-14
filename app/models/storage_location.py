from sqlalchemy import Boolean, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base


class StorageLocation(Base):
    """Bảng 4.7: Thiết kế chi tiết cấu trúc bảng StorageLocations (Vị trí ô kệ kho).
    
    Ghi chú chuẩn hóa dữ liệu: Thuộc tính `is_full` được lưu trữ phục vụ truy vấn
    nhanh theo tài liệu thẩm định, mang giá trị logic suy ra từ (current_count >= capacity).
    """
    __tablename__ = "storage_locations"

    __table_args__ = (
        {
            "mysql_engine": "InnoDB",
            "mysql_charset": "utf8mb4",
            "mysql_collate": "utf8mb4_unicode_ci",
        },
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(20), nullable=False, unique=True)
    zone: Mapped[str] = mapped_column(String(20), nullable=False)
    capacity: Mapped[int] = mapped_column(Integer, nullable=False)
    current_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default=text("0"))
    is_full: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=text("0"))

    # Quan hệ với bảng packages
    packages = relationship("Package", back_populates="storage_location")

