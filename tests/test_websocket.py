import pytest
from fastapi.testclient import TestClient
from app.main import app

def test_websocket_simulation_connection_and_stream():
    """
    Kiểm thử kênh WebSocket /api/v1/ws/simulation/stream (TC-32 đến TC-35):
    - Kết nối handshake WebSocket thành công (101 Switching Protocols).
    - Nhận snapshot dữ liệu mô phỏng chứa đúng cấu trúc: packages, gates, amr.
    - Gửi lệnh tương tác 'SPAWN_PACKAGE' lên server.
    - Nhận gói tin tiếp theo xác nhận bưu kiện mới đã được đưa vào mô phỏng.
    """
    with TestClient(app) as client:
        with client.websocket_connect("/api/v1/ws/simulation/stream") as websocket:
            # 1. Nhận frame đầu tiên
            data = websocket.receive_json()
            assert "timestamp" in data
            assert "packages" in data
            assert "gates" in data
            assert "amr" in data
            assert "ai_vision" in data
            assert data["ai_vision"]["id_switches"] == 0
            assert len(data["gates"]) == 3
            assert data["amr"]["id"] == "AMR-01"

            # 2. Gửi lệnh kích hoạt che khuất bưu kiện (Occlusion test)
            websocket.send_json({"action": "TOGGLE_OCCLUSION", "enable": True})

            # Frame tiếp theo xác nhận occlusion_simulated = True
            frame_occ = websocket.receive_json()
            assert frame_occ["ai_vision"]["occlusion_simulated"] is True

            # 3. Gửi lệnh tạo kiện hàng qua WebSocket
            cmd = {
                "action": "SPAWN_PACKAGE",
                "barcode": "PKG-WS-TEST-88"
            }
            websocket.send_json(cmd)

            # 4. Đọc các frames tiếp theo để xác nhận kiện hàng xuất hiện
            found = False
            for _ in range(5):
                frame = websocket.receive_json()
                barcodes = [p["barcode"] for p in frame.get("packages", [])]
                if "PKG-WS-TEST-88" in barcodes:
                    found = True
                    break

            assert found, "Kiện hàng tạo qua WebSocket không xuất hiện trong luồng snapshot"

