"""
API v1 Router: IoT Sorting Gates Control & Postal Routing (UC-06, UC-07, UC-09)
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import SortingGate
from app.schemas import (
    SortingGateResponse,
    GateTriggerRequest,
    PostalRouteLookupRequest,
    PostalRouteLookupResponse,
    GateCycleExecutionRequest,
    GateCycleExecutionResponse,
    GateResetResponse
)
from app.services.sorting_service import sorting_service

router = APIRouter()


@router.get("/gates", response_model=List[SortingGateResponse], summary="Danh sách trạng thái 4 cổng phân loại IoT")
def get_sorting_gates(db: Session = Depends(get_db)):
    """
    Truy vấn danh mục 4 cổng phân loại IoT trên băng tải (Miền Bắc, Miền Trung, Miền Nam, Làn Re-check).
    """
    return db.query(SortingGate).order_by(SortingGate.gate_number.asc()).all()


@router.post("/lookup-route", response_model=PostalRouteLookupResponse, summary="Tra cứu lộ trình bưu chính ảo (Virtual Attribution - UC-06)")
def lookup_postal_route(req: PostalRouteLookupRequest):
    """
    Ánh xạ mã bưu chính VNPost 5-6 chữ số sang cổng phân loại tương ứng:
    - Tiền tố 10-39: Cổng 1 (Miền Bắc)
    - Tiền tố 40-69: Cổng 2 (Miền Trung & Tây Nguyên)
    - Tiền tố 70-96: Cổng 3 (Miền Nam)
    - Khác hoặc lỗi: Cổng 4 (Làn Re-check)
    """
    result = sorting_service.resolve_postal_route(
        postal_code=req.postal_code,
        destination_zone=req.destination_zone
    )
    return result


@router.post("/trigger", summary="Kích hoạt cần gạt cổng phân loại góc 45 độ (UC-07)")
def trigger_gate(req: GateTriggerRequest, db: Session = Depends(get_db)):
    """
    Phát lệnh kích hoạt mở cần gạt phân loại góc 45 độ khi bưu kiện chạm vạch cảm biến.
    Tự động kiểm tra an toàn (Pre-check Safety) từ chối gạt nếu cổng đang bị JAMMED.
    """
    try:
        result = sorting_service.trigger_gate(
            db=db,
            gate_number=req.gate_number,
            package_id=req.package_id,
            deflect_angle_deg=req.deflect_angle_deg
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/gates/{gate_number}/cycle", response_model=GateCycleExecutionResponse, summary="Thực thi chu kỳ gạt kèm cảm biến phản hồi (Feedback Sensor Lifecycle)")
def execute_gate_cycle(gate_number: int, req: GateCycleExecutionRequest, db: Session = Depends(get_db)):
    """
    Thực thi chu kỳ phân loại hoàn chỉnh khép kín:
    Mở cần gạt 45° -> Đợi cảm biến quang học phản hồi -> Tự động thu về 0° (IDLE) hoặc phát JAM_ALERT nếu timeout.
    """
    try:
        result = sorting_service.execute_divert_cycle(
            db=db,
            gate_number=gate_number,
            package_id=req.package_id,
            deflect_angle_deg=req.deflect_angle_deg,
            simulate_feedback=req.simulate_feedback
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/gates/{gate_number}/anti-jam", summary="Kích hoạt cảnh báo ngoại lệ kẹt hàng (Anti-Jam - UC-09)")
def trigger_anti_jam(gate_number: int, db: Session = Depends(get_db)):
    """
    Phát tín hiệu cảnh báo kẹt hàng khi cảm biến không ghi nhận kiện rơi sau 3 giây.
    """
    result = sorting_service.handle_anti_jam_alert(db=db, gate_number=gate_number)
    return result


@router.post("/gates/{gate_number}/reset", response_model=GateResetResponse, summary="Khôi phục cổng sau khi gỡ kẹt hàng (Clear Jam / Reset)")
def reset_gate(gate_number: int, db: Session = Depends(get_db)):
    """
    Nhân viên vận hành xác nhận đã gỡ lỗi thành công để đưa trạng thái cổng từ JAMMED về IDLE.
    """
    try:
        result = sorting_service.reset_gate_status(db=db, gate_number=gate_number)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
