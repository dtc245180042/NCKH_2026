"""
Pydantic v2 schemas: IoT Sorting Gates (UC-06, UC-07, UC-09)
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


class PostalRouteLookupRequest(BaseModel):
    postal_code: str = Field(..., description="Mã bưu chính VNPost 5-6 chữ số (ví dụ: 100000, 550000, 700000)")
    destination_zone: Optional[str] = Field(None, description="Tên vùng miền đến nếu có")


class PostalRouteLookupResponse(BaseModel):
    postal_code: str
    target_gate: int
    target_zone: str
    is_recheck: bool
    description: str


class GateCycleExecutionRequest(BaseModel):
    gate_number: int = Field(..., ge=1, le=4)
    package_id: int
    deflect_angle_deg: float = Field(default=45.0, description="Góc mở cần gạt chuẩn 45 độ")
    simulate_feedback: bool = Field(default=True, description="Giả lập cảm biến quang học phản hồi kiện rơi thành công")


class GateCycleExecutionResponse(BaseModel):
    status: str
    gate_number: int
    package_id: int
    angle_deg: float
    feedback_received: bool
    final_gate_status: str
    message: str


class GateResetResponse(BaseModel):
    status: str
    gate_number: int
    previous_status: str
    new_status: str
    message: str
