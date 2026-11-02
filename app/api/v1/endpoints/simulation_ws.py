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
    - Nhận lệnh tương tác từ người dùng (SPAWN_PACKAGE, PING, SET_GATE, CLEAR_JAM, E-STOP...).
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
                    elif action == "TOGGLE_OCCLUSION":
                        enable = payload.get("enable")
                        warehouse_simulation.toggle_occlusion(enable)
                    elif action == "TOGGLE_AUTO_SPAWN":
                        enable = payload.get("enable")
                        warehouse_simulation.toggle_auto_spawn(enable)
                    elif action == "INJECT_PACKAGE":
                        barcode = payload.get("barcode", "")
                        dest = payload.get("destination", "Hà Nội")
                        weight = float(payload.get("weight", 2.0))
                        dims = payload.get("dimensions", "30x20x15")
                        warehouse_simulation.inject_custom_package(barcode, dest, weight, dims)
                    elif action == "ADD_OBSTACLE":
                        ox = float(payload.get("x", 0.0))
                        oy = float(payload.get("y", 0.0))
                        warehouse_simulation.add_obstacle(ox, oy)
                    elif action == "CLEAR_OBSTACLES":
                        warehouse_simulation.clear_obstacles()
                    elif action == "TRIGGER_JAM":
                        gate_id = int(payload.get("gate_id", 1))
                        warehouse_simulation.trigger_jam(gate_id)
                    elif action == "CLEAR_JAM":
                        warehouse_simulation.clear_jam()
                    elif action == "CONVEYOR_REVERSE":
                        dur = float(payload.get("duration", 2.0))
                        warehouse_simulation.conveyor_reverse(dur)
                    elif action == "EMERGENCY_STOP_ALL":
                        enable = bool(payload.get("enable", True))
                        warehouse_simulation.emergency_stop_all(enable)
                    elif action == "FORCE_GATE_ACTUATOR":
                        gate_id = int(payload.get("gate_id", 1))
                        warehouse_simulation.force_gate_diverter(gate_id)
                    elif action == "FORCE_AMR_DOCK":
                        robot_id = str(payload.get("robot_id", "AMR-01"))
                        warehouse_simulation.force_amr_dock(robot_id)
                    elif action == "RESUME_AMR":
                        robot_id = str(payload.get("robot_id", "AMR-01"))
                        warehouse_simulation.resume_amr(robot_id)
                    elif action == "SET_COIL":
                        addr = int(payload.get("addr", 0))
                        val = bool(payload.get("value", False))
                        warehouse_simulation.modbus_engine.datastore.write_coil(addr, val)
                    elif action == "SET_REGISTER":
                        addr = int(payload.get("addr", 0))
                        val = int(payload.get("value", 0))
                        warehouse_simulation.modbus_engine.datastore.write_holding_register(addr, val)
                    elif action == "SET_PLC_MODE":
                        mode = str(payload.get("mode", "RUN")).upper()
                        warehouse_simulation.modbus_engine.cpu_mode = mode
                    elif action == "TRIGGER_RFID_BURST":
                        count = int(payload.get("count", 50))
                        res = warehouse_simulation.rfid_engine.trigger_bulk_scan(count)
                        await websocket.send_json({"type": "RFID_BURST_RESULT", "data": res})
                    elif action == "TOGGLE_RFID_PORTAL":
                        active = payload.get("active")
                        if active is None:
                            warehouse_simulation.rfid_engine.is_active = not warehouse_simulation.rfid_engine.is_active
                        else:
                            warehouse_simulation.rfid_engine.is_active = bool(active)
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
                # Cập nhật frame vật lý (60 FPS = dt ~ 0.016s)
                warehouse_simulation.update_physics(dt=1.0 / 60.0)
                snapshot = warehouse_simulation.get_state_snapshot()
                await websocket.send_json(snapshot)
                await asyncio.sleep(1.0 / 60.0)
        except WebSocketDisconnect:
            pass
        except Exception as e:
            logger.debug(f"Stream kết thúc: {e}")
        finally:
            manager.disconnect(websocket)

    # Chạy đồng thời cả 2 tác vụ: Nhận lệnh và Truyền phát dữ liệu
    await asyncio.gather(receive_commands(), stream_snapshots())
