"""
Pydantic v2 schemas: IoT Sorting Gates & Anti-jam Safety System (UC-07, UC-09)
"""
from typing import Optional, List, Dict, Any
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


class JamWatchdogItem(BaseModel):
    gate_number: int
    package_id: Optional[int]
    elapsed_seconds: float
    status: str
    action_taken: str


class JamWatchdogScanResponse(BaseModel):
    timestamp: float
    total_gates_scanned: int
    active_actuations: int
    jammed_gates_count: int
    conveyor_interlocked: bool
    conveyor_speed: float
    details: List[JamWatchdogItem]


class EmergencyStopRequest(BaseModel):
    operator_name: str = Field(default="Operator", description="Người ra lệnh dừng khẩn cấp")
    reason: str = Field(..., description="Lý do dừng khẩn cấp hệ thống phân loại")


class EmergencyStopResponse(BaseModel):
    status: str
    action: str
    conveyor_speed: float
    stopped_gates: List[int]
    message: str
    timestamp: float


class JamResolveRequest(BaseModel):
    gate_number: int = Field(..., ge=1, le=8)
    operator_name: str = Field(default="Operator", description="Người xử lý sự cố")
    root_cause: str = Field(..., description="Nguyên nhân kẹt hàng (ví dụ: bưu kiện méo mó, rách bao bì, quá khổ)")
    corrective_action: str = Field(default="Gỡ bưu kiện kẹt thủ công và kiểm tra cần gạt", description="Biện pháp xử lý")


class JamResolveResponse(BaseModel):
    status: str
    gate_number: int
    previous_status: str
    new_status: str
    downtime_seconds: float
    conveyor_resumed: bool
    message: str
    timestamp: float


class AntiJamMetricsResponse(BaseModel):
    total_jam_incidents: int
    total_downtime_seconds: float
    mttr_seconds: float  # Mean Time to Recovery
    active_jammed_gates: List[int]
    conveyor_interlocked: bool
    summary: str
