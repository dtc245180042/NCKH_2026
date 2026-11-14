from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict, Field

PackageStatus = Literal["Created", "On_Belt", "Stored", "Dispatched"]


class PackageBase(BaseModel):
    barcode: str = Field(..., min_length=3, max_length=32, description="Mã vạch bưu kiện duy nhất")
    weight: float = Field(..., gt=0, description="Khối lượng kiện hàng (kg)")
    dimensions: Optional[str] = Field(None, max_length=50, description="Kích thước DxRxC (cm)")
    destination_code: str = Field(..., min_length=2, max_length=20, description="Mã bưu chính hoặc mã tỉnh/thành đích")


class PackageCreate(PackageBase):
    pass


class PackageUpdate(BaseModel):
    weight: Optional[float] = Field(None, gt=0)
    dimensions: Optional[str] = None
    destination_code: Optional[str] = None
    status: Optional[PackageStatus] = None
    location_id: Optional[int] = None
    gate_id: Optional[int] = None


class PackageResponse(PackageBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    status: str
    tracking_id: Optional[int] = None
    location_id: Optional[int] = None
    gate_id: Optional[int] = None


class PackageListResponse(BaseModel):
    total: int
    items: list[PackageResponse]


class StorageLocationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    zone: str
    capacity: int
    current_count: int
    is_full: bool


class StorageLocationListResponse(BaseModel):
    total: int
    items: list[StorageLocationResponse]

