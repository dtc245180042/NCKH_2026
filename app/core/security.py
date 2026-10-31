"""
Security module: Password hashing (bcrypt) and JWT Token handling.
"""
from datetime import datetime, timedelta
from typing import Any, Union, Optional
import hashlib
import hmac
from app.core.config import settings

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
    """Tạo chuỗi băm mật khẩu bảo mật"""
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
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode = {
        "exp": expire,
        "sub": str(subject),
        "role": role,
        "iat": datetime.utcnow()
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
