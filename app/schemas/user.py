from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator
from app.core.security import validate_password_rules

UserRole = Literal["Admin", "Manager", "Operator"]


class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, description="Tên đăng nhập duy nhất")
    full_name: str = Field(..., min_length=1, max_length=100, description="Họ và tên người dùng")
    role: UserRole = Field(..., description="Vai trò: Admin, Manager hoặc Operator")


class UserCreate(UserBase):
    password: str = Field(..., description="Mật khẩu khởi tạo")

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        validate_password_rules(v)
        return v


class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=1, max_length=100)
    role: Optional[UserRole] = None
    password: Optional[str] = None

    @field_validator("password")
    @classmethod
    def validate_password_optional(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            validate_password_rules(v)
        return v


class UserStatusUpdate(BaseModel):
    is_active: bool = Field(..., description="Trạng thái kích hoạt (True: hoạt động, False: khóa)")


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    full_name: str
    role: str
    is_active: bool


class UserListResponse(BaseModel):
    total: int
    items: list[UserResponse]
