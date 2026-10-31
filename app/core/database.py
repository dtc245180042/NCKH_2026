from typing import Generator, Optional
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker
from app.core.config import settings

# Engine và SessionFactory được khởi tạo lazy để không kích hoạt kết nối CSDL khi import module
_engine: Optional[Engine] = None
_session_factory: Optional[sessionmaker[Session]] = None


def get_engine() -> Engine:
    """Khởi tạo engine dạng lazy: chỉ kết nối khi thực sự cần dùng lần đầu."""
    global _engine
    if _engine is None:
        _engine = create_engine(
            settings.SQLALCHEMY_DATABASE_URI,
            pool_pre_ping=True,   # Tự động kiểm tra tính sống còn của kết nối trước khi dùng
            pool_recycle=3600,    # Tái tạo kết nối sau 1 giờ tránh timeout của MySQL
            pool_size=5,
            max_overflow=10,
        )
    return _engine


def get_session_factory() -> sessionmaker[Session]:
    """Khởi tạo session factory dạng lazy liên kết với engine."""
    global _session_factory
    if _session_factory is None:
        _session_factory = sessionmaker(
            autocommit=False,
            autoflush=False,
            bind=get_engine(),
        )
    return _session_factory


def get_db() -> Generator[Session, None, None]:
    """FastAPI Dependency cung cấp Database Session cho từng request."""
    session_factory = get_session_factory()
    db = session_factory()
    try:
        yield db
    finally:
        db.close()

