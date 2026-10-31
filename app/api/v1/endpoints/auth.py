import json
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user
from app.core.database import get_db
from app.core.security import (
    create_access_token,
    verify_dummy_password,
    verify_password,
)
from app.models.system_log import SystemLog
from app.models.user import User
from app.schemas.auth import LoginRequest, Token
from app.schemas.user import UserResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=Token)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    """
    Đăng nhập hệ thống:
    - Chống dò quét (User Enumeration & Timing Attack): trả về cùng 401 cho mọi sai lệch.
    - Chạy checkpw giả định khi không tìm thấy username.
    - Chỉ kiểm tra trạng thái is_active sau khi mật khẩu đã đúng.
    - Ghi nhận nhật ký truy cập vào system_logs (không lưu mật khẩu).
    """
    stmt = select(User).where(User.username == request.username)
    user = db.execute(stmt).scalar_one_or_none()

    if user is None:
        # Chạy hash giả để cân bằng thời gian xử lý CPU
        verify_dummy_password(request.password)
        # Ghi log thất bại
        log = SystemLog(
            user_id=None,
            action="LOGIN_FAILED",
            details=json.dumps({"username": request.username, "reason": "user_not_found"}),
        )
        db.add(log)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tên đăng nhập hoặc mật khẩu không chính xác",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Kiểm tra mật khẩu thực tế
    if not verify_password(request.password, user.password_hash):
        log = SystemLog(
            user_id=user.id,
            action="LOGIN_FAILED",
            details=json.dumps({"username": request.username, "reason": "invalid_password"}),
        )
        db.add(log)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tên đăng nhập hoặc mật khẩu không chính xác",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Kiểm tra tài khoản bị khóa sau khi đã xác thực mật khẩu
    if not user.is_active:
        log = SystemLog(
            user_id=user.id,
            action="LOGIN_FAILED",
            details=json.dumps({"username": request.username, "reason": "account_inactive"}),
        )
        db.add(log)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tài khoản đã bị vô hiệu hóa",
        )

    # Đăng nhập thành công
    access_token = create_access_token(subject=user.id, role=user.role)
    log = SystemLog(
        user_id=user.id,
        action="LOGIN",
        details=json.dumps({"username": user.username, "role": user.role, "status": "SUCCESS"}),
    )
    db.add(log)
    db.commit()

    return Token(access_token=access_token, token_type="bearer")


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_active_user)):
    """
    Lấy thông tin tài khoản đang đăng nhập.
    """
    return current_user

