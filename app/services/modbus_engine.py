import asyncio
import struct
import logging
from typing import Dict, List, Optional, Tuple, Any

logger = logging.getLogger(__name__)

class ModbusExceptionCode:
    ILLEGAL_FUNCTION = 0x01
    ILLEGAL_DATA_ADDRESS = 0x02
    ILLEGAL_DATA_VALUE = 0x03
    SLAVE_DEVICE_FAILURE = 0x04

class ModbusDataStore:
    """
    In-memory Data Store cho mô phỏng PLC Siemens S7-1200:
    - Discrete Inputs (1xxxx, Read-Only): DI 0.0 -> DI 0.7
    - Coils (0xxxx, Read/Write): DQ 0.0 -> DQ 0.7
    - Input Registers (3xxxx, Read-Only): AI 0 -> AI 7
    - Holding Registers (4xxxx, Read/Write): HR 40001 -> HR 40016
    """
    def __init__(self):
        # 16 Discrete Inputs
        self.discrete_inputs: List[bool] = [False] * 16
        # 16 Coils
        self.coils: List[bool] = [False] * 16
        # 16 Holding Registers (16-bit unsigned ints)
        self.holding_registers: List[int] = [0] * 16
        # 16 Input Registers
        self.input_registers: List[int] = [0] * 16

        # Thiết lập giá trị mặc định chuẩn công nghiệp
        self.coils[0] = True   # DQ 0.0: Băng chuyền chạy (Conveyor Run)
        self.coils[4] = True   # DQ 0.4: Đèn tháp XANH sáng (Normal Operation)
        self.discrete_inputs[4] = True # DI 0.4: E-STOP Thường đóng (NC = 1 nghĩa là an toàn)

        self.holding_registers[0] = 500  # HR 40001: Setpoint Speed (500 mm/s)
        self.holding_registers[1] = 500  # HR 40002: Actual Speed (500 mm/s)
        self.holding_registers[2] = 0    # HR 40003: Bắc Total Sorted
        self.holding_registers[3] = 0    # HR 40004: Trung Total Sorted
        self.holding_registers[4] = 0    # HR 40005: Nam Total Sorted
        self.holding_registers[5] = 0    # HR 40006: Mã lỗi (0=OK)
        self.holding_registers[6] = 12   # HR 40007: PLC Scan Cycle (12 ms)

    def read_coils(self, start_addr: int, count: int) -> Tuple[Optional[List[bool]], int]:
        if start_addr < 0 or start_addr + count > len(self.coils) or count <= 0 or count > 2000:
            return None, ModbusExceptionCode.ILLEGAL_DATA_ADDRESS
        return self.coils[start_addr:start_addr + count], 0

    def write_coil(self, addr: int, value: bool) -> int:
        if addr < 0 or addr >= len(self.coils):
            return ModbusExceptionCode.ILLEGAL_DATA_ADDRESS
        self.coils[addr] = bool(value)
        return 0

    def read_discrete_inputs(self, start_addr: int, count: int) -> Tuple[Optional[List[bool]], int]:
        if start_addr < 0 or start_addr + count > len(self.discrete_inputs) or count <= 0 or count > 2000:
            return None, ModbusExceptionCode.ILLEGAL_DATA_ADDRESS
        return self.discrete_inputs[start_addr:start_addr + count], 0

    def set_discrete_input(self, addr: int, value: bool) -> int:
        if addr < 0 or addr >= len(self.discrete_inputs):
            return ModbusExceptionCode.ILLEGAL_DATA_ADDRESS
        self.discrete_inputs[addr] = bool(value)
        return 0

    def read_holding_registers(self, start_addr: int, count: int) -> Tuple[Optional[List[int]], int]:
        if start_addr < 0 or start_addr + count > len(self.holding_registers) or count <= 0 or count > 125:
            return None, ModbusExceptionCode.ILLEGAL_DATA_ADDRESS
        return self.holding_registers[start_addr:start_addr + count], 0

    def write_holding_register(self, addr: int, value: int) -> int:
        if addr < 0 or addr >= len(self.holding_registers):
            return ModbusExceptionCode.ILLEGAL_DATA_ADDRESS
        if value < 0 or value > 0xFFFF:
            return ModbusExceptionCode.ILLEGAL_DATA_VALUE
        self.holding_registers[addr] = int(value)
        return 0


class ModbusTCPEngine:
    """
    Bộ giao thức Modbus TCP chuẩn công nghiệp (Pure-Python):
    - Đóng gói & Giải mã MBAP Header (Transaction ID, Protocol ID=0, Length, Unit ID).
    - Hỗ trợ các Function Code cốt lõi:
      * FC01 (0x01): Read Coils
      * FC02 (0x02): Read Discrete Inputs
      * FC03 (0x03): Read Holding Registers
      * FC05 (0x05): Write Single Coil
      * FC06 (0x06): Write Single Holding Register
      * FC15 (0x0F): Write Multiple Coils
      * FC16 (0x10): Write Multiple Holding Registers
    - Tích hợp Socket Server AsyncIO không chặn.
    """
    def __init__(self, datastore: Optional[ModbusDataStore] = None):
        self.datastore = datastore or ModbusDataStore()
        self.server: Optional[asyncio.Server] = None
        self.is_running = False
        self.host = "127.0.0.1"
        self.port = 5020
        self.cpu_mode = "RUN"  # "RUN", "STOP", "ERROR"

    def process_pdu(self, function_code: int, pdu_data: bytes) -> bytes:
        """Xử lý PDU và trả về response PDU hoặc Exception PDU"""
        if self.cpu_mode == "STOP" and function_code not in (0x01, 0x02, 0x03, 0x04):
            # Ở chế độ STOP, chỉ cho phép đọc, từ chối lệnh ghi điều khiển
            return struct.pack("!BB", function_code | 0x80, ModbusExceptionCode.SLAVE_DEVICE_FAILURE)

        try:
            # FC01: Read Coils
            if function_code == 0x01:
                start_addr, count = struct.unpack("!HH", pdu_data[:4])
                bits, err = self.datastore.read_coils(start_addr, count)
                if err != 0 or bits is None:
                    return struct.pack("!BB", function_code | 0x80, err)
                byte_count = (count + 7) // 8
                packed_bytes = bytearray(byte_count)
                for i, bit in enumerate(bits):
                    if bit:
                        packed_bytes[i // 8] |= (1 << (i % 8))
                return struct.pack("!BB", function_code, byte_count) + bytes(packed_bytes)

            # FC02: Read Discrete Inputs
            elif function_code == 0x02:
                start_addr, count = struct.unpack("!HH", pdu_data[:4])
                bits, err = self.datastore.read_discrete_inputs(start_addr, count)
                if err != 0 or bits is None:
                    return struct.pack("!BB", function_code | 0x80, err)
                byte_count = (count + 7) // 8
                packed_bytes = bytearray(byte_count)
                for i, bit in enumerate(bits):
                    if bit:
                        packed_bytes[i // 8] |= (1 << (i % 8))
                return struct.pack("!BB", function_code, byte_count) + bytes(packed_bytes)

            # FC03: Read Holding Registers
            elif function_code == 0x03:
                start_addr, count = struct.unpack("!HH", pdu_data[:4])
                regs, err = self.datastore.read_holding_registers(start_addr, count)
                if err != 0 or regs is None:
                    return struct.pack("!BB", function_code | 0x80, err)
                byte_count = count * 2
                res = struct.pack("!BB", function_code, byte_count)
                for val in regs:
                    res += struct.pack("!H", val)
                return res

            # FC05: Write Single Coil
            elif function_code == 0x05:
                addr, val = struct.unpack("!HH", pdu_data[:4])
                # 0xFF00 = ON (True), 0x0000 = OFF (False)
                if val not in (0xFF00, 0x0000):
                    return struct.pack("!BB", function_code | 0x80, ModbusExceptionCode.ILLEGAL_DATA_VALUE)
                bool_val = (val == 0xFF00)
                err = self.datastore.write_coil(addr, bool_val)
                if err != 0:
                    return struct.pack("!BB", function_code | 0x80, err)
                # Echo lại đúng request PDU khi thành công
                return struct.pack("!BHH", function_code, addr, val)

            # FC06: Write Single Holding Register
            elif function_code == 0x06:
                addr, val = struct.unpack("!HH", pdu_data[:4])
                err = self.datastore.write_holding_register(addr, val)
                if err != 0:
                    return struct.pack("!BB", function_code | 0x80, err)
                return struct.pack("!BHH", function_code, addr, val)

            # FC15 (0x0F): Write Multiple Coils
            elif function_code == 0x0F:
                addr, count, byte_count = struct.unpack("!HHB", pdu_data[:5])
                data_bytes = pdu_data[5:5+byte_count]
                for i in range(count):
                    bit_val = bool(data_bytes[i // 8] & (1 << (i % 8)))
                    err = self.datastore.write_coil(addr + i, bit_val)
                    if err != 0:
                        return struct.pack("!BB", function_code | 0x80, err)
                return struct.pack("!BHH", function_code, addr, count)

            # FC16 (0x10): Write Multiple Holding Registers
            elif function_code == 0x10:
                addr, count, byte_count = struct.unpack("!HHB", pdu_data[:5])
                for i in range(count):
                    val = struct.unpack("!H", pdu_data[5 + i*2 : 7 + i*2])[0]
                    err = self.datastore.write_holding_register(addr + i, val)
                    if err != 0:
                        return struct.pack("!BB", function_code | 0x80, err)
                return struct.pack("!BHH", function_code, addr, count)

            else:
                return struct.pack("!BB", function_code | 0x80, ModbusExceptionCode.ILLEGAL_FUNCTION)

        except Exception as ex:
            logger.error(f"Modbus PDU processing exception: {ex}")
            return struct.pack("!BB", function_code | 0x80, ModbusExceptionCode.SLAVE_DEVICE_FAILURE)

    def handle_modbus_frame(self, request_bytes: bytes) -> Optional[bytes]:
        """
        Phân tích frame Modbus TCP (MBAP Header + PDU) và sinh response frame
        MBAP Header:
        - 0..1: Transaction Identifier (2 bytes)
        - 2..3: Protocol Identifier (2 bytes, 0 = Modbus TCP)
        - 4..5: Length (2 bytes, số byte tiếp theo bao gồm Unit ID + PDU)
        - 6:    Unit Identifier (1 byte, slave address)
        - 7:    Function Code (1 byte)
        - 8..:  Data
        """
        if len(request_bytes) < 7:
            return None

        tid, proto_id, length, unit_id = struct.unpack("!HHHB", request_bytes[:7])
        if proto_id != 0:
            return None

        pdu = request_bytes[7:]
        if len(pdu) < 1:
            return None

        fc = pdu[0]
        pdu_data = pdu[1:]

        response_pdu = self.process_pdu(fc, pdu_data)
        resp_len = 1 + len(response_pdu) # Unit ID (1) + Response PDU

        resp_mbap = struct.pack("!HHHB", tid, proto_id, resp_len, unit_id)
        return resp_mbap + response_pdu

    async def _handle_client(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
        """Xử lý phiên giao tiếp TCP song song với các trạm SCADA / PLC clients"""
        peer = writer.get_extra_info("peername")
        logger.info(f"Modbus client kết nối từ {peer}")
        try:
            while self.is_running:
                header_data = await reader.read(7)
                if not header_data or len(header_data) < 7:
                    break
                tid, proto, length, unit_id = struct.unpack("!HHHB", header_data)
                remaining_len = length - 1  # Đã đọc unit_id
                if remaining_len > 0:
                    pdu_data = await reader.read(remaining_len)
                else:
                    pdu_data = b""

                full_frame = header_data + pdu_data
                response_frame = self.handle_modbus_frame(full_frame)
                if response_frame:
                    writer.write(response_frame)
                    await writer.drain()
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.debug(f"Modbus client error: {e}")
        finally:
            writer.close()
            await writer.wait_closed()
            logger.info(f"Modbus client {peer} đã ngắt kết nối.")

    async def start_server(self, host: str = "127.0.0.1", port: int = 5020):
        """Khởi động Async Modbus TCP Server"""
        if self.is_running:
            return
        self.host = host
        self.port = port
        try:
            self.server = await asyncio.start_server(self._handle_client, host, port)
            self.is_running = True
            logger.info(f"Modbus TCP Server đang lắng nghe tại {host}:{port}")
        except Exception as e:
            logger.warning(f"Không thể bind port {port} cho Modbus TCP: {e}")

    async def stop_server(self):
        """Dừng Modbus TCP Server an toàn"""
        if self.server:
            self.server.close()
            await self.server.wait_closed()
            self.server = None
        self.is_running = False
        logger.info("Modbus TCP Server đã dừng.")

    def get_scada_telemetry(self) -> Dict[str, Any]:
        """Tổng hợp telemetry cho SCADA UX/UI & Digital Twin"""
        di_labels = [
            "DI 0.0 - Cảm biến PE-00 (Vào băng)",
            "DI 0.1 - Cảm biến PE-01 (Cổng 1 Bắc)",
            "DI 0.2 - Cảm biến PE-02 (Cổng 2 Trung)",
            "DI 0.3 - Cảm biến PE-03 (Cổng 3 Nam)",
            "DI 0.4 - Nút dừng E-STOP (Thường đóng NC)",
            "DI 0.5 - Cảm biến kẹt kẹt băng Jam-01",
            "DI 0.6 - Công tắc chọn chế độ Tự động",
            "DI 0.7 - Tín hiệu sẵn sàng cổng RFID"
        ]
        dq_labels = [
            "DQ 0.0 - Động cơ băng chuyền Main Drive",
            "DQ 0.1 - Servo gạt Cổng 1 (Miền Bắc)",
            "DQ 0.2 - Servo gạt Cổng 2 (Miền Trung)",
            "DQ 0.3 - Servo gạt Cổng 3 (Miền Nam)",
            "DQ 0.4 - Đèn tháp XANH (Normal)",
            "DQ 0.5 - Đèn tháp VÀNG (Sorting)",
            "DQ 0.6 - Đèn tháp ĐỎ & Còi báo kẹt",
            "DQ 0.7 - Kích hoạt ăng-ten RFID Portal"
        ]
        hr_labels = [
            {"addr": 40001, "name": "Conveyor Setpoint Speed", "value": self.datastore.holding_registers[0], "unit": "mm/s"},
            {"addr": 40002, "name": "Conveyor Actual Speed", "value": self.datastore.holding_registers[1], "unit": "mm/s"},
            {"addr": 40003, "name": "Miền Bắc Sorted Count", "value": self.datastore.holding_registers[2], "unit": "pkgs"},
            {"addr": 40004, "name": "Miền Trung Sorted Count", "value": self.datastore.holding_registers[3], "unit": "pkgs"},
            {"addr": 40005, "name": "Miền Nam Sorted Count", "value": self.datastore.holding_registers[4], "unit": "pkgs"},
            {"addr": 40006, "name": "PLC System Error Code", "value": self.datastore.holding_registers[5], "unit": "code"},
            {"addr": 40007, "name": "S7-1200 Scan Cycle Time", "value": self.datastore.holding_registers[6], "unit": "ms"}
        ]

        return {
            "plc_name": "Siemens SIMATIC S7-1200 (CPU 1214C DC/DC/DC)",
            "ip_address": f"{self.host}:{self.port}",
            "cpu_mode": self.cpu_mode,
            "scan_time_ms": self.datastore.holding_registers[6],
            "discrete_inputs": [
                {"pin": f"DI 0.{i}", "label": di_labels[i], "state": self.datastore.discrete_inputs[i]}
                for i in range(8)
            ],
            "coils": [
                {"pin": f"DQ 0.{i}", "label": dq_labels[i], "state": self.datastore.coils[i]}
                for i in range(8)
            ],
            "holding_registers": hr_labels
        }
