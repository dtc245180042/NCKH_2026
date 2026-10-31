"""
API v1 Router: IoT Sorting Gates Control & Anti-jam Safety Engine (UC-06, UC-07, UC-09)
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import SortingGate
from app.schemas import (
    SortingGateResponse,
    GateTriggerRequest,
    JamWatchdogScanResponse,
    EmergencyStopRequest,
    EmergencyStopResponse,
    JamResolveRequest,
    JamResolveResponse,
    AntiJamMetricsResponse,
)
from app.services.sorting_service import sorting_service

router = APIRouter()


@router.get("/gates", response_model=List[SortingGateResponse], summary="Danh sách trạng thái 4 cổng phân loại IoT")
def get_sorting_gates(db: Session = Depends(get_db)):
    """
    Truy vấn danh mục và trạng thái thời gian thực của 4 cổng phân loại IoT trên băng tải.
    """
    return db.query(SortingGate).order_by(SortingGate.gate_number.asc()).all()


@router.post("/trigger", summary="Kích hoạt cần gạt cổng phân loại góc 45 độ (UC-07)")
def trigger_gate(req: GateTriggerRequest, db: Session = Depends(get_db)):
    """
    Phát tín hiệu kích hoạt mở cần gạt phân loại góc 45 độ khi bưu kiện chạm vạch cảm biến.
    Tự động khởi tạo đồng hồ Jam Watchdog Timer 3.0 giây và kiểm tra an toàn trước khi gạt.
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


@router.post("/gates/{gate_number}/feedback", summary="Ghi nhận tín hiệu cảm biến quang phản hồi kiện rơi thành công")
def register_feedback(gate_number: int, package_id: int, db: Session = Depends(get_db)):
    """
    Cảm biến quang miệng máng trượt xác nhận kiện hàng đã rơi qua thành công.
    Tự động thu hồi cần gạt về 0 độ (IDLE) và hủy đếm lùi Watchdog.
    """
    try:
        result = sorting_service.register_sensor_feedback(
            db=db,
            gate_number=gate_number,
            package_id=package_id
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/gates/{gate_number}/anti-jam", summary="Kích hoạt cảnh báo ngoại lệ kẹt hàng thủ công (UC-09)")
def trigger_anti_jam(gate_number: int, db: Session = Depends(get_db)):
    """
    Phát tín hiệu cảnh báo kẹt hàng và khóa liên động dừng băng tải bảo vệ cơ khí.
    """
    result = sorting_service.handle_anti_jam_alert(db=db, gate_number=gate_number)
    return result


@router.post("/antijam/watchdog-scan", response_model=JamWatchdogScanResponse, summary="Quét Jam Watchdog Timer tự động phát hiện kẹt hàng")
def scan_watchdog(db: Session = Depends(get_db)):
    """
    Động cơ Watchdog định kỳ quét các cổng đang mở. Nếu trôi qua quá 3.0s chưa có feedback -> tự động kích hoạt kẹt hàng.
    """
    result = sorting_service.scan_jam_watchdog(db=db)
    return result


@router.post("/antijam/emergency-stop", response_model=EmergencyStopResponse, summary="Dừng khẩn cấp toàn bộ hệ thống phân loại (Emergency Stop)")
def emergency_stop(req: EmergencyStopRequest, db: Session = Depends(get_db)):
    """
    Lệnh dừng khẩn cấp dây chuyền: Dừng ngay lập tức băng tải về 0 px/s và khóa an toàn toàn bộ các cổng.
    """
    result = sorting_service.trigger_emergency_stop(
        db=db,
        operator_name=req.operator_name,
        reason=req.reason
    )
    return result


@router.post("/antijam/resolve", response_model=JamResolveResponse, summary="Xác nhận xử lý sự cố kẹt hàng & Đo lường MTTR")
def resolve_jam(req: JamResolveRequest, db: Session = Depends(get_db)):
    """
    Nhân viên vận hành báo cáo nguyên nhân sự cố, đưa cổng về IDLE và mở lại băng tải nếu không còn cổng nào khác bị kẹt.
    """
    try:
        result = sorting_service.resolve_jam_incident(
            db=db,
            gate_number=req.gate_number,
            operator_name=req.operator_name,
            root_cause=req.root_cause,
            corrective_action=req.corrective_action
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/antijam/metrics", response_model=AntiJamMetricsResponse, summary="Thống kê KPI kẹt hàng & Thời gian phục hồi trung bình (MTTR)")
def get_metrics(db: Session = Depends(get_db)):
    """
    Thống kê tổng số vụ kẹt hàng, tổng thời gian dừng máy và chỉ số MTTR (Mean Time to Recovery).
    """
    result = sorting_service.get_antijam_metrics(db=db)
    return result
