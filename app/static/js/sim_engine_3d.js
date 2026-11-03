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
        GRID_W: 36,
        GRID_H: 22,
        SPEED_MULTIPLIER: 1.0,
        MAX_RACK_CAPACITY: 6,
        PACKAGE_SPEED: 2.2, // ô/giây trên băng tải
        AMR_SPEED: 2.4,     // ô/giây
        CONVEYOR_Y: 3,      // Dòng băng chuyền trên lưới Y=3
        GATES: [
            { id: 1, region: "Bắc", x: 9, y: 3, dropX: 9, dropY: 6, waitX: 9, waitY: 7, color: "#0284c7" },
            { id: 2, region: "Trung", x: 18, y: 3, dropX: 18, dropY: 6, waitX: 18, waitY: 7, color: "#9333ea" }, // Tím theo đề bài
            { id: 3, region: "Nam", x: 27, y: 3, dropX: 27, dropY: 6, waitX: 27, waitY: 7, color: "#10b981" }
        ],
        PROVINCES: [
            // Miền Bắc (Xanh Dương)
            { id: "hn", name: "Hà Nội", region: "Bắc", x: 7, y: 19, color: "#0284c7" },
            { id: "hp", name: "Hải Phòng", region: "Bắc", x: 9, y: 19, color: "#0284c7" },
            { id: "qn", name: "Quảng Ninh", region: "Bắc", x: 11, y: 19, color: "#0284c7" },
            // Miền Trung (Tím)
            { id: "dn", name: "Đà Nẵng", region: "Trung", x: 16, y: 19, color: "#9333ea" },
            { id: "hue", name: "Huế", region: "Trung", x: 18, y: 19, color: "#9333ea" },
            { id: "kh", name: "Khánh Hòa", region: "Trung", x: 20, y: 19, color: "#9333ea" },
            // Miền Nam (Xanh Lá)
            { id: "hcm", name: "TP.HCM", region: "Nam", x: 25, y: 19, color: "#10b981" },
            { id: "bd", name: "Bình Dương", region: "Nam", x: 27, y: 19, color: "#10b981" },
            { id: "ct", name: "Cần Thơ", region: "Nam", x: 29, y: 19, color: "#10b981" }
        ]
    };

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
            CONFIG.PROVINCES.forEach(p => {
                this.racks[p.id] = { ...p, count: 0, items: [] };
            });

            // 3 Cổng IoT
            this.gates = CONFIG.GATES.map(g => ({
                ...g,
                isJammed: false,
                jamTimer: 0,
                sortedCount: 0,
                diverterAngle: 0
            }));

            // 3 Robot AMR
            this.amrs = [
                {
                    id: "AMR-01",
                    name: "AMR-01 (Bắc)",
                    region: "Bắc",
                    color: "#0284c7",
                    x: 9, y: 7,
                    homeX: 9, homeY: 7,
                    dropX: 9, dropY: 6,
                    state: "IDLE", // IDLE -> GOING_TO_PICK -> PICKING -> DELIVERING -> UNLOADING -> RETURNING
                    currentPackage: null,
                    targetRack: null,
                    path: [],
                    blockedTimer: 0,
                    noPathAlert: false,
                    speed: CONFIG.AMR_SPEED
                },
                {
                    id: "AMR-02",
                    name: "AMR-02 (Trung)",
                    region: "Trung",
                    color: "#9333ea",
                    x: 18, y: 7,
                    homeX: 18, homeY: 7,
                    dropX: 18, dropY: 6,
                    state: "IDLE",
                    currentPackage: null,
                    targetRack: null,
                    path: [],
                    blockedTimer: 0,
                    noPathAlert: false,
                    speed: CONFIG.AMR_SPEED
                },
                {
                    id: "AMR-03",
                    name: "AMR-03 (Nam)",
                    region: "Nam",
                    color: "#10b981",
                    x: 27, y: 7,
                    homeX: 27, homeY: 7,
                    dropX: 27, dropY: 6,
                    state: "IDLE",
                    currentPackage: null,
                    targetRack: null,
                    path: [],
                    blockedTimer: 0,
                    noPathAlert: false,
                    speed: CONFIG.AMR_SPEED
                }
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
            // 1. Ô Băng chuyền Y = 3 (X từ 2 đến 33)
            if (y === CONFIG.CONVEYOR_Y && x >= 2 && x <= 33) return true;
            // 2. Ô Kệ tỉnh thành Y = 19
            if (y === 19 && CONFIG.PROVINCES.some(p => p.x === x)) return true;
            // 3. Ô Điểm thả của 3 cổng (dropX, dropY) & Điểm chờ (homeX, homeY)
            for (let g of CONFIG.GATES) {
                if (x === g.dropX && y === g.dropY) return true;
                if (x === g.waitX && y === g.waitY) return true;
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
            // Băng chuyền Y = 3
            if (y === CONFIG.CONVEYOR_Y && x >= 2 && x <= 33) return true;
            // Các ô kệ tỉnh thành
            if (y === 19 && CONFIG.PROVINCES.some(p => p.x === x)) return true;

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

            const pkg = {
                id: this.nextPackageId++,
                barcode: `PKG-${this.nextPackageId}`,
                province: targetProvince.name,
                region: targetProvince.region,
                rackId: targetProvince.id,
                gateId: gate.id,
                x: 2.0, // Điểm xuất phát ở đầu băng tải X=2, Y=3
                y: CONFIG.CONVEYOR_Y,
                confidence: 0,
                scanned: false,
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
                    const pkgToPick = availablePkgs.length > 0 ? availablePkgs[0] : null;

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
                            this.logEvent(`${amr.id} đổi đường vòng tránh robot chắn đường`, "NAV");
                            this.planPathForAMR(amr, finalTarget.x, finalTarget.y);
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
                                amr.targetRack.items.push(amr.currentPackage.id);
                                this.totalProcessed++;
                                this.logEvent(`${amr.id} xếp kiện #${amr.currentPackage.id} vào ô [${amr.targetRack.name} ${amr.targetRack.count}/6]`, "STORAGE");

                                // Tự động xuất ô khi đầy 6 kiện
                                if (amr.targetRack.count >= CONFIG.MAX_RACK_CAPACITY) {
                                    this.logEvent(`Ô [${amr.targetRack.name}] đã đầy 6 kiện. TỰ ĐỘNG XUẤT Ô THÀNH CÔNG!`, "EXPORT");
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

