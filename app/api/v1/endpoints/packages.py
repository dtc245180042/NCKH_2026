import json
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, require_roles
from app.core.database import get_db
from app.models.package import Package
from app.models.sorting_gate import SortingGate
from app.models.storage_location import StorageLocation
from app.models.system_log import SystemLog
from app.models.user import User
from app.schemas.package import (
    PackageCreate,
    PackageListResponse,
    PackageResponse,
    PackageUpdate,
    StorageLocationListResponse,
    StorageLocationResponse,
)

router = APIRouter(tags=["Packages & Warehouse Management"])


# ==========================================
# 1. API QUẢN LÝ KIỆN HÀNG (PACKAGES)
# ==========================================

@router.post("/packages", response_model=PackageResponse, status_code=status.HTTP_201_CREATED)
def create_package(
    pkg_in: PackageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Tiếp nhận bưu kiện mới vào hệ thống (Barcode check unique).
    """
    existing = db.execute(select(Package).where(Package.barcode == pkg_in.barcode)).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Mã kiện hàng '{pkg_in.barcode}' đã tồn tại trong hệ thống",
        )

    pkg = Package(
        barcode=pkg_in.barcode,
        weight=pkg_in.weight,
        dimensions=pkg_in.dimensions,
        destination_code=pkg_in.destination_code,
        status="Created",
    )
    db.add(pkg)
    db.commit()
    db.refresh(pkg)

    # Ghi log
    log = SystemLog(
        user_id=current_user.id,
        action="PACKAGE_CREATE",
        details=json.dumps({"package_id": pkg.id, "barcode": pkg.barcode, "dest": pkg.destination_code}),
    )
    db.add(log)
    db.commit()

    # Bơm kiện hàng trực tiếp vào băng chuyền mô phỏng vật lý của Digital Twin
    try:
        from app.services.simulation_engine import warehouse_simulation
        warehouse_simulation.inject_custom_package(
            barcode=pkg.barcode,
            destination_code=pkg.destination_code,
            weight=pkg.weight,
            dimensions=pkg.dimensions
        )
    except Exception:
        pass
    return pkg


@router.get("/packages", response_model=PackageListResponse)
def list_packages(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    status: Optional[str] = Query(default=None),
    destination_code: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_active_user),
):
    """
    Tra cứu danh sách bưu kiện có phân trang và lọc theo trạng thái/nơi đến.
    """
    stmt = select(Package)
    count_stmt = select(func.count(Package.id))

    if status:
        stmt = stmt.where(Package.status == status)
        count_stmt = count_stmt.where(Package.status == status)

    if destination_code:
        stmt = stmt.where(Package.destination_code == destination_code)
        count_stmt = count_stmt.where(Package.destination_code == destination_code)

    total = db.execute(count_stmt).scalar() or 0
    items = db.execute(stmt.offset(skip).limit(limit)).scalars().all()

    return PackageListResponse(total=total, items=items)


@router.get("/packages/{barcode}", response_model=PackageResponse)
def get_package_by_barcode(
    barcode: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_active_user),
):
    """
    Tra cứu thông tin chi tiết một kiện hàng theo mã Barcode.
    """
    pkg = db.execute(select(Package).where(Package.barcode == barcode)).scalar_one_or_none()
    if not pkg:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy kiện hàng với mã vạch yêu cầu",
        )
    return pkg


@router.patch("/packages/{package_id}", response_model=PackageResponse)
def update_package(
    package_id: int,
    pkg_update: PackageUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Cập nhật trạng thái kiện hàng, gán vị trí ô kệ hoặc cổng phân loại.
    Tự động cập nhật current_count và is_full của ô kệ nếu bưu kiện được lưu vào kệ.
    """
    pkg = db.execute(select(Package).where(Package.id == package_id)).scalar_one_or_none()
    if not pkg:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy kiện hàng",
        )

    # Kiểm tra liên kết ô kệ (nếu có)
    if pkg_update.location_id is not None and pkg_update.location_id != pkg.location_id:
        loc = db.execute(select(StorageLocation).where(StorageLocation.id == pkg_update.location_id)).scalar_one_or_none()
        if not loc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ô kệ không tồn tại")
        if loc.is_full:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Ô kệ {loc.code} đã đầy sức chứa")
        
        # Tăng count của kệ mới
        loc.current_count += 1
        if loc.current_count >= loc.capacity:
            loc.is_full = True

        # Giảm count của kệ cũ nếu trước đó đang nằm ở kệ khác
        if pkg.location_id:
            old_loc = db.execute(select(StorageLocation).where(StorageLocation.id == pkg.location_id)).scalar_one_or_none()
            if old_loc and old_loc.current_count > 0:
                old_loc.current_count -= 1
                old_loc.is_full = False

        pkg.location_id = pkg_update.location_id

    # Kiểm tra cổng phân loại
    if pkg_update.gate_id is not None:
        gate = db.execute(select(SortingGate).where(SortingGate.id == pkg_update.gate_id)).scalar_one_or_none()
        if not gate:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cổng phân loại không tồn tại")
        pkg.gate_id = pkg_update.gate_id

    if pkg_update.weight is not None:
        pkg.weight = pkg_update.weight
    if pkg_update.dimensions is not None:
        pkg.dimensions = pkg_update.dimensions
    if pkg_update.destination_code is not None:
        pkg.destination_code = pkg_update.destination_code
    if pkg_update.status is not None:
        pkg.status = pkg_update.status

    db.commit()
    db.refresh(pkg)

    # Ghi log
    log = SystemLog(
        user_id=current_user.id,
        action="PACKAGE_UPDATE",
        details=json.dumps({"package_id": pkg.id, "status": pkg.status, "location_id": pkg.location_id}),
    )
    db.add(log)
    db.commit()

    return pkg


# ==========================================
# 2. API QUẢN LÝ Ô KỆ LƯU TRỮ (LOCATIONS)
# ==========================================

@router.get("/locations", response_model=StorageLocationListResponse)
def list_storage_locations(
    zone: Optional[str] = Query(default=None),
    is_full: Optional[bool] = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_active_user),
):
    """
    Danh sách các ô kệ trong kho, kèm số lượng kiện hiện tại và trạng thái đầy.
    """
    stmt = select(StorageLocation)
    count_stmt = select(func.count(StorageLocation.id))

    if zone:
        stmt = stmt.where(StorageLocation.zone == zone)
        count_stmt = count_stmt.where(StorageLocation.zone == zone)

    if is_full is not None:
        stmt = stmt.where(StorageLocation.is_full == is_full)
        count_stmt = count_stmt.where(StorageLocation.is_full == is_full)

    total = db.execute(count_stmt).scalar() or 0
    items = db.execute(stmt).scalars().all()

    return StorageLocationListResponse(total=total, items=items)


# ==========================================
# 3. THUẬT TOÁN GỢI Ý XẾP CHỖ ABC (LOG-118)
# ==========================================

@router.post("/packages/{package_id}/recommend-slot")
def recommend_package_slot(
    package_id: int,
    turnover_hint: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_active_user),
):
    """
    Gợi ý ô kệ tối ưu theo phân tích ABC Heuristic (LOG-118):
    - Tự động phân loại Zone A (Fast), Zone B (Medium), Zone C (Slow).
    - Tính khoảng cách di chuyển ngắn nhất cho robot AMR.
    """
    from app.services.storage_heuristic import storage_heuristic

    pkg = db.execute(select(Package).where(Package.id == package_id)).scalar_one_or_none()
    if not pkg:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kiện hàng không tồn tại")

    locs = db.execute(select(StorageLocation)).scalars().all()
    available_locations = [
        {
            "id": l.id,
            "code": l.code,
            "zone": l.zone,
            "capacity": l.capacity,
            "current_count": l.current_count,
            "is_full": l.is_full,
        }
        for l in locs
    ]

    best_slot = storage_heuristic.recommend_slot(
        package_weight=pkg.weight,
        destination_code=pkg.destination_code,
        available_locations=available_locations,
        turnover_hint=turnover_hint,
    )

    if not best_slot:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Kho hàng đã đầy, không còn ô trống!")

    return {
        "package_id": pkg.id,
        "barcode": pkg.barcode,
        "recommended_slot": best_slot,
    }


@router.post("/packages/{package_id}/assign-slot")
def assign_package_slot(
    package_id: int,
    location_id: Optional[int] = Query(default=None),
    turnover_hint: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Gán kiện hàng vào ô kệ tối ưu và điều phối AMR lưu kho (LOG-118).
    """
    from app.services.storage_heuristic import storage_heuristic

    pkg = db.execute(select(Package).where(Package.id == package_id)).scalar_one_or_none()
    if not pkg:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kiện hàng không tồn tại")

    # Nếu không chỉ định location_id, tự động lấy gợi ý tối ưu
    target_loc = None
    if location_id is not None:
        target_loc = db.execute(select(StorageLocation).where(StorageLocation.id == location_id)).scalar_one_or_none()
        if not target_loc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ô kệ không tồn tại")
        if target_loc.is_full or target_loc.current_count >= target_loc.capacity:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Ô kệ '{target_loc.code}' đã đầy!")
    else:
        locs = db.execute(select(StorageLocation)).scalars().all()
        loc_dicts = [
            {"id": l.id, "code": l.code, "zone": l.zone, "capacity": l.capacity, "current_count": l.current_count, "is_full": l.is_full}
            for l in locs
        ]
        best = storage_heuristic.recommend_slot(pkg.weight, pkg.destination_code, loc_dicts, turnover_hint)
        if not best:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Kho hàng đã đầy!")
        target_loc = db.execute(select(StorageLocation).where(StorageLocation.id == best["id"])).scalar_one_or_none()

    # Trừ số lượng ở vị trí cũ nếu có
    if pkg.location_id and pkg.location_id != target_loc.id:
        old_loc = db.execute(select(StorageLocation).where(StorageLocation.id == pkg.location_id)).scalar_one_or_none()
        if old_loc and old_loc.current_count > 0:
            old_loc.current_count -= 1
            old_loc.is_full = False

    # Gán vào ô mới
    target_loc.current_count += 1
    if target_loc.current_count >= target_loc.capacity:
        target_loc.is_full = True

    pkg.location_id = target_loc.id
    pkg.status = "Stored"

    db.commit()
    db.refresh(pkg)
    db.refresh(target_loc)

    # Ghi log kiểm toán
    log = SystemLog(
        user_id=current_user.id,
        action="PACKAGE_ASSIGN_SLOT",
        details=json.dumps({"package_id": pkg.id, "barcode": pkg.barcode, "location_code": target_loc.code, "zone": target_loc.zone}),
    )
    db.add(log)
    db.commit()

    return {
        "message": f"Đã gán kiện hàng '{pkg.barcode}' vào ô kệ '{target_loc.code}' ({target_loc.zone})",
        "package_id": pkg.id,
        "status": pkg.status,
        "location": {
            "id": target_loc.id,
            "code": target_loc.code,
            "zone": target_loc.zone,
            "current_count": target_loc.current_count,
            "capacity": target_loc.capacity,
            "is_full": target_loc.is_full,
        },
    }


