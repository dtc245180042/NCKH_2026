/**
 * ==============================================================================
 * NEXUSLOG - 3D AI DIGITAL TWIN ENGINE (CHUẨN HÓA MÀU SẮC & TRÌNH TỰ ROBOT)
 * ==============================================================================
 * BẢN CẬP NHẬT HOÀN CHỈNH THEO QUY CHUẨN PHẦN MỀM & BỨC ẢNH THỰC TẾ:
 * 1. QUY CHUẨN MÀU SẮC 100% ĐỒNG BỘ VỚI SCADA 2D & BACKEND:
 *    - Miền Bắc: Xanh Dương (#0284c7) -> Cổng 1, Máng 1, AMR-01, Kệ HN/HP/QN
 *    - Miền Trung: Cam Công Nghiệp (#d97706) -> Cổng 2, Máng 2, AMR-02, Kệ ĐN/Huế/KH
 *    - Miền Nam: Xanh Lá (#059669) -> Cổng 3, Máng 3, AMR-03, Kệ HCM/BD/CT
 *    - Dự Bị: Tím (#8b5cf6) -> AMR-04 Standby
 * 2. THÂN XE AMR ĐẶC KHỐI CÔNG NGHIỆP: Rõ nét, bo góc, có đèn viền, nhìn từ trên
 *    xuống hay phối cảnh đều vững chãi, không bị khung rỗng hay nhạt nhòa.
 * 3. TRÌNH TỰ CHUYỂN ĐỘNG CHUẨN XÁC 5 BƯỚC KHÉP KÍN:
 *    Chân Máng -> Nhận Kiện -> Chạy đến đúng Bục Kệ Tỉnh Thành -> Dỡ Hàng -> Về Máng!
 * ==============================================================================
 */

(function (window) {
    "use strict";

    const Warehouse3D = {
        initialized: false,
        container: null,
        scene: null,
        camera: null,
        renderer: null,
        controls: null,
        raycaster: null,
        mouse: null,
        animFrameId: null,

        // Nhóm Meshes
        meshes: {
            beltRollers: [],
            diverters: [],
            chuteRollers: [],
            chutes: [],
            podiums: {},
            amrs: {},
            packages: {},
            aiGantry: null,
            aiBoundingBox: null,
            aiFloatingBadge: null,
            aStarTrails: {}
        },

        // Trạng thái Camera
        cameraMode: "iso",
        followTargetAMR: "AMR-01",
        selectedEntity: null,

        // Bảng ánh xạ tọa độ 3D chuẩn xác
        layout: {
            beltZ: -6.5,
            beltHeight: 1.5,
            chutes: {
                1: { x: -5, zStart: -5.9, zEnd: -1.5, yStart: 1.5, yEnd: 0.35, color: 0x0284c7, label: "Miền Bắc" },
                2: { x: 2, zStart: -5.9, zEnd: -1.5, yStart: 1.5, yEnd: 0.35, color: 0xd97706, label: "Miền Trung" },
                3: { x: 9, zStart: -5.9, zEnd: -1.5, yStart: 1.5, yEnd: 0.35, color: 0x059669, label: "Miền Nam" }
            },
            podiums: {
                // Miền Bắc (Xanh Dương)
                "Hà Nội": { x: -14, z: 4.5, color: "#0284c7", topHex: 0x0284c7, region: "Bắc" },
                "Hải Phòng": { x: -10.5, z: 4.5, color: "#0284c7", topHex: 0x0284c7, region: "Bắc" },
                "Quảng Ninh": { x: -7, z: 4.5, color: "#0284c7", topHex: 0x0284c7, region: "Bắc" },

                // Miền Trung (Cam Công Nghiệp - Chuẩn SCADA 2D)
                "Đà Nẵng": { x: -2.5, z: 4.5, color: "#d97706", topHex: 0xd97706, region: "Trung" },
                "Huế": { x: 1, z: 4.5, color: "#d97706", topHex: 0xd97706, region: "Trung" },
                "Khánh Hòa": { x: 4.5, z: 4.5, color: "#d97706", topHex: 0xd97706, region: "Trung" },

                // Miền Nam (Xanh Lá - Chuẩn SCADA 2D)
                "TP. Hồ Chí Minh": { x: 9, z: 4.5, color: "#059669", topHex: 0x059669, region: "Nam" },
                "TP.HCM": { x: 9, z: 4.5, color: "#059669", topHex: 0x059669, region: "Nam" },
                "Bình Dương": { x: 12.5, z: 4.5, color: "#059669", topHex: 0x059669, region: "Nam" },
                "Cần Thơ": { x: 16, z: 4.5, color: "#059669", topHex: 0x059669, region: "Nam" }
            },
            docks: {
                "dock_1": { x: -18, z: 1.0, color: 0xd97706 },
                "dock_2": { x: -16, z: 1.0, color: 0xd97706 },
                "standby": { x: -13.5, z: 1.0, color: 0x8b5cf6 }
            }
        },

        // Dữ liệu thời gian thực
        state: {
            packages: [],
            amrs: {},
            gates: [],
            provinceRacks: {},
            conveyorRunning: true
        },

        // =========================================================================
        // 1. KHỞI TẠO THREE.JS ENGINE
        // =========================================================================
        init: function (containerId) {
            const container = document.getElementById(containerId);
            if (!container) return;

            if (this.initialized) {
                this.resize();
                return;
            }

            this.container = container;
            const width = container.clientWidth || 960;
            const height = container.clientHeight || 520;

            // Scene nền sáng sạch sẽ (Clean Light Theme)
            this.scene = new THREE.Scene();
            this.scene.background = new THREE.Color(0xf1f5f9);
            this.scene.fog = new THREE.FogExp2(0xf1f5f9, 0.012);

            // Camera phối cảnh
            this.camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000);
            this.setCameraView("iso");

            // Renderer chống răng cưa khử bóng mềm
            this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
            this.renderer.setSize(width, height);
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            this.renderer.outputEncoding = THREE.sRGBEncoding;
            container.innerHTML = "";
            container.appendChild(this.renderer.domElement);

            // OrbitControls
            if (window.THREE && window.THREE.OrbitControls) {
                this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
                this.controls.enableDamping = true;
                this.controls.dampingFactor = 0.06;
                this.controls.maxPolarAngle = Math.PI / 2 - 0.05;
                this.controls.minDistance = 8;
                this.controls.maxDistance = 65;
                this.controls.target.set(0, 0, 0);
            }

            this.raycaster = new THREE.Raycaster();
            this.mouse = new THREE.Vector2();

            // Xây dựng các mô hình
            this.buildEnvironment();
            this.buildConveyorAndChutes();
            this.buildAIVisionGantry();
            this.buildPodiumRacks();
            this.buildDocksAndStandby();
            this.buildAMRFleet();

            this.bindEvents();

            this.initialized = true;
            this.animate = this.animate.bind(this);
            this.animate();

            console.log("[Warehouse3D] Đã cập nhật thành công chuẩn màu sắc & chuyển động AMR!");
        },

        // =========================================================================
        // 2. MÔI TRƯỜNG & ÁNH SÁNG BAN NGÀY
        // =========================================================================
        buildEnvironment: function () {
            // Mặt sàn trắng sáng phản chiếu nhẹ
            const floorGeo = new THREE.PlaneGeometry(65, 45);
            const floorMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45, metalness: 0.05 });
            const floor = new THREE.Mesh(floorGeo, floorMat);
            floor.rotation.x = -Math.PI / 2;
            floor.receiveShadow = true;
            this.scene.add(floor);

            // Lưới ô vuông mờ thanh mảnh
            const gridHelper = new THREE.GridHelper(60, 60, 0xcfd8dc, 0xe2e8f0);
            gridHelper.position.y = 0.01;
            this.scene.add(gridHelper);

            // Đèn môi trường
            const ambient = new THREE.AmbientLight(0xffffff, 0.9);
            this.scene.add(ambient);

            // Đèn ánh nắng tạo bóng đổ thực tế
            const sunLight = new THREE.DirectionalLight(0xffffff, 0.95);
            sunLight.position.set(18, 28, 20);
            sunLight.castShadow = true;
            sunLight.shadow.mapSize.width = 2048;
            sunLight.shadow.mapSize.height = 2048;
            sunLight.shadow.bias = -0.0004;
            this.scene.add(sunLight);

            const fillLight = new THREE.DirectionalLight(0xe0f2fe, 0.4);
            fillLight.position.set(-20, 20, -15);
            this.scene.add(fillLight);
        },

        // =========================================================================
        // 3. BĂNG CHUYỀN CHÍNH & 3 MÁNG TRƯỢT DỐC XUỐNG (CHUẨN MÀU BẮC - TRUNG - NAM)
        // =========================================================================
        buildConveyorAndChutes: function () {
            const conveyorGroup = new THREE.Group();
            const beltLength = 36;
            const beltWidth = 1.4;
            const beltHeight = this.layout.beltHeight;
            const beltZ = this.layout.beltZ;

            // Khung băng tải chính màu than chì
            const frameMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5, metalness: 0.3 });
            const railGeo = new THREE.BoxGeometry(beltLength, 0.22, 0.1);

            const railL = new THREE.Mesh(railGeo, frameMat);
            railL.position.set(0, beltHeight, beltZ - beltWidth / 2);
            conveyorGroup.add(railL);

            const railR = new THREE.Mesh(railGeo, frameMat);
            railR.position.set(0, beltHeight, beltZ + beltWidth / 2);
            conveyorGroup.add(railR);

            // Chân đế
            const legGeo = new THREE.BoxGeometry(0.12, beltHeight, 0.12);
            for (let x = -beltLength / 2 + 1; x <= beltLength / 2 - 1; x += 4) {
                const leg = new THREE.Mesh(legGeo, frameMat);
                leg.position.set(x, beltHeight / 2, beltZ);
                leg.castShadow = true;
                conveyorGroup.add(leg);
            }

            // Con lăn kim loại
            const rollerGeo = new THREE.CylinderGeometry(0.06, 0.06, beltWidth - 0.08, 12);
            const rollerMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.7, roughness: 0.3 });
            this.meshes.beltRollers = [];
            const rollerCount = 65;
            for (let i = 0; i < rollerCount; i++) {
                const roller = new THREE.Mesh(rollerGeo, rollerMat);
                const rx = -beltLength / 2 + i * (beltLength / rollerCount) + 0.25;
                roller.position.set(rx, beltHeight, beltZ);
                roller.rotation.x = Math.PI / 2;
                conveyorGroup.add(roller);
                this.meshes.beltRollers.push(roller);
            }

            // =====================================================================
            // 3 CỔNG GẠT & 3 MÁNG TRƯỢT DỐC XUỐNG THEO ĐÚNG MÀU QUY CHUẨN:
            // Cổng 1: Xanh Dương (#0284c7) | Cổng 2: Cam (#d97706) | Cổng 3: Xanh Lá (#059669)
            // =====================================================================
            this.meshes.diverters = [];
            this.meshes.chutes = [];
            this.meshes.chuteRollers = [];

            for (let gId in this.layout.chutes) {
                const cCfg = this.layout.chutes[gId];
                const gateId = parseInt(gId);

                // Cổng vòm đen tối giản
                const archGroup = new THREE.Group();
                const archColGeo = new THREE.BoxGeometry(0.18, 2.2, 0.18);
                const archMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 });

                const colBack = new THREE.Mesh(archColGeo, archMat);
                colBack.position.set(cCfg.x, beltHeight + 1.0, beltZ - beltWidth / 2 - 0.1);
                archGroup.add(colBack);

                const colFront = new THREE.Mesh(archColGeo, archMat);
                colFront.position.set(cCfg.x, beltHeight + 1.0, beltZ + beltWidth / 2 + 0.1);
                archGroup.add(colFront);

                const topBeamGeo = new THREE.BoxGeometry(0.2, 0.2, beltWidth + 0.4);
                const topBeam = new THREE.Mesh(topBeamGeo, archMat);
                topBeam.position.set(cCfg.x, beltHeight + 2.1, beltZ);
                archGroup.add(topBeam);
                conveyorGroup.add(archGroup);

                // Cánh tay gạt cơ khí
                const armGeo = new THREE.BoxGeometry(1.3, 0.2, 0.06);
                const armMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.6 });
                const arm = new THREE.Mesh(armGeo, armMat);
                arm.position.set(0.65, 0, 0);

                const armPivot = new THREE.Group();
                armPivot.position.set(cCfg.x - 0.6, beltHeight + 0.12, beltZ - beltWidth / 2);
                armPivot.add(arm);
                conveyorGroup.add(armPivot);
                this.meshes.diverters.push({ id: gateId, pivot: armPivot, currentAngle: 0, targetAngle: 0 });

                // MÁNG TRƯỢT CON LĂN DỐC XUỐNG SÀN
                const chuteLength = 4.8;
                const chuteWidth = 1.35;
                const chuteGroup = new THREE.Group();
                chuteGroup.position.set(cCfg.x, beltHeight - 0.55, beltZ + 2.5);
                chuteGroup.rotation.x = 0.21;

                // Thân sàn máng
                const bedGeo = new THREE.BoxGeometry(chuteWidth, 0.08, chuteLength);
                const bedMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4 });
                const bed = new THREE.Mesh(bedGeo, bedMat);
                chuteGroup.add(bed);

                // Lan can 2 bên viền ĐÚNG MÀU QUY CHUẨN (Xanh Dương / Cam / Xanh Lá)
                const railBorderMat = new THREE.MeshStandardMaterial({ color: cCfg.color, roughness: 0.3 });
                const railBorderGeo = new THREE.BoxGeometry(0.08, 0.24, chuteLength);

                const rL = new THREE.Mesh(railBorderGeo, railBorderMat);
                rL.position.set(-chuteWidth / 2, 0.12, 0);
                chuteGroup.add(rL);

                const rR = new THREE.Mesh(railBorderGeo, railBorderMat);
                rR.position.set(chuteWidth / 2, 0.12, 0);
                chuteGroup.add(rR);

                // Con lăn máng trượt
                const crGeo = new THREE.CylinderGeometry(0.04, 0.04, chuteWidth - 0.1, 10);
                const crMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.6 });
                for (let rz = -chuteLength / 2 + 0.3; rz <= chuteLength / 2 - 0.2; rz += 0.5) {
                    const cRoller = new THREE.Mesh(crGeo, crMat);
                    cRoller.position.set(0, 0.06, rz);
                    cRoller.rotation.z = Math.PI / 2;
                    chuteGroup.add(cRoller);
                    this.meshes.chuteRollers.push(cRoller);
                }
                conveyorGroup.add(chuteGroup);

                // Vạch đệm đón hàng tại chân máng (Nơi AMR đỗ nhận kiện)
                const padGeo = new THREE.PlaneGeometry(1.6, 1.6);
                const padMat = new THREE.MeshBasicMaterial({ color: cCfg.color, transparent: true, opacity: 0.35 });
                const pad = new THREE.Mesh(padGeo, padMat);
                pad.rotation.x = -Math.PI / 2;
                pad.position.set(cCfg.x, 0.02, cCfg.zEnd);
                this.scene.add(pad);

                this.meshes.chutes.push({ id: gateId, ...cCfg });
            }

            this.scene.add(conveyorGroup);
        },

        // =========================================================================
        // 4. CỔNG VÒM THỊ GIÁC AI YOLOv12n (CYAN/TEAL CHUẨN ẢNH MẪU)
        // =========================================================================
        buildAIVisionGantry: function () {
            const gantryGroup = new THREE.Group();
            const gx = -12;
            const gz = this.layout.beltZ;

            const archMat = new THREE.MeshStandardMaterial({ color: 0x06b6d4, roughness: 0.2 });
            const colGeo = new THREE.BoxGeometry(0.2, 3.0, 0.2);

            const col1 = new THREE.Mesh(colGeo, archMat);
            col1.position.set(gx, 1.5, gz - 0.9);
            gantryGroup.add(col1);

            const col2 = new THREE.Mesh(colGeo, archMat);
            col2.position.set(gx, 1.5, gz + 0.9);
            gantryGroup.add(col2);

            const beamGeo = new THREE.BoxGeometry(0.22, 0.22, 2.0);
            const topBeam = new THREE.Mesh(beamGeo, archMat);
            topBeam.position.set(gx, 2.9, gz);
            gantryGroup.add(topBeam);

            // Bảng thẻ nổi lơ lửng [YOLOv12n: 98.4%]
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
            const badgePlane = new THREE.Mesh(
                new THREE.PlaneGeometry(2.4, 0.68),
                new THREE.MeshBasicMaterial({ map: badgeTex, transparent: true })
            );
            badgePlane.position.set(gx, 3.4, gz);
            gantryGroup.add(badgePlane);

            // Khung Bounding Box 3D
            const bboxGeo = new THREE.BoxGeometry(0.9, 0.75, 0.85);
            const bboxEdges = new THREE.EdgesGeometry(bboxGeo);
            const bbox = new THREE.LineSegments(bboxEdges, new THREE.LineBasicMaterial({ color: 0x06b6d4, linewidth: 2 }));
            bbox.position.set(gx, 1.85, gz);
            gantryGroup.add(bbox);

            this.scene.add(gantryGroup);
        },

        // =========================================================================
        // 5. DÃY 9 BỤC KỆ TỈNH THÀNH (ĐỒNG BỘ 100% MÀU QUY CHUẨN PHẦN MỀM)
        // =========================================================================
        buildPodiumRacks: function () {
            const podiumGroup = new THREE.Group();

            const provinceList = [
                // Miền Bắc: Xanh Dương (#0284c7)
                { name: "Hà Nội", region: "Bắc", x: -14, color: "#0284c7", topHex: 0x0284c7, count: 5 },
                { name: "Hải Phòng", region: "Bắc", x: -10.5, color: "#0284c7", topHex: 0x0284c7, count: 3 },
                { name: "Quảng Ninh", region: "Bắc", x: -7, color: "#0284c7", topHex: 0x0284c7, count: 2 },

                // Miền Trung: Cam Công Nghiệp (#d97706) - KHÔNG PHẢI TÍM
                { name: "Đà Nẵng", region: "Trung", x: -2.5, color: "#d97706", topHex: 0xd97706, count: 5 },
                { name: "Huế", region: "Trung", x: 1, color: "#d97706", topHex: 0xd97706, count: 2 },
                { name: "Khánh Hòa", region: "Trung", x: 4.5, color: "#d97706", topHex: 0xd97706, count: 1 },

                // Miền Nam: Xanh Lá (#059669)
                { name: "TP.HCM", region: "Nam", x: 9, color: "#059669", topHex: 0x059669, count: 0 },
                { name: "Bình Dương", region: "Nam", x: 12.5, color: "#059669", topHex: 0x059669, count: 1 },
                { name: "Cần Thơ", region: "Nam", x: 16, color: "#059669", topHex: 0x059669, count: 2 }
            ];

            const podiumZ = 4.5;

            provinceList.forEach((p) => {
                const singlePodium = new THREE.Group();
                singlePodium.position.set(p.x, 0, podiumZ);
                singlePodium.userData = { isRack: true, ...p };

                // Thân bục màu xám trắng đặc khối vững chãi
                const bodyGeo = new THREE.BoxGeometry(2.4, 0.8, 1.8);
                const bodyMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.4 });
                const body = new THREE.Mesh(bodyGeo, bodyMat);
                body.position.y = 0.4;
                body.castShadow = true;
                body.receiveShadow = true;
                singlePodium.add(body);

                // Mặt bục ĐÚNG MÀU QUY CHUẨN (Xanh Dương / Cam / Xanh Lá)
                const topGeo = new THREE.BoxGeometry(2.42, 0.08, 1.82);
                const topMat = new THREE.MeshStandardMaterial({ color: p.topHex, roughness: 0.3 });
                const topPlate = new THREE.Mesh(topGeo, topMat);
                topPlate.position.y = 0.84;
                singlePodium.add(topPlate);

                // Các thùng hàng xếp trên bục
                const boxGroup = new THREE.Group();
                const cartonGeo = new THREE.BoxGeometry(0.72, 0.55, 0.72);
                const cartonMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.6 });

                for (let b = 0; b < Math.min(p.count, 6); b++) {
                    const cBox = new THREE.Mesh(cartonGeo, cartonMat);
                    const colIdx = b % 2;
                    const rowIdx = Math.floor(b / 2);
                    cBox.position.set(-0.45 + colIdx * 0.9, 0.88 + 0.28 + rowIdx * 0.55, 0);
                    cBox.castShadow = true;
                    boxGroup.add(cBox);
                }
                singlePodium.add(boxGroup);
                singlePodium.userData.boxGroup = boxGroup;

                // Thẻ nhãn lơ lửng viền ĐÚNG MÀU QUY CHUẨN
                const labelCanvas = document.createElement("canvas");
                labelCanvas.width = 256;
                labelCanvas.height = 100;
                const lctx = labelCanvas.getContext("2d");

                lctx.fillStyle = "#ffffff";
                lctx.strokeStyle = p.color;
                lctx.lineWidth = 6;
                lctx.beginPath();
                lctx.roundRect(8, 8, 240, 84, 14);
                lctx.fill();
                lctx.stroke();

                lctx.fillStyle = "#0f172a";
                lctx.font = "bold 28px 'Plus Jakarta Sans', sans-serif";
                lctx.textAlign = "center";
                lctx.fillText(p.name, 128, 44);

                lctx.fillStyle = p.color;
                lctx.font = "bold 24px 'JetBrains Mono', sans-serif";
                lctx.fillText(`${p.count}/6 ô`, 128, 76);

                const labelTex = new THREE.CanvasTexture(labelCanvas);
                const labelMesh = new THREE.Mesh(
                    new THREE.PlaneGeometry(1.8, 0.7),
                    new THREE.MeshBasicMaterial({ map: labelTex, transparent: true })
                );
                labelMesh.position.set(0, 2.5, 0);
                singlePodium.add(labelMesh);
                singlePodium.userData.labelMesh = labelMesh;

                podiumGroup.add(singlePodium);
                this.meshes.podiums[p.name] = singlePodium;
            });

            this.scene.add(podiumGroup);
        },

        // =========================================================================
        // 6. TRẠM SẠC & BÃI ĐỖ DỰ BỊ
        // =========================================================================
        buildDocksAndStandby: function () {
            const dockGroup = new THREE.Group();
            const docks = [
                { id: "dock_1", label: "DOCK 1", x: -18, z: 1.0, color: 0xd97706 },
                { id: "dock_2", label: "DOCK 2", x: -15.5, z: 1.0, color: 0xd97706 },
                { id: "standby", label: "AMR-04", x: -13, z: 1.0, color: 0x8b5cf6 }
            ];

            docks.forEach((d) => {
                const padGeo = new THREE.PlaneGeometry(1.8, 1.8);
                const padMat = new THREE.MeshBasicMaterial({ color: d.color, transparent: true, opacity: 0.35 });
                const pad = new THREE.Mesh(padGeo, padMat);
                pad.rotation.x = -Math.PI / 2;
                pad.position.set(d.x, 0.02, d.z);
                dockGroup.add(pad);

                const borderGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.8, 0.04, 1.8));
                const border = new THREE.LineSegments(borderGeo, new THREE.LineBasicMaterial({ color: d.color, linewidth: 2 }));
                border.position.set(d.x, 0.02, d.z);
                dockGroup.add(border);
            });

            this.scene.add(dockGroup);
        },

        // =========================================================================
        // 7. THIẾT KẾ THÂN XE AMR ĐẶC KHỐI CÔNG NGHIỆP SẮC NÉT (SOLID INDUSTRIAL PUCK)
        // =========================================================================
        buildAMRFleet: function () {
            // Danh sách cấu hình 4 xe ĐÚNG MÀU QUY CHUẨN PHẦN MỀM
            const amrsConfig = [
                { id: "AMR-01", name: "AMR-01 (Bắc)", color: 0x0284c7, homeX: -5, homeZ: -1.5 },
                { id: "AMR-02", name: "AMR-02 (Trung)", color: 0xd97706, homeX: 2, homeZ: -1.5 }, // MÀU CAM CHUẨN
                { id: "AMR-03", name: "AMR-03 (Nam)", color: 0x059669, homeX: 9, homeZ: -1.5 },
                { id: "AMR-04", name: "AMR-04 (Dự Bị)", color: 0x8b5cf6, homeX: -13, homeZ: 1.0 }
            ];

            amrsConfig.forEach((cfg) => {
                const amrGroup = new THREE.Group();
                amrGroup.position.set(cfg.homeX, 0.2, cfg.homeZ);
                amrGroup.userData = {
                    isAMR: true,
                    id: cfg.id,
                    name: cfg.name,
                    color: cfg.color,
                    homeX: cfg.homeX,
                    homeZ: cfg.homeZ,
                    state: "IDLE",
                    battery: 88,
                    carryingPackage: null,
                    // Trình tự chuyển động nội suy mượt mà
                    kinematicState: "WAITING_AT_CHUTE", // WAITING_AT_CHUTE -> DELIVERING -> UNLOADING -> RETURNING
                    targetPodium: null,
                    moveT: 0
                };

                // 1. Thân xe dưới màu xám than chì đặc khối
                const chassisGeo = new THREE.BoxGeometry(1.4, 0.28, 1.3);
                const chassisMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.4 });
                const chassis = new THREE.Mesh(chassisGeo, chassisMat);
                chassis.castShadow = true;
                amrGroup.add(chassis);

                // 2. Viền màu trên lưng xe ĐÚNG MÀU QUY CHUẨN (Đặc khối rõ nét nhìn từ trên xuống)
                const rimGeo = new THREE.BoxGeometry(1.42, 0.12, 1.32);
                const rimMat = new THREE.MeshStandardMaterial({ color: cfg.color, roughness: 0.2 });
                const rim = new THREE.Mesh(rimGeo, rimMat);
                rim.position.y = 0.15;
                amrGroup.add(rim);

                // 3. Mặt bàn nâng trung tâm màu trắng sáng
                const deckGeo = new THREE.BoxGeometry(1.0, 0.08, 0.95);
                const deckMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
                const deck = new THREE.Mesh(deckGeo, deckMat);
                deck.position.y = 0.22;
                amrGroup.add(deck);

                // 4. Mắt cảm biến LiDAR ở đầu xe
                const eyeGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.15, 12);
                const eyeMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
                const eye = new THREE.Mesh(eyeGeo, eyeMat);
                eye.position.set(0, 0.25, 0.5);
                amrGroup.add(eye);

                // 5. Thùng hàng màu vàng kraft khi xe đang chở
                const boxGeo = new THREE.BoxGeometry(0.72, 0.55, 0.72);
                const boxMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.6 });
                const carryingBox = new THREE.Mesh(boxGeo, boxMat);
                carryingBox.position.set(0, 0.58, 0);
                carryingBox.castShadow = true;
                carryingBox.visible = false;
                amrGroup.add(carryingBox);
                amrGroup.userData.carryingBox = carryingBox;

                this.scene.add(amrGroup);
                this.meshes.amrs[cfg.id] = amrGroup;
            });
        },

        // =========================================================================
        // 8. ĐIỀU KHIỂN TRÌNH TỰ ROBOT CHUẨN XÁC 5 BƯỚC KHÉP KÍN (60 FPS)
        // =========================================================================
        updateState: function (snapshot) {
            if (!this.initialized || !snapshot) return;

            // 1. Cập nhật kiện hàng và TRƯỢT DỐC THEO MÁNG
            if (snapshot.packages) {
                this.updatePackagesSliding(snapshot.packages);
            }

            // 2. Cập nhật 3 Cổng gạt
            if (snapshot.gates) {
                snapshot.gates.forEach((g) => {
                    const div = this.meshes.diverters.find((d) => d.id === g.id);
                    if (div) {
                        div.targetAngle = (g.state === "OPEN" || g.angle > 0) ? -Math.PI / 4 : 0;
                    }
                });
            }

            // 3. ĐIỀU PHỐI TRÌNH TỰ CHUYỂN ĐỘNG ROBOT THEO ĐÚNG LOGIC NGHIỆP VỤ:
            const amrDataList = snapshot.amrs || (snapshot.amr ? [snapshot.amr] : []);
            amrDataList.forEach((aData, idx) => {
                const amrId = aData.id || `AMR-0${idx + 1}`;
                const amrMesh = this.meshes.amrs[amrId];
                if (!amrMesh) return;

                amrMesh.userData.battery = aData.battery !== undefined ? aData.battery : amrMesh.userData.battery;
                amrMesh.userData.backendState = aData.state;

                // Xác định đích đến Tỉnh/Thành phố từ kiện hàng
                let targetProvince = null;
                if (aData.current_package && aData.current_package.destination) {
                    targetProvince = aData.current_package.destination;
                } else if (aData.target_label) {
                    targetProvince = aData.target_label;
                }

                const podiumCfg = targetProvince ? this.layout.podiums[targetProvince] : null;

                // CHU KỲ 5 BƯỚC CHUẨN XÁC:
                const homeX = amrMesh.userData.homeX;
                const homeZ = amrMesh.userData.homeZ;

                if (aData.state === "DELIVERING" && podiumCfg) {
                    // BƯỚC 3: ĐANG CHỞ HÀNG TỪ CHÂN MÁNG -> ĐÚNG BỤC KỆ TỈNH THÀNH
                    amrMesh.userData.carryingBox.visible = true;
                    // Di chuyển thẳng tắp theo làn từ (homeX, homeZ) tới (podiumCfg.x, podiumCfg.z - 1.2)
                    amrMesh.position.x += (podiumCfg.x - amrMesh.position.x) * 0.08;
                    amrMesh.position.z += ((podiumCfg.z - 1.2) - amrMesh.position.z) * 0.08;
                    amrMesh.rotation.y = 0; // Hướng về phía bục kệ
                } else if (aData.state === "UNLOADING" && podiumCfg) {
                    // BƯỚC 4: ĐỖ TRƯỚC BỤC KỆ DỠ HÀNG
                    amrMesh.position.x = podiumCfg.x;
                    amrMesh.position.z = podiumCfg.z - 1.2;
                    amrMesh.userData.carryingBox.visible = false;
                } else if (aData.state === "RETURNING" || aData.state === "WAITING_FOR_CARGO" || aData.state === "IDLE") {
                    // BƯỚC 5 & 1: QUAY VỀ VỊ TRÍ CHÂN MÁNG ĐỨNG ĐÓN KIỆN TIẾP THEO
                    amrMesh.userData.carryingBox.visible = false;
                    amrMesh.position.x += (homeX - amrMesh.position.x) * 0.08;
                    amrMesh.position.z += (homeZ - amrMesh.position.z) * 0.08;
                    amrMesh.rotation.y = Math.PI; // Hướng quay lại
                } else if (aData.state === "CHARGING_AT_DOCK" || aData.state === "GOING_TO_DOCK") {
                    // CHẾ ĐỘ SẠC: ĐỖ TẠI TRẠM SẠC BÊN HÔNG
                    const dockX = amrId === "AMR-01" ? -18 : -15.5;
                    amrMesh.position.x += (dockX - amrMesh.position.x) * 0.08;
                    amrMesh.position.z += (1.0 - amrMesh.position.z) * 0.08;
                }
            });

            this.updateInspectorHUD();
        },

        // Cập nhật kiện hàng trượt dốc theo máng
        updatePackagesSliding: function (pkgList) {
            const currentIds = new Set();
            const beltZ = this.layout.beltZ;
            const beltHeight = this.layout.beltHeight;

            pkgList.forEach((p) => {
                const id = p.id || p.tracking_id;
                currentIds.add(id);

                let pMesh = this.meshes.packages[id];
                if (!pMesh) {
                    const boxGeo = new THREE.BoxGeometry(0.72, 0.55, 0.72);
                    const boxMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.6 });
                    pMesh = new THREE.Mesh(boxGeo, boxMat);
                    pMesh.castShadow = true;
                    pMesh.userData = { isPackage: true, ...p, chuteProgress: 0 };
                    this.scene.add(pMesh);
                    this.meshes.packages[id] = pMesh;
                }

                pMesh.userData = { ...pMesh.userData, ...p };

                const isDiverted = p.status === "Diverting" || p.status === "InChute" || p.status === "Sorted";
                const gateId = p.gate || (p.destination && p.destination.includes("Bắc") ? 1 : (p.destination && p.destination.includes("Trung") ? 2 : 3));
                const chute = this.layout.chutes[gateId];

                if (isDiverted && chute) {
                    // Kiện hàng trượt dốc theo quán tính tự động xuống chân máng
                    if (pMesh.userData.chuteProgress === undefined) pMesh.userData.chuteProgress = 0;
                    if (pMesh.userData.chuteProgress < 1.0) {
                        pMesh.userData.chuteProgress += 0.04;
                    }
                    const prog = pMesh.userData.chuteProgress;
                    pMesh.position.x = chute.x;
                    pMesh.position.z = chute.zStart + (chute.zEnd - chute.zStart) * prog;
                    pMesh.position.y = chute.yStart - (chute.yStart - chute.yEnd) * prog + 0.28;
                } else {
                    // Kiện hàng chạy trên băng tải chính
                    const px = ((p.x || 0) / 960) * 36 - 18;
                    pMesh.position.x = px;
                    pMesh.position.y = beltHeight + 0.28;
                    pMesh.position.z = beltZ;
                }
            });

            for (let id in this.meshes.packages) {
                if (!currentIds.has(id) && !currentIds.has(Number(id))) {
                    this.scene.remove(this.meshes.packages[id]);
                    delete this.meshes.packages[id];
                }
            }
        },

        // =========================================================================
        // 9. VÒNG LẶP RENDER 60 FPS
        // =========================================================================
        animate: function () {
            this.animFrameId = requestAnimationFrame(this.animate);

            if (this.state.conveyorRunning) {
                this.meshes.beltRollers.forEach((r) => { r.rotation.y += 0.08; });
                this.meshes.chuteRollers.forEach((cr) => { cr.rotation.x += 0.06; });
            }

            this.meshes.diverters.forEach((d) => {
                d.currentAngle += (d.targetAngle - d.currentAngle) * 0.15;
                d.pivot.rotation.y = d.currentAngle;
            });

            if (this.controls) this.controls.update();

            this.renderer.render(this.scene, this.camera);
        },

        // =========================================================================
        // 10. ĐIỀU KHIỂN GÓC NHÌN & TƯƠNG TÁC
        // =========================================================================
        setCameraView: function (mode) {
            this.cameraMode = mode;
            if (mode === "iso") {
                this.camera.position.set(20, 24, 24);
                this.camera.lookAt(0, 0, 0);
                if (this.controls) this.controls.target.set(0, 0, 0);
            } else if (mode === "top") {
                this.camera.position.set(0, 36, 0.1);
                this.camera.lookAt(0, 0, 0);
                if (this.controls) this.controls.target.set(0, 0, 0);
            }
        },

        bindEvents: function () {
            const self = this;
            window.addEventListener("resize", () => self.resize());

            this.renderer.domElement.addEventListener("pointerdown", (event) => {
                const rect = self.renderer.domElement.getBoundingClientRect();
                self.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
                self.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

                self.raycaster.setFromCamera(self.mouse, self.camera);
                const intersects = self.raycaster.intersectObjects(self.scene.children, true);

                if (intersects.length > 0) {
                    let hitObj = null;
                    for (let i = 0; i < intersects.length; i++) {
                        let obj = intersects[i].object;
                        while (obj.parent && obj.parent !== self.scene) {
                            if (obj.userData && (obj.userData.isAMR || obj.userData.isRack || obj.userData.isPackage)) {
                                hitObj = obj;
                                break;
                            }
                            obj = obj.parent;
                        }
                        if (hitObj) break;
                    }
                    if (hitObj) {
                        self.selectedEntity = hitObj.userData;
                        self.updateInspectorHUD();
                    }
                }
            });
        },

        updateInspectorHUD: function () {
            const panel = document.getElementById("threed-inspector-panel");
            if (!panel || !this.selectedEntity) return;

            panel.style.display = "block";
            const titleEl = document.getElementById("inspector-entity-title");
            const badgeEl = document.getElementById("inspector-entity-badge");
            const bodyEl = document.getElementById("inspector-entity-body");

            const ent = this.selectedEntity;
            if (ent.isRack) {
                titleEl.textContent = `Bục Kệ: ${ent.name} (Miền ${ent.region})`;
                badgeEl.textContent = "KHO TỈNH THÀNH";
                badgeEl.style.background = "#eff6ff";
                badgeEl.style.color = ent.color;

                bodyEl.innerHTML = `
                    <div class="inspector-field-row"><span class="lbl">Sức chứa:</span><span class="val font-mono">${ent.count || 0}/6 Kiện</span></div>
                    <div class="inspector-field-row"><span class="lbl">Tỷ lệ lấp đầy:</span><span class="val font-mono">${Math.round(((ent.count || 0)/6)*100)}%</span></div>
                    <div class="inspector-field-row"><span class="lbl">Trạng thái ô:</span><span class="val" style="color:#16a34a; font-weight:600;">Sẵn sàng nhận hàng</span></div>
                `;
            } else if (ent.isAMR) {
                titleEl.textContent = `Xe Tự Hành: ${ent.id}`;
                badgeEl.textContent = ent.backendState || "HOẠT ĐỘNG";
                badgeEl.style.background = "#f0fdf4";
                badgeEl.style.color = "#15803d";

                bodyEl.innerHTML = `
                    <div class="inspector-field-row"><span class="lbl">Dung lượng Pin:</span><span class="val font-mono" style="color:#16a34a; font-weight:700;">${ent.battery}%</span></div>
                    <div class="inspector-field-row"><span class="lbl">Tải trọng:</span><span class="val">${ent.carryingBox && ent.carryingBox.visible ? 'Đang chở kiện hàng' : 'Trống tải'}</span></div>
                    <div class="inspector-field-row"><span class="lbl">Trình tự lộ trình:</span><span class="val" style="color:#0284c7; font-weight:600;">Chân Máng ➔ Bục Kệ ➔ Quay Về</span></div>
                `;
            }
        },

        resize: function () {
            if (!this.container || !this.renderer || !this.camera) return;
            const width = this.container.clientWidth;
            const height = this.container.clientHeight;
            if (width > 0 && height > 0) {
                this.camera.aspect = width / height;
                this.camera.updateProjectionMatrix();
                this.renderer.setSize(width, height);
            }
        }
    };

    window.Warehouse3D = Warehouse3D;
})(window);
