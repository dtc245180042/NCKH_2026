"""
Pydantic v2 schemas: IoT Sorting Gates (UC-07)
"""
from typing import Optional
from pydantic import BaseModel, Field


class SortingGateBase(BaseModel):
    gate_number: int = Field(..., ge=1, le=8)
    target_zone: str = Field(..., example="Miền Bắc")
    postal_code_prefix: str = Field(..., example="100000")
    conveyor_position_x: float = Field(..., example=380.0)
    divert_direction: int = Field(default=1)
    status: str = Field(default="IDLE")


class GateTriggerRequest(BaseModel):
    package_id: int
    gate_number: int
    deflect_angle_deg: float = Field(default=45.0, description="Góc mở cần gạt chuẩn 45 độ")


class SortingGateResponse(SortingGateBase):
    gate_id: int
    total_diverted_count: int

    class Config:
        from_attributes = True

