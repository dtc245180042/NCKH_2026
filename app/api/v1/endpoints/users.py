import json
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.database import get_db
from app.core.security import get_password_hash
from app.models.system_log import SystemLog
from app.models.user import User
from app.schemas.user import (
    UserCreate,
    UserListResponse,
    UserResponse,
    UserStatusUpdate,
    UserUpdate,
)

router = APIRouter(prefix="/users", tags=["Users Management"])


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    user_in: UserCreate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_roles(["Admin"])),
):
    """
    Tạo tài khoản người dùng mới (Chỉ dành cho Admin).
    """
    # Kiểm tra trùng username
    existing_user = db.execute(select(User).where(User.username == user_in.username)).scalar_one_or_none()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tên đăng nhập đã tồn tại trong hệ thống",
        )

    user = User(
        username=user_in.username,
        password_hash=get_password_hash(user_in.password),
        full_name=user_in.full_name,
        role=user_in.role,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Ghi log tạo người dùng
    log = SystemLog(
        user_id=current_admin.id,
        action="USER_CREATE",
        details=json.dumps({"target_user_id": user.id, "target_username": user.username, "role": user.role}),
    )
    db.add(log)
    db.commit()

    return user


@router.get("", response_model=UserListResponse)
def list_users(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    role: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(["Admin", "Manager"])),
):
    """
    Xem danh sách người dùng có phân trang (Admin & Manager).
    """
    stmt = select(User)
    count_stmt = select(func.count(User.id))

    if role:
        stmt = stmt.where(User.role == role)
        count_stmt = count_stmt.where(User.role == role)

    total = db.execute(count_stmt).scalar() or 0
    items = db.execute(stmt.offset(skip).limit(limit)).scalars().all()

    return UserListResponse(total=total, items=items)


@router.get("/{user_id}", response_model=UserResponse)
def get_user_detail(
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(["Admin", "Manager"])),
):
    """
    Xem chi tiết thông tin một người dùng.
    """
    user = db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Người dùng không tồn tại",
        )
    return user


@router.patch("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    user_update: UserUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_roles(["Admin"])),
):
    """
    Cập nhật thông tin người dùng / đổi role / đặt lại mật khẩu (Chỉ Admin).
    Quy tắc an toàn:
    - Không cho phép Admin tự hạ quyền của chính mình.
    - Không cho phép hạ quyền Admin hoạt động cuối cùng trong hệ thống.
    """
    user = db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Người dùng không tồn tại",
        )

    # Kiểm tra hạ quyền
    if user_update.role is not None and user_update.role != user.role:
        if user.role == "Admin" and user_update.role != "Admin":
            # 1. Admin tự hạ quyền chính mình
            if current_admin.id == user.id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Không thể tự hạ quyền Admin của chính mình",
                )
            # 2. Hạ quyền Admin hoạt động cuối cùng
            active_admin_count = db.execute(
                select(func.count(User.id)).where(User.role == "Admin", User.is_active.is_(True))
            ).scalar() or 0
            if active_admin_count <= 1 and user.is_active:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Không thể hạ quyền Admin hoạt động duy nhất còn lại trong hệ thống",
                )
        user.role = user_update.role

    if user_update.full_name is not None:
        user.full_name = user_update.full_name

    if user_update.password is not None:
        user.password_hash = get_password_hash(user_update.password)

    db.commit()
    db.refresh(user)

    log = SystemLog(
        user_id=current_admin.id,
        action="USER_UPDATE",
        details=json.dumps({"target_user_id": user.id, "target_username": user.username}),
    )
    db.add(log)
    db.commit()

    return user


@router.patch("/{user_id}/status", response_model=UserResponse)
def update_user_status(
    user_id: int,
    status_in: UserStatusUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_roles(["Admin"])),
):
    """
    Khóa hoặc mở khóa tài khoản (Chỉ Admin).
    Quy tắc an toàn:
    - Không cho phép Admin tự khóa tài khoản của chính mình.
    - Không cho phép khóa tài khoản Admin hoạt động cuối cùng trong hệ thống.
    """
    user = db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Người dùng không tồn tại",
        )

    if not status_in.is_active and user.is_active:
        # Kiểm tra tự khóa
        if current_admin.id == user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Không thể tự vô hiệu hóa tài khoản của chính mình",
            )
        # Kiểm tra Admin cuối cùng
        if user.role == "Admin":
            active_admin_count = db.execute(
                select(func.count(User.id)).where(User.role == "Admin", User.is_active.is_(True))
            ).scalar() or 0
            if active_admin_count <= 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Không thể vô hiệu hóa Admin hoạt động duy nhất còn lại trong hệ thống",
                )

    user.is_active = status_in.is_active
    db.commit()
    db.refresh(user)

    action_name = "USER_ACTIVATE" if status_in.is_active else "USER_DEACTIVATE"
    log = SystemLog(
        user_id=current_admin.id,
        action=action_name,
        details=json.dumps({"target_user_id": user.id, "target_username": user.username, "is_active": user.is_active}),
    )
    db.add(log)
    db.commit()

    return user

