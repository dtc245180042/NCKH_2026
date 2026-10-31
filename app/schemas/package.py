"""
Pydantic v2 schemas: Package management & Inbound ingestion (UC-03)
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class PackageBase(BaseModel):
    barcode: str = Field(..., example="PKG-VN-100293")
    tracking_code: Optional[str] = Field(None, example="VNPOST-HN-01")
    weight: float = Field(default=1.5, ge=0.1, le=50.0, description="Trọng lượng (kg)")
    dimensions: str = Field(default="30x25x20", description="Kích thước cm")
    destination_zone: str = Field(..., example="Miền Bắc")
    postal_code: str = Field(default="100000", example="100000")


class PackageCreate(PackageBase):
    pass


class InboundRequest(BaseModel):
    barcode: Optional[str] = None
    destination_zone: str = Field(..., example="Miền Bắc")
    postal_code: str = Field(default="100000", example="100000")
    weight: Optional[float] = 2.0


class PackageUpdate(BaseModel):
    status: Optional[str] = None
    destination_zone: Optional[str] = None
    current_location_id: Optional[int] = None
    weight: Optional[float] = None


class PackageResponse(PackageBase):
    package_id: int
    status: str
    current_location_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
