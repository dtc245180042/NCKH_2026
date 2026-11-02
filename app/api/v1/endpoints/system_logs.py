import hashlib
import json
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, desc
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user
from app.core.database import get_db
from app.models.system_log import SystemLog
from app.models.user import User
from app.services.simulation_engine import warehouse_simulation

router = APIRouter(tags=["System Logs & Audit Trail"])


@router.get("/system-logs")
def get_system_logs(
    limit: int = Query(default=50, ge=1, le=200),
    action: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Truy xuất luồng nhật ký kiểm toán hệ thống (Audit Trail) kết hợp:
    1. Các sự kiện lưu vết trong Cơ sở dữ liệu MySQL (Users, Auth, Packages).
    2. Các sự kiện thời gian thực từ động cơ mô phỏng phần cứng (PLC, RFID, AMR, Anti-jam).
    """
    # 1. Lấy logs từ MySQL
    stmt = select(SystemLog).order_by(desc(SystemLog.id)).limit(limit)
    if action:
        stmt = stmt.where(SystemLog.action == action)
    db_logs = db.execute(stmt).scalars().all()

    results = []
    for log in db_logs:
        raw_detail = log.details or ""
        sha = hashlib.sha256(f"{log.id}|{log.created_at}|{log.action}|{raw_detail}".encode()).hexdigest()
        results.append({
            "id": log.id,
            "created_at": log.created_at.strftime("%Y-%m-%d %H:%M:%S") if log.created_at else datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "actor": f"User #{log.user_id}" if log.user_id else "SYSTEM",
            "action": log.action,
            "details": raw_detail,
            "level": "INFO",
            "sha256": sha[:16] + "..."
        })

    # 2. Bổ sung các sự kiện phần cứng thời gian thực từ simulation_engine
    sim_events = getattr(warehouse_simulation, "audit_events", [])
    for ev in reversed(sim_events[-30:]):
        results.append({
            "id": ev.get("id", len(results) + 1),
            "created_at": ev.get("timestamp", datetime.now().strftime("%Y-%m-%d %H:%M:%S")),
            "actor": ev.get("actor", "HARDWARE_ENGINE"),
            "action": ev.get("action", "EVENT"),
            "details": ev.get("details", ""),
            "level": ev.get("level", "INFO"),
            "sha256": ev.get("sha256", hashlib.sha256(str(ev).encode()).hexdigest()[:16] + "...")
        })

    # Giới hạn số lượng
    results = results[:limit]
    return {
        "total": len(results),
        "items": results
    }

