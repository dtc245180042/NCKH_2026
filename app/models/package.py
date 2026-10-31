from typing import Optional
from sqlalchemy import CheckConstraint, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base


class Package(Base):
    """Bảng 4.6: Thiết kế chi tiết cấu trúc bảng Packages (Kiện hàng lưu thông)."""
    __tablename__ = "packages"

    __table_args__ = (
        CheckConstraint(
            "status IN ('Created', 'On_Belt', 'Stored', 'Dispatched')",
            name="status_valid",
        ),
        {
            "mysql_engine": "InnoDB",
            "mysql_charset": "utf8mb4",
            "mysql_collate": "utf8mb4_unicode_ci",
        },
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    barcode: Mapped[str] = mapped_column(String(32), nullable=False, unique=True)
    weight: Mapped[float] = mapped_column(Float, nullable=False)
    dimensions: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    destination_code: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False)
    tracking_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, index=True)
    location_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("storage_locations.id", ondelete="RESTRICT"), nullable=True, index=True
    )
    gate_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("sorting_gates.id", ondelete="RESTRICT"), nullable=True, index=True
    )

    # Relationships
    storage_location = relationship("StorageLocation", back_populates="packages")
    sorting_gate = relationship("SortingGate", back_populates="packages")

