import asyncio
import json
import logging
from typing import List
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.simulation_engine import warehouse_simulation

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Simulation WebSocket"])


class ConnectionManager:
    """Quản lý các kết nối WebSocket client đang hoạt động"""
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"Client kết nối WebSocket thành công. Tổng active: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"Client ngắt kết nối WebSocket. Còn lại: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        for connection in list(self.active_connections):
            try:
                await connection.send_json(message)
            except Exception:
                self.disconnect(connection)


manager = ConnectionManager()


@router.websocket("/ws/simulation/stream")
async def websocket_simulation_stream(websocket: WebSocket):
    """
    Kênh truyền phát trực tiếp (Stream) dữ liệu mô phỏng kho hàng ở tốc độ 60 FPS:
    - Nhận lệnh tương tác từ người dùng (SPAWN_PACKAGE, PING, SET_GATE).
    - Phát snapshot liên tục mỗi ~16.6ms.
    """
    await manager.connect(websocket)

    async def receive_commands():
        """Lắng nghe lệnh gửi lên từ Frontend client"""
        try:
            while True:
                data_text = await websocket.receive_text()
                try:
                    payload = json.loads(data_text)
                    action = payload.get("action")
                    if action == "SPAWN_PACKAGE":
                        barcode = payload.get("barcode")
                        warehouse_simulation.spawn_package(barcode)
                    elif action == "SET_GATE":
                        gate_id = payload.get("gate_id", 1)
                        gate_status = payload.get("status", "ACTIVE")
                        angle = payload.get("angle", 45.0)
                        warehouse_simulation.set_gate_status(gate_id, gate_status, angle)
                    elif action == "PING":
                        await websocket.send_json({"type": "PONG", "timestamp": payload.get("timestamp")})
                except Exception as e:
                    logger.warning(f"Lỗi xử lý command từ client: {e}")
        except WebSocketDisconnect:
            pass
        except Exception:
            pass

    async def stream_snapshots():
        """Truyền phát tọa độ 60 FPS xuống client"""
        try:
            while True:
                # Cập nhật vật lý 1 bước
                warehouse_simulation.update_physics(dt=1.0 / 60.0)
                snapshot = warehouse_simulation.get_state_snapshot()
                await websocket.send_json(snapshot)
                # Đảm bảo tần số 60 FPS (nghỉ 16ms)
                await asyncio.sleep(1.0 / 60.0)
        except WebSocketDisconnect:
            pass
        except Exception:
            pass

    # Chạy song song 2 tasks đọc và ghi
    recv_task = asyncio.create_task(receive_commands())
    send_task = asyncio.create_task(stream_snapshots())

    try:
        done, pending = await asyncio.wait(
            [recv_task, send_task],
            return_when=asyncio.FIRST_COMPLETED,
        )
        for task in pending:
            task.cancel()
    finally:
        manager.disconnect(websocket)
