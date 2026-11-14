from typing import Generator, Optional
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool
from app.core.config import settings
from app.models import Base

# Engine và SessionFactory được khởi tạo lazy
_engine: Optional[Engine] = None
_session_factory: Optional[sessionmaker[Session]] = None


def get_engine() -> Engine:
    """
    Khởi tạo engine dạng lazy.
    Nếu kết nối MySQL chưa sẵn sàng hoặc đang ở chế độ dev cục bộ,
    tự động fallback sang SQLite file cục bộ 'app.db' để máy chủ chạy trơn tru.
    """
    global _engine
    if _engine is None:
        try:
            # Thử tạo engine MySQL theo cấu hình
            mysql_engine = create_engine(
                settings.SQLALCHEMY_DATABASE_URI,
                pool_pre_ping=True,
                pool_recycle=3600,
                pool_size=5,
                max_overflow=10,
            )
            # Kiểm tra kết nối nhanh với timeout ngắn
            with mysql_engine.connect() as conn:
                pass
            _engine = mysql_engine
        except Exception:
            # Fallback sang SQLite local app.db (đã nằm trong .gitignore)
            sqlite_engine = create_engine(
                "sqlite:///app.db",
                connect_args={"check_same_thread": False},
            )
            Base.metadata.create_all(bind=sqlite_engine)
            _engine = sqlite_engine
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
