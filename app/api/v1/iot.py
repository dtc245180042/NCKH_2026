"""
API v1 Router: IoT Sorting Gates Control (UC-07)
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import SortingGate
from app.schemas import SortingGateResponse, GateTriggerRequest
from app.services.sorting_service import sorting_service

router = APIRouter()


@router.get("/gates", response_model=List[SortingGateResponse], summary="Danh sách trạng thái 4 cổng phân loại IoT")
def get_sorting_gates(db: Session = Depends(get_db)):
    return db.query(SortingGate).order_by(SortingGate.gate_number.asc()).all()


@router.post("/trigger", summary="Kích hoạt cần gạt cổng phân loại góc 45 độ")
def trigger_gate(req: GateTriggerRequest, db: Session = Depends(get_db)):
    """
    Phát tín hiệu kích hoạt mở cần gạt phân loại góc 45 độ khi bưu kiện chạm vạch cảm biến.
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


@router.post("/gates/{gate_number}/anti-jam", summary="Kích hoạt cảnh báo ngoại lệ kẹt hàng (Anti-Jam)")
def trigger_anti_jam(gate_number: int, db: Session = Depends(get_db)):
    result = sorting_service.handle_anti_jam_alert(db=db, gate_number=gate_number)
    return result
