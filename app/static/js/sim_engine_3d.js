/**
 * ==============================================================================
 * NEXUSLOG 3D - SIMULATION LOGIC CORE ENGINE (STABLE REFINED EDITION)
 * ==============================================================================
 * Nền tảng lõi tối ưu kế thừa từ bản 2c3a066 kết hợp tính năng nâng cấp:
 * 1. Đội 6 xe AMR chạy A* Heuristic Chebyshev 8 hướng mượt mà, chống cắt góc.
 * 2. Mô hình Pin SoC (0-100%) và 3 Trạm sạc 3D cố định tại (x=2, y=12, 16, 20).
 * 3. Bảng Manual Override chuẩn SCADA: E-STOP, Gỡ kẹt đảo chiều 2s, Force Cổng, Về sạc, Khôi phục.
 * 4. Không bao giờ tự động sinh kẹt ngẫu nhiên (triệt tiêu 100% vòng lặp kẹt và cảnh báo giả).
 * 5. Giữ nguyên 100% nghiệp vụ phân loại 3 miền, xuất phiếu A4 và Excel .xls.
 * ==============================================================================
 */

(function (window) {
    "use strict";

    // 1. HẰNG SỐ CẤU HÌNH HỆ THỐNG
    const CONFIG = {
        GRID_W: 46,
        GRID_H: 30,
        SPEED_MULTIPLIER: 1.0,
        MAX_RACK_CAPACITY: 18,
        PACKAGE_SPEED: 2.2, // ô/giây trên băng tải
        AMR_SPEED: 2.4,     // ô/giây
        CONVEYOR_Y: 4,      // Dòng băng chuyền trên lưới Y=4
        BATTERY_LOW: 25,    // Ngưỡng pin thấp tự về sạc (%)
        BATTERY_FULL: 90,   // Ngưỡng sạc đầy quay lại làm việc (%)
        BATTERY_MIN_RUN: 20,// Pin tối thiểu để chạy nhiệm vụ (%)
        DRAIN_PER_CELL: 0.08, // Tiêu thụ pin mỗi ô di chuyển
        CHARGE_RATE_PER_SEC: 5.0, // Tốc độ nạp pin (%/s)

        CHARGERS: [
            { id: "CHG-01", name: "Trạm sạc 1 (Bắc)", region: "Bắc", x: 2, y: 12, color: "#0284c7" },
            { id: "CHG-02", name: "Trạm sạc 2 (Trung)", region: "Trung", x: 2, y: 16, color: "#9333ea" },
            { id: "CHG-03", name: "Trạm sạc 3 (Nam)", region: "Nam", x: 2, y: 20, color: "#10b981" }
        ],

        GATES: [
            { id: 1, region: "Bắc", name: "Hub Miền Bắc", x: 11, y: 4, dropX: 11, dropY: 7, waitX: 11, waitY: 9, color: "#0284c7" },
            { id: 2, region: "Trung", name: "Hub Miền Trung", x: 23, y: 4, dropX: 23, dropY: 7, waitX: 23, waitY: 9, color: "#9333ea" },
            { id: 3, region: "Nam", name: "Hub Miền Nam", x: 35, y: 4, dropX: 35, dropY: 7, waitX: 35, waitY: 9, color: "#10b981" }
        ],

        CLUSTER_RACKS: [
            // HUB BẮC (4 KỆ GOM)
            { id: "rack_b1", name: "Hà Nội - Bắc Ninh - V.Phúc", shortName: "HN - BN - VP", region: "Bắc", x: 6, y: 22, color: "#0284c7", provinces: ["Hà Nội", "Bắc Ninh", "Vĩnh Phúc"] },
            { id: "rack_b2", name: "Hải Phòng - Q.Ninh - H.Dương", shortName: "HP - QN - HD", region: "Bắc", x: 12, y: 22, color: "#0284c7", provinces: ["Hải Phòng", "Quảng Ninh", "Hải Dương"] },
            { id: "rack_b3", name: "H.Yên - N.Định - T.Bình - N.Bình", shortName: "HY - NĐ - TB - NB", region: "Bắc", x: 6, y: 26, color: "#0284c7", provinces: ["Hưng Yên", "Nam Định", "Thái Bình", "Ninh Bình"] },
            { id: "rack_b4", name: "Phú Thọ - Thái Nguyên", shortName: "PT - TN", region: "Bắc", x: 12, y: 26, color: "#0284c7", provinces: ["Phú Thọ", "Thái Nguyên"] },

            // HUB TRUNG (3 KỆ GOM)
            { id: "rack_t1", name: "Thanh Hóa - Nghệ An - Hà Tĩnh", shortName: "TH - NA - HT", region: "Trung", x: 20, y: 22, color: "#9333ea", provinces: ["Thanh Hóa", "Nghệ An", "Hà Tĩnh"] },
            { id: "rack_t2", name: "Quảng Bình - Huế - Đà Nẵng", shortName: "QB - HUE - DN", region: "Trung", x: 26, y: 22, color: "#9333ea", provinces: ["Quảng Bình", "Thừa Thiên Huế", "Đà Nẵng"] },
            { id: "rack_t3", name: "Quảng Nam - Q.Ngãi - B.Định - K.Hòa", shortName: "QN - QNG - BĐ - KH", region: "Trung", x: 23, y: 26, color: "#9333ea", provinces: ["Quảng Nam", "Quảng Ngãi", "Bình Định", "Khánh Hòa"] },

            // HUB NAM (3 KỆ GOM)
            { id: "rack_n1", name: "TP.HCM - Bình Dương - Đồng Nai", shortName: "HCM - BD - ĐNA", region: "Nam", x: 33, y: 22, color: "#10b981", provinces: ["TP.HCM", "Bình Dương", "Đồng Nai"] },
            { id: "rack_n2", name: "Bà Rịa VT - Long An - Tiền Giang", shortName: "BRV - LA - TG", region: "Nam", x: 39, y: 22, color: "#10b981", provinces: ["Bà Rịa - VT", "Long An", "Tiền Giang"] },
            { id: "rack_n3", name: "Cần Thơ - An Giang - Đ.Tháp - Cà Mau", shortName: "CT - AG - ĐT - CM", region: "Nam", x: 36, y: 26, color: "#10b981", provinces: ["Cần Thơ", "An Giang", "Đồng Tháp", "Bến Tre", "Kiên Giang", "Cà Mau"] }
        ],

        PROVINCES: [
            // CỤM 1: HUB MIỀN BẮC (12 TỈNH GOM VÀO 4 KỆ)
            { id: "hn", name: "Hà Nội", code: "HAN", region: "Bắc", rackId: "rack_b1", color: "#0284c7" },
            { id: "bn", name: "Bắc Ninh", code: "BNH", region: "Bắc", rackId: "rack_b1", color: "#0284c7" },
            { id: "vp", name: "Vĩnh Phúc", code: "VPH", region: "Bắc", rackId: "rack_b1", color: "#0284c7" },
            { id: "hp", name: "Hải Phòng", code: "HPH", region: "Bắc", rackId: "rack_b2", color: "#0284c7" },
            { id: "qn", name: "Quảng Ninh", code: "QNH", region: "Bắc", rackId: "rack_b2", color: "#0284c7" },
            { id: "hd", name: "Hải Dương", code: "HDU", region: "Bắc", rackId: "rack_b2", color: "#0284c7" },
            { id: "hy", name: "Hưng Yên", code: "HYE", region: "Bắc", rackId: "rack_b3", color: "#0284c7" },
            { id: "nd", name: "Nam Định", code: "NDH", region: "Bắc", rackId: "rack_b3", color: "#0284c7" },
            { id: "tb", name: "Thái Bình", code: "TBH", region: "Bắc", rackId: "rack_b3", color: "#0284c7" },
            { id: "nb", name: "Ninh Bình", code: "NBH", region: "Bắc", rackId: "rack_b3", color: "#0284c7" },
            { id: "pt", name: "Phú Thọ", code: "PTO", region: "Bắc", rackId: "rack_b4", color: "#0284c7" },
            { id: "tn", name: "Thái Nguyên", code: "TNN", region: "Bắc", rackId: "rack_b4", color: "#0284c7" },

            // CỤM 2: HUB MIỀN TRUNG (10 TỈNH GOM VÀO 3 KỆ)
            { id: "th", name: "Thanh Hóa", code: "THA", region: "Trung", rackId: "rack_t1", color: "#9333ea" },
            { id: "na", name: "Nghệ An", code: "NAN", region: "Trung", rackId: "rack_t1", color: "#9333ea" },
            { id: "ht", name: "Hà Tĩnh", code: "HTH", region: "Trung", rackId: "rack_t1", color: "#9333ea" },
            { id: "qb", name: "Quảng Bình", code: "QBH", region: "Trung", rackId: "rack_t2", color: "#9333ea" },
            { id: "hue", name: "Thừa Thiên Huế", code: "HUE", region: "Trung", rackId: "rack_t2", color: "#9333ea" },
            { id: "dn", name: "Đà Nẵng", code: "DNG", region: "Trung", rackId: "rack_t2", color: "#9333ea" },
            { id: "qnam", name: "Quảng Nam", code: "QNM", region: "Trung", rackId: "rack_t3", color: "#9333ea" },
            { id: "qng", name: "Quảng Ngãi", code: "QNG", region: "Trung", rackId: "rack_t3", color: "#9333ea" },
            { id: "bdh", name: "Bình Định", code: "BDH", region: "Trung", rackId: "rack_t3", color: "#9333ea" },
            { id: "kh", name: "Khánh Hòa", code: "KHA", region: "Trung", rackId: "rack_t3", color: "#9333ea" },

            // CỤM 3: HUB MIỀN NAM (12 TỈNH GOM VÀO 3 KỆ)
            { id: "sg", name: "TP. Hồ Chí Minh", code: "SGN", region: "Nam", rackId: "rack_n1", color: "#10b981" },
            { id: "bd", name: "Bình Dương", code: "BDG", region: "Nam", rackId: "rack_n1", color: "#10b981" },
            { id: "dna", name: "Đồng Nai", code: "DNA", region: "Nam", rackId: "rack_n1", color: "#10b981" },
            { id: "brvt", name: "Bà Rịa - VT", code: "BRV", region: "Nam", rackId: "rack_n2", color: "#10b981" },
            { id: "la", name: "Long An", code: "LAN", region: "Nam", rackId: "rack_n2", color: "#10b981" },
            { id: "tg", name: "Tiền Giang", code: "TGG", region: "Nam", rackId: "rack_n2", color: "#10b981" },
            { id: "ct", name: "Cần Thơ", code: "CTH", region: "Nam", rackId: "rack_n3", color: "#10b981" },
            { id: "ag", name: "An Giang", code: "AGG", region: "Nam", rackId: "rack_n3", color: "#10b981" },
            { id: "dt", name: "Đồng Tháp", code: "DTP", region: "Nam", rackId: "rack_n3", color: "#10b981" },
            { id: "bt", name: "Bến Tre", code: "BTR", region: "Nam", rackId: "rack_n3", color: "#10b981" },
            { id: "kg", name: "Kiên Giang", code: "KGG", region: "Nam", rackId: "rack_n3", color: "#10b981" },
            { id: "cm", name: "Cà Mau", code: "CMU", region: "Nam", rackId: "rack_n3", color: "#10b981" }
        ]
    };

    // 2. THUẬT TOÁN TÌM ĐƯỜNG A* HEURISTIC CHEBYSHEV (8 HƯỚNG LINH HOẠT, CHỐNG CẮT GÓC)
    class AStar {
        static findPath(startX, startY, targetX, targetY, isBlockedFn) {
            startX = Math.round(startX);
            startY = Math.round(startY);
            targetX = Math.round(targetX);
            targetY = Math.round(targetY);

            if (startX === targetX && startY === targetY) return [];

            const openSet = [];
            const closedSet = new Set();
            const cameFrom = new Map();

            const gScore = new Map();
            const fScore = new Map();

            const key = (x, y) => `${x},${y}`;

            // Hàm khoảng cách Heuristic Chebyshev hỗ trợ đi chéo
            const h = (x1, y1, x2, y2) => {
                const dx = Math.abs(x1 - x2);
                const dy = Math.abs(y1 - y2);
                return Math.max(dx, dy) + 0.414 * Math.min(dx, dy);
            };

            const startKey = key(startX, startY);
            gScore.set(startKey, 0);
            fScore.set(startKey, h(startX, startY, targetX, targetY));
            openSet.push({ x: startX, y: startY, f: fScore.get(startKey) });

            // 8 hướng di chuyển: 4 hướng thẳng + 4 hướng chéo
            const directions = [
                { dx: 1, dy: 0, cost: 1.0 },
                { dx: -1, dy: 0, cost: 1.0 },
                { dx: 0, dy: 1, cost: 1.0 },
                { dx: 0, dy: -1, cost: 1.0 },
                { dx: 1, dy: 1, cost: 1.414 },
                { dx: -1, dy: 1, cost: 1.414 },
                { dx: 1, dy: -1, cost: 1.414 },
                { dx: -1, dy: -1, cost: 1.414 }
            ];

            let iterations = 0;
            const MAX_ITERATIONS = 1200;

            while (openSet.length > 0 && iterations++ < MAX_ITERATIONS) {
                openSet.sort((a, b) => a.f - b.f);
                const current = openSet.shift();
                const currentKey = key(current.x, current.y);

                if (current.x === targetX && current.y === targetY) {
                    const path = [];
                    let currKey = currentKey;
                    while (cameFrom.has(currKey)) {
                        const [px, py] = currKey.split(",").map(Number);
                        path.unshift({ x: px, y: py });
                        currKey = cameFrom.get(currKey);
                    }
                    return path;
                }

                closedSet.add(currentKey);

                for (let d of directions) {
                    const nx = current.x + d.dx;
                    const ny = current.y + d.dy;
                    const neighborKey = key(nx, ny);

                    if (nx < 0 || nx >= CONFIG.GRID_W || ny < 0 || ny >= CONFIG.GRID_H) continue;
                    if (closedSet.has(neighborKey)) continue;

                    // Miễn trừ ô đích đến để robot luôn tiếp cận được mục tiêu
                    const isTarget = (nx === targetX && ny === targetY);
                    if (!isTarget && isBlockedFn(nx, ny)) continue;

                    // Luật chống cắt góc (Corner Cutting Prevention) khi đi chéo
                    if (d.dx !== 0 && d.dy !== 0) {
                        if (isBlockedFn(current.x + d.dx, current.y) && isBlockedFn(current.x, current.y + d.dy)) {
                            continue;
                        }
                    }

                    const tentativeG = gScore.get(currentKey) + d.cost;
                    if (!gScore.has(neighborKey) || tentativeG < gScore.get(neighborKey)) {
                        cameFrom.set(neighborKey, currentKey);
                        gScore.set(neighborKey, tentativeG);
                        const f = tentativeG + h(nx, ny, targetX, targetY);
                        fScore.set(neighborKey, f);

                        const existing = openSet.find(n => n.x === nx && n.y === ny);
                        if (!existing) {
                            openSet.push({ x: nx, y: ny, f: f });
                        } else {
                            existing.f = f;
                        }
                    }
                }
            }

            return null;
        }
    }

    // 3. LỚP ĐỘNG CƠ MÔ PHỎNG SCADA LOGIC ENGINE
    class SimulationLogicEngine {
        constructor() {
            this.config = CONFIG;
            this.speedMultiplier = CONFIG.SPEED_MULTIPLIER;
            this.autoSpawn = true;
            this.flexibleMode = false;
            this.sirenMuted = false;
            this.isEStop = false;
            this.conveyorReverseTimer = 0;

            this.spawnTimer = 0;
            this.spawnInterval = 2.6;
            this.nextPackageId = 1001;

            this.packages = [];
            this.obstacles = new Set();

            // Khởi tạo 3 Trạm Sạc Cố Định
            this.chargers = CONFIG.CHARGERS.map(c => ({
                ...c,
                occupiedBy: null
            }));

            // Khởi tạo 10 Kệ gom tỉnh thành
            this.racks = {};
            CONFIG.CLUSTER_RACKS.forEach(r => {
                this.racks[r.id] = {
                    ...r,
                    count: 0,
                    items: []
                };
            });

            // Khởi tạo 3 Cổng phân loại IoT
            this.gates = CONFIG.GATES.map(g => ({
                ...g,
                isJammed: false,
                jamReason: null,
                jamTimer: 0,
                sortedCount: 0,
                diverterAngle: 0
            }));

            // Đội 6 Xe AMR Tự Hành (Mỗi Hub 2 xe)
            this.amrs = [
                // Hub Bắc
                { id: "AMR-01", name: "AMR-01 (Bắc 1)", region: "Bắc", color: "#0284c7", x: 9, y: 9, homeX: 9, homeY: 9, dropX: 11, dropY: 7, state: "IDLE", battery: 94, currentPackage: null, targetRack: null, targetChargerId: null, currentTask: "Chờ nhận hàng", path: [], blockedTimer: 0, noPathAlert: false, speed: CONFIG.AMR_SPEED },
                { id: "AMR-02", name: "AMR-02 (Bắc 2)", region: "Bắc", color: "#0284c7", x: 13, y: 9, homeX: 13, homeY: 9, dropX: 11, dropY: 7, state: "IDLE", battery: 90, currentPackage: null, targetRack: null, targetChargerId: null, currentTask: "Chờ nhận hàng", path: [], blockedTimer: 0, noPathAlert: false, speed: CONFIG.AMR_SPEED },
                // Hub Trung
                { id: "AMR-03", name: "AMR-03 (Trung 1)", region: "Trung", color: "#9333ea", x: 21, y: 9, homeX: 21, homeY: 9, dropX: 23, dropY: 7, state: "IDLE", battery: 96, currentPackage: null, targetRack: null, targetChargerId: null, currentTask: "Chờ nhận hàng", path: [], blockedTimer: 0, noPathAlert: false, speed: CONFIG.AMR_SPEED },
                { id: "AMR-04", name: "AMR-04 (Trung 2)", region: "Trung", color: "#9333ea", x: 25, y: 9, homeX: 25, homeY: 9, dropX: 23, dropY: 7, state: "IDLE", battery: 88, currentPackage: null, targetRack: null, targetChargerId: null, currentTask: "Chờ nhận hàng", path: [], blockedTimer: 0, noPathAlert: false, speed: CONFIG.AMR_SPEED },
                // Hub Nam
                { id: "AMR-05", name: "AMR-05 (Nam 1)", region: "Nam", color: "#10b981", x: 33, y: 9, homeX: 33, homeY: 9, dropX: 35, dropY: 7, state: "IDLE", battery: 92, currentPackage: null, targetRack: null, targetChargerId: null, currentTask: "Chờ nhận hàng", path: [], blockedTimer: 0, noPathAlert: false, speed: CONFIG.AMR_SPEED },
                { id: "AMR-06", name: "AMR-06 (Nam 2)", region: "Nam", color: "#10b981", x: 37, y: 9, homeX: 37, homeY: 9, dropX: 35, dropY: 7, state: "IDLE", battery: 86, currentPackage: null, targetRack: null, targetChargerId: null, currentTask: "Chờ nhận hàng", path: [], blockedTimer: 0, noPathAlert: false, speed: CONFIG.AMR_SPEED }
            ];

            this.events = [];
            this.totalProcessed = 0;
            this.totalConfidenceSum = 0;
            this.totalConfScanned = 0;

            this.logEvent("Hệ thống khởi động thành công. Lưới A* và 3 Trạm Sạc sẵn sàng.", "INFO");
        }

        logEvent(text, type = "INFO") {
            const timeStr = new Date().toTimeString().split(" ")[0];
            this.events.unshift({ time: timeStr, text: text, type: type });
            if (this.events.length > 50) this.events.pop();
        }

        // Kiểm tra ô bị chặn cho thuật toán A*
        isCellBlockedForAMR(x, y, selfAmrId) {
            if (this.obstacles.has(`${x},${y}`)) return true;
            if (y === CONFIG.CONVEYOR_Y && x >= 2 && x <= 43) return true;

            // Chỉ thân kệ tại dòng r.y là vật cản, hàng r.y-1 phía trước là hành lang thông thoáng
            if (CONFIG.CLUSTER_RACKS.some(r => Math.abs(r.x - x) <= 1 && r.y === y)) return true;

            // Trạm sạc đang có xe khác chiếm
            if (this.chargers) {
                const chg = this.chargers.find(c => c.x === x && c.y === y);
                if (chg && chg.occupiedBy && chg.occupiedBy !== selfAmrId) return true;
            }

            // Xe robot khác
            for (let other of this.amrs) {
                if (other.id !== selfAmrId) {
                    const ox = Math.round(other.x);
                    const oy = Math.round(other.y);
                    if (ox === x && oy === y) return true;
                }
            }
            return false;
        }

        planPathForAMR(amr, targetX, targetY) {
            const isBlockedFn = (x, y) => this.isCellBlockedForAMR(x, y, amr.id);
            const path = AStar.findPath(amr.x, amr.y, targetX, targetY, isBlockedFn);
            if (path && path.length > 0) {
                amr.path = path;
                amr.noPathAlert = false;
                amr.blockedTimer = 0;
            } else {
                amr.path = [];
                // Chỉ cảnh báo nếu thực sự bị chặn quá 3 giây
                amr.blockedTimer += 0.4;
                if (amr.blockedTimer > 3.0) {
                    amr.noPathAlert = true;
                }
            }
            return path;
        }

        clearAllObstacles() {
            this.obstacles.clear();
            this.amrs.forEach(a => {
                a.noPathAlert = false;
                a.blockedTimer = 0;
            });
            this.logEvent("Đã dọn sạch toàn bộ vật cản trên sàn kho", "INFO");
        }

        // Sinh kiện hàng mới (100% bưu kiện tiêu chuẩn chạy mượt mà)
        spawnPackage(provinceName = null) {
            let targetProvince = null;
            if (provinceName) {
                targetProvince = CONFIG.PROVINCES.find(p => p.name === provinceName);
            }
            if (!targetProvince) {
                const randIdx = Math.floor(Math.random() * CONFIG.PROVINCES.length);
                targetProvince = CONFIG.PROVINCES[randIdx];
            }

            let gateId = 1;
            if (targetProvince.region === "Trung") gateId = 2;
            else if (targetProvince.region === "Nam") gateId = 3;

            const gate = CONFIG.GATES.find(g => g.id === gateId);
            const pkgId = this.nextPackageId++;

            // Mã vận đơn Code128
            const barcode = `VN-${targetProvince.code}-${String(pkgId).padStart(6, '0')}`;
            const conf = 0.94 + Math.random() * 0.05;
            this.totalConfidenceSum += conf;
            this.totalConfScanned++;

            const newPkg = {
                id: pkgId,
                barcode: barcode,
                province: targetProvince.name,
                region: targetProvince.region,
                rackId: targetProvince.rackId,
                gateId: gateId,
                weight: (1.5 + Math.random() * 2.3).toFixed(1), // 1.5 - 3.8 kg
                x: 2.0, // Điểm bắt đầu băng tải
                y: CONFIG.CONVEYOR_Y,
                status: "ON_BELT", // ON_BELT -> DIVERTING -> AT_DROP -> CARRIED -> STORED
                targetGateX: gate.x,
                divertProgress: 0,
                confidence: conf
            };

            this.packages.push(newPkg);
            this.logEvent(`[AI CAMERA SCAN] Bưu kiện #${pkgId} (${targetProvince.name}) ➔ Phân luồng Cổng ${gateId} (${targetProvince.region}) [Conf: ${(conf * 100).toFixed(1)}%]`, "AI");
            return newPkg;
        }

        // =========================================================================
        // MANUAL OVERRIDE & MÔ PHỎNG SỰ CỐ CỔNG CÓ CHỦ ĐÍCH
        // =========================================================================
        hasPackageAtGate(gateId) {
            const gid = Number(gateId);
            const gate = this.gates.find(g => g.id === gid);
            if (!gate) return false;
            const atDrop = this.packages.some(p => p.gateId === gid && (p.status === "AT_DROP" || p.status === "DIVERTING"));
            const nearGate = this.packages.some(p => p.status === "ON_BELT" && Math.abs(p.x - gate.x) <= 2.2);
            return atDrop || nearGate;
        }

        // Kích hoạt sự cố cổng (Chỉ chạy khi người dùng chủ động bấm)
        triggerGateFault(gateId, causeType = "OVERLOAD") {
            const gate = this.gates.find(g => g.id === Number(gateId));
            if (!gate) return { success: false, message: "Không tìm thấy cổng chỉ định" };

            const causeDescriptions = {
                "OVERLOAD": "Quá tải hàng đợi máng (> 3 kiện)",
                "SENSOR_FAULT": "Lỗi cảm biến quang phân loại tại cổng",
                "DEADLOCK": "Xung đột 2 xe AMR tại chân máng"
            };
            const reasonStr = causeDescriptions[causeType] || causeType;

            gate.isJammed = true;
            gate.jamReason = reasonStr;
            gate.jamTimer = 9.0;

            this.amrs.forEach(amr => {
                if (amr.currentPackage && amr.currentPackage.gateId === gate.id && (amr.state === "GOING_TO_PICK" || amr.state === "IDLE")) {
                    amr.state = "BLOCKED";
                    amr.currentTask = `Chờ thông tuyến Cổng ${gate.id}`;
                }
            });

            this.logEvent(`🚨 SỰ CỐ CỔNG ${gate.id} (${gate.region}): ${reasonStr}`, "ALARM");
            return { success: true, message: `Đã kích hoạt sự cố Cổng ${gate.id}: ${reasonStr}` };
        }

        triggerJamTest() {
            return this.triggerGateFault(1, "OVERLOAD");
        }

        triggerOcclusionTest() {
            this.logEvent("Đã kích hoạt thử nghiệm che khuất bưu kiện (Occlusion)", "AI");
        }

        // E-STOP Dừng Khẩn Cấp Toàn Kho
        toggleEStop() {
            this.isEStop = !this.isEStop;
            if (this.isEStop) {
                this.amrs.forEach(amr => {
                    amr.savedState = amr.state;
                    amr.state = "E_STOP";
                    amr.currentTask = "🛑 Dừng khẩn cấp E-STOP";
                    amr.savedPath = amr.path ? [...amr.path] : [];
                    amr.path = [];
                });
                this.logEvent("🛑 DỪNG KHẨN CẤP TOÀN BỘ KHO (E-STOP ON)", "ALARM");
            } else {
                this.amrs.forEach(amr => {
                    if (amr.state === "E_STOP") {
                        amr.state = amr.savedState || "IDLE";
                        amr.currentTask = "Khôi phục hoạt động sau E-STOP";
                        if (amr.savedPath && amr.savedPath.length > 0) {
                            amr.path = amr.savedPath;
                        } else {
                            this.planPathForAMR(amr, amr.homeX, amr.homeY);
                        }
                    }
                });
                this.logEvent("✅ ĐÃ NHẢ DỪNG KHẨN CẤP E-STOP, HỆ THỐNG PHỤC HỒI", "INFO");
            }
            return this.isEStop;
        }

        // Gỡ kẹt băng tải đảo chiều 2 giây
        reverseConveyorToUnjam() {
            this.conveyorReverseTimer = 2.0;
            this.logEvent("🔄 ĐANG ĐẢO CHIỀU BĂNG TẢI 2 GIÂY ĐỂ GIẢI PHÓNG KẸT...", "WARN");

            setTimeout(() => {
                this.gates.forEach(g => {
                    g.isJammed = false;
                    g.jamReason = null;
                    g.jamTimer = 0;
                });
                this.amrs.forEach(a => {
                    if (a.state === "BLOCKED") {
                        a.state = "IDLE";
                        a.currentTask = "Tiếp tục nhận việc";
                    }
                });
                this.logEvent("✅ ĐÃ GỠ KẸT THÀNH CÔNG! Băng tải trở lại chiều tiến bình thường", "INFO");
            }, 2000 / this.speedMultiplier);

            return { success: true, message: "Đang đảo chiều băng tải 2 giây để nhả kẹt kiện hàng..." };
        }

        // Force gạt cổng phân loại 1, 2, 3
        forceGateDivert(gateId) {
            const gid = Number(gateId);
            const gate = this.gates.find(g => g.id === gid);
            if (!gate) return { success: false, message: "Cổng không tồn tại" };

            const candidate = this.packages.find(p => p.status === "ON_BELT" && Math.abs(p.x - gate.x) <= 3.0);
            if (!candidate) {
                return { success: false, message: `Không có kiện hàng nào tại Cổng ${gid} để Force!` };
            }

            candidate.status = "DIVERTING";
            candidate.gateId = gate.id;
            candidate.region = gate.region;
            candidate.divertProgress = 0;
            gate.sortedCount++;

            this.logEvent(`⚡ MANUAL OVERRIDE: Force gạt kiện #${candidate.id} vào Cổng ${gate.id} (${gate.region})`, "WARN");
            return { success: true, message: `Đã Force gạt kiện #${candidate.id} vào Cổng ${gate.id}!` };
        }

        // Điều xe AMR về trạm sạc
        sendAmrToCharge(amrId = "AMR-01") {
            const amr = this.amrs.find(a => a.id === amrId);
            if (!amr) return { success: false, message: `Không tìm thấy ${amrId}` };

            if (amr.state === "E_STOP") return { success: false, message: `${amrId} đang bị E-STOP!` };
            if (amr.state === "CHARGING") return { success: false, message: `${amrId} hiện đã ở trong trạm sạc!` };

            if (amr.currentPackage) {
                amr.currentPackage.status = "AT_DROP";
                amr.currentPackage = null;
            }

            const freeCharger = this.chargers.find(c => !c.occupiedBy || c.occupiedBy === amr.id);
            if (!freeCharger) return { success: false, message: "Tất cả các trạm sạc hiện đang có xe!" };

            freeCharger.occupiedBy = amr.id;
            amr.targetChargerId = freeCharger.id;
            amr.state = "TO_CHARGER";
            amr.currentTask = `Lệnh thủ công: Di chuyển về ${freeCharger.name}`;
            this.planPathForAMR(amr, freeCharger.x, freeCharger.y);

            this.logEvent(`⚡ MANUAL OVERRIDE: Điều ${amr.id} về ${freeCharger.name}`, "AMR");
            return { success: true, message: `Đã lệnh cho ${amr.id} di chuyển về ${freeCharger.name}!` };
        }

        // Khôi phục AMR
        recoverAMR(amrId = null) {
            let count = 0;
            this.amrs.forEach(amr => {
                if (!amrId || amr.id === amrId) {
                    amr.state = "IDLE";
                    amr.noPathAlert = false;
                    amr.blockedTimer = 0;
                    amr.currentTask = "Đã khôi phục, sẵn sàng nhận việc";
                    this.planPathForAMR(amr, amr.homeX, amr.homeY);
                    count++;
                }
            });
            this.logEvent(`Đã khôi phục ${count} xe AMR hoạt động bình thường`, "INFO");
            return { success: true, recovered: count, message: `Đã khôi phục ${count} xe AMR!` };
        }

        // =========================================================================
        // 4. VÒNG LẶP CẬP NHẬT CHÍNH (UPDATE LOOP CHUẨN XÁC)
        // =========================================================================
        update(dt) {
            dt = dt * this.speedMultiplier;

            // 1. Nếu E-STOP: Dừng toàn bộ chuyển động
            if (this.isEStop) return;

            // 2. Xử lý đảo chiều băng tải gỡ kẹt
            if (this.conveyorReverseTimer > 0) {
                this.conveyorReverseTimer -= dt;
                this.packages.forEach(p => {
                    if (p.status === "ON_BELT") {
                        p.x = Math.max(2.0, p.x - CONFIG.PACKAGE_SPEED * dt);
                    }
                });
                return;
            }

            // 3. Tự động phục hồi kẹt cổng khi hết thời gian
            this.gates.forEach(g => {
                if (g.isJammed) {
                    g.jamTimer -= dt;
                    if (g.jamTimer <= 0) {
                        g.isJammed = false;
                        g.jamReason = null;
                        this.logEvent(`Cổng ${g.id} (${g.region}) đã tự động phục hồi thông tuyến`, "INFO");
                        this.amrs.forEach(a => {
                            if (a.state === "BLOCKED") {
                                a.state = "IDLE";
                                a.currentTask = "Tiếp tục nhận việc";
                            }
                        });
                    }
                }
            });

            // 4. Tự động sinh bưu kiện tuần hoàn
            if (this.autoSpawn) {
                this.spawnTimer += dt;
                if (this.spawnTimer >= this.spawnInterval) {
                    this.spawnTimer = 0;
                    if (this.packages.filter(p => p.status === "ON_BELT").length < 6) {
                        this.spawnPackage();
                    }
                }
            }

            // 5. Cập nhật vị trí bưu kiện trên băng chuyền
            for (let i = this.packages.length - 1; i >= 0; i--) {
                const p = this.packages[i];

                if (p.status === "ON_BELT") {
                    let canMove = true;
                    for (let other of this.packages) {
                        if (other !== p && other.status === "ON_BELT") {
                            if (other.x > p.x && (other.x - p.x) < 1.35) {
                                canMove = false;
                                break;
                            }
                        }
                    }

                    // Tiếp cận cổng phân loại đích
                    if (canMove && p.x >= p.targetGateX - 0.25 && p.x <= p.targetGateX + 0.6) {
                        const targetGate = this.gates.find(g => g.id === p.gateId);
                        if (targetGate && targetGate.isJammed) {
                            canMove = false; // Dừng chờ nếu cổng kẹt
                        } else if (targetGate) {
                            // Mở cần gạt cơ khí
                            targetGate.diverterAngle = 0.85;
                            p.status = "DIVERTING";
                            p.divertProgress = 0;

                            const chuteQueue = this.packages.filter(item => item.gateId === p.gateId && item.status === "AT_DROP");
                            p.queueSlot = Math.min(3, chuteQueue.length);
                            targetGate.sortedCount++;
                            this.logEvent(`Cổng ${targetGate.id} gạt kiện #${p.id} sang máng ${p.region}`, "SORT");
                        }
                    }

                    if (canMove) {
                        p.x += CONFIG.PACKAGE_SPEED * dt;
                    }
                } else if (p.status === "DIVERTING") {
                    p.divertProgress += dt * 2.0;
                    const targetGate = this.gates.find(g => g.id === p.gateId);

                    p.y = CONFIG.CONVEYOR_Y + p.divertProgress * 2.5;
                    p.x = targetGate.x;

                    if (p.divertProgress >= 1.0) {
                        p.status = "AT_DROP";
                        p.y = 6.0;
                        if (targetGate) targetGate.diverterAngle = 0;
                    }
                }
            }

            // 6. CẬP NHẬT MÁY TRẠNG THÁI 6 ROBOT AMR & PIN
            for (let amr of this.amrs) {
                // Tiêu hao pin khi di chuyển
                if (amr.path && amr.path.length > 0) {
                    amr.battery = Math.max(5, amr.battery - CONFIG.DRAIN_PER_CELL * (amr.currentPackage ? 1.5 : 1.0) * dt);
                }

                // Xử lý nạp pin tại trạm sạc
                if (amr.state === "CHARGING") {
                    amr.battery = Math.min(100, amr.battery + CONFIG.CHARGE_RATE_PER_SEC * dt);
                    amr.currentTask = `Đang nạp pin (${Math.round(amr.battery)}%)...`;

                    if (amr.battery >= CONFIG.BATTERY_FULL) {
                        const chg = this.chargers.find(c => c.id === amr.targetChargerId);
                        if (chg) chg.occupiedBy = null;
                        amr.targetChargerId = null;
                        amr.state = "IDLE";
                        amr.currentTask = "Sạc đầy, sẵn sàng nhận việc";
                        this.planPathForAMR(amr, amr.homeX, amr.homeY);
                        this.logEvent(`🔋 ${amr.id} đã sạc đầy ${Math.round(amr.battery)}%, sẵn sàng làm việc`, "AMR");
                    }
                    continue;
                }

                // Tự động về sạc nếu pin < 25% và đang rảnh rỗi
                if (amr.battery < CONFIG.BATTERY_LOW && amr.state === "IDLE") {
                    const freeCharger = this.chargers.find(c => !c.occupiedBy);
                    if (freeCharger) {
                        freeCharger.occupiedBy = amr.id;
                        amr.targetChargerId = freeCharger.id;
                        amr.state = "TO_CHARGER";
                        amr.currentTask = `Pin thấp (${Math.round(amr.battery)}%), đang về ${freeCharger.name}`;
                        this.planPathForAMR(amr, freeCharger.x, freeCharger.y);
                        this.logEvent(`⚡ ${amr.id} tự động về ${freeCharger.name} nạp điện`, "AMR");
                        continue;
                    }
                }

                // Máy trạng thái bốc dỡ hàng
                if (amr.state === "IDLE") {
                    // Tìm kiện ở chân máng
                    const availablePkg = this.packages.find(p => {
                        if (p.status !== "AT_DROP") return false;
                        if (!this.flexibleMode && p.region !== amr.region) return false;
                        // Không có xe khác đang đến lấy
                        return !this.amrs.some(other => other !== amr && other.currentPackage === p);
                    });

                    if (availablePkg) {
                        amr.currentPackage = availablePkg;
                        amr.state = "GOING_TO_PICK";
                        amr.currentTask = `Đang tới máng đón kiện #${availablePkg.id}`;
                        this.planPathForAMR(amr, amr.dropX, amr.dropY + 1);
                    }
                }

                // Di chuyển theo lộ trình A*
                if (amr.path && amr.path.length > 0) {
                    const nextNode = amr.path[0];
                    const dx = nextNode.x - amr.x;
                    const dy = nextNode.y - amr.y;
                    const dist = Math.hypot(dx, dy);

                    const step = amr.speed * dt;
                    if (dist <= step) {
                        amr.x = nextNode.x;
                        amr.y = nextNode.y;
                        amr.path.shift();
                    } else {
                        amr.x += (dx / dist) * step;
                        amr.y += (dy / dist) * step;
                    }
                }

                // Hoàn thành lộ trình
                if (amr.path.length === 0) {
                    if (amr.state === "TO_CHARGER") {
                        amr.state = "CHARGING";
                        amr.currentTask = "Đang nạp pin tại trạm sạc";
                    } else if (amr.state === "GOING_TO_PICK") {
                        amr.state = "PICKING";
                        setTimeout(() => {
                            if (amr.currentPackage) {
                                amr.currentPackage.status = "CARRIED";
                                const rack = this.racks[amr.currentPackage.rackId];
                                amr.targetRack = rack;
                                amr.state = "DELIVERING";
                                amr.currentTask = `Chở kiện #${amr.currentPackage.id} về ${rack ? rack.shortName : 'kệ'}`;
                                if (rack) {
                                    this.planPathForAMR(amr, rack.x, rack.y - 1);
                                }
                            }
                        }, 350 / this.speedMultiplier);
                    } else if (amr.state === "DELIVERING") {
                        amr.state = "UNLOADING";
                        setTimeout(() => {
                            if (amr.targetRack && amr.currentPackage) {
                                amr.targetRack.count++;
                                amr.targetRack.items.push({
                                    id: amr.currentPackage.id,
                                    barcode: amr.currentPackage.barcode,
                                    province: amr.currentPackage.province,
                                    region: amr.currentPackage.region
                                });
                                this.totalProcessed++;
                                this.logEvent(`${amr.id} đã xếp kiện #${amr.currentPackage.id} vào kệ [${amr.targetRack.shortName}]`, "STORAGE");

                                // Tự động xuất ô khi đầy 18 kiện
                                if (amr.targetRack.count >= CONFIG.MAX_RACK_CAPACITY) {
                                    this.logEvent(`Ô [${amr.targetRack.shortName}] đã đầy. Tự động xuất ô!`, "EXPORT");
                                    amr.targetRack.count = 0;
                                    amr.targetRack.items = [];
                                }

                                const pIdx = this.packages.indexOf(amr.currentPackage);
                                if (pIdx !== -1) this.packages.splice(pIdx, 1);

                                amr.currentPackage = null;
                                amr.targetRack = null;
                                amr.state = "RETURNING";
                                amr.currentTask = "Trở về vị trí đỗ";
                                this.planPathForAMR(amr, amr.homeX, amr.homeY);
                            }
                        }, 350 / this.speedMultiplier);
                    } else if (amr.state === "RETURNING") {
                        amr.state = "IDLE";
                        amr.currentTask = "Chờ nhận hàng";
                    }
                }
            }
        }

        // Xuất xe tải chở hàng (Bàn giao vận chuyển)
        dispatchTruck(options = {}) {
            const regionName = typeof options === 'string' ? options : (options.region || "Bắc");
            const filterProvince = typeof options === 'object' ? options.provinceName : null;
            const filterRackId = typeof options === 'object' ? options.rackId : null;

            let targetRacks = CONFIG.CLUSTER_RACKS.filter(r => r.region === regionName);
            if (filterRackId && filterRackId !== "ALL") {
                targetRacks = targetRacks.filter(r => r.id === filterRackId);
            }

            const dispatchedItems = [];
            targetRacks.forEach(p => {
                const r = this.racks[p.id];
                if (r && r.count > 0) {
                    if (filterProvince && filterProvince !== "ALL") {
                        const remaining = [];
                        r.items.forEach(pkg => {
                            const prov = typeof pkg === 'object' ? pkg.province : p.name;
                            if (prov === filterProvince) dispatchedItems.push(pkg);
                            else remaining.push(pkg);
                        });
                        r.items = remaining;
                        r.count = remaining.length;
                    } else {
                        dispatchedItems.push(...r.items);
                        r.items = [];
                        r.count = 0;
                    }
                }
            });

            const plates = {
                "Bắc": "29C-882.91 (Xe 8 Tấn Tuyến Hà Nội - Phía Bắc)",
                "Trung": "43C-612.45 (Xe 10 Tấn Tuyến Đà Nẵng - Miền Trung)",
                "Nam": "51C-993.18 (Xe 15 Tấn Tuyến TP.HCM - Miền Tây)"
            };

            const manifest = {
                manifestId: `PXK-${Date.now().toString().slice(-6)}-${regionName === 'Bắc' ? 'BAC' : (regionName === 'Trung' ? 'TRUNG' : 'NAM')}`,
                region: regionName,
                truckPlate: plates[regionName] || "29C-882.91",
                timestamp: new Date().toISOString(),
                totalPackages: dispatchedItems.length,
                packages: dispatchedItems
            };

            this.logEvent(`[XUẤT HÀNG] Đã bàn giao ${dispatchedItems.length} kiện lên xe tải ${manifest.truckPlate}`, "EXPORT");
            return manifest;
        }

        exportStateJSON() {
            return JSON.stringify({
                timestamp: Date.now(),
                totalProcessed: this.totalProcessed,
                packages: this.packages,
                amrs: this.amrs.map(a => ({ id: a.id, x: a.x, y: a.y, battery: a.battery, state: a.state, task: a.currentTask })),
                chargers: this.chargers,
                gates: this.gates.map(g => ({ id: g.id, count: g.sortedCount, jammed: g.isJammed })),
                racks: Object.keys(this.racks).map(k => ({ id: k, count: this.racks[k].count }))
            }, null, 2);
        }
    }

    // Đưa vào window toàn cục
    window.SimulationLogicEngine = SimulationLogicEngine;
})(window);
