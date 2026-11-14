import random
import time
import math
from typing import Dict, List, Optional, Any, Tuple

class RFIDTag:
    """
    Biểu diễn một thẻ RFID UHF chuẩn EPCglobal Gen2 (ISO/IEC 18000-6C):
    - EPC (Electronic Product Code): 96-bit (SGTIN-96)
    - TID (Transponder ID): 96-bit duy nhất xuất xưởng (Chip Impinj Monza R6)
    - User Memory: 512-bit
    """
    def __init__(self, pkg_id: int, barcode: str, region: str = "Bắc"):
        self.pkg_id = pkg_id
        self.barcode = barcode
        self.region = region
        self.epc = self._generate_sgtin96(pkg_id, barcode)
        self.tid = self._generate_tid(pkg_id)
        self.read_count = 0
        self.rssi = -60.0
        self.antenna_port = 1
        self.last_read_time = 0.0
        self.inventoried = False

    def _generate_sgtin96(self, pkg_id: int, barcode: str) -> str:
        # Chuẩn SGTIN-96: Header (8 bits) = 0x30 | Filter (3) | Partition (3) | Company (24) | Item (20) | Serial (38)
        # Sinh chuỗi Hex 24 ký tự (96 bits)
        clean_num = "".join([c for c in barcode if c.isdigit()]) or str(pkg_id)
        item_ref = int(clean_num) % 100000
        serial = (pkg_id * 1234567) & 0x3FFFFFFFFF
        company_prefix = 0x893501 # Mã doanh nghiệp Việt Nam GS1
        # Ghép thành hex 24 ký tự
        return f"3034{company_prefix:06X}{item_ref:05X}{serial:010X}"[:24].upper()

    def _generate_tid(self, pkg_id: int) -> str:
        # TID Monza R6: E2801160 (Impinj class) + serial 64-bit
        monza_prefix = "E2801160"
        chip_serial = f"{(pkg_id * 9876543210 + 0xABCDEF):016X}"[-16:]
        return f"{monza_prefix}{chip_serial}".upper()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "pkg_id": self.pkg_id,
            "barcode": self.barcode,
            "epc": self.epc,
            "tid": self.tid,
            "region": self.region,
            "rssi": round(self.rssi, 1),
            "antenna_port": self.antenna_port,
            "read_count": self.read_count,
            "last_read_time": round(self.last_read_time, 2)
        }


class QAlgorithmSimulator:
    """
    Thuật toán chống va chạm vô tuyến Q-Algorithm (Dynamic Slotted-Aloha EPC Gen2):
    - Bộ đọc phát Query với tham số nguyên Q (0 <= Q <= 15).
    - Số khe (Slots) = 2^Q.
    - Mỗi thẻ chọn ngẫu nhiên một khe trong [0, 2^Q - 1].
    - Cập nhật thích ứng (Adaptive Q-adjustment):
      * Nếu va chạm (Collision > 1 tag): Q = min(15, Q + c)
      * Nếu không có thẻ (Empty slot): Q = max(0, Q - c)
      * Nếu đọc thành công (1 tag): Q = max(0, Q - c) (hoặc giữ nguyên theo chuẩn ISO)
      * Giá trị c thường nằm trong khoảng 0.1 đến 0.5 (mặc định c = 0.2).
    """
    def __init__(self, initial_q: float = 4.0, c: float = 0.2):
        self.q = initial_q
        self.c = c
        self.total_rounds = 0
        self.total_slots = 0
        self.total_collisions = 0
        self.total_successes = 0
        self.total_empties = 0

    def run_inventory_round(self, tags: List[RFIDTag]) -> Tuple[List[RFIDTag], Dict[str, Any]]:
        """
        Thực thi một chu kỳ kiểm kê Slotted-Aloha cho tập thẻ hiện có trong trường sóng.
        Trả về danh sách thẻ đọc thành công trong chu kỳ và thống kê hiệu năng.
        """
        uninventoried_tags = [t for t in tags if not t.inventoried]
        if not uninventoried_tags:
            return [], {
                "q": round(self.q, 2),
                "slots": 2 ** int(round(self.q)),
                "success": 0,
                "collisions": 0,
                "empties": 0,
                "collision_rate": 0.0
            }

        slots_count = 2 ** int(round(self.q))
        slots_allocation: Dict[int, List[RFIDTag]] = {i: [] for i in range(slots_count)}

        # Mỗi thẻ chọn ngẫu nhiên một khe trong [0, slots_count - 1]
        for tag in uninventoried_tags:
            chosen_slot = random.randint(0, slots_count - 1)
            slots_allocation[chosen_slot].append(tag)

        successful_tags: List[RFIDTag] = []
        round_collisions = 0
        round_empties = 0
        round_successes = 0

        for slot_idx, allocated in slots_allocation.items():
            if len(allocated) == 0:
                # Khe rỗng -> Giảm Q để co hẹp khoảng trống
                round_empties += 1
                self.q = max(0.0, self.q - self.c)
            elif len(allocated) == 1:
                # Đọc thành công 1 thẻ duy nhất
                tag = allocated[0]
                tag.inventoried = True
                tag.read_count += 1
                tag.last_read_time = time.time()
                successful_tags.append(tag)
                round_successes += 1
                self.q = max(0.0, self.q - (self.c * 0.5))
            else:
                # Va chạm sóng giữa >= 2 thẻ -> Tăng Q để mở rộng khe thời gian
                round_collisions += 1
                self.q = min(15.0, self.q + self.c)

        self.total_rounds += 1
        self.total_slots += slots_count
        self.total_collisions += round_collisions
        self.total_successes += round_successes
        self.total_empties += round_empties

        collision_rate = (round_collisions / slots_count) if slots_count > 0 else 0.0

        stats = {
            "q": round(self.q, 2),
            "slots": slots_count,
            "success": round_successes,
            "collisions": round_collisions,
            "empties": round_empties,
            "collision_rate": round(collision_rate * 100, 1),
            "remaining_uninventoried": len(tags) - len(successful_tags)
        }
        return successful_tags, stats


class RFIDPortalEngine:
    """
    Cổng quét RFID UHF công nghiệp (Cổng vòm kiểm soát đầu vào băng chuyền):
    - Tần số hoạt động: 920.5 MHz (Băng tần UHF Việt Nam / ETSI / FCC).
    - Công suất phát: 30 dBm (1000 mW).
    - Cụm 4 ăng-ten phân cực tròn (4 Ports Circular Polarized Antennas).
    - Tích hợp mô hình lan truyền sóng vô tuyến Friis & tính toán RSSI.
    - Quản lý danh sách thẻ đã quét, lưu vết lịch sử và thông lượng (Throughput).
    """
    def __init__(self, portal_x: float = 120.0, portal_width: float = 80.0):
        self.portal_x = portal_x          # Tâm cổng quét trên trục X của băng chuyền
        self.portal_width = portal_width  # Vùng phủ sóng: [X - width/2, X + width/2]
        self.frequency_mhz = 920.5
        self.tx_power_dbm = 30.0
        self.is_active = True

        self.q_simulator = QAlgorithmSimulator(initial_q=4.0, c=0.2)
        self.known_tags: Dict[int, RFIDTag] = {}
        self.recent_reads: List[Dict[str, Any]] = []
        self.total_scans_count = 0
        self.throughput_tag_per_sec = 0.0
        self.last_throughput_calc = time.time()
        self.reads_in_window = 0

    def calculate_rssi(self, pkg_x: float, antenna_port: int) -> float:
        """Tính toán RSSI dựa trên khoảng cách tới tâm cổng quét (mô hình suy hao Friis)"""
        dist = abs(pkg_x - self.portal_x)
        max_dist = self.portal_width / 2.0
        norm_dist = min(1.0, dist / max_dist)
        # RSSI cao nhất tại tâm (-44 dBm), giảm dần ra mép (-76 dBm) kèm nhiễu ngẫu nhiên
        base_rssi = -44.0 - (norm_dist * 32.0)
        noise = random.uniform(-1.5, 1.5)
        return max(-80.0, min(-40.0, base_rssi + noise))

    def process_conveyor_packages(self, packages: List[Dict[str, Any]]):
        """Kiểm tra kiện hàng trong vùng phủ sóng của cổng quét và kích hoạt Q-Algorithm"""
        if not self.is_active:
            return

        min_x = self.portal_x - (self.portal_width / 2.0)
        max_x = self.portal_x + (self.portal_width / 2.0)

        # Lọc các kiện hàng đang nằm trọn trong vùng bức xạ vô tuyến của cổng
        in_zone_pkgs = [p for p in packages if min_x <= p.get("x", 0) <= max_x and p.get("status") == "On_Belt"]
        if not in_zone_pkgs:
            return

        in_zone_tags: List[RFIDTag] = []
        for p in in_zone_pkgs:
            pkg_id = p["id"]
            if pkg_id not in self.known_tags:
                region = "Bắc" if p.get("gate") == 1 else ("Trung" if p.get("gate") == 2 else "Nam")
                self.known_tags[pkg_id] = RFIDTag(pkg_id, p.get("barcode", f"PKG-{pkg_id}"), region)

            tag = self.known_tags[pkg_id]
            ant = random.randint(1, 4)
            tag.antenna_port = ant
            tag.rssi = self.calculate_rssi(p["x"], ant)
            in_zone_tags.append(tag)

        # Chạy thuật toán Q-Algorithm
        successes, stats = self.q_simulator.run_inventory_round(in_zone_tags)
        for tag in successes:
            self.total_scans_count += 1
            self.reads_in_window += 1
            tag_dict = tag.to_dict()
            self.recent_reads.insert(0, tag_dict)
            if len(self.recent_reads) > 20:
                self.recent_reads.pop()

        # Cập nhật thông lượng (Throughput)
        now = time.time()
        if now - self.last_throughput_calc >= 1.0:
            self.throughput_tag_per_sec = round(self.reads_in_window / (now - self.last_throughput_calc), 1)
            self.reads_in_window = 0
            self.last_throughput_calc = now

    def trigger_bulk_scan(self, count: int = 50) -> Dict[str, Any]:
        """
        Mô phỏng trường hợp bắn kiểm kê hàng loạt (Bulk Inventory Burst):
        Đưa đồng thời 50-100 pallet thẻ qua cổng để kiểm thử độ co giãn thích ứng của Q-Algorithm.
        """
        bulk_tags: List[RFIDTag] = []
        base_id = 9000
        for i in range(count):
            t_id = base_id + i
            barcode = f"PALLET-BULK-{t_id}"
            reg = "Bắc" if i % 3 == 0 else ("Trung" if i % 3 == 1 else "Nam")
            tag = RFIDTag(t_id, barcode, reg)
            tag.rssi = random.uniform(-65.0, -48.0)
            tag.antenna_port = (i % 4) + 1
            bulk_tags.append(tag)

        # Chạy kiểm kê nhiều vòng cho đến khi đọc hết hoặc đạt tối đa 20 vòng
        rounds_history = []
        start_time = time.time()
        total_read = 0

        while any(not t.inventoried for t in bulk_tags) and len(rounds_history) < 20:
            successes, round_stat = self.q_simulator.run_inventory_round(bulk_tags)
            total_read += len(successes)
            rounds_history.append(round_stat)
            for t in successes:
                self.recent_reads.insert(0, t.to_dict())
                if len(self.recent_reads) > 20:
                    self.recent_reads.pop()

        duration_ms = (time.time() - start_time) * 1000.0
        self.total_scans_count += total_read

        return {
            "burst_total_tags": count,
            "tags_inventoried": total_read,
            "rounds_count": len(rounds_history),
            "final_q": round(self.q_simulator.q, 2),
            "duration_ms": round(duration_ms, 2),
            "throughput_speed": f"{int((total_read / (duration_ms / 1000.0))) if duration_ms > 0 else 0} tags/sec",
            "rounds_history": rounds_history
        }

    def get_telemetry(self) -> Dict[str, Any]:
        return {
            "portal_name": "RFID UHF Bulk Portal Gateway (Impinj Speedway R420)",
            "status": "ACTIVE" if self.is_active else "STANDBY",
            "frequency_mhz": self.frequency_mhz,
            "tx_power_dbm": self.tx_power_dbm,
            "antenna_count": 4,
            "q_factor": round(self.q_simulator.q, 2),
            "total_slots": self.q_simulator.total_slots,
            "total_collisions": self.q_simulator.total_collisions,
            "collision_rate_percent": round((self.q_simulator.total_collisions / max(1, self.q_simulator.total_slots)) * 100, 1),
            "total_scans_count": self.total_scans_count,
            "throughput_tag_per_sec": self.throughput_tag_per_sec,
            "recent_reads": self.recent_reads
        }
