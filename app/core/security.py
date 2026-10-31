"""
Security module: Password hashing (bcrypt), JWT Token handling, and Password Strength Validation.
Tuân thủ tiêu chuẩn an toàn thông tin và kiểm toán mã nguồn (LOG-124).
"""
from datetime import datetime, timedelta
from typing import Any, Union, Optional, Tuple
import hashlib
import hmac
import re
from app.core.config import settings

# Danh sách đen các mật khẩu mặc định/quá yếu bị cấm tuyệt đối
WEAK_PASSWORD_BLACKLIST = {
    "123456",
    "12345678",
    "123456789",
    "password",
    "admin",
    "admin123",
    "admin@123",
    "operator123",
    "viewer123",
    "qwerty",
    "letmein",
    "welcome",
    "root",
    "guest"
}

# Thử import passlib và jose, nếu chưa cài đặt thì fallback an toàn dùng SHA256 HMAC
try:
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    HAS_PASSLIB = True
except ImportError:
    pwd_context = None
    HAS_PASSLIB = False

try:
    from jose import jwt, JWTError
    HAS_JOSE = True
except ImportError:
    HAS_JOSE = False


def validate_password_strength(password: str) -> Tuple[bool, str]:
    """
    Thẩm định độ mạnh của mật khẩu theo chuẩn bảo mật:
    - Độ dài tối thiểu 8 ký tự
    - Bắt buộc chứa chữ hoa, chữ thường, chữ số
    - Chứa ít nhất một ký tự đặc biệt (@$!%*?&#...)
    - Tuyệt đối không trùng với danh sách mật khẩu yếu/mặc định phổ biến
    """
    if not password:
        return False, "Mật khẩu không được để trống."

    if len(password) < 8:
        return False, f"Mật khẩu quá ngắn ({len(password)} ký tự). Yêu cầu độ dài tối thiểu 8 ký tự."

    if password.lower() in WEAK_PASSWORD_BLACKLIST:
        return False, "Mật khẩu quá phổ biến hoặc thuộc danh sách mật khẩu yếu mặc định bị cấm."

    has_upper = any(c.isupper() for c in password)
    has_lower = any(c.islower() for c in password)
    has_digit = any(c.isdigit() for c in password)
    has_special = bool(re.search(r"[!@#$%^&*(),.?\":{}|<>\-_=+[\]/\\]", password))

    if not has_lower:
        return False, "Mật khẩu phải chứa ít nhất 1 chữ cái viết thường (a-z)."

    if not has_upper:
        return False, "Mật khẩu phải chứa ít nhất 1 chữ cái viết hoa (A-Z)."

    if not has_digit:
        return False, "Mật khẩu phải chứa ít nhất 1 chữ số (0-9)."

    if not has_special:
        return False, "Mật khẩu phải chứa ít nhất 1 ký tự đặc biệt (!@#$%^&*...)."

    return True, "Mật khẩu đạt tiêu chuẩn an toàn mạnh."


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Xác thực mật khẩu plain-text với chuỗi băm"""
    if HAS_PASSLIB and pwd_context and hashed_password.startswith("$2"):
        try:
            return pwd_context.verify(plain_password, hashed_password)
        except Exception:
            pass

    # Fallback SHA256 HMAC an toàn
    computed = hmac.new(
        settings.SECRET_KEY.encode(),
        plain_password.encode(),
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(computed, hashed_password.replace("sha256$", ""))


def get_password_hash(password: str) -> str:
    """Tạo chuỗi băm mật khẩu bảo mật (bcrypt hoặc HMAC-SHA256)"""
    if HAS_PASSLIB and pwd_context:
        try:
            return pwd_context.hash(password)
        except Exception:
            pass

    # Fallback SHA256 HMAC
    computed = hmac.new(
        settings.SECRET_KEY.encode(),
        password.encode(),
        hashlib.sha256
    ).hexdigest()
    return f"sha256${computed}"


def create_access_token(subject: Union[str, Any], role: str = "OPERATOR", expires_delta: Optional[timedelta] = None) -> str:
    """Sinh JWT Access Token mang thông tin user_id và role RBAC"""
    now = datetime.utcnow()
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode = {
        "exp": expire,
        "sub": str(subject),
        "role": role,
        "iat": now
    }

    if HAS_JOSE:
        return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    else:
        # Fallback token encoder đơn giản dạng signed header.payload.sig
        import base64
        import json
        payload_bytes = json.dumps(to_encode, default=str).encode()
        payload_b64 = base64.urlsafe_b64encode(payload_bytes).decode().rstrip("=")
        header_b64 = base64.urlsafe_b64encode(b'{"alg":"HS256","typ":"JWT"}').decode().rstrip("=")
        msg = f"{header_b64}.{payload_b64}".encode()
        sig = hmac.new(settings.SECRET_KEY.encode(), msg, hashlib.sha256).digest()
        sig_b64 = base64.urlsafe_b64encode(sig).decode().rstrip("=")
        return f"{header_b64}.{payload_b64}.{sig_b64}"


def decode_access_token(token: str) -> Optional[dict]:
    """Giải mã và kiểm tra tính hợp lệ của JWT token"""
    if HAS_JOSE:
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            return payload
        except Exception:
            return None
    else:
        # Fallback decode
        import base64
        import json
        try:
            parts = token.split(".")
            if len(parts) != 3:
                return None
            header_b64, payload_b64, sig_b64 = parts
            msg = f"{header_b64}.{payload_b64}".encode()
            expected_sig = hmac.new(settings.SECRET_KEY.encode(), msg, hashlib.sha256).digest()
            # Padding
            rem = len(sig_b64) % 4
            sig_padded = sig_b64 + ("=" * (4 - rem) if rem else "")
            actual_sig = base64.urlsafe_b64decode(sig_padded.encode())
            if not hmac.compare_digest(expected_sig, actual_sig):
                return None
            rem_p = len(payload_b64) % 4
            p_padded = payload_b64 + ("=" * (4 - rem_p) if rem_p else "")
            payload = json.loads(base64.urlsafe_b64decode(p_padded.encode()).decode())
            return payload
        except Exception:
            return None
