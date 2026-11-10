/**
 * ==============================================================================
 * NEXUSLOG 3D - SIMULATION LOGIC CORE ENGINE (GRID 36x22, A* 4-WAY, STATE MACHINE)
 * ==============================================================================
 * Thiết kế tách bạch 100% độc lập với đồ họa:
 * - Lưới 36x22 (ô 1m), vật cản tĩnh & động
 * - Thuật toán tìm đường A* 4 hướng với chi phí phạt
 * - Đặt chỗ ô kế tiếp (Cell Reservation) chống đâm xuyên nhau
 * - Nhường đường & Tính lại lộ trình (Replanning) sau 1.2s tránh Deadlock
 * - Quản lý kiện hàng, 3 cổng IoT, 9 ô kệ (tối đa 6 kiện/ô, tự động xuất ô)
 * - Xuất / nhập trạng thái dạng JSON
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
            { id: "pt", name: "Phú Thọ", code: "PTH", region: "Bắc", rackId: "rack_b4", color: "#0284c7" },
            { id: "tn", name: "Thái Nguyên", code: "TNG", region: "Bắc", rackId: "rack_b4", color: "#0284c7" },

            // CỤM 2: HUB MIỀN TRUNG (10 TỈNH GOM VÀO 3 KỆ)
            { id: "th", name: "Thanh Hóa", code: "THO", region: "Trung", rackId: "rack_t1", color: "#9333ea" },
            { id: "na", name: "Nghệ An", code: "NAN", region: "Trung", rackId: "rack_t1", color: "#9333ea" },
            { id: "ht", name: "Hà Tĩnh", code: "HTI", region: "Trung", rackId: "rack_t1", color: "#9333ea" },
            { id: "qb", name: "Quảng Bình", code: "QBI", region: "Trung", rackId: "rack_t2", color: "#9333ea" },
            { id: "hue", name: "Thừa Thiên Huế", code: "HUE", region: "Trung", rackId: "rack_t2", color: "#9333ea" },
            { id: "dn", name: "Đà Nẵng", code: "DNG", region: "Trung", rackId: "rack_t2", color: "#9333ea" },
            { id: "qm", name: "Quảng Nam", code: "QNA", region: "Trung", rackId: "rack_t3", color: "#9333ea" },
            { id: "qng", name: "Quảng Ngãi", code: "QNG", region: "Trung", rackId: "rack_t3", color: "#9333ea" },
            { id: "bdh", name: "Bình Định", code: "BDI", region: "Trung", rackId: "rack_t3", color: "#9333ea" },
            { id: "kh", name: "Khánh Hòa", code: "KHO", region: "Trung", rackId: "rack_t3", color: "#9333ea" },

            // CỤM 3: HUB MIỀN NAM (12 TỈNH GOM VÀO 3 KỆ)
            { id: "hcm", name: "TP.HCM", code: "SGN", region: "Nam", rackId: "rack_n1", color: "#10b981" },
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
        ]};

    // 2. THUẬT TOÁN TÌM ĐƯỜNG A* 4 HƯỚNG
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
            const h = (x1, y1, x2, y2) => Math.abs(x1 - x2) + Math.abs(y1 - y2); // Heuristic Manhattan

            const startKey = key(startX, startY);
            gScore.set(startKey, 0);
            fScore.set(startKey, h(startX, startY, targetX, targetY));
            openSet.push({ x: startX, y: startY, f: fScore.get(startKey) });

            const directions = [
                { dx: 1, dy: 0 },
                { dx: -1, dy: 0 },
                { dx: 0, dy: 1 },
                { dx: 0, dy: -1 }
            ];

            let iterations = 0;
            const MAX_ITERATIONS = 1200;

            while (openSet.length > 0 && iterations++ < MAX_ITERATIONS) {
                // Lấy nút có fScore nhỏ nhất
                openSet.sort((a, b) => a.f - b.f);
                const current = openSet.shift();
                const currentKey = key(current.x, current.y);

                if (current.x === targetX && current.y === targetY) {
                    // Tái dựng lộ trình
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

                    // Kiểm tra ô bị chặn (ngoại trừ ô đích đến)
                    const isTarget = (nx === targetX && ny === targetY);
                    if (!isTarget && isBlockedFn(nx, ny)) continue;

                    const tentativeG = gScore.get(currentKey) + 1;
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

            return null; // Không tìm thấy đường
        }
    }

    // 3. CORE LOGIC ENGINE MÔ PHỎNG KHO
    class SimulationLogicEngine {
        constructor() {
            this.config = CONFIG;
            this.speedMultiplier = 1.0;
            this.autoSpawn = true;
            this.flexibleMode = false;
            this.sirenMuted = false;
            this.testOcclusionActive = false;

            // Vật cản tĩnh do người dùng đặt (Set lưu "x,y")
            this.obstacles = new Set();

            // Danh sách kiện hàng
            this.packages = [];
            this.nextPackageId = 1001;
            this.spawnTimer = 0;

            // 9 Ô kệ phân loại
            this.racks = {};
            CONFIG.CLUSTER_RACKS.forEach(r => {
                this.racks[r.id] = { ...r, count: 0, items: [] };
            });

            // 3 Cổng IoT
            this.gates = CONFIG.GATES.map(g => ({
                ...g,
                isJammed: false,
                jamTimer: 0,
                sortedCount: 0,
                diverterAngle: 0
            }));

            // ĐỘI 6 ROBOT AMR TỰ HÀNH (MỖI HUB 2 XE)
            this.amrs = [
                // Hub Miền Bắc (2 xe)
                { id: "AMR-01", name: "AMR-01 (Bắc 1)", region: "Bắc", color: "#0284c7", x: 9, y: 9, homeX: 9, homeY: 9, dropX: 11, dropY: 7, state: "IDLE", currentPackage: null, targetRack: null, path: [], blockedTimer: 0, noPathAlert: false, speed: CONFIG.AMR_SPEED },
                { id: "AMR-02", name: "AMR-02 (Bắc 2)", region: "Bắc", color: "#0284c7", x: 13, y: 9, homeX: 13, homeY: 9, dropX: 11, dropY: 7, state: "IDLE", currentPackage: null, targetRack: null, path: [], blockedTimer: 0, noPathAlert: false, speed: CONFIG.AMR_SPEED },
                // Hub Miền Trung (2 xe)
                { id: "AMR-03", name: "AMR-03 (Trung 1)", region: "Trung", color: "#9333ea", x: 21, y: 9, homeX: 21, homeY: 9, dropX: 23, dropY: 7, state: "IDLE", currentPackage: null, targetRack: null, path: [], blockedTimer: 0, noPathAlert: false, speed: CONFIG.AMR_SPEED },
                { id: "AMR-04", name: "AMR-04 (Trung 2)", region: "Trung", color: "#9333ea", x: 25, y: 9, homeX: 25, homeY: 9, dropX: 23, dropY: 7, state: "IDLE", currentPackage: null, targetRack: null, path: [], blockedTimer: 0, noPathAlert: false, speed: CONFIG.AMR_SPEED },
                // Hub Miền Nam (2 xe)
                { id: "AMR-05", name: "AMR-05 (Nam 1)", region: "Nam", color: "#10b981", x: 33, y: 9, homeX: 33, homeY: 9, dropX: 35, dropY: 7, state: "IDLE", currentPackage: null, targetRack: null, path: [], blockedTimer: 0, noPathAlert: false, speed: CONFIG.AMR_SPEED },
                { id: "AMR-06", name: "AMR-06 (Nam 2)", region: "Nam", color: "#10b981", x: 37, y: 9, homeX: 37, homeY: 9, dropX: 35, dropY: 7, state: "IDLE", currentPackage: null, targetRack: null, path: [], blockedTimer: 0, noPathAlert: false, speed: CONFIG.AMR_SPEED }
            ];

            // Dòng sự kiện trực tiếp (Live Event Log)
            this.events = [];
            this.totalProcessed = 0;
            this.totalConfidenceSum = 0;
            this.totalConfScanned = 0;

            this.logEvent("Hệ thống khởi động thành công. Lưới A* 36x22 sẵn sàng.", "INFO");
        }

        logEvent(text, type = "INFO") {
            const time = new Date().toLocaleTimeString("vi-VN");
            this.events.unshift({ time, text, type });
            if (this.events.length > 30) this.events.pop();
        }

        // Kiểm tra xem ô (x,y) có phải ô cấm đặt vật cản hoặc bị chặn
        isReservedCell(x, y) {
            // 1. Ô Băng chuyền Y = CONFIG.CONVEYOR_Y
            if (y === CONFIG.CONVEYOR_Y && x >= 2 && x <= 43) return true;
            // 2. Ô 10 Kệ gom cụm tỉnh (kích thước chiếm dụng)
            if (CONFIG.CLUSTER_RACKS.some(r => Math.abs(r.x - x) <= 1 && Math.abs(r.y - y) <= 1)) return true;
            // 3. Ô Điểm thả của 3 cổng & Điểm sạc/chờ của 6 AMR
            for (let g of CONFIG.GATES) {
                if (x === g.dropX && y === g.dropY) return true;
            }
            if (this.amrs) {
                for (let a of this.amrs) {
                    if (x === a.homeX && y === a.homeY) return true;
                }
            }
            return false;
        }

        // Bật / tắt vật cản tại ô (x, y) khi click chuột
        toggleObstacle(x, y) {
            if (x < 0 || x >= CONFIG.GRID_W || y < 0 || y >= CONFIG.GRID_H) return false;
            if (this.isReservedCell(x, y)) {
                this.logEvent(`Không thể đặt vật cản vào vùng cấm (${x}, ${y})`, "WARN");
                return false;
            }

            // Không cho đặt nếu đang có robot đứng tại ô đó
            const amrAtCell = this.amrs.find(a => Math.round(a.x) === x && Math.round(a.y) === y);
            if (amrAtCell) {
                this.logEvent(`Không thể đặt vật cản lên vị trí của ${amrAtCell.id}`, "WARN");
                return false;
            }

            const k = `${x},${y}`;
            if (this.obstacles.has(k)) {
                this.obstacles.delete(k);
                this.logEvent(`Đã xóa vật cản tại (${x}, ${y})`, "INFO");
            } else {
                this.obstacles.add(k);
                this.logEvent(`Đã đặt vật cản A* tại (${x}, ${y})`, "OBSTACLE");
            }

            // Yêu cầu mọi AMR tính toán lại đường đi ngay lập tức
            this.replanAllAMRs();
            return true;
        }

        clearAllObstacles() {
            this.obstacles.clear();
            this.logEvent("Đã dọn sạch toàn bộ vật cản trên sàn", "INFO");
            this.replanAllAMRs();
        }

        // Hàm kiểm tra ô bị chặn dùng cho thuật toán A* của robot
        isCellBlockedForAMR(x, y, selfAmrId) {
            // Vật cản tĩnh do người dùng đặt
            if (this.obstacles.has(`${x},${y}`)) return true;
            // Băng chuyền
            if (y === CONFIG.CONVEYOR_Y && x >= 2 && x <= 43) return true;
            // 34 Ô kệ tỉnh thành
            if (CONFIG.CLUSTER_RACKS.some(r => (Math.abs(r.x - x) <= 1 && Math.abs(r.y - y) <= 1))) return true;

            // Các robot khác (được coi là vật cản động nếu đứng chắn đường)
            for (let other of this.amrs) {
                if (other.id !== selfAmrId) {
                    const ox = Math.round(other.x);
                    const oy = Math.round(other.y);
                    if (ox === x && oy === y) return true;
                }
            }
            return false;
        }

        replanAllAMRs() {
            for (let amr of this.amrs) {
                if (amr.path && amr.path.length > 0) {
                    const target = amr.path[amr.path.length - 1];
                    this.planPathForAMR(amr, target.x, target.y);
                }
            }
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
                amr.noPathAlert = true;
                this.logEvent(`Cảnh báo: ${amr.id} không tìm được đường tới (${targetX}, ${targetY})!`, "ALARM");
            }
            return path;
        }

        // Tạo kiện hàng mới
        spawnPackage(provinceName = null) {
            let targetProvince = null;
            if (provinceName) {
                targetProvince = CONFIG.PROVINCES.find(p => p.name === provinceName);
            }
            if (!targetProvince) {
                const randIdx = Math.floor(Math.random() * CONFIG.PROVINCES.length);
                targetProvince = CONFIG.PROVINCES[randIdx];
            }

            const gate = CONFIG.GATES.find(g => g.region === targetProvince.region);

            const pkgNum = this.nextPackageId++;
            const paddedId = String(pkgNum).padStart(6, '0');
            const waybill = `VN-${targetProvince.code || 'LOG'}-${paddedId}`;
            const pkg = {
                id: pkgNum,
                barcode: waybill,
                province: targetProvince.name,
                provinceCode: targetProvince.code || 'LOG',
                region: targetProvince.region,
                rackId: targetProvince.rackId, // Ánh xạ vào 1 trong 10 Kệ gom cụm tỉnh
                gateId: gate.id,
                x: 2.0, // Điểm xuất phát ở đầu băng tải X=2, Y=CONFIG.CONVEYOR_Y
                y: CONFIG.CONVEYOR_Y,
                confidence: 0,
                scanned: false,
                weight: (0.8 + Math.random() * 4.2).toFixed(1) + " kg",
                customer: "Khách hàng " + targetProvince.name,
                status: "ON_BELT", // ON_BELT -> DIVERTING -> AT_DROP -> CARRIED -> DELIVERED
                divertProgress: 0
            };

            this.packages.push(pkg);
            this.logEvent(`Đã nạp kiện hàng #${pkg.id} [${pkg.province} - Miền ${pkg.region}]`, "INFO");
            return pkg;
        }

        // Kích hoạt Test kẹt cổng (Jam)
        triggerJamTest() {
            const randGate = this.gates[Math.floor(Math.random() * this.gates.length)];
            randGate.isJammed = true;
            randGate.jamTimer = 8.0; // Kẹt trong 8 giây rồi tự thông
            this.logEvent(`CẢNH BÁO KẸT CỔNG: Cổng ${randGate.id} (${randGate.region}) bị kẹt!`, "ALARM");
        }

        // Kích hoạt Test che khuất (Occlusion)
        triggerOcclusionTest() {
            this.testOcclusionActive = true;
            this.logEvent("Đã kích hoạt giả lập CHE KHUẤT camera AI cho kiện hàng kế tiếp", "WARN");
        }

        // =========================================================================
        // VÒNG LẶP CẬP NHẬT LOGIC (STEP UPDATE)
        // =========================================================================
        update(rawDt) {
            const dt = Math.min(rawDt, 0.1) * this.speedMultiplier;

            // 1. Tự động sinh kiện hàng định kỳ
            if (this.autoSpawn) {
                this.spawnTimer += dt;
                if (this.spawnTimer >= 3.8) {
                    this.spawnTimer = 0;
                    // Kiểm tra nếu đầu băng tải không bị kẹt thì sinh
                    const isHeadOccupied = this.packages.some(p => p.status === "ON_BELT" && p.x < 4.5);
                    if (!isHeadOccupied) {
                        this.spawnPackage();
                    }
                }
            }

            // 2. Cập nhật 3 Cổng IoT (Xử lý kẹt cổng nếu có & Trạng thái mở gạt hàng)
            for (let g of this.gates) {
                if (g.isJammed) {
                    g.jamTimer -= dt;
                    if (g.jamTimer <= 0) {
                        g.isJammed = false;
                        this.logEvent(`Cổng ${g.id} (${g.region}) đã tự động giải tỏa kẹt thành công.`, "INFO");
                    }
                }

                // Kiểm tra xem có kiện hàng nào đang rẽ qua cổng này không để mở cần gạt
                const isDivertingHere = this.packages.some(p => p.gateId === g.id && p.status === "DIVERTING");
                if (g.isJammed || isDivertingHere) {
                    g.diverterAngle = -Math.PI / 4; // Mở gạt chéo 45 độ ngang lòng băng tải
                } else {
                    g.diverterAngle = 0; // Đóng ép sát thành băng tải
                }
            }

            // 3. Cập nhật kiện hàng trên băng chuyền
            for (let i = this.packages.length - 1; i >= 0; i--) {
                const p = this.packages[i];

                if (p.status === "ON_BELT") {
                    // Quét cổng AI tại vị trí X = 6.0
                    if (!p.scanned && p.x >= 5.8) {
                        p.scanned = true;
                        if (this.testOcclusionActive) {
                            p.confidence = 0.62 + Math.random() * 0.05; // Giảm độ tin cậy khi che khuất
                            this.testOcclusionActive = false;
                            this.logEvent(`Camera AI: Kiện #${p.id} bị che khuất! Quét lại: ${(p.confidence * 100).toFixed(1)}%`, "WARN");
                        } else {
                            p.confidence = 0.93 + Math.random() * 0.065;
                            this.logEvent(`Camera AI quét kiện #${p.id} [${p.province}]: ${(p.confidence * 100).toFixed(1)}%`, "AI");
                        }
                        this.totalConfidenceSum += p.confidence;
                        this.totalConfScanned++;
                    }

                    // Kiểm tra khoảng cách với kiện đi trước (chống chồng lấn)
                    let canMove = true;
                    for (let other of this.packages) {
                        if (other !== p && other.status === "ON_BELT" && other.x > p.x && (other.x - p.x) < 1.4) {
                            canMove = false;
                            break;
                        }
                    }

                    // Tới đúng Cổng IoT phân loại
                    const targetGate = this.gates.find(g => g.id === p.gateId);
                    if (targetGate && Math.abs(p.x - targetGate.x) < 0.25) {
                        // Đếm số lượng kiện đang xếp hàng trong máng đệm (Chute Buffer Queue - Tối đa 4 kiện)
                        const chuteQueue = this.packages.filter(other => (other.status === "AT_DROP" || other.status === "DIVERTING") && other.gateId === p.gateId);
                        const isChuteFull = chuteQueue.length >= 4;

                        if (targetGate.isJammed || isChuteFull) {
                            canMove = false; // Chỉ dừng băng chuyền khi máng đã đầy kịch trần 4 kiện hoặc cổng kẹt
                        } else {
                            p.status = "DIVERTING";
                            p.divertProgress = 0;
                            // Tính vị trí đệm trên máng (Queue Slot index: 0 là chân máng Y=6.0, 1 là Y=5.1, 2 là Y=4.2, 3 là Y=3.3)
                            p.queueSlot = chuteQueue.length;
                            targetGate.sortedCount++;
                            this.logEvent(`Cổng ${targetGate.id} gạt kiện #${p.id} sang máng Miền ${p.region} (Đệm: ${chuteQueue.length + 1}/4)`, "SORT");
                        }
                    }

                    if (canMove) {
                        p.x += CONFIG.PACKAGE_SPEED * dt;
                    }
                } else if (p.status === "DIVERTING") {
                    // Trượt từ mặt băng chuyền Y=3 xuống vị trí đệm trên máng
                    const targetY = 6.0 - (p.queueSlot || 0) * 0.9;
                    p.divertProgress += dt * 2.0;
                    p.y = 3.0 + p.divertProgress * (targetY - 3.0);
                    if (p.divertProgress >= 1.0) {
                        p.y = targetY;
                        p.status = "AT_DROP";
                        this.logEvent(`Kiện #${p.id} đã vào hàng đợi máng Cổng ${p.gateId} tại vị trí Y=${targetY.toFixed(1)}`, "INFO");
                    }
                }
            }

            // 4. CẬP NHẬT MÁY TRẠNG THÁI 3 ROBOT AMR (STATE MACHINE)
            for (let amr of this.amrs) {
                // Xử lý khi bị tắc đường / không có đường
                if (amr.noPathAlert) {
                    amr.blockedTimer += dt;
                    if (amr.blockedTimer > 1.2) {
                        amr.blockedTimer = 0;
                        // Thử tính lại đường vòng
                        if (amr.targetRack) {
                            this.planPathForAMR(amr, amr.targetRack.x, amr.targetRack.y - 1);
                        } else if (amr.state === "GOING_TO_PICK") {
                            this.planPathForAMR(amr, amr.dropX, amr.dropY + 1);
                        } else {
                            this.planPathForAMR(amr, amr.homeX, amr.homeY);
                        }
                    }
                }

                if (amr.state === "IDLE") {
                    // Tìm kiện hàng ở vị trí đầu hàng đợi của máng (ưu tiên kiện có Y gần chân máng nhất Y >= 5.5)
                    let availablePkgs = [];
                    if (this.flexibleMode) {
                        availablePkgs = this.packages.filter(p => p.status === "AT_DROP");
                    } else {
                        availablePkgs = this.packages.filter(p => p.status === "AT_DROP" && p.region === amr.region);
                    }

                    // Sắp xếp ưu tiên kiện trượt tới trước (Y lớn nhất ~ chân máng)
                    availablePkgs.sort((a, b) => b.y - a.y);

                    // Khóa máng độc quyền (Chute Reservation): Loại trừ kiện tại máng đang có robot khác phục vụ
                    const unreservedPkgs = availablePkgs.filter(pkg => {
                        return !this.amrs.some(other => 
                            other !== amr &&
                            (other.state === "GOING_TO_PICK" || other.state === "PICKING") &&
                            other.currentPackage && other.currentPackage.gateId === pkg.gateId
                        );
                    });

                    const pkgToPick = unreservedPkgs.length > 0 ? unreservedPkgs[0] : null;

                    if (pkgToPick) {
                        amr.currentPackage = pkgToPick;
                        pkgToPick.status = "RESERVED";
                        amr.state = "GOING_TO_PICK";
                        const targetGate = CONFIG.GATES.find(g => g.id === pkgToPick.gateId);
                        this.planPathForAMR(amr, targetGate.dropX, targetGate.dropY + 1);
                        this.logEvent(`${amr.id} tới máng đón kiện #${pkgToPick.id}`, "AMR");
                    } else {
                        // Nếu đang không ở điểm chờ, tự động quay về điểm chờ
                        const distToHome = Math.hypot(amr.x - amr.homeX, amr.y - amr.homeY);
                        if (distToHome > 0.2 && amr.path.length === 0) {
                            this.planPathForAMR(amr, amr.homeX, amr.homeY);
                        }
                    }
                }

                // Di chuyển theo lộ trình A* (Path Following)
                if (amr.path && amr.path.length > 0) {
                    const nextNode = amr.path[0];

                    // Kiểm tra ĐẶT CHỖ Ô KẾ TIẾP (Cell Reservation) chống đâm robot khác
                    let isNextNodeBlocked = false;
                    for (let other of this.amrs) {
                        if (other !== amr) {
                            const ox = Math.round(other.x);
                            const oy = Math.round(other.y);
                            if (ox === nextNode.x && oy === nextNode.y) {
                                isNextNodeBlocked = true;
                                break;
                            }
                        }
                    }

                    if (isNextNodeBlocked) {
                        amr.blockedTimer += dt;
                        if (amr.blockedTimer > 1.2) {
                            // Quá 1.2s: tính lại đường vòng tránh robot chắn đường
                            amr.blockedTimer = 0;
                            const finalTarget = amr.path[amr.path.length - 1];
                            
                            // Kiểm tra nếu ô đích cuối cùng đang bị robot khác chiếm giữ (tránh kẹt đối đầu)
                            const isTargetOccupied = this.amrs.some(other => 
                                other !== amr && 
                                Math.round(other.x) === finalTarget.x && 
                                Math.round(other.y) === finalTarget.y
                            );
                            
                            if (isTargetOccupied) {
                                // Robot kia đang chiếm đúng ô đích -> Lùi lại 1 ô đệm an toàn chờ lượt
                                const waitSpots = [
                                    { x: amr.x, y: amr.y + 1 },
                                    { x: amr.x, y: amr.y - 1 },
                                    { x: amr.x - 1, y: amr.y },
                                    { x: amr.x + 1, y: amr.y }
                                ];
                                const safeSpot = waitSpots.find(s => !this.isCellBlockedForAMR(Math.round(s.x), Math.round(s.y), amr.id));
                                if (safeSpot) {
                                    this.logEvent(`${amr.id} tạm dừng tại ô đệm chờ robot phía trước hoàn thành`, "NAV");
                                    this.planPathForAMR(amr, Math.round(safeSpot.x), Math.round(safeSpot.y));
                                }
                            } else {
                                this.logEvent(`${amr.id} đổi đường vòng tránh robot chắn đường`, "NAV");
                                this.planPathForAMR(amr, finalTarget.x, finalTarget.y);
                            }
                        }
                    } else {
                        amr.blockedTimer = 0;
                        // Tiến bước mượt mà tới nextNode
                        const dx = nextNode.x - amr.x;
                        const dy = nextNode.y - amr.y;
                        const dist = Math.hypot(dx, dy);
                        const step = amr.speed * dt;

                        if (dist <= step) {
                            amr.x = nextNode.x;
                            amr.y = nextNode.y;
                            amr.path.shift(); // Hoàn thành nút này
                        } else {
                            amr.x += (dx / dist) * step;
                            amr.y += (dy / dist) * step;
                        }
                    }
                }

                // Cập nhật vị trí kiện hàng đang chở theo robot
                if (amr.currentPackage && (amr.state === "DELIVERING" || amr.state === "UNLOADING")) {
                    amr.currentPackage.x = amr.x;
                    amr.currentPackage.y = amr.y;
                }

                // Xử lý các điểm mốc trạng thái khi tới đích
                if (amr.path.length === 0) {
                    if (amr.state === "GOING_TO_PICK") {
                        // Đã tới chân máng -> Bốc hàng lên xe & Quét mã nhận diện ô kệ
                        amr.state = "PICKING";
                        setTimeout(() => {
                            if (amr.currentPackage) {
                                amr.currentPackage.status = "CARRIED";
                                
                                // BƯỚC QUÉT MÃ ĐIỂM ĐẾN TRÊN ROBOT:
                                const rack = this.racks[amr.currentPackage.rackId];
                                amr.targetRack = rack;
                                amr.state = "DELIVERING";
                                
                                // Đẩy các kiện phía sau trong máng trượt dồn xuống chân máng
                                const remainingChutePkgs = this.packages.filter(p => p.status === "AT_DROP" && p.gateId === amr.currentPackage.gateId);
                                remainingChutePkgs.forEach(rp => {
                                    if (rp.y < 6.0) rp.y += 0.9; // Dồn xuống chân máng
                                });

                                this.planPathForAMR(amr, rack.x, rack.y - 1);
                                this.logEvent(`[QUÉT MÃ TRÊN ROBOT] ${amr.id} đã nhặt kiện #${amr.currentPackage.id} ➔ Quét mã đích: [${rack.name}]`, "AI");
                            }
                        }, 400 / this.speedMultiplier);
                    } else if (amr.state === "DELIVERING") {
                        // Đã tới trước ô kệ -> Dỡ hàng đặt lên kệ
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
                                this.logEvent(`${amr.id} xếp kiện #${amr.currentPackage.id} (${amr.currentPackage.province}) vào ô [${amr.targetRack.name} ${amr.targetRack.count}/${CONFIG.MAX_RACK_CAPACITY}]`, "STORAGE");

                                // Tự động xuất ô khi đầy 18 kiện
                                if (amr.targetRack.count >= CONFIG.MAX_RACK_CAPACITY) {
                                    this.logEvent(`Ô [${amr.targetRack.name}] đã đầy ${CONFIG.MAX_RACK_CAPACITY} kiện. TỰ ĐỘNG XUẤT Ô THÀNH CÔNG!`, "EXPORT");
                                    amr.targetRack.count = 0;
                                    amr.targetRack.items = [];
                                }

                                // Xóa kiện đã giao
                                const pIdx = this.packages.indexOf(amr.currentPackage);
                                if (pIdx !== -1) this.packages.splice(pIdx, 1);

                                amr.currentPackage = null;
                                amr.targetRack = null;
                                amr.state = "RETURNING";
                                this.planPathForAMR(amr, amr.homeX, amr.homeY);
                            }
                        }, 500 / this.speedMultiplier);
                    } else if (amr.state === "RETURNING") {
                        amr.state = "IDLE";
                    }
                }
            }
        }

        // Xuất trạng thái dạng JSON

        // =========================================================================
        // XUẤT ĐƠN XE TẢI LIÊN TỈNH ĐỊNH KỲ 15:00 (DISPATCH MANIFEST)
        // =========================================================================
        dispatchTruck(options = "Bắc") {
            const plates = {
                "Bắc": "29C-882.91 (Xe 8 Tấn Tuyến Hà Nội - Phía Bắc)",
                "Trung": "43C-612.45 (Xe 10 Tấn Tuyến Đà Nẵng - Miền Trung)",
                "Nam": "51C-993.18 (Xe 15 Tấn Tuyến TP.HCM - Miền Tây)"
            };

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
                        // Chỉ xuất các kiện thuộc đúng Tỉnh này
                        const remainingItems = [];
                        r.items.forEach(pkg => {
                            const prov = typeof pkg === 'object' ? pkg.province : p.name;
                            const pkgId = typeof pkg === 'object' ? pkg.id : pkg;
                            const barcode = typeof pkg === 'object' ? pkg.barcode : `VN-${p.shortName || 'LOG'}-${String(pkgId).padStart(6, '0')}`;
                            if (prov === filterProvince) {
                                dispatchedItems.push({
                                    packageId: pkgId,
                                    barcode: barcode,
                                    province: prov,
                                    region: p.region,
                                    rackName: p.name
                                });
                            } else {
                                remainingItems.push(pkg);
                            }
                        });
                        r.items = remainingItems;
                        r.count = remainingItems.length;
                    } else {
                        // Xuất toàn bộ kiện trên kệ
                        r.items.forEach(pkg => {
                            const pkgId = typeof pkg === 'object' ? pkg.id : pkg;
                            const barcode = typeof pkg === 'object' ? pkg.barcode : `VN-${p.shortName || 'LOG'}-${String(pkgId).padStart(6, '0')}`;
                            const prov = typeof pkg === 'object' ? pkg.province : p.name;
                            dispatchedItems.push({
                                packageId: pkgId,
                                barcode: barcode,
                                province: prov,
                                region: p.region,
                                rackName: p.name
                            });
                        });
                        r.count = 0;
                        r.items = [];
                    }
                }
            });

            const manifest = {
                manifestId: `PXK-${Date.now().toString().slice(-6)}-${regionName === 'Bắc' ? 'BAC' : (regionName === 'Trung' ? 'TRUNG' : 'NAM')}`,
                dispatchTime: new Date().toLocaleTimeString("vi-VN"),
                region: regionName,
                hubName: `Hub Miền ${regionName}`,
                filterProvince: filterProvince || "Tất cả",
                filterRackId: filterRackId || "Tất cả",
                truckPlate: plates[regionName] || "29C-999.99",
                totalPackages: dispatchedItems.length,
                packages: dispatchedItems
            };

            const scopeText = filterProvince && filterProvince !== "ALL" ? `Tỉnh ${filterProvince}` : (filterRackId && filterRackId !== "ALL" ? `Kệ ${filterRackId}` : `Toàn Tuyến ${manifest.hubName}`);
            this.logEvent(`[XUẤT PHIẾU XUẤT HÀNG] ${scopeText}: Đã bàn giao ${manifest.totalPackages} kiện cho tài xế xe ${manifest.truckPlate}`, "EXPORT");
            return manifest;
        }

        exportStateJSON() {
            return JSON.stringify({
                timestamp: Date.now(),
                autoSpawn: this.autoSpawn,
                flexibleMode: this.flexibleMode,
                totalProcessed: this.totalProcessed,
                obstacles: Array.from(this.obstacles),
                racks: this.racks,
                packages: this.packages,
                amrs: this.amrs.map(a => ({ id: a.id, x: a.x, y: a.y, state: a.state, battery: a.battery }))
            }, null, 2);
        }

        // Nạp trạng thái từ JSON
        importStateJSON(jsonStr) {
            try {
                const data = JSON.parse(jsonStr);
                if (data.obstacles) this.obstacles = new Set(data.obstacles);
                if (data.autoSpawn !== undefined) this.autoSpawn = data.autoSpawn;
                if (data.flexibleMode !== undefined) this.flexibleMode = data.flexibleMode;
                this.replanAllAMRs();
                this.logEvent("Đã nạp thành công cấu hình trạng thái từ JSON", "INFO");
                return true;
            } catch (e) {
                this.logEvent("Lỗi nạp cấu hình JSON: " + e.message, "ERROR");
                return false;
            }
        }
    }

    window.SimulationLogicEngine = SimulationLogicEngine;
    window.SIM_CONFIG = CONFIG;
})(window);

