"""
API v1 Router: Packages & Inbound Operations (UC-03)
"""
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import Package, SystemLog
from app.schemas import PackageCreate, PackageUpdate, PackageResponse, InboundRequest

router = APIRouter()


@router.get("", response_model=List[PackageResponse], summary="Danh sách kiện hàng trong hệ thống")
def list_packages(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status: Optional[str] = None,
    destination: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Package)
    if status:
        query = query.filter(Package.status == status)
    if destination:
        query = query.filter(Package.destination_zone == destination)
    return query.order_by(Package.package_id.desc()).offset(skip).limit(limit).all()


@router.post("/inbound", response_model=PackageResponse, summary="Tiếp nhận kiện hàng mới tại cổng Inbound (UC-03)")
def receive_inbound_package(inbound_in: InboundRequest, db: Session = Depends(get_db)):
    """
    Tiếp nhận hàng hóa tại cổng Inbound, sinh mã vạch ảo (Virtual Barcode),
    gán tuyến bưu chính và phát tín hiệu đưa lên băng chuyền chính.
    """
    barcode = inbound_in.barcode or f"PKG-VN-{uuid.uuid4().hex[:8].upper()}"

    # Kiểm tra trùng lặp
    existing = db.query(Package).filter(Package.barcode == barcode).first()
    if existing:
        raise HTTPException(status_code=400, detail="Mã barcode đã tồn tại trong hệ thống")

    new_pkg = Package(
        barcode=barcode,
        tracking_code=f"TRK-{barcode[-6:]}",
        weight=inbound_in.weight or 1.8,
        dimensions="30x25x20",
        destination_zone=inbound_in.destination_zone,
        postal_code=inbound_in.postal_code,
        status="RECEIVED"
    )
    db.add(new_pkg)

    # Ghi nhận log Inbound
    log = SystemLog(
        event_type="INBOUND_RECEIVE",
        description=f"Tiếp nhận kiện {barcode} tại Cổng Inbound -> Đích: {new_pkg.destination_zone} ({new_pkg.postal_code})"
    )
    db.add(log)
    db.commit()
    db.refresh(new_pkg)
    return new_pkg


@router.get("/{package_id}", response_model=PackageResponse, summary="Chi tiết kiện hàng")
def get_package(package_id: int, db: Session = Depends(get_db)):
    pkg = db.query(Package).filter(Package.package_id == package_id).first()
    if not pkg:
        raise HTTPException(status_code=404, detail="Không tìm thấy bưu kiện")
    return pkg


@router.put("/{package_id}", response_model=PackageResponse, summary="Cập nhật trạng thái kiện hàng")
def update_package(package_id: int, pkg_in: PackageUpdate, db: Session = Depends(get_db)):
    pkg = db.query(Package).filter(Package.package_id == package_id).first()
    if not pkg:
        raise HTTPException(status_code=404, detail="Không tìm thấy bưu kiện")

    if pkg_in.status is not None:
        pkg.status = pkg_in.status
    if pkg_in.destination_zone is not None:
        pkg.destination_zone = pkg_in.destination_zone
    if pkg_in.current_location_id is not None:
        pkg.current_location_id = pkg_in.current_location_id
    if pkg_in.weight is not None:
        pkg.weight = pkg_in.weight

    db.commit()
    db.refresh(pkg)
    return pkg

