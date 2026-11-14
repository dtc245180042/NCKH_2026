/**
 * ==============================================================================
 * NEXUSLOG 3D - THREE.JS DIGITAL TWIN SCADA RENDERING ENGINE (UPGRADED)
 * ==============================================================================
 * Kiến trúc đồ họa 3D Three.js tách bạch hoàn toàn:
 * - 3 Trạm sạc 3D chuyên dụng có đèn LED phát sáng và trạng thái trạm
 * - Bảng HUD Pin & Trạng thái động (Billboard Sprites luôn hướng về Camera)
 * - Đèn cảnh báo nhấp nháy tại cổng khi xảy ra sự cố
 * - Vệt quỹ đạo A* chỉ hiển thị khi robot thực sự di chuyển
 * - Tối ưu hiệu năng 60 FPS mượt mà
 * ==============================================================================
 */

(function (window) {
    "use strict";

    class SimulationRenderer3D {
        constructor(containerId, logicEngine) {
            this.container = document.getElementById(containerId);
            this.engine = logicEngine;
            this.config = logicEngine.config;

            this.scene = null;
            this.camera = null;
            this.renderer = null;
            this.controls = null;
            this.raycaster = new THREE.Raycaster();
            this.mouse = new THREE.Vector2();

            this.meshes = {
                conveyor: null,
                rollers: [],
                gates: {},
                diverters: [],
                racks: {},
                amrs: {},
                chargers: {},
                packages: {},
                obstacles: {},
                aStarTrails: {},
                dockLabels: []
            };

            this.fps = 60;
            this.lastTime = performance.now();
            this.frameCount = 0;
            this.fpsTimer = performance.now();
            this.lastSyncTime = performance.now();
            this.followCamActive = false;
            this.followAmrId = "AMR-01";

            this.animate = this.animate.bind(this);
            this.initScene();
            this.bindEvents();
        }

        // Chuyển đổi tọa độ Lưới (Grid) sang Không gian 3D (World)
        gridToWorld(gx, gy) {
            const wx = gx - this.config.GRID_W / 2; // -23 .. +23
            const wz = gy - this.config.GRID_H / 2; // -15 .. +15
            return { x: wx, z: wz };
        }

        // Chuyển đổi tọa độ 3D (World) sang Lưới (Grid)
        worldToGrid(wx, wz) {
            const gx = Math.round(wx + this.config.GRID_W / 2);
            const gy = Math.round(wz + this.config.GRID_H / 2);
            return {
                x: Math.max(0, Math.min(this.config.GRID_W - 1, gx)),
                y: Math.max(0, Math.min(this.config.GRID_H - 1, gy))
            };
        }

        initScene() {
            // Xóa canvas cũ nếu có
            const oldCanvas = this.container.querySelector("canvas");
            if (oldCanvas) oldCanvas.remove();

            // 1. Scene
            this.scene = new THREE.Scene();
            this.scene.background = new THREE.Color(0xf8fafc); // Nền sáng sạch công nghiệp
            this.scene.fog = new THREE.FogExp2(0xf8fafc, 0.007);

            // 2. Camera
            const aspect = this.container.clientWidth / this.container.clientHeight;
            this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
            this.setCameraPreset("iso"); // Phối cảnh isometric mặc định

            // 3. WebGL Renderer
            this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
            this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            this.container.appendChild(this.renderer.domElement);

            // 4. OrbitControls
            if (window.THREE && window.THREE.OrbitControls) {
                this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
                this.controls.enableDamping = true;
                this.controls.dampingFactor = 0.08;
                this.controls.maxPolarAngle = Math.PI / 2 - 0.05; // Không cho nhìn từ dưới sàn lên
                this.controls.minDistance = 6;
                this.controls.maxDistance = 65;
            }

            // 5. Ánh sáng & Đổ bóng
            this.setupLights();

            // 6. Xây dựng các mô hình 3D
            this.buildFloorAndLanes();
            this.buildConveyorAndGates();
            this.buildChargingStations();
            this.buildAIPortal();
            this.build9ProvinceRacks();
            this.buildAMRs();
            this.buildInboundAndOutboundDocks();

            // Bắt đầu vòng lặp render
            requestAnimationFrame(this.animate);
        }

        setupLights() {
            const ambient = new THREE.AmbientLight(0xffffff, 0.75);
            this.scene.add(ambient);

            const sunLight = new THREE.DirectionalLight(0xffffff, 0.95);
            sunLight.position.set(16, 32, 22);
            sunLight.castShadow = true;
            sunLight.shadow.mapSize.width = 2048;
            sunLight.shadow.mapSize.height = 2048;
            sunLight.shadow.camera.near = 0.5;
            sunLight.shadow.camera.far = 120;
            sunLight.shadow.camera.left = -28;
            sunLight.shadow.camera.right = 28;
            sunLight.shadow.camera.top = 22;
            sunLight.shadow.camera.bottom = -22;
            this.scene.add(sunLight);

            const fillLight = new THREE.DirectionalLight(0xe0f2fe, 0.4);
            fillLight.position.set(-18, 14, -18);
            this.scene.add(fillLight);
        }

        // =========================================================================
        // A. SÀN KHO & LÀN ĐƯỜNG PHÂN VÙNG
        // =========================================================================
        buildFloorAndLanes() {
            const floorW = this.config.GRID_W;
            const floorH = this.config.GRID_H;

            // Mặt sàn bê tông epoxy xám nhạt
            const floorGeo = new THREE.PlaneGeometry(floorW + 2, floorH + 2);
            const floorMat = new THREE.MeshStandardMaterial({
                color: 0xffffff,
                roughness: 0.85,
                metalness: 0.05
            });
            const floor = new THREE.Mesh(floorGeo, floorMat);
            floor.rotation.x = -Math.PI / 2;
            floor.position.y = -0.01;
            floor.receiveShadow = true;
            this.scene.add(floor);
            this.groundPlane = floor;

            // Lưới tọa độ A* Grid mờ thanh lịch
            const gridHelper = new THREE.GridHelper(Math.max(floorW, floorH), Math.max(floorW, floorH), 0x94a3b8, 0xe2e8f0);
            gridHelper.position.y = 0.01;
            this.scene.add(gridHelper);

            // Làn đường hành lang an toàn trung tâm (Làn Miền Trung - Tím mờ)
            const laneCenterGeo = new THREE.PlaneGeometry(12, floorH - 12);
            const laneCenterMat = new THREE.MeshBasicMaterial({ color: 0x9333ea, transparent: true, opacity: 0.05 });
            const laneCenter = new THREE.Mesh(laneCenterGeo, laneCenterMat);
            laneCenter.rotation.x = -Math.PI / 2;
            laneCenter.position.set(0, 0.015, 3.5);
            this.scene.add(laneCenter);
        }

        // =========================================================================
        // B. BĂNG CHUYỀN CON LĂN & 3 CỔNG IOT PHÂN LOẠI
        // =========================================================================
        buildConveyorAndGates() {
            const beltW = 42;
            const beltD = 1.35;
            const beltH = 0.85;
            const wPos = this.gridToWorld(22.5, this.config.CONVEYOR_Y);

            const conveyorGroup = new THREE.Group();

            // Khung thép đỡ băng tải
            const frameGeo = new THREE.BoxGeometry(beltW, 0.22, beltD);
            const frameMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.6, roughness: 0.3 });
            const frame = new THREE.Mesh(frameGeo, frameMat);
            frame.position.set(wPos.x, beltH, wPos.z);
            frame.castShadow = true;
            frame.receiveShadow = true;
            conveyorGroup.add(frame);

            // Chân trụ băng tải
            const legGeo = new THREE.CylinderGeometry(0.08, 0.08, beltH, 8);
            const legMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8 });
            for (let x = -beltW / 2 + 1; x <= beltW / 2 - 1; x += 3.8) {
                const leg1 = new THREE.Mesh(legGeo, legMat);
                leg1.position.set(wPos.x + x, beltH / 2, wPos.z - beltD / 2 + 0.1);
                conveyorGroup.add(leg1);

                const leg2 = new THREE.Mesh(legGeo, legMat);
                leg2.position.set(wPos.x + x, beltH / 2, wPos.z + beltD / 2 - 0.1);
                conveyorGroup.add(leg2);
            }

            // Thanh lan can bảo vệ 2 bên
            const fenceGeo = new THREE.BoxGeometry(beltW, 0.12, 0.04);
            const fenceMat = new THREE.MeshStandardMaterial({ color: 0xeab308, metalness: 0.4 });
            const fenceL = new THREE.Mesh(fenceGeo, fenceMat);
            fenceL.position.set(wPos.x, beltH + 0.15, wPos.z - beltD / 2);
            conveyorGroup.add(fenceL);

            const fenceR = new THREE.Mesh(fenceGeo, fenceMat);
            fenceR.position.set(wPos.x, beltH + 0.15, wPos.z + beltD / 2);
            conveyorGroup.add(fenceR);

            // Con lăn kim loại
            const rollerGeo = new THREE.CylinderGeometry(0.05, 0.05, beltD - 0.1, 10);
            const rollerMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.5 });
            this.meshes.rollers = [];
            for (let x = -beltW / 2 + 0.5; x <= beltW / 2 - 0.5; x += 0.55) {
                const r = new THREE.Mesh(rollerGeo, rollerMat);
                r.position.set(wPos.x + x, beltH + 0.08, wPos.z);
                r.rotation.x = Math.PI / 2;
                conveyorGroup.add(r);
                this.meshes.rollers.push(r);
            }

            // 3 CỔNG IOT CƠ KHÍ & MÁNG TRƯỢT
            this.config.GATES.forEach(gate => {
                const gWorld = this.gridToWorld(gate.x, gate.y);
                const dropWorld = this.gridToWorld(gate.dropX, gate.dropY);

                // Cổng vòm
                const archGeo = new THREE.BoxGeometry(0.18, 2.0, 0.18);
                const archMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3 });
                const colBack = new THREE.Mesh(archGeo, archMat);
                colBack.position.set(gWorld.x, beltH + 0.9, gWorld.z - beltD / 2 - 0.1);
                conveyorGroup.add(colBack);

                const colFront = new THREE.Mesh(archGeo, archMat);
                colFront.position.set(gWorld.x, beltH + 0.9, gWorld.z + beltD / 2 + 0.1);
                conveyorGroup.add(colFront);

                const topBeam = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, beltD + 0.4), archMat);
                topBeam.position.set(gWorld.x, beltH + 1.9, gWorld.z);
                conveyorGroup.add(topBeam);

                // Cần gạt cơ khí phân loại IoT
                const armGroup = new THREE.Group();

                // Trụ xoay Servo
                const servoCyl = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.16, 0.16, 0.45, 16),
                    new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.2 })
                );
                servoCyl.position.y = 0.2;
                armGroup.add(servoCyl);

                // Nắp đèn LED báo trạng thái đỉnh trụ xoay (có thể nhấp nháy khi sự cố)
                const ledCapMat = new THREE.MeshBasicMaterial({ color: gate.color });
                const ledCap = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.09, 0.09, 0.08, 16),
                    ledCapMat
                );
                ledCap.position.y = 0.44;
                armGroup.add(ledCap);

                // Cánh tay gạt
                const bladeGeo = new THREE.BoxGeometry(1.45, 0.26, 0.12);
                const bladeMat = new THREE.MeshStandardMaterial({ color: gate.color, metalness: 0.3, roughness: 0.3 });
                const blade = new THREE.Mesh(bladeGeo, bladeMat);
                blade.position.set(0.72, 0.2, 0);
                armGroup.add(blade);

                const armPivot = new THREE.Group();
                armPivot.position.set(gWorld.x - 0.7, beltH + 0.05, gWorld.z - beltD / 2 + 0.1);
                armPivot.add(armGroup);
                conveyorGroup.add(armPivot);

                this.meshes.diverters.push({
                    id: gate.id,
                    pivot: armPivot,
                    bladeMat: bladeMat,
                    ledCapMat: ledCapMat,
                    defaultColor: new THREE.Color(gate.color),
                    currentAngle: 0,
                    targetAngle: 0
                });

                // Máng trượt dốc (Chute)
                const chuteLen = Math.hypot(dropWorld.x - gWorld.x, dropWorld.z - gWorld.z);
                const chuteGeo = new THREE.BoxGeometry(1.2, 0.08, chuteLen);
                const chuteMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.6, roughness: 0.3 });
                const chute = new THREE.Mesh(chuteGeo, chuteMat);
                chute.position.set(gWorld.x, beltH / 2, (gWorld.z + dropWorld.z) / 2);
                chute.rotation.x = 0.26; // Góc dốc xuống sàn
                conveyorGroup.add(chute);

                // Vùng đệm nhận hàng của AMR tại chân máng (Drop Zone)
                const dropPad = new THREE.Mesh(
                    new THREE.PlaneGeometry(1.4, 1.4),
                    new THREE.MeshBasicMaterial({ color: gate.color, transparent: true, opacity: 0.35 })
                );
                dropPad.rotation.x = -Math.PI / 2;
                dropPad.position.set(dropWorld.x, 0.02, dropWorld.z);
                this.scene.add(dropPad);
            });

            this.scene.add(conveyorGroup);
        }

        // =========================================================================
        // C. 3 TRẠM SẠC 3D (CHARGING STATIONS) CÓ ĐÈN PHÁT SÁNG & TRẠNG THÁI
        // =========================================================================
        buildChargingStations() {
            const chgGroup = new THREE.Group();

            this.engine.chargers.forEach(chg => {
                const wPos = this.gridToWorld(chg.x, chg.y);
                const stationGroup = new THREE.Group();
                stationGroup.position.set(wPos.x, 0, wPos.z);

                // 1. Đế sạc công nghiệp chống trượt
                const padGeo = new THREE.BoxGeometry(1.5, 0.06, 1.5);
                const padMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.4, roughness: 0.4 });
                const pad = new THREE.Mesh(padGeo, padMat);
                pad.position.y = 0.03;
                stationGroup.add(pad);

                // Viền vàng cảnh báo an toàn quanh đế
                const borderGeo = new THREE.RingGeometry(0.7, 0.85, 4);
                const borderMat = new THREE.MeshBasicMaterial({ color: 0xeab308, side: THREE.DoubleSide });
                const border = new THREE.Mesh(borderGeo, borderMat);
                border.rotation.x = -Math.PI / 2;
                border.rotation.z = Math.PI / 4;
                border.position.y = 0.07;
                stationGroup.add(border);

                // Vòng LED tiếp xúc sạc trên sàn (Phát sáng khi có xe vào nạp)
                const contactRingMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.5 });
                const contactRing = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.42, 0.42, 0.02, 16),
                    contactRingMat
                );
                contactRing.position.y = 0.075;
                stationGroup.add(contactRing);

                // 2. Trụ sạc đứng (Pillar) ở cạnh sau
                const pillarGeo = new THREE.BoxGeometry(0.35, 1.5, 0.35);
                const pillarMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.7, roughness: 0.2 });
                const pillar = new THREE.Mesh(pillarGeo, pillarMat);
                pillar.position.set(0, 0.75, -0.65);
                stationGroup.add(pillar);

                // Đèn LED biểu tượng Pin trên đỉnh trụ sạc
                const ledPillarMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
                const ledPillar = new THREE.Mesh(
                    new THREE.BoxGeometry(0.24, 0.2, 0.05),
                    ledPillarMat
                );
                ledPillar.position.set(0, 1.25, -0.45);
                stationGroup.add(ledPillar);

                // 3. Billboard Nhãn Tên Trạm Sạc (Luôn xoay về camera)
                const labelCanvas = document.createElement("canvas");
                labelCanvas.width = 280;
                labelCanvas.height = 80;
                const lctx = labelCanvas.getContext("2d");
                lctx.fillStyle = "rgba(15, 23, 42, 0.92)";
                lctx.strokeStyle = "#eab308";
                lctx.lineWidth = 4;
                lctx.beginPath();
                lctx.roundRect(4, 4, 272, 72, 10);
                lctx.fill();
                lctx.stroke();
                lctx.fillStyle = "#ffffff";
                lctx.font = "bold 24px 'Plus Jakarta Sans', sans-serif";
                lctx.textAlign = "center";
                lctx.fillText(chg.name, 140, 36);
                lctx.fillStyle = "#10b981";
                lctx.font = "bold 20px 'JetBrains Mono', monospace";
                lctx.fillText("● TRỐNG SẴN SÀNG", 140, 62);

                const labelTex = new THREE.CanvasTexture(labelCanvas);
                const labelMesh = new THREE.Mesh(
                    new THREE.PlaneGeometry(2.0, 0.58),
                    new THREE.MeshBasicMaterial({ map: labelTex, transparent: true })
                );
                labelMesh.position.set(0, 2.0, -0.65);
                stationGroup.add(labelMesh);

                stationGroup.userData = {
                    id: chg.id,
                    contactRingMat,
                    ledPillarMat,
                    labelCanvas,
                    labelTex,
                    labelMesh
                };

                chgGroup.add(stationGroup);
                this.meshes.chargers[chg.id] = stationGroup;
            });

            this.scene.add(chgGroup);
        }

        // =========================================================================
        // D. CỔNG AI XANH LƠ (TEAL) + BOUNDING BOX + NHÃN "YOLOv12n: xx.x%"
        // =========================================================================
        buildAIPortal() {
            const gPos = this.gridToWorld(6, this.config.CONVEYOR_Y);
            const portalGroup = new THREE.Group();

            const gantryMat = new THREE.MeshStandardMaterial({ color: 0x06b6d4, roughness: 0.2 });
            const col1 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.8, 0.18), gantryMat);
            col1.position.set(gPos.x, 1.4, gPos.z - 0.85);
            portalGroup.add(col1);

            const col2 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.8, 0.18), gantryMat);
            col2.position.set(gPos.x, 1.4, gPos.z + 0.85);
            portalGroup.add(col2);

            const topBeam = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 1.9), gantryMat);
            topBeam.position.set(gPos.x, 2.7, gPos.z);
            portalGroup.add(topBeam);

            // Bounding box xanh lơ
            const bboxGeo = new THREE.BoxGeometry(0.85, 0.7, 0.85);
            const bboxEdges = new THREE.EdgesGeometry(bboxGeo);
            const bbox = new THREE.LineSegments(bboxEdges, new THREE.LineBasicMaterial({ color: 0x06b6d4, linewidth: 2 }));
            bbox.position.set(gPos.x, 1.6, gPos.z);
            portalGroup.add(bbox);
            this.meshes.aiBoundingBox = bbox;

            // Nhãn nổi "YOLOv12n: 98.4%"
            const badgeCanvas = document.createElement("canvas");
            badgeCanvas.width = 320;
            badgeCanvas.height = 90;
            const bctx = badgeCanvas.getContext("2d");
            bctx.fillStyle = "#06b6d4";
            bctx.beginPath();
            bctx.roundRect(0, 0, 320, 90, 16);
            bctx.fill();
            bctx.fillStyle = "#ffffff";
            bctx.font = "bold 34px 'JetBrains Mono', sans-serif";
            bctx.textAlign = "center";
            bctx.fillText("YOLOv12n: 98.4%", 160, 56);

            const badgeTex = new THREE.CanvasTexture(badgeCanvas);
            const badgeMesh = new THREE.Mesh(
                new THREE.PlaneGeometry(2.4, 0.68),
                new THREE.MeshBasicMaterial({ map: badgeTex, transparent: true })
            );
            badgeMesh.position.set(gPos.x, 3.2, gPos.z);
            portalGroup.add(badgeMesh);
            this.meshes.aiBadgeMesh = badgeMesh;

            this.scene.add(portalGroup);
        }

        // =========================================================================
        // E. 10 CỤM KỆ TỈNH THÀNH (BILLBOARD SPRITES LUÔN HƯỚNG VỀ CAMERA)
        // =========================================================================
        build9ProvinceRacks() {
            const rackGroup = new THREE.Group();
            const racksList = this.config.CLUSTER_RACKS;

            racksList.forEach(p => {
                const wPos = this.gridToWorld(p.x, p.y);
                const singleRack = new THREE.Group();
                singleRack.position.set(wPos.x, 0, wPos.z);

                // Khung bục kệ
                const body = new THREE.Mesh(
                    new THREE.BoxGeometry(2.4, 0.45, 1.8),
                    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.4 })
                );
                body.position.y = 0.225;
                singleRack.add(body);

                // Mặt bục phân màu miền
                const topPlate = new THREE.Mesh(
                    new THREE.BoxGeometry(2.44, 0.06, 1.84),
                    new THREE.MeshBasicMaterial({ color: p.color })
                );
                topPlate.position.y = 0.47;
                singleRack.add(topPlate);

                // Thùng hàng xếp trên kệ
                const boxesContainer = new THREE.Group();
                singleRack.add(boxesContainer);
                singleRack.userData = { boxesContainer, count: 0, provinceName: p.name, color: p.color };

                // Nhãn nổi Billboard: Nền tối chữ trắng viền màu sắc nét
                const labelCanvas = document.createElement("canvas");
                labelCanvas.width = 360;
                labelCanvas.height = 110;
                const lctx = labelCanvas.getContext("2d");
                lctx.fillStyle = "rgba(15, 23, 42, 0.92)";
                lctx.strokeStyle = p.color;
                lctx.lineWidth = 5;
                lctx.beginPath();
                lctx.roundRect(6, 6, 348, 98, 14);
                lctx.fill();
                lctx.stroke();
                lctx.fillStyle = "#ffffff";
                lctx.font = "bold 26px 'Plus Jakarta Sans', sans-serif";
                lctx.textAlign = "center";
                lctx.fillText(p.shortName || p.name, 180, 46);
                lctx.fillStyle = p.color;
                lctx.font = "bold 22px 'JetBrains Mono', sans-serif";
                lctx.fillText("0/18 ô", 180, 82);

                const labelTex = new THREE.CanvasTexture(labelCanvas);
                const labelMesh = new THREE.Mesh(
                    new THREE.PlaneGeometry(2.6, 0.8),
                    new THREE.MeshBasicMaterial({ map: labelTex, transparent: true })
                );
                labelMesh.position.set(0, 2.3, 0);
                singleRack.add(labelMesh);
                singleRack.userData.labelMesh = labelMesh;
                singleRack.userData.labelCanvas = labelCanvas;
                singleRack.userData.labelTex = labelTex;

                rackGroup.add(singleRack);
                this.meshes.racks[p.id] = singleRack;
            });

            this.scene.add(rackGroup);
        }

        // =========================================================================
        // F. 6 ROBOT AMR KHỐI THẤP + THANH PIN & NHÃN TRẠNG THÁI 3D DYNAMIC
        // =========================================================================
        buildAMRs() {
            this.engine.amrs.forEach(amr => {
                const wPos = this.gridToWorld(amr.x, amr.y);
                const amrGroup = new THREE.Group();
                amrGroup.position.set(wPos.x, 0.15, wPos.z);

                // Thân xe khối thấp
                const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3 });
                const body = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.26, 1.2), bodyMat);
                amrGroup.add(body);

                // Mặt trên đúng màu làn
                const rimMat = new THREE.MeshBasicMaterial({ color: amr.color });
                const rim = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.08, 1.22), rimMat);
                rim.position.y = 0.14;
                amrGroup.add(rim);

                // Nắp trắng trung tâm
                const deck = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.85), new THREE.MeshBasicMaterial({ color: 0xffffff }));
                deck.position.y = 0.18;
                amrGroup.add(deck);

                // Thùng hàng khi xe chở (Kích thước & màu sắc kraft đồng nhất)
                const boxGeo = new THREE.BoxGeometry(0.65, 0.46, 0.58);
                const boxMat = new THREE.MeshStandardMaterial({ color: 0xc88236, roughness: 0.7, metalness: 0.05 });
                const carryingBox = new THREE.Mesh(boxGeo, boxMat);
                carryingBox.position.set(0, 0.44, 0);
                carryingBox.visible = false;
                amrGroup.add(carryingBox);

                // BẢNG HUD 3D TRÊN ĐẦU AMR: TÊN XE + THANH PIN + TRẠNG THÁI
                const hudCanvas = document.createElement("canvas");
                hudCanvas.width = 240;
                hudCanvas.height = 90;
                const hctx = hudCanvas.getContext("2d");

                // Vẽ khởi tạo
                this.drawAMRHUDCanvas(hctx, amr);

                const hudTex = new THREE.CanvasTexture(hudCanvas);
                const hudMesh = new THREE.Mesh(
                    new THREE.PlaneGeometry(1.5, 0.56),
                    new THREE.MeshBasicMaterial({ map: hudTex, transparent: true })
                );
                hudMesh.position.set(0, 1.15, 0);
                amrGroup.add(hudMesh);

                amrGroup.userData = {
                    id: amr.id,
                    carryingBox,
                    hudMesh,
                    hudCanvas,
                    hudTex,
                    lastBattery: amr.battery,
                    lastState: amr.state
                };

                this.scene.add(amrGroup);
                this.meshes.amrs[amr.id] = amrGroup;

                // Dải đường màu xanh lơ hiển thị lộ trình A*
                const trailGeo = new THREE.BufferGeometry();
                const positions = new Float32Array(60 * 3);
                trailGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
                const trailLine = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color: 0x06b6d4, linewidth: 2 }));
                this.scene.add(trailLine);
                this.meshes.aStarTrails[amr.id] = trailLine;
            });
        }

        // Vẽ nội dung Canvas HUD cho robot AMR (Tên, % Pin, Thanh pin màu, Trạng thái)
        drawAMRHUDCanvas(ctx, amr) {
            ctx.clearRect(0, 0, 240, 90);

            // Nền tối bo tròn
            ctx.fillStyle = "rgba(15, 23, 42, 0.88)";
            ctx.strokeStyle = amr.color;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.roundRect(3, 3, 234, 84, 10);
            ctx.fill();
            ctx.stroke();

            // Dòng 1: Tên xe + Badge trạng thái
            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 20px 'JetBrains Mono', monospace";
            ctx.textAlign = "left";
            ctx.fillText(amr.id, 14, 28);

            // Trạng thái rút gọn
            const stateTextMap = {
                "IDLE": "RẢNH",
                "TO_PICKUP": "LẤY HÀNG",
                "CARRYING": "VẬN CHUYỂN",
                "UNLOADING": "DỠ HÀNG",
                "TO_CHARGER": "VỀ SẠC",
                "CHARGING": "ĐANG SẠC",
                "BLOCKED": "BỊ CHẶN",
                "ERROR": "LỖI",
                "E_STOP": "E-STOP"
            };
            const stText = stateTextMap[amr.state] || amr.state;

            // Màu trạng thái
            let badgeBg = "#38bdf8"; // Xanh dương
            if (amr.state === "CARRYING" || amr.state === "TO_PICKUP" || amr.state === "UNLOADING") badgeBg = "#10b981"; // Xanh lá
            else if (amr.state === "CHARGING" || amr.state === "TO_CHARGER") badgeBg = "#f59e0b"; // Vàng
            else if (amr.state === "BLOCKED" || amr.state === "ERROR" || amr.state === "E_STOP") badgeBg = "#ef4444"; // Đỏ

            ctx.fillStyle = badgeBg;
            ctx.beginPath();
            ctx.roundRect(110, 10, 116, 22, 6);
            ctx.fill();
            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 13px 'Plus Jakarta Sans', sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(stText, 168, 26);

            // Dòng 2: Thanh Pin tiến độ (Battery Progress Bar)
            const bat = Math.max(0, Math.min(100, Math.round(amr.battery)));
            const barW = 160;
            const barH = 12;
            const barX = 14;
            const barY = 42;

            // Khung thanh pin
            ctx.fillStyle = "#334155";
            ctx.beginPath();
            ctx.roundRect(barX, barY, barW, barH, 4);
            ctx.fill();

            // Mức nạp pin thực tế
            const fillW = Math.max(4, (bat / 100) * barW);
            let batColor = "#10b981"; // Xanh lá > 50%
            if (bat <= 25) batColor = "#ef4444"; // Đỏ
            else if (bat <= 50) batColor = "#f59e0b"; // Vàng

            ctx.fillStyle = batColor;
            ctx.beginPath();
            ctx.roundRect(barX, barY, fillW, barH, 4);
            ctx.fill();

            // Phần trăm chữ số bên cạnh thanh pin
            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 15px 'JetBrains Mono', monospace";
            ctx.textAlign = "right";
            ctx.fillText(`${bat}%`, 226, 53);

            // Dòng 3: Nhiệm vụ tóm tắt
            ctx.fillStyle = "#94a3b8";
            ctx.font = "12px 'Plus Jakarta Sans', sans-serif";
            ctx.textAlign = "left";
            const taskStr = amr.currentTask ? (amr.currentTask.length > 26 ? amr.currentTask.slice(0, 24) + "..." : amr.currentTask) : "Sẵn sàng";
            ctx.fillText(taskStr, 14, 76);
        }

        // =========================================================================
        // G. VÒNG LẶP RENDER HOẠT CẢNH (ANIMATE LOOP)
        // =========================================================================
        animate() {
            requestAnimationFrame(this.animate);
            const now = performance.now();
            const dt = (now - this.lastTime) * 0.001;
            this.lastTime = now;

            // Đo đạc FPS
            this.frameCount++;
            if (now - this.fpsTimer >= 1000) {
                this.fps = this.frameCount;
                this.frameCount = 0;
                this.fpsTimer = now;
                const fpsEl = document.getElementById("hud-fps");
                if (fpsEl) fpsEl.textContent = this.fps;
            }

            if (this.controls) this.controls.update();

            // Billboard các bục cửa nhập/xuất luôn hướng về camera
            if (this.meshes.dockLabels) {
                this.meshes.dockLabels.forEach(lbl => lbl.quaternion.copy(this.camera.quaternion));
            }

            // 1. Cập nhật Logic Engine
            this.engine.update(dt);

            // 2. Xoay con lăn băng chuyền
            if (!this.engine.isEStop) {
                const rollerDir = this.engine.conveyorReverseTimer > 0 ? -1 : 1;
                this.meshes.rollers.forEach(r => { r.rotation.y += 0.08 * rollerDir * this.engine.speedMultiplier; });
            }

            // 3. Cập nhật cánh tay gạt & Hiệu ứng nhấp nháy đèn cảnh báo khi sự cố
            this.engine.gates.forEach(g => {
                const div = this.meshes.diverters.find(d => d.id === g.id);
                if (div) {
                    div.targetAngle = g.diverterAngle || 0;
                    div.currentAngle += (div.targetAngle - div.currentAngle) * 0.18;
                    div.pivot.rotation.y = div.currentAngle;

                    // Hiệu ứng nhấp nháy đỏ/cam khi kẹt cổng
                    if (g.isJammed) {
                        const pulse = Math.sin(now * 0.01) > 0;
                        div.ledCapMat.color.setHex(pulse ? 0xef4444 : 0xf97316);
                        div.bladeMat.color.setHex(pulse ? 0xef4444 : 0xf97316);
                    } else {
                        div.ledCapMat.color.copy(div.defaultColor);
                        div.bladeMat.color.copy(div.defaultColor);
                    }
                }
            });

            // 4. Cập nhật Trạm Sạc 3D (Phát sáng khi có xe vào nạp)
            this.engine.chargers.forEach(chg => {
                const stMesh = this.meshes.chargers[chg.id];
                if (stMesh) {
                    const isOccupied = !!chg.occupiedBy;
                    if (isOccupied) {
                        // Vòng LED tiếp xúc phát sáng vàng/xanh lơ nhịp thở
                        const pulse = 0.5 + 0.4 * Math.sin(now * 0.006);
                        stMesh.userData.contactRingMat.color.setHex(0xeab308);
                        stMesh.userData.contactRingMat.opacity = pulse;
                        stMesh.userData.ledPillarMat.color.setHex(0xeab308);
                    } else {
                        stMesh.userData.contactRingMat.color.setHex(0x38bdf8);
                        stMesh.userData.contactRingMat.opacity = 0.35;
                        stMesh.userData.ledPillarMat.color.setHex(0x10b981);
                    }

                    // Billboard quay về camera
                    if (stMesh.userData.labelMesh) {
                        stMesh.userData.labelMesh.quaternion.copy(this.camera.quaternion);
                    }
                }
            });

            // 5. Cập nhật kiện hàng trên 3D Scene
            this.renderPackages();

            // 6. Cập nhật 6 Robot AMR & Vệt đường A*
            this.renderAMRs();

            // 7. Cập nhật 10 Cụm kệ & Billboard Nhãn luôn quay về camera
            this.renderRacks();

            // 8. Cập nhật vật cản A* do người dùng đặt
            this.renderObstacles();

            // 9. Cập nhật HUD & Event log
            this.updateHUD();

            // 10. Chế độ Camera bám theo AMR
            if (this.followCamActive) {
                const targetAmr = this.meshes.amrs[this.followAmrId];
                if (targetAmr) {
                    this.camera.position.set(targetAmr.position.x, 8, targetAmr.position.z + 9);
                    this.camera.lookAt(targetAmr.position.x, 0, targetAmr.position.z);
                    if (this.controls) this.controls.target.set(targetAmr.position.x, 0, targetAmr.position.z);
                }
            }

            this.renderer.render(this.scene, this.camera);
        }

        renderPackages() {
            const beltH = 0.85;
            const currentIds = new Set();

            this.engine.packages.forEach(p => {
                currentIds.add(p.id);
                let pMesh = this.meshes.packages[p.id];
                const wPos = this.gridToWorld(p.x, p.y);

                if (!pMesh) {
                    const pGroup = new THREE.Group();

                    // Kích thước chuẩn thùng carton công nghiệp đồng nhất (loại bỏ hoàn toàn oversize)
                    const boxW = 0.65;
                    const boxH = 0.46;
                    const boxD = 0.58;

                    // Chất liệu bìa carton màu nâu vàng kraft chân thực
                    const boxMat = new THREE.MeshStandardMaterial({
                        color: 0xc88236,
                        roughness: 0.72,
                        metalness: 0.05
                    });
                    const boxMesh = new THREE.Mesh(new THREE.BoxGeometry(boxW, boxH, boxD), boxMat);
                    boxMesh.castShadow = true;
                    pGroup.add(boxMesh);

                    // Dải băng keo đóng gói niêm phong màu nâu đậm chạy ngang giữa mặt trên
                    const tapeMat = new THREE.MeshStandardMaterial({
                        color: 0x8a521a,
                        roughness: 0.4,
                        metalness: 0.1
                    });
                    const tapeTop = new THREE.Mesh(new THREE.BoxGeometry(boxW + 0.002, 0.006, 0.12), tapeMat);
                    tapeTop.position.y = boxH / 2 + 0.003;
                    pGroup.add(tapeTop);

                    // Canvas độ phân giải cao 400x220: Tem nhãn mã vạch Code128 siêu nét
                    const createShippingLabelCanvas = () => {
                        const canvas = document.createElement("canvas");
                        canvas.width = 400;
                        canvas.height = 220;
                        const ctx = canvas.getContext("2d");

                        // Nền tem màu trắng tinh có viền đen bưu chính sắc nét
                        ctx.fillStyle = "#ffffff";
                        ctx.fillRect(0, 0, 400, 220);
                        ctx.strokeStyle = "#0f172a";
                        ctx.lineWidth = 4;
                        ctx.strokeRect(2, 2, 396, 216);

                        // Header tem: Logo EXPRESS & Vùng miền
                        ctx.fillStyle = "#0284c7";
                        ctx.fillRect(4, 4, 392, 44);
                        ctx.fillStyle = "#ffffff";
                        ctx.font = "bold 22px 'Plus Jakarta Sans', sans-serif";
                        ctx.textAlign = "left";
                        ctx.fillText("NEXUSLOG EXPRESS", 16, 34);

                        ctx.textAlign = "right";
                        ctx.font = "bold 20px 'JetBrains Mono', monospace";
                        ctx.fillText(`${p.region ? p.region.toUpperCase() : 'VN'}`, 384, 34);

                        // Mã vận đơn chữ to đậm nét
                        ctx.fillStyle = "#0f172a";
                        ctx.font = "bold 28px 'JetBrains Mono', monospace";
                        ctx.textAlign = "center";
                        ctx.fillText(p.barcode || `VN-${p.id}`, 200, 84);

                        // Cụm vạch mã vạch Code128 chân thực (đen tuyền, vạch dày/mỏng)
                        ctx.fillStyle = "#000000";
                        const seed = p.id * 17 + 5;
                        for (let bx = 30; bx < 370; bx += 5) {
                            const val = Math.sin(bx * 0.45 + seed);
                            if (val > -0.45) {
                                const barW = val > 0.4 ? 3.8 : 2.2;
                                ctx.fillRect(bx, 96, barW, 64);
                            }
                        }

                        // Dòng thông tin bưu cục phát & cân nặng thực tế
                        ctx.fillStyle = "#0f172a";
                        ctx.font = "bold 22px 'Plus Jakarta Sans', sans-serif";
                        ctx.textAlign = "center";
                        const weightStr = p.weight ? `${p.weight} kg` : "2.4 kg";
                        ctx.fillText(`${p.province || 'Hà Nội'}  |  ${weightStr}`, 200, 196);

                        return canvas;
                    };

                    const labelTex = new THREE.CanvasTexture(createShippingLabelCanvas());

                    // 1. Dán nhãn lên Mặt Trên của kiện hàng (Top Face)
                    const labelTop = new THREE.Mesh(
                        new THREE.PlaneGeometry(boxW * 0.72, boxD * 0.65),
                        new THREE.MeshBasicMaterial({ map: labelTex })
                    );
                    labelTop.rotation.x = -Math.PI / 2;
                    labelTop.position.set(0, boxH / 2 + 0.005, 0.05);
                    pGroup.add(labelTop);

                    // 2. Dán nhãn lên Mặt Trước hướng về Camera/Người nhìn (Front Face)
                    const labelFront = new THREE.Mesh(
                        new THREE.PlaneGeometry(boxW * 0.72, boxH * 0.72),
                        new THREE.MeshBasicMaterial({ map: labelTex })
                    );
                    labelFront.position.set(0, 0, boxD / 2 + 0.005);
                    pGroup.add(labelFront);

                    this.scene.add(pGroup);
                    this.meshes.packages[p.id] = pGroup;
                    pMesh = pGroup;
                }

                pMesh.position.x = wPos.x;
                pMesh.position.z = wPos.z;

                if (p.status === "ON_BELT") {
                    pMesh.position.y = beltH + 0.32;
                } else if (p.status === "DIVERTING") {
                    pMesh.position.y = beltH + 0.32 - p.divertProgress * 1.1;
                } else if (p.status === "AT_DROP") {
                    pMesh.position.y = 0.28;
                } else if (p.status === "CARRIED") {
                    pMesh.position.y = 0.65; // Nằm trên lưng AMR
                }
            });

            // Dọn dẹp kiện đã hoàn thành
            for (let id in this.meshes.packages) {
                if (!currentIds.has(Number(id))) {
                    this.scene.remove(this.meshes.packages[id]);
                    delete this.meshes.packages[id];
                }
            }
        }

        renderAMRs() {
            this.engine.amrs.forEach(amr => {
                const amrMesh = this.meshes.amrs[amr.id];
                if (!amrMesh) return;

                const wPos = this.gridToWorld(amr.x, amr.y);
                amrMesh.position.x = wPos.x;
                amrMesh.position.z = wPos.z;

                // Hiển thị thùng hàng trên xe
                amrMesh.userData.carryingBox.visible = (amr.state === "CARRYING" || amr.state === "UNLOADING");

                // Cập nhật Billboard HUD của xe luôn quay về camera
                if (amrMesh.userData.hudMesh) {
                    amrMesh.userData.hudMesh.quaternion.copy(this.camera.quaternion);

                    // Redraw canvas nếu có thay đổi pin hoặc trạng thái
                    const batNow = Math.round(amr.battery);
                    if (amrMesh.userData.lastBattery !== batNow || amrMesh.userData.lastState !== amr.state) {
                        amrMesh.userData.lastBattery = batNow;
                        amrMesh.userData.lastState = amr.state;
                        const hctx = amrMesh.userData.hudCanvas.getContext("2d");
                        this.drawAMRHUDCanvas(hctx, amr);
                        amrMesh.userData.hudTex.needsUpdate = true;
                    }
                }

                // Cập nhật vệt đường A* (CHỈ HIỂN THỊ KHI XE ĐANG CHẠY)
                const trailLine = this.meshes.aStarTrails[amr.id];
                if (trailLine) {
                    const isMoving = amr.path && amr.path.length > 0 &&
                                    amr.state !== "IDLE" && amr.state !== "CHARGING" && amr.state !== "E_STOP";

                    if (isMoving) {
                        trailLine.visible = true;
                        const positions = trailLine.geometry.attributes.position.array;
                        let count = 0;

                        // Điểm xuất phát
                        positions[0] = wPos.x;
                        positions[1] = 0.04;
                        positions[2] = wPos.z;
                        count++;

                        for (let i = 0; i < amr.path.length && count < 60; i++) {
                            const nodeWorld = this.gridToWorld(amr.path[i].x, amr.path[i].y);
                            positions[count * 3] = nodeWorld.x;
                            positions[count * 3 + 1] = 0.04;
                            positions[count * 3 + 2] = nodeWorld.z;
                            count++;
                        }

                        // Màu vệt: Đỏ nếu cảnh báo, Vàng nếu về sạc, Xanh lơ nếu vận chuyển
                        if (amr.state === "TO_CHARGER") {
                            trailLine.material.color.setHex(0xf59e0b);
                        } else if (amr.blockedTimer > 0) {
                            trailLine.material.color.setHex(0xef4444);
                        } else {
                            trailLine.material.color.setHex(0x06b6d4);
                        }

                        trailLine.geometry.setDrawRange(0, count);
                        trailLine.geometry.attributes.position.needsUpdate = true;
                    } else {
                        trailLine.visible = false;
                    }
                }
            });
        }

        renderRacks() {
            const racksList = this.config.CLUSTER_RACKS;
            racksList.forEach(p => {
                const rackGroup = this.meshes.racks[p.id];
                const logicRack = this.engine.racks[p.id];
                if (!rackGroup || !logicRack) return;

                // Xoay nhãn Billboard về Camera
                if (rackGroup.userData.labelMesh) {
                    rackGroup.userData.labelMesh.quaternion.copy(this.camera.quaternion);
                }

                // Cập nhật số lượng thùng hàng trên kệ
                if (rackGroup.userData.count !== logicRack.count) {
                    rackGroup.userData.count = logicRack.count;
                    const container = rackGroup.userData.boxesContainer;
                    while (container.children.length > 0) {
                        container.remove(container.children[0]);
                    }

                    const boxGeo = new THREE.BoxGeometry(0.65, 0.46, 0.58);
                    const boxMat = new THREE.MeshStandardMaterial({ color: 0xc88236, roughness: 0.7, metalness: 0.05 });

                    for (let i = 0; i < logicRack.count; i++) {
                        const box = new THREE.Mesh(boxGeo, boxMat);
                        const col = i % 3;
                        const row = Math.floor((i % 6) / 3);
                        const tier = Math.floor(i / 6);
                        box.position.set(-0.7 + col * 0.7, 0.7 + tier * 0.44, -0.45 + row * 0.9);
                        container.add(box);
                    }

                    // Cập nhật text nhãn
                    const lcanvas = rackGroup.userData.labelCanvas;
                    if (lcanvas) {
                        const lctx = lcanvas.getContext("2d");
                        lctx.fillStyle = "rgba(15, 23, 42, 0.92)";
                        lctx.strokeStyle = p.color;
                        lctx.lineWidth = 5;
                        lctx.beginPath();
                        lctx.roundRect(6, 6, 348, 98, 14);
                        lctx.fill();
                        lctx.stroke();
                        lctx.fillStyle = "#ffffff";
                        lctx.font = "bold 26px 'Plus Jakarta Sans', sans-serif";
                        lctx.textAlign = "center";
                        lctx.fillText(p.shortName || p.name, 180, 46);
                        lctx.fillStyle = p.color;
                        lctx.font = "bold 22px 'JetBrains Mono', sans-serif";
                        lctx.fillText(`${logicRack.count}/18 ô`, 180, 82);
                        rackGroup.userData.labelTex.needsUpdate = true;
                    }
                }
            });
        }

        renderObstacles() {
            const currentKeys = new Set(this.engine.obstacles);

            currentKeys.forEach(k => {
                if (!this.meshes.obstacles[k]) {
                    const [gx, gy] = k.split(",").map(Number);
                    const wPos = this.gridToWorld(gx, gy);

                    const obsGroup = new THREE.Group();
                    obsGroup.position.set(wPos.x, 0.4, wPos.z);

                    // Thùng phuy / Cọc tiêu cảnh báo
                    const cone = new THREE.Mesh(
                        new THREE.ConeGeometry(0.38, 0.8, 16),
                        new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.2 })
                    );
                    cone.position.y = 0.4;
                    obsGroup.add(cone);

                    // Đế cao su đen
                    const base = new THREE.Mesh(
                        new THREE.BoxGeometry(0.85, 0.08, 0.85),
                        new THREE.MeshBasicMaterial({ color: 0x0f172a })
                    );
                    base.position.y = 0.04;
                    obsGroup.add(base);

                    this.scene.add(obsGroup);
                    this.meshes.obstacles[k] = obsGroup;
                }
            });

            // Xóa các vật cản đã gỡ
            for (let k in this.meshes.obstacles) {
                if (!currentKeys.has(k)) {
                    this.scene.remove(this.meshes.obstacles[k]);
                    delete this.meshes.obstacles[k];
                }
            }
        }

        // =========================================================================
        // H. CẬP NHẬT HUD KPI, EVENT LOGS & SIDEBAR
        // =========================================================================
        updateHUD() {
            // 1. Chỉ số KPI
            const procEl = document.getElementById("hud-processed");
            if (procEl) procEl.textContent = this.engine.totalProcessed;

            const waitingEl = document.getElementById("hud-waiting");
            if (waitingEl) waitingEl.textContent = this.engine.packages.length;

            const accEl = document.getElementById("hud-accuracy");
            if (accEl) {
                const avg = this.engine.totalConfScanned > 0 ?
                    (this.engine.totalConfidenceSum / this.engine.totalConfScanned * 100).toFixed(1) : "98.4";
                accEl.textContent = `${avg}%`;
            }

            // KPI Pin trung bình đội xe
            const avgBatEl = document.getElementById("hud-avg-battery");
            if (avgBatEl) {
                const avgBat = this.engine.amrs.reduce((sum, a) => sum + a.battery, 0) / this.engine.amrs.length;
                avgBatEl.textContent = `${Math.round(avgBat)}%`;
            }

            // KPI Cổng đang kẹt
            const jammedGatesEl = document.getElementById("hud-jammed-gates");
            if (jammedGatesEl) {
                const jammedCount = this.engine.gates.filter(g => g.isJammed).length;
                jammedGatesEl.textContent = jammedCount;
                jammedGatesEl.style.color = jammedCount > 0 ? "#ef4444" : "#10b981";
            }

            // KPI AMR đang hoạt động
            const activeAmrEl = document.getElementById("hud-active-amrs");
            if (activeAmrEl) {
                const activeCount = this.engine.amrs.filter(a => a.state === "CARRYING" || a.state === "TO_PICKUP" || a.state === "UNLOADING").length;
                activeAmrEl.textContent = `${activeCount} / 6`;
            }

            // 2. Danh sách 6 AMR trong Sidebar
            this.engine.amrs.forEach((a, idx) => {
                const stEl = document.getElementById(`hud-amr-state-${idx + 1}`);
                if (stEl) {
                    const stMap = {
                        "IDLE": '<span class="badge-state state-idle">Rảnh</span>',
                        "TO_PICKUP": '<span class="badge-state state-run">Lấy hàng</span>',
                        "CARRYING": '<span class="badge-state state-run">Chở hàng</span>',
                        "UNLOADING": '<span class="badge-state state-run">Dỡ hàng</span>',
                        "TO_CHARGER": '<span class="badge-state state-chg">Về sạc</span>',
                        "CHARGING": '<span class="badge-state state-chg">Đang sạc</span>',
                        "BLOCKED": '<span class="badge-state state-err">Bị chặn</span>',
                        "ERROR": '<span class="badge-state state-err">Lỗi</span>',
                        "E_STOP": '<span class="badge-state state-err">E-STOP</span>'
                    };
                    stEl.innerHTML = stMap[a.state] || a.state;
                }

                // Cập nhật thanh pin và % trong sidebar
                const batValEl = document.getElementById(`hud-amr-bat-${idx + 1}`);
                const batBarEl = document.getElementById(`hud-amr-bar-${idx + 1}`);
                if (batValEl && batBarEl) {
                    const bat = Math.round(a.battery);
                    batValEl.textContent = `${bat}%`;

                    let barColor = "#10b981";
                    if (bat <= 25) barColor = "#ef4444";
                    else if (bat <= 50) barColor = "#f59e0b";

                    batBarEl.style.width = `${bat}%`;
                    batBarEl.style.backgroundColor = barColor;
                }

                // Cập nhật nhiệm vụ hiện tại
                const taskEl = document.getElementById(`hud-amr-task-${idx + 1}`);
                if (taskEl) {
                    taskEl.textContent = a.currentTask || "Sẵn sàng";
                }
            });

            // 3. Dòng sự kiện thời gian thực (Giữ 50 dòng)
            const logContainer = document.getElementById("hud-event-logs");
            if (logContainer) {
                logContainer.innerHTML = this.engine.events.map(e => `
                    <div class="hud-log-row log-${e.type.toLowerCase()}">
                        <span class="log-time">${e.time}</span>
                        <span class="log-type-tag tag-${e.type.toLowerCase()}">[${e.type}]</span>
                        <span class="log-text">${e.text}</span>
                    </div>
                `).join("");
            }

            // Đồng bộ sang giao diện cha nếu chạy trong iframe
            const now = performance.now();
            if (now - this.lastSyncTime >= 250) {
                this.lastSyncTime = now;
                const accuracyStr = this.engine.totalConfScanned > 0 ?
                    (this.engine.totalConfidenceSum / this.engine.totalConfScanned * 100).toFixed(1) + "%" : "98.4%";
                const activeAmrCount = this.engine.amrs.filter(a => a.state === "CARRYING" || a.state === "TO_PICKUP").length;
                const amrSummaryStr = `${activeAmrCount}/6 Hoạt động`;

                try {
                    if (window.parent && window.parent !== window) {
                        window.parent.postMessage({
                            type: "SYNC_3D_METRICS",
                            metrics: {
                                totalProcessed: this.engine.totalProcessed,
                                waitingCount: this.engine.packages.length,
                                accuracy: accuracyStr,
                                activeGates: `${3 - this.engine.gates.filter(g => g.isJammed).length} / 3`,
                                amrSummary: amrSummaryStr,
                                fps: this.fps
                            }
                        }, "*");
                    }
                } catch (e) {}
            }
        }


        // =========================================================================
        // G. BỤC CỬA NHẬP HÀNG & 3 BỤC CỬA XUẤT HÀNG (INBOUND & OUTBOUND DOCKS)
        // =========================================================================
        buildInboundAndOutboundDocks() {
            const dockGroup = new THREE.Group();
            this.meshes.dockLabels = [];

            // Helper tạo chất liệu vân sọc an toàn vàng/đen (Hazard Stripes)
            const createHazardTexture = () => {
                const cv = document.createElement("canvas");
                cv.width = 128;
                cv.height = 32;
                const c = cv.getContext("2d");
                c.fillStyle = "#eab308";
                c.fillRect(0, 0, 128, 32);
                c.fillStyle = "#0f172a";
                for (let i = -32; i < 160; i += 24) {
                    c.beginPath();
                    c.moveTo(i, 0);
                    c.lineTo(i + 14, 0);
                    c.lineTo(i - 4, 32);
                    c.lineTo(i - 18, 32);
                    c.closePath();
                    c.fill();
                }
                const tex = new THREE.CanvasTexture(cv);
                tex.wrapS = THREE.RepeatWrapping;
                tex.wrapT = THREE.RepeatWrapping;
                return tex;
            };

            const hazardTex = createHazardTexture();
            hazardTex.repeat.set(4, 1);

            // ---------------------------------------------------------------------
            // 1. BỤC CỬA NHẬP HÀNG (INBOUND DOCK) - ĐẦU BĂNG CHUYỀN BÊN TRÁI
            // ---------------------------------------------------------------------
            const inDock = new THREE.Group();
            const inX = -23.8;
            const inZ = -11.0;
            inDock.position.set(inX, 0, inZ);

            // Bục dỡ hàng bê tông/thép chịu lực nâng cao bằng mặt băng chuyền (H = 0.85m)
            const inPlatformMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.5, roughness: 0.4 });
            const inPlatform = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.85, 3.2), inPlatformMat);
            inPlatform.position.set(0, 0.85 / 2, 0);
            inPlatform.receiveShadow = true;
            inDock.add(inPlatform);

            // Viền chỉ dẫn an toàn mép bục vàng đen
            const inHazardGeo = new THREE.BoxGeometry(0.12, 0.84, 3.22);
            const inHazardMat = new THREE.MeshBasicMaterial({ map: hazardTex });
            const inHazard = new THREE.Mesh(inHazardGeo, inHazardMat);
            inHazard.position.set(1.8, 0.85 / 2, 0);
            inDock.add(inHazard);

            // Cổng cửa cuốn nhập kho (Industrial Roll-up Portal Frame)
            const portalFrameMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.6, roughness: 0.3 });
            const pPostL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 3.2, 0.35), portalFrameMat);
            pPostL.position.set(-1.6, 1.6, -1.4);
            inDock.add(pPostL);
            const pPostR = new THREE.Mesh(new THREE.BoxGeometry(0.35, 3.2, 0.35), portalFrameMat);
            pPostR.position.set(-1.6, 1.6, 1.4);
            inDock.add(pPostR);
            const pTopBeam = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.4, 3.15), portalFrameMat);
            pTopBeam.position.set(-1.6, 3.2, 0);
            inDock.add(pTopBeam);

            // Tấm cửa cuốn công nghiệp (Roll-up Shutter Slats)
            const shutterMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.7, roughness: 0.3 });
            const shutter = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.4, 2.7), shutterMat);
            shutter.position.set(-1.6, 2.4, 0);
            inDock.add(shutter);

            // Thùng xe tải Container cập bục nhập hàng bên ngoài
            const truckBoxMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.3, roughness: 0.4 });
            const truckBox = new THREE.Mesh(new THREE.BoxGeometry(5.2, 3.0, 2.7), truckBoxMat);
            truckBox.position.set(-4.3, 1.5, 0);
            truckBox.castShadow = true;
            inDock.add(truckBox);

            // Đèn đuôi xe tải
            const tailLightMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
            const tLight1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.3), tailLightMat);
            tLight1.position.set(-1.68, 0.45, -1.15);
            inDock.add(tLight1);
            const tLight2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.3), tailLightMat);
            tLight2.position.set(-1.68, 0.45, 1.15);
            inDock.add(tLight2);

            // Bàn con lăn tiếp liệu từ bục vào băng tải
            const rollerInfeedMat = new THREE.MeshStandardMaterial({ color: 0x06b6d4, metalness: 0.7, roughness: 0.2 });
            for (let rx = -1.2; rx <= 1.2; rx += 0.4) {
                const rMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.4, 12), rollerInfeedMat);
                rMesh.rotation.x = Math.PI / 2;
                rMesh.position.set(rx, 0.88, 0);
                inDock.add(rMesh);
            }

            // Billboard Biển hiệu Cửa Nhập Hàng (Quay theo camera)
            const inLabelCanvas = document.createElement("canvas");
            inLabelCanvas.width = 440;
            inLabelCanvas.height = 120;
            const ictx = inLabelCanvas.getContext("2d");
            ictx.fillStyle = "rgba(15, 23, 42, 0.94)";
            ictx.strokeStyle = "#0284c7";
            ictx.lineWidth = 5;
            ictx.beginPath();
            ictx.roundRect(6, 6, 428, 108, 14);
            ictx.fill();
            ictx.stroke();
            ictx.fillStyle = "#ffffff";
            ictx.font = "bold 26px 'Plus Jakarta Sans', sans-serif";
            ictx.textAlign = "center";
            ictx.fillText("CỬA NHẬP HÀNG 01 (INBOUND)", 220, 48);
            ictx.fillStyle = "#38bdf8";
            ictx.font = "bold 20px 'JetBrains Mono', monospace";
            ictx.fillText("TIẾP NHẬN PARCEL TỪ XE TẢI CONTAINER", 220, 86);

            const inLabelTex = new THREE.CanvasTexture(inLabelCanvas);
            const inLabelMesh = new THREE.Mesh(
                new THREE.PlaneGeometry(3.6, 0.98),
                new THREE.MeshBasicMaterial({ map: inLabelTex, transparent: true, side: THREE.DoubleSide })
            );
            inLabelMesh.position.set(-1.6, 3.85, 0);
            inDock.add(inLabelMesh);
            this.meshes.dockLabels.push(inLabelMesh);

            dockGroup.add(inDock);

            // ---------------------------------------------------------------------
            // 2. 3 BỤC CỬA XUẤT HÀNG (OUTBOUND SHIPPING DOCKS) - VÁCH DƯỚI NHÀ KHO
            // ---------------------------------------------------------------------
            const outboundDocks = [
                { id: "OUT-01", name: "CỬA XUẤT 01 - MIỀN BẮC", truck: "XE 29C-882.91 • ĐANG ĐÓNG HÀNG", x: -13.5, color: "#0284c7", hex: 0x0284c7 },
                { id: "OUT-02", name: "CỬA XUẤT 02 - MIỀN TRUNG", truck: "XE 43C-612.45 • ĐANG ĐÓNG HÀNG", x: 0.0, color: "#9333ea", hex: 0x9333ea },
                { id: "OUT-03", name: "CỬA XUẤT 03 - MIỀN NAM", truck: "XE 51C-993.18 • ĐANG ĐÓNG HÀNG", x: 13.5, color: "#10b981", hex: 0x10b981 }
            ];

            const outZ = 15.6;

            outboundDocks.forEach(dock => {
                const dGroup = new THREE.Group();
                dGroup.position.set(dock.x, 0, outZ);

                // Bục xuất hàng bê tông sàn kho
                const outPlatGeo = new THREE.BoxGeometry(4.8, 0.45, 2.4);
                const outPlatMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.4, roughness: 0.4 });
                const outPlat = new THREE.Mesh(outPlatGeo, outPlatMat);
                outPlat.position.set(0, 0.225, 0);
                outPlat.receiveShadow = true;
                dGroup.add(outPlat);

                // Dải vạch sọc an toàn vàng/đen viền mép bục xuất
                const dHazTex = createHazardTexture();
                dHazTex.repeat.set(5, 1);
                const dHazMesh = new THREE.Mesh(
                    new THREE.BoxGeometry(4.82, 0.44, 0.12),
                    new THREE.MeshBasicMaterial({ map: dHazTex })
                );
                dHazMesh.position.set(0, 0.225, -1.2);
                dGroup.add(dHazMesh);

                // 2 Trụ bảo vệ chống va chạm màu vàng (Bollards)
                const bollardGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.85, 16);
                const bollardMat = new THREE.MeshStandardMaterial({ color: 0xeab308, metalness: 0.5, roughness: 0.3 });
                const bL = new THREE.Mesh(bollardGeo, bollardMat);
                bL.position.set(-2.2, 0.42, -1.1);
                dGroup.add(bL);
                const bR = new THREE.Mesh(bollardGeo, bollardMat);
                bR.position.set(2.2, 0.42, -1.1);
                dGroup.add(bR);

                // Khung cửa cuốn xuất kho (Roll-up Dock Portal)
                const dPortalMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.6, roughness: 0.3 });
                const dpL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.4, 0.3), dPortalMat);
                dpL.position.set(-2.2, 1.7, 0.9);
                dGroup.add(dpL);
                const dpR = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.4, 0.3), dPortalMat);
                dpR.position.set(2.2, 1.7, 0.9);
                dGroup.add(dpR);
                const dpTop = new THREE.Mesh(new THREE.BoxGeometry(4.7, 0.35, 0.3), dPortalMat);
                dpTop.position.set(0, 3.35, 0.9);
                dGroup.add(dpTop);

                // Cửa cuốn kim loại hé mở
                const dShutterMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.7, roughness: 0.3 });
                const dShutter = new THREE.Mesh(new THREE.BoxGeometry(4.1, 1.5, 0.08), dShutterMat);
                dShutter.position.set(0, 2.5, 0.9);
                dGroup.add(dShutter);

                // Đèn LED chỉ thị trạng thái cổng xuất
                const dockLedMat = new THREE.MeshBasicMaterial({ color: dock.hex });
                const dockLed = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 16), dockLedMat);
                dockLed.position.set(0, 3.65, 0.95);
                dGroup.add(dockLed);

                // Thùng xe tải Container đỗ bên ngoài cửa xuất
                const trailerMat = new THREE.MeshStandardMaterial({ color: dock.hex, metalness: 0.35, roughness: 0.4 });
                const trailer = new THREE.Mesh(new THREE.BoxGeometry(4.0, 3.1, 4.5), trailerMat);
                trailer.position.set(0, 1.55, 3.3);
                trailer.castShadow = true;
                dGroup.add(trailer);

                // Mái che vòm bảo vệ cửa bục xuất hàng
                const canopyMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 });
                const canopy = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.15, 1.8), canopyMat);
                canopy.position.set(0, 3.75, 0.2);
                dGroup.add(canopy);

                // Billboard Biển hiệu Cửa Xuất Hàng (Billboard luôn hướng về Camera)
                const dCanvas = document.createElement("canvas");
                dCanvas.width = 440;
                dCanvas.height = 120;
                const dctx = dCanvas.getContext("2d");
                dctx.fillStyle = "rgba(15, 23, 42, 0.94)";
                dctx.strokeStyle = dock.color;
                dctx.lineWidth = 5;
                dctx.beginPath();
                dctx.roundRect(6, 6, 428, 108, 14);
                dctx.fill();
                dctx.stroke();
                dctx.fillStyle = "#ffffff";
                dctx.font = "bold 26px 'Plus Jakarta Sans', sans-serif";
                dctx.textAlign = "center";
                dctx.fillText(dock.name, 220, 48);
                dctx.fillStyle = dock.color;
                dctx.font = "bold 20px 'JetBrains Mono', monospace";
                dctx.fillText(dock.truck, 220, 86);

                const dTex = new THREE.CanvasTexture(dCanvas);
                const dMesh = new THREE.Mesh(
                    new THREE.PlaneGeometry(3.6, 0.98),
                    new THREE.MeshBasicMaterial({ map: dTex, transparent: true, side: THREE.DoubleSide })
                );
                dMesh.position.set(0, 4.45, 0.9);
                dGroup.add(dMesh);
                this.meshes.dockLabels.push(dMesh);

                dockGroup.add(dGroup);
            });

            this.scene.add(dockGroup);
        }

        bindEvents() {
            window.addEventListener("resize", () => {
                if (!this.container || !this.renderer || !this.camera) return;
                const w = this.container.clientWidth;
                const h = this.container.clientHeight;
                this.camera.aspect = w / h;
                this.camera.updateProjectionMatrix();
                this.renderer.setSize(w, h);
            });

            // Phân biệt Click chuột (đặt vật cản) và Kéo chuột (OrbitControls)
            let pointerDownX = 0;
            let pointerDownY = 0;
            let pointerDownTime = 0;

            this.renderer.domElement.addEventListener("pointerdown", (event) => {
                pointerDownX = event.clientX;
                pointerDownY = event.clientY;
                pointerDownTime = performance.now();
            });

            this.renderer.domElement.addEventListener("pointerup", (event) => {
                const dist = Math.hypot(event.clientX - pointerDownX, event.clientY - pointerDownY);
                const elapsed = performance.now() - pointerDownTime;

                if (dist > 6 || elapsed > 350) return;

                const rect = this.renderer.domElement.getBoundingClientRect();
                this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
                this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

                this.raycaster.setFromCamera(this.mouse, this.camera);
                const intersects = this.raycaster.intersectObject(this.groundPlane);

                if (intersects.length > 0) {
                    const pt = intersects[0].point;
                    const gridCoords = this.worldToGrid(pt.x, pt.z);
                    this.engine.toggleObstacle(gridCoords.x, gridCoords.y);
                }
            });
        }

        setCameraPreset(mode) {
            this.followCamActive = (mode === "follow");
            if (mode === "iso") {
                this.camera.position.set(0, 25, 23);
                this.camera.lookAt(0, -1.0, 0);
                if (this.controls) this.controls.target.set(0, -1.0, 0);
            } else if (mode === "top") {
                this.camera.position.set(0, 32, 0.1);
                this.camera.lookAt(0, -0.5, 0);
                if (this.controls) this.controls.target.set(0, -0.5, 0);
            }
        }
    }

    window.SimulationRenderer3D = SimulationRenderer3D;
})(window);
