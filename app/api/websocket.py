"""
WebSocket Streaming Router: Kênh truyền nhận thời gian thực chuẩn 60 FPS (UC-12)
Đồng bộ hóa trạng thái mô phỏng đồ họa Canvas 2D giữa Backend và Frontend
"""
import asyncio
import json
import logging
from typing import List
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.simulation_manager import simulation_manager

logger = logging.getLogger("simulation_ws")
router = APIRouter()


class ConnectionManager:
    """Quản lý các kết nối WebSocket đang hoạt động"""
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"Client kết nối WebSocket mới. Tổng số client: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"Client ngắt kết nối WebSocket. Còn lại: {len(self.active_connections)}")

    async def broadcast_json(self, data: dict):
        for connection in list(self.active_connections):
            try:
                await connection.send_json(data)
            except Exception:
                self.disconnect(connection)


manager = ConnectionManager()


@router.websocket("/ws/simulation/stream")
async def simulation_stream(websocket: WebSocket):
    """
    Kênh WebSocket truyền phát trạng thái mô phỏng 60 FPS:
    - Chu kỳ phát sóng: 16.6 ms (1/60 giây)
    - Hỗ trợ client gửi lệnh điều khiển 2 chiều: spawn, speed, pause, reset
    """
    await manager.connect(websocket)

    async def receive_commands():
        """Lắng nghe các lệnh điều khiển từ Frontend truyền lên"""
        try:
            while True:
                text = await websocket.receive_text()
                try:
                    cmd = json.loads(text)
                    action = cmd.get("action")
                    if action == "spawn":
                        dest = cmd.get("destination", "Miền Bắc")
                        simulation_manager.spawn_parcel(destination=dest)
                    elif action == "pause":
                        simulation_manager.is_running = False
                    elif action == "resume":
                        simulation_manager.is_running = True
                    elif action == "speed":
                        simulation_manager.speed_multiplier = float(cmd.get("value", 1.0))
                    elif action == "reset":
                        simulation_manager.parcels.clear()
                        simulation_manager.total_sorted = 0
                except json.JSONDecodeError:
                    pass
        except WebSocketDisconnect:
            pass
        except Exception as e:
            logger.warning(f"Lỗi nhận lệnh WebSocket: {e}")

    # Chạy task lắng nghe song song với task phát sóng
    receive_task = asyncio.create_task(receive_commands())

    try:
        while True:
            # Lấy snapshot trạng thái mô phỏng thời gian thực
            state = simulation_manager.get_current_state()
            await websocket.send_json(state)

            # Tối ưu nhịp khung hình chuẩn 60 FPS (1/60s ≈ 0.0166s)
            await asyncio.sleep(1.0 / 60.0)

    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.info(f"WebSocket session kết thúc: {e}")
        manager.disconnect(websocket)
    finally:
        receive_task.cancel()
