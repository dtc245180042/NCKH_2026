import json
import logging
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import get_password_hash
from app.models.system_log import SystemLog
from app.models.user import User

logger = logging.getLogger(__name__)


def init_initial_admin(db: Session) -> User:
    """
    Hàm khởi tạo tài khoản Admin ban đầu:
    - Chỉ chạy thủ công khi có lệnh cho phép.
    - Đọc INITIAL_ADMIN_USERNAME, INITIAL_ADMIN_PASSWORD, INITIAL_ADMIN_FULL_NAME từ cấu hình.
    - Nếu đã tồn tại username thì giữ nguyên, không ghi đè mật khẩu.
    - Ghi nhận vào system_logs.
    """
    admin_username = settings.INITIAL_ADMIN_USERNAME
    stmt = select(User).where(User.username == admin_username)
    existing_user = db.execute(stmt).scalar_one_or_none()

    if existing_user:
        logger.info(f"Tài khoản Admin '{admin_username}' đã tồn tại trong CSDL. Giữ nguyên.")
        return existing_user

    admin_password = settings.INITIAL_ADMIN_PASSWORD
    admin_full_name = getattr(settings, "INITIAL_ADMIN_FULL_NAME", "System Administrator")

    admin = User(
        username=admin_username,
        password_hash=get_password_hash(admin_password),
        full_name=admin_full_name,
        role="Admin",
        is_active=True,
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)

    log = SystemLog(
        user_id=admin.id,
        action="INITIAL_ADMIN_SEED",
        details=json.dumps({"username": admin.username, "role": "Admin", "seeded": True}),
    )
    db.add(log)
    db.commit()

    logger.info(f"Đã tạo thành công tài khoản Admin ban đầu: {admin.username}")
    return admin

