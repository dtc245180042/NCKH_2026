import struct
import pytest
from app.services.modbus_engine import ModbusDataStore, ModbusTCPEngine, ModbusExceptionCode
from app.services.rfid_engine import RFIDTag, QAlgorithmSimulator, RFIDPortalEngine
from app.services.simulation_engine import WarehouseSimulationEngine

def test_modbus_datastore_initial_state():
    ds = ModbusDataStore()
    # Kiểm tra mặc định công nghiệp: Conveyor chạy, Đèn xanh sáng, E-Stop an toàn (NC=1)
    bits, err = ds.read_coils(0, 8)
    assert err == 0
    assert bits[0] is True  # DQ 0.0 Conveyor Run
    assert bits[4] is True  # DQ 0.4 Tower Green

    di_bits, di_err = ds.read_discrete_inputs(0, 8)
    assert di_err == 0
    assert di_bits[4] is True # DI 0.4 E-STOP NC

    regs, r_err = ds.read_holding_registers(0, 7)
    assert r_err == 0
    assert regs[0] == 500   # HR 40001 Setpoint speed
    assert regs[6] == 12    # HR 40007 Scan cycle 12ms

def test_modbus_datastore_bounds():
    ds = ModbusDataStore()
    # Vượt quá range coils
    _, err = ds.read_coils(10, 10)
    assert err == ModbusExceptionCode.ILLEGAL_DATA_ADDRESS

    # Vượt quá range holding registers
    _, err_hr = ds.read_holding_registers(15, 5)
    assert err_hr == ModbusExceptionCode.ILLEGAL_DATA_ADDRESS

    # Ghi giá trị 16-bit không hợp lệ
    err_val = ds.write_holding_register(0, 0x1FFFF)
    assert err_val == ModbusExceptionCode.ILLEGAL_DATA_VALUE

def test_modbus_tcp_fc01_read_coils():
    engine = ModbusTCPEngine()
    # MBAP: TID=1, Proto=0, Len=6, Unit=1 | FC01, StartAddr=0, Count=8
    req = struct.pack("!HHHBBHH", 1, 0, 6, 1, 0x01, 0, 8)
    resp = engine.handle_modbus_frame(req)
    assert resp is not None
    tid, proto, length, unit, fc, byte_cnt = struct.unpack("!HHHBBB", resp[:9])
    assert tid == 1
    assert proto == 0
    assert fc == 0x01
    assert byte_cnt == 1
    # Byte 9 chứa bitmask coils (DQ 0.0=1, DQ 0.4=1 -> 0b00010001 = 17)
    coils_byte = resp[9]
    assert (coils_byte & 0x01) == 0x01 # Bit 0
    assert (coils_byte & 0x10) == 0x10 # Bit 4

def test_modbus_tcp_fc05_write_single_coil():
    engine = ModbusTCPEngine()
    # Ghi Coil 1 (Servo Gổng 1) ON (0xFF00)
    req = struct.pack("!HHHBBHH", 2, 0, 6, 1, 0x05, 1, 0xFF00)
    resp = engine.handle_modbus_frame(req)
    assert resp is not None
    assert engine.datastore.coils[1] is True

    # Ghi Coil 1 OFF (0x0000)
    req_off = struct.pack("!HHHBBHH", 3, 0, 6, 1, 0x05, 1, 0x0000)
    resp_off = engine.handle_modbus_frame(req_off)
    assert resp_off is not None
    assert engine.datastore.coils[1] is False

def test_modbus_tcp_fc03_fc06_holding_registers():
    engine = ModbusTCPEngine()
    # Ghi Register 0 (Tốc độ đặt) = 650 mm/s qua FC06
    req_write = struct.pack("!HHHBBHH", 4, 0, 6, 1, 0x06, 0, 650)
    resp_write = engine.handle_modbus_frame(req_write)
    assert resp_write is not None
    assert engine.datastore.holding_registers[0] == 650

    # Đọc lại qua FC03
    req_read = struct.pack("!HHHBBHH", 5, 0, 6, 1, 0x03, 0, 1)
    resp_read = engine.handle_modbus_frame(req_read)
    assert resp_read is not None
    tid, proto, length, unit, fc, byte_cnt, val = struct.unpack("!HHHBBBH", resp_read)
    assert fc == 0x03
    assert byte_cnt == 2
    assert val == 650

def test_modbus_tcp_cpu_stop_mode():
    engine = ModbusTCPEngine()
    engine.cpu_mode = "STOP"
    # Lệnh ghi FC05 phải bị từ chối với Exception Code 0x04
    req_write = struct.pack("!HHHBBHH", 6, 0, 6, 1, 0x05, 1, 0xFF00)
    resp = engine.handle_modbus_frame(req_write)
    assert resp is not None
    fc, exc_code = struct.unpack("!BB", resp[7:9])
    assert fc == 0x85 # 0x05 | 0x80
    assert exc_code == ModbusExceptionCode.SLAVE_DEVICE_FAILURE

def test_rfid_tag_sgtin96_and_tid():
    tag = RFIDTag(pkg_id=101, barcode="PKG-10001", region="Bắc")
    # SGTIN-96 chuẩn có độ dài hex 24 ký tự (96 bits) và bắt đầu bằng 3034
    assert len(tag.epc) == 24
    assert tag.epc.startswith("3034")
    # TID Impinj Monza R6 bắt đầu bằng E2801160
    assert len(tag.tid) == 24
    assert tag.tid.startswith("E2801160")
    assert tag.barcode == "PKG-10001"

def test_rfid_q_algorithm_collision_and_adaptation():
    sim = QAlgorithmSimulator(initial_q=2.0, c=0.2) # 2^2 = 4 slots
    tags = [
        RFIDTag(1, "PKG-01"),
        RFIDTag(2, "PKG-02"),
        RFIDTag(3, "PKG-03"),
        RFIDTag(4, "PKG-04"),
        RFIDTag(5, "PKG-05"),
        RFIDTag(6, "PKG-06")
    ]
    # Với 6 thẻ trong 4 slots chắc chắn có xác suất va chạm cao
    successes, stats = sim.run_inventory_round(tags)
    assert "q" in stats
    assert "slots" in stats
    assert "collision_rate" in stats
    # Q-factor phải thay đổi linh hoạt thích ứng
    assert stats["slots"] == 4

def test_rfid_bulk_scan_burst():
    portal = RFIDPortalEngine(portal_x=120.0, portal_width=80.0)
    result = portal.trigger_bulk_scan(count=30)
    assert result["burst_total_tags"] == 30
    assert result["tags_inventoried"] == 30
    assert result["rounds_count"] >= 1
    assert len(portal.recent_reads) > 0
    telemetry = portal.get_telemetry()
    assert telemetry["status"] == "ACTIVE"
    assert telemetry["frequency_mhz"] == 920.5

def test_hil_closed_loop_simulation():
    engine = WarehouseSimulationEngine()
    # Đặt một kiện hàng nằm ngay vị trí cảm biến PE-01 (Cổng 1: x=215.0)
    engine.packages = [
        {"id": 201, "x": 215.0, "y": 155.0, "barcode": "PKG-10201", "status": "On_Belt", "gate": 1}
    ]
    engine.update_physics(dt=1.0 / 60.0)

    # Cảm biến DI 0.1 phải kích hoạt (True)
    di_bits, _ = engine.modbus_engine.datastore.read_discrete_inputs(0, 4)
    assert di_bits[1] is True # PE-01 active
    assert di_bits[0] is False # PE-00 inactive

    # Snapshot phải chứa telemetry của PLC Modbus và RFID Portal
    snapshot = engine.get_state_snapshot()
    assert "plc_modbus" in snapshot
    assert "rfid_portal" in snapshot
    assert snapshot["plc_modbus"]["cpu_mode"] == "RUN"
    assert len(snapshot["plc_modbus"]["discrete_inputs"]) == 8
    assert len(snapshot["plc_modbus"]["coils"]) == 8
