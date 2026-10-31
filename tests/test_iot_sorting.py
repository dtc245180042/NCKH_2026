import time
import pytest
from app.services.sorting_controller import SortingGateController

def test_virtual_attribution_zipcode_routing():
    """
    Kiểm thử thuật toán ánh xạ mã bưu chính (Virtual Attribution - LOG-114):
    - 10000..39999 -> Cổng 1 (Miền Bắc)
    - 40000..69999 -> Cổng 2 (Miền Trung)
    - 70000..99999 -> Cổng 3 (Miền Nam)
    - Mã không hợp lệ -> None (Trôi về làn kiểm tra lại Re-check)
    """
    controller = SortingGateController()

    # Miền Bắc
    assert controller.route_by_zipcode("10000") == 1
    assert controller.route_by_zipcode("VN-12500") == 1
    assert controller.route_by_zipcode("39999") == 1

    # Miền Trung
    assert controller.route_by_zipcode("40000") == 2
    assert controller.route_by_zipcode("55000") == 2
    assert controller.route_by_zipcode("69999") == 2

    # Miền Nam
    assert controller.route_by_zipcode("70000") == 3
    assert controller.route_by_zipcode("84000") == 3
    assert controller.route_by_zipcode("99999") == 3

    # Ngoại lệ: Mã lỗi / không đọc được
    assert controller.route_by_zipcode("UNKNOWN") is None
    assert controller.route_by_zipcode("123") is None
    assert controller.route_by_zipcode("") is None


def test_gate_trigger_and_diverter_angle():
    """Kiểm thử mở cần gạt góc 45 độ khi bưu kiện tới vạch kích hoạt"""
    controller = SortingGateController()
    now = time.time()

    # Kích hoạt Cổng 1
    success = controller.trigger_gate(1, now=now)
    assert success is True
    gate1 = controller.gates[1]
    assert gate1["status"] == "DIVERTING"
    assert gate1["angle"] == 45.0

    # Cảm biến cửa làn xác nhận bưu kiện rơi an toàn sau 0.8s
    controller.confirm_package_diverted(1)
    assert gate1["status"] == "IDLE"
    assert gate1["angle"] == 0.0
    assert gate1["diverted_count"] == 1


def test_anti_jam_mechanism_and_emergency_stop():
    """
    Kiểm thử cơ chế chống kẹt hàng (Anti-jam - LOG-115):
    - Cổng mở quá 3.0 giây mà cảm biến chưa xác nhận -> Kích hoạt JAMMED & Dừng khẩn cấp.
    - Xử lý giải phóng kẹt hàng (clear_jam) -> Khôi phục hệ thống hoạt động bình thường.
    """
    controller = SortingGateController()
    t0 = 1000.0

    # Mở Cổng 2 lúc t = 1000.0
    controller.trigger_gate(2, now=t0)
    assert controller.is_emergency_stopped is False

    # Tại t = 1001.0 (sau 1.0s, chưa quá ngưỡng 3s)
    res = controller.update_gate_states(now=t0 + 1.0)
    assert res["emergency_stop"] is False
    assert controller.gates[2]["status"] == "DIVERTING"

    # Tại t = 1003.5 (sau 3.5s, vượt ngưỡng 3.0s -> Phát hiện kẹt bưu kiện)
    res_jam = controller.update_gate_states(now=t0 + 3.5)
    assert res_jam["emergency_stop"] is True
    assert res_jam["jam_detected"] is True
    assert res_jam["jammed_gate_id"] == 2
    assert controller.gates[2]["status"] == "JAMMED"
    assert controller.is_emergency_stopped is True

    # Giải phóng kẹt hàng
    controller.clear_jam()
    assert controller.is_emergency_stopped is False
    assert controller.gates[2]["status"] == "IDLE"
    assert controller.gates[2]["angle"] == 0.0

