from sqlalchemy import Boolean, CheckConstraint, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base


class User(Base):
    """Bảng 4.5: Thiết kế chi tiết cấu trúc bảng Users (Người dùng hệ thống)."""
    __tablename__ = "users"

    __table_args__ = (
        CheckConstraint(
            "role IN ('Admin', 'Manager', 'Operator')",
            name="role_valid",
        ),
        {
            "mysql_engine": "InnoDB",
            "mysql_charset": "utf8mb4",
            "mysql_collate": "utf8mb4_unicode_ci",
        },
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(100), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default=text("1"))

    # Quan hệ với bảng system_logs
    system_logs = relationship("SystemLog", back_populates="user")

