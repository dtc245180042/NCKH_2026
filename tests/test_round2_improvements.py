import io
import openpyxl
import pytest
from app.services.simulation_engine import WarehouseSimulationEngine, PROVINCES_CATALOG
from app.models.user import User
from app.api.v1.endpoints.export_excel import export_warehouse_excel_report


def test_two_stage_province_routing_catalog():
    """Kiểm tra danh mục định tuyến 9 Tỉnh/Thành phố theo 3 miền"""
    assert len(PROVINCES_CATALOG) == 9
    assert PROVINCES_CATALOG["Hà Nội"]["gate"] == 1
    assert PROVINCES_CATALOG["Hà Nội"]["region"] == "Bắc"
    assert PROVINCES_CATALOG["Đà Nẵng"]["gate"] == 2
    assert PROVINCES_CATALOG["Đà Nẵng"]["region"] == "Trung"
    assert PROVINCES_CATALOG["TP. Hồ Chí Minh"]["gate"] == 3
    assert PROVINCES_CATALOG["TP. Hồ Chí Minh"]["region"] == "Nam"


def test_custom_package_injection_and_auto_spawn_toggle():
    """Kiểm tra bơm kiện hàng thủ công từ form và công tắc Auto-Spawn"""
    sim = WarehouseSimulationEngine()
    initial_count = len(sim.packages)

    # 1. Bơm kiện hàng tùy chọn về Đà Nẵng
    new_pkg = sim.inject_custom_package("PKG-TEST-DANANG", destination_code="Đà Nẵng", weight=3.5)
    assert len(sim.packages) == initial_count + 1
    assert new_pkg["barcode"] == "PKG-TEST-DANANG"
    assert new_pkg["province"] == "Đà Nẵng"
    assert new_pkg["gate"] == 2
    assert new_pkg["x"] == 42.0
    assert new_pkg["status"] == "On_Belt"

    # 2. Kiểm tra công tắc Auto-Spawn
    assert sim.auto_spawn is True
    sim.toggle_auto_spawn(False)
    assert sim.auto_spawn is False
    sim.toggle_auto_spawn(True)
    assert sim.auto_spawn is True


def test_anti_jam_detection_and_reverse_clear():
    """Kiểm tra phát hiện sự cố kẹt hàng và chu trình đảo chiều giải phóng điểm kẹt"""
    sim = WarehouseSimulationEngine()
    assert sim.is_jammed is False

    # Giả lập kẹt hàng Cổng 1
    sim.trigger_jam(gate_id=1)
    assert sim.is_jammed is True
    assert sim.sorting_controller.is_emergency_stopped is True
    # Khi kẹt hàng, snapshot phải báo động
    snap = sim.get_state_snapshot()
    assert snap["jam_alert"]["active"] is True
    assert snap["conveyor_running"] is False

    # Kích hoạt giải tỏa kẹt (Jam Clear)
    sim.clear_jam()
    assert sim.is_jammed is False
    assert sim.is_reversed is True
    assert sim.reverse_timer > 0.0


def test_amr_low_battery_and_preemption():
    """Kiểm tra AMR tự động về trạm sạc khi pin yếu và ngắt sạc khẩn cấp khi dồn ứ hàng"""
    sim = WarehouseSimulationEngine()
    robot = sim.amrs[0]

    # Giả lập pin yếu < 20%
    robot["battery"] = 18.0
    robot["state"] = "WAITING_FOR_CARGO"
    sim.update_physics(dt=1.0 / 60.0)

    # Robot phải chuyển sang trạng thái GOING_TO_DOCK
    assert robot["state"] in ("GOING_TO_DOCK", "CHARGING_AT_DOCK")

    # Giả lập robot đang ở trạm sạc và đạt pin 28%
    robot["state"] = "CHARGING_AT_DOCK"
    robot["battery"] = 28.0

    # Giả lập máng trượt Cổng 1 bị dồn ứ 2 kiện hàng
    sim.packages.append({"id": 901, "x": 240.0, "y": 240.0, "status": "Sorted", "divert_gate": 1, "barcode": "PKG-S1"})
    sim.packages.append({"id": 902, "x": 240.0, "y": 240.0, "status": "Sorted", "divert_gate": 1, "barcode": "PKG-S2"})

    sim.update_physics(dt=1.0 / 60.0)
    # Preemption phải kích hoạt -> Robot ngắt sạc khẩn cấp ra nhận nhiệm vụ
    assert robot["charge_boost"] is True
    assert robot["state"] == "RETURNING"


def test_audit_trail_sha256_hash():
    """Kiểm tra tính toàn vẹn của chuỗi nhật ký kiểm toán với mã băm SHA-256"""
    sim = WarehouseSimulationEngine()
    sim.log_audit_event("TEST_ACTION", "TEST_ACTOR", "Kiểm thử mã băm toàn vẹn", "SUCCESS")
    assert len(sim.audit_events) > 0
    last_event = sim.audit_events[-1]
    assert last_event["action"] == "TEST_ACTION"
    assert "sha256" in last_event
    assert len(last_event["sha256"]) > 10


def test_excel_export_three_sheets_and_content():
    """Kiểm tra API xuất file Excel (.xlsx) chuẩn công nghiệp 3 Sheets"""
    dummy_user = User(id=1, username="admin", full_name="System Administrator", role="Admin", is_active=True)
    resp = export_warehouse_excel_report(current_user=dummy_user)

    # Đọc bytes của file Excel
    content = resp.body
    assert len(content) > 5000 # File xlsx hợp lệ phải có dung lượng từ vài KB trở lên

    wb = openpyxl.load_workbook(io.BytesIO(content))
    sheet_names = wb.sheetnames
    assert "KPI_Tong_Quan" in sheet_names
    assert "Kien_Hang_Tinh_Thanh" in sheet_names
    assert "Nhat_Ky_Kiem_Toan" in sheet_names

    ws1 = wb["KPI_Tong_Quan"]
    assert "BÁO CÁO VẬN HÀNH" in str(ws1["A1"].value)
    ws2 = wb["Kien_Hang_Tinh_Thanh"]
    assert "9 TỈNH/THÀNH PHỐ" in str(ws2["A1"].value)
    ws3 = wb["Nhat_Ky_Kiem_Toan"]
    assert "NHẬT KÝ KIỂM TOÁN" in str(ws3["A1"].value)
