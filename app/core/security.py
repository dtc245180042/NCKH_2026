import bcrypt
import jwt
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from app.core.config import settings

# Dummy hash cố định để chạy checkpw khi username không tồn tại (timing-attack resistance)
DUMMY_BCRYPT_HASH = "$2b$12$e8Y.oJjYwIqB.dG6L0J44uVvXQYvP061xO5Pq9Z/6oZ4a1Z6b0/02"


def validate_password_rules(password: str) -> None:
    """
    Quy tắc mật khẩu dùng chung:
    - Độ dài tối thiểu 8 ký tự
    - Giới hạn tối đa 72 bytes theo chuẩn Bcrypt
    Ném ValueError nếu không thỏa mãn.
    """
    if len(password) < 8:
        raise ValueError("Mật khẩu phải có độ dài tối thiểu 8 ký tự.")
    
    encoded = password.encode("utf-8")
    if len(encoded) > 72:
        raise ValueError("Mật khẩu không được vượt quá 72 byte (theo giới hạn chuẩn của Bcrypt).")


def get_password_hash(password: str) -> str:
    """
    Băm mật khẩu trực tiếp bằng bcrypt.
    """
    validate_password_rules(password)
    password_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password_bytes, salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Kiểm tra mật khẩu khớp với hash.
    Nếu mật khẩu đầu vào > 72 bytes, bcrypt 5.x ném ValueError -> bắt và trả về False an toàn.
    """
    try:
        plain_bytes = plain_password.encode("utf-8")
        if len(plain_bytes) > 72:
            return False
        return bcrypt.checkpw(plain_bytes, hashed_password.encode("utf-8"))
    except ValueError:
        return False


def verify_dummy_password(plain_password: str) -> bool:
    """
    Chạy checkpw giả định khi username không tồn tại để cân bằng thời gian phản hồi CPU.
    """
    try:
        plain_bytes = plain_password.encode("utf-8")
        if len(plain_bytes) > 72:
            plain_bytes = plain_bytes[:72]
        bcrypt.checkpw(plain_bytes, DUMMY_BCRYPT_HASH.encode("utf-8"))
    except Exception:
        pass
    return False


def create_access_token(subject: str | int, role: str, expires_delta: Optional[timedelta] = None) -> str:
    """
    Tạo JWT token cố định thuật toán HS256, claims exp, iat, sub, role.
    """
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    payload: dict[str, Any] = {
        "sub": str(subject),
        "role": role,
        "iat": now,
        "exp": expire,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")


def decode_access_token(token: str) -> dict[str, Any]:
    """
    Giải mã JWT token với thuật toán bắt buộc HS256, kiểm tra exp và sub.
    Ném jwt.PyJWTError nếu token không hợp lệ hoặc hết hạn.
    """
    payload = jwt.decode(
        token,
        settings.SECRET_KEY,
        algorithms=["HS256"],
        options={"require": ["exp", "sub"]},
    )
    return payload

