"""
Pydantic v2 schemas: Storage locations & Warehouse layout (UC-10)
"""
from typing import Optional
from pydantic import BaseModel, Field


class StorageLocationBase(BaseModel):
    location_code: str = Field(..., example="RACK-A-01-01")
    zone: str = Field(..., example="A (Khu Bắc)")
    grid_x: int = Field(..., example=340)
    grid_y: int = Field(..., example=70)
    capacity_weight: float = Field(default=150.0)
    is_occupied: bool = False


class StorageLocationCreate(StorageLocationBase):
    pass


class StorageLocationResponse(StorageLocationBase):
    location_id: int

    class Config:
        from_attributes = True

