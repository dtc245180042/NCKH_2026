"""
API v1 Router: Authentication & RBAC (UC-01 & UC-02)
"""
from datetime import timedelta
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import verify_password, get_password_hash, create_access_token, decode_access_token
from app.models import User, SystemLog
from app.schemas import Token, LoginRequest, UserCreate, UserResponse

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/token")


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    """Dependency lấy thông tin User đang đăng nhập từ JWT Token"""
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token không hợp lệ hoặc đã hết hạn",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user_id = payload.get("sub")
    user = db.query(User).filter(User.user_id == int(user_id)).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=400, detail="Tài khoản không tồn tại hoặc đã bị khóa")
    return user


@router.post("/login", response_model=Token, summary="Đăng nhập hệ thống cấp JWT Token")
def login(login_data: LoginRequest, db: Session = Depends(get_db)):
    """Đăng nhập bằng username và password (JSON payload)"""
    user = db.query(User).filter(User.username == login_data.username).first()
    if not user or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sai tên đăng nhập hoặc mật khẩu",
        )

    # Ghi log đăng nhập
    log = SystemLog(
        event_type="AUTH_LOGIN",
        description=f"Người dùng '{user.username}' ({user.role}) đăng nhập thành công.",
        user_id=user.user_id
    )
    db.add(log)
    db.commit()

    token = create_access_token(subject=user.user_id, role=user.role)
    return {
        "access_token": token,
        "token_type": "bearer",
        "role": user.role,
        "user_id": user.user_id,
        "full_name": user.full_name
    }


@router.post("/token", response_model=Token, summary="OAuth2 standard token endpoint cho Swagger UI")
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """OAuth2 compatible token login cho Swagger Authorize button"""
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Sai username hoặc password")

    token = create_access_token(subject=user.user_id, role=user.role)
    return {
        "access_token": token,
        "token_type": "bearer",
        "role": user.role,
        "user_id": user.user_id,
        "full_name": user.full_name
    }


@router.get("/me", response_model=UserResponse, summary="Lấy thông tin tài khoản hiện tại")
def read_current_user(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/register", response_model=UserResponse, summary="Tạo mới tài khoản người dùng (Admin only)")
def register_user(user_in: UserCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Chỉ Quản trị viên (ADMIN) mới có quyền tạo tài khoản.")

    existing = db.query(User).filter(User.username == user_in.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Tên người dùng đã tồn tại.")

    new_user = User(
        username=user_in.username,
        hashed_password=get_password_hash(user_in.password),
        full_name=user_in.full_name,
        role=user_in.role,
        is_active=user_in.is_active
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@router.get("/users", response_model=List[UserResponse], summary="Danh sách người dùng (Admin/Operator)")
def list_users(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(User).all()
