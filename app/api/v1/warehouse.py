"""
API v1 Router: Warehouse Storage Locations & Layout (UC-10)
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import StorageLocation, Package, SystemLog
from app.schemas import StorageLocationCreate, StorageLocationResponse

router = APIRouter()


@router.get("/locations", response_model=List[StorageLocationResponse], summary="Danh sách các ô kệ lưu kho")
def list_storage_locations(
    zone: Optional[str] = None,
    occupied: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    query = db.query(StorageLocation)
    if zone:
        query = query.filter(StorageLocation.zone.contains(zone))
    if occupied is not None:
        query = query.filter(StorageLocation.is_occupied == occupied)
    return query.all()


@router.post("/locations", response_model=StorageLocationResponse, summary="Thêm mới ô kệ lưu kho")
def create_storage_location(location_in: StorageLocationCreate, db: Session = Depends(get_db)):
    existing = db.query(StorageLocation).filter(StorageLocation.location_code == location_in.location_code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Mã vị trí kệ đã tồn tại")

    new_loc = StorageLocation(**location_in.dict())
    db.add(new_loc)
    db.commit()
    db.refresh(new_loc)
    return new_loc


@router.put("/locations/{location_id}/occupy", summary="Gán kiện hàng vào ô kệ lưu kho (Putaway)")
def occupy_location(location_id: int, package_id: int, db: Session = Depends(get_db)):
    loc = db.query(StorageLocation).filter(StorageLocation.location_id == location_id).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Không tìm thấy vị trí ô kệ")
    if loc.is_occupied:
        raise HTTPException(status_code=400, detail="Vị trí ô kệ này đã có hàng lưu giữ")

    pkg = db.query(Package).filter(Package.package_id == package_id).first()
    if not pkg:
        raise HTTPException(status_code=404, detail="Không tìm thấy bưu kiện")

    loc.is_occupied = True
    pkg.current_location_id = loc.location_id
    pkg.status = "STORED"

    log = SystemLog(
        event_type="WAREHOUSE_PUTAWAY",
        description=f"Xếp kiện {pkg.barcode} vào ô kệ {loc.location_code}."
    )
    db.add(log)
    db.commit()

    return {
        "status": "STORED",
        "location_code": loc.location_code,
        "package_barcode": pkg.barcode
    }
