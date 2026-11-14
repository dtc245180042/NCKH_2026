from sqlalchemy import CheckConstraint, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base


class SortingGate(Base):
    """Bảng 4.8: Thiết kế chi tiết cấu trúc bảng SortingGates (Cổng phân loại IoT)."""
    __tablename__ = "sorting_gates"

    __table_args__ = (
        CheckConstraint(
            "diverter_status IN ('IDLE', 'ACTIVE', 'ERROR')",
            name="diverter_status_valid",
        ),
        {
            "mysql_engine": "InnoDB",
            "mysql_charset": "utf8mb4",
            "mysql_collate": "utf8mb4_unicode_ci",
        },
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    gate_number: Mapped[int] = mapped_column(Integer, nullable=False, unique=True)
    target_province: Mapped[str] = mapped_column(String(50), nullable=False)
    diverter_status: Mapped[str] = mapped_column(String(20), nullable=False, default="IDLE", server_default=text("'IDLE'"))

    # Quan hệ với bảng packages
    packages = relationship("Package", back_populates="sorting_gate")

