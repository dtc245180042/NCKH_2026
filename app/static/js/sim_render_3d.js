/**
 * ==============================================================================
 * NEXUSLOG 3D - THREE.JS RENDERING ENGINE (LIGHTWEIGHT, SOLID INDUSTRIAL 3D)
 * ==============================================================================
 * Lớp hiển thị 3D độc lập bằng Three.js r128:
 * - Sàn 36x22 ô, lưới nhẹ A*, dải sàn 3 miền với nhãn "LÀN n: MIỀN ... (AMR-0n)"
 * - Băng chuyền con lăn ngang rào vàng-đen
 * - Cổng AI xanh lơ (Teal) + Bounding Box chiếu tọa độ 3D + nhãn "YOLOv12n: xx.x%"
 * - 3 Cổng IoT cơ khí (Bắc, Trung, Nam) + 3 Máng trượt con lăn nghiêng
 * - 9 Ô kệ phân loại (thùng xếp tầng tối đa 6 kiện + nhãn nổi "Tên + số/6 ô")
 * - 3 Robot AMR khối thấp đúng màu làn, xoay hướng mượt mà, vệt laser A* xanh lơ
 * - Ánh sáng Hemisphere + 1 Directional (Không đổ bóng nặng, chạy mượt trên Intel UHD)
 * - Tương tác click chuột đặt/xóa vật cản A* trực tiếp
 * ==============================================================================
 */

(function (window) {
    "use strict";

    class SimulationRenderer3D {
        constructor(canvasContainerId, logicEngine) {
            this.container = document.getElementById(canvasContainerId);
            this.engine = logicEngine;
            this.config = window.SIM_CONFIG;

            this.scene = null;
            this.camera = null;
            this.renderer = null;
            this.controls = null;
            this.raycaster = null;
            this.mouse = null;
            this.groundPlane = null;

            this.meshes = {
                rollers: [],
                diverters: [],
                chuteRollers: [],
                racks: {},
                amrs: {},
                packages: {},
                obstacles: {},
                aStarTrails: {},
                aiBoundingBox: null,
                aiBadgeMesh: null
            };

            this.followCamActive = false;
            this.followAmrId = "AMR-01";
            this.lastTime = performance.now();
            this.fps = 60;
            this.fpsCounter = 0;
            this.fpsTimer = performance.now();

            this.init();
        }

        init() {
            if (!this.container) return;
            const w = this.container.clientWidth || 960;
            const h = this.container.clientHeight || 520;

            // 1. Scene
            this.scene = new THREE.Scene();
            this.scene.background = new THREE.Color(0xf8fafc); // Nền sáng sạch sẽ

            // 2. Camera
            this.camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 1000);
            this.setCameraPreset("iso");

            // 3. Renderer nhẹ mượt (Không bóng đổ thời gian thực để đạt 60 FPS trên Intel UHD)
            this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
            this.renderer.setSize(w, h);
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
            this.renderer.shadowMap.enabled = false; // Tắt shadow map để tối ưu hiệu năng
            this.container.innerHTML = "";
            this.container.appendChild(this.renderer.domElement);

            // 4. OrbitControls
            if (window.THREE && window.THREE.OrbitControls) {
                this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
                this.controls.enableDamping = true;
                this.controls.dampingFactor = 0.08;
                this.controls.maxPolarAngle = Math.PI / 2 - 0.04;
                this.controls.minDistance = 6;
                this.controls.maxDistance = 60;
                this.controls.target.set(0, 0, 0);
            }

            this.raycaster = new THREE.Raycaster();
            this.mouse = new THREE.Vector2();

            // 5. Xây dựng cảnh
            this.buildFloorAndLanes();
            this.buildConveyorAndGates();
            this.buildAIPortal();
            this.build9ProvinceRacks();
            this.buildAMRs();

            // 6. Bắt sự kiện click đặt vật cản
            this.bindEvents();

            // 7. Vòng lặp render
            this.animate = this.animate.bind(this);
            requestAnimationFrame(this.animate);
        }

        // Chuyển đổi tọa độ Grid (X: 0..36, Y: 0..22) sang tọa độ 3D Scene
        gridToWorld(gx, gy) {
            const wx = gx - this.config.GRID_W / 2; // -18 .. +18
            const wz = gy - this.config.GRID_H / 2; // -11 .. +11
            return { x: wx, z: wz };
        }

        worldToGrid(wx, wz) {
            const gx = Math.round(wx + this.config.GRID_W / 2);
            const gy = Math.round(wz + this.config.GRID_H / 2);
            return { x: gx, y: gy };
        }

        // =========================================================================
        // A. SÀN 36x22, LƯỚI A*, DẢI SÀN 3 LÀN
        // =========================================================================
        buildFloorAndLanes() {
            // Mặt phẳng sàn tương tác
            const floorGeo = new THREE.PlaneGeometry(this.config.GRID_W, this.config.GRID_H);
            const floorMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
            const floor = new THREE.Mesh(floorGeo, floorMat);
            floor.rotation.x = -Math.PI / 2;
            this.scene.add(floor);
            this.groundPlane = floor;

            // Lưới A* mờ nhẹ 36x22
            const gridHelper = new THREE.GridHelper(this.config.GRID_W, this.config.GRID_W, 0xd1d5db, 0xe2e8f0);
            gridHelper.position.y = 0.01;
            gridHelper.scale.z = this.config.GRID_H / this.config.GRID_W;
            this.scene.add(gridHelper);

            // Ánh sáng Hemisphere + 1 Directional
            const hemiLight = new THREE.HemisphereLight(0xffffff, 0xe2e8f0, 0.85);
            this.scene.add(hemiLight);

            const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
            dirLight.position.set(15, 25, 20);
            this.scene.add(dirLight);

            // Dải sàn tô màu mờ 3 làn (Bắc: Xanh dương, Trung: Tím, Nam: Xanh lá)
            const lanesConfig = [
                { id: 1, region: "BẮC", amr: "AMR-01", x: 9, color: 0x0284c7 },
                { id: 2, region: "TRUNG", amr: "AMR-02", x: 18, color: 0x9333ea },
                { id: 3, region: "NAM", amr: "AMR-03", x: 27, color: 0x10b981 }
            ];

            lanesConfig.forEach(lane => {
                const wPos = this.gridToWorld(lane.x, 12);
                const laneGeo = new THREE.PlaneGeometry(7.0, 12.0);
                const laneMat = new THREE.MeshBasicMaterial({
                    color: lane.color,
                    transparent: true,
                    opacity: 0.12,
                    side: THREE.DoubleSide
                });
                const laneMesh = new THREE.Mesh(laneGeo, laneMat);
                laneMesh.rotation.x = -Math.PI / 2;
                laneMesh.position.set(wPos.x, 0.015, wPos.z);
                this.scene.add(laneMesh);

                // Chữ ghi trên sàn: "LÀN n: MIỀN ... (AMR-0n)"
                const textCanvas = document.createElement("canvas");
                textCanvas.width = 512;
                textCanvas.height = 128;
                const tctx = textCanvas.getContext("2d");
                tctx.fillStyle = "rgba(255,255,255,0.0)";
                tctx.fillRect(0, 0, 512, 128);
                tctx.fillStyle = lane.color === 0x0284c7 ? "#0284c7" : (lane.color === 0x9333ea ? "#9333ea" : "#059669");
                tctx.font = "bold 34px 'Plus Jakarta Sans', sans-serif";
                tctx.textAlign = "center";
                tctx.fillText(`LÀN ${lane.id}: MIỀN ${lane.region} (${lane.amr})`, 256, 75);

                const tex = new THREE.CanvasTexture(textCanvas);
                const tPlane = new THREE.Mesh(new THREE.PlaneGeometry(5.0, 1.25), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
                tPlane.rotation.x = -Math.PI / 2;
                tPlane.position.set(wPos.x, 0.02, wPos.z - 2.5);
                this.scene.add(tPlane);
            });
        }

        // =========================================================================
        // B. BĂNG CHUYỀN RÀO VÀNG-ĐEN, 3 CỔNG IOT & MÁNG TRƯỢT
        // =========================================================================
        buildConveyorAndGates() {
            const conveyorGroup = new THREE.Group();
            const beltW = 32;
            const beltD = 1.3;
            const beltH = 1.2;
            const wPos = this.gridToWorld(18, this.config.CONVEYOR_Y);

            // Khung thân băng chuyền màu than chì
            const frameGeo = new THREE.BoxGeometry(beltW, 0.2, beltD);
            const frameMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 });
            const frame = new THREE.Mesh(frameGeo, frameMat);
            frame.position.set(wPos.x, beltH, wPos.z);
            conveyorGroup.add(frame);

            // Rào bảo vệ sọc vàng - đen hai bên băng chuyền
            const fenceGeo = new THREE.BoxGeometry(beltW, 0.25, 0.08);
            const fenceMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.4 });
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

                // Cần gạt cơ khí phân loại IoT (Mechanical Diverter Arm & Servo Actuator)
                const armGroup = new THREE.Group();

                // Trụ xoay Servo mạ kim loại công nghiệp
                const servoCyl = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.16, 0.16, 0.45, 16),
                    new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.2 })
                );
                servoCyl.position.y = 0.2;
                armGroup.add(servoCyl);

                // Nắp đèn LED báo trạng thái đỉnh trụ xoay
                const ledCap = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.09, 0.09, 0.08, 16),
                    new THREE.MeshBasicMaterial({ color: gate.color })
                );
                ledCap.position.y = 0.44;
                armGroup.add(ledCap);

                // Cánh tay gạt dài, dày dặn, viền nổi bật (Mechanical Sweeper Blade)
                const bladeGeo = new THREE.BoxGeometry(1.45, 0.26, 0.12);
                const bladeMat = new THREE.MeshStandardMaterial({ color: gate.color, metalness: 0.3, roughness: 0.3 });
                const blade = new THREE.Mesh(bladeGeo, bladeMat);
                blade.position.set(0.72, 0.2, 0); // Trục xoay nằm ở đầu thanh
                armGroup.add(blade);

                // Lớp đệm cao su đen giảm chấn tiếp xúc kiện hàng
                const rubberGeo = new THREE.BoxGeometry(1.45, 0.08, 0.04);
                const rubberMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
                const rubberStripe = new THREE.Mesh(rubberGeo, rubberMat);
                rubberStripe.position.set(0.72, 0.2, 0.07);
                armGroup.add(rubberStripe);

                // Gắn cụm cần gạt vào thành sau của băng tải tại vị trí cổng
                const armPivot = new THREE.Group();
                armPivot.position.set(gWorld.x - 0.7, beltH + 0.1, gWorld.z - beltD / 2 + 0.06);
                armPivot.add(armGroup);
                conveyorGroup.add(armPivot);
                this.meshes.diverters.push({ id: gate.id, pivot: armPivot, currentAngle: 0, targetAngle: 0 });

                // Máng trượt con lăn nghiêng dẫn kiện từ băng tải xuống điểm thả
                const chuteLen = Math.hypot(dropWorld.x - gWorld.x, dropWorld.z - gWorld.z);
                const chuteBed = new THREE.Mesh(
                    new THREE.BoxGeometry(1.2, 0.08, chuteLen),
                    new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4 })
                );
                chuteBed.position.set(gWorld.x, beltH - 0.45, (gWorld.z + dropWorld.z) / 2);
                chuteBed.rotation.x = 0.22;
                conveyorGroup.add(chuteBed);

                // Lan can máng trượt đúng màu cổng
                const railMat = new THREE.MeshBasicMaterial({ color: gate.color });
                const railL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, chuteLen), railMat);
                railL.position.set(gWorld.x - 0.6, beltH - 0.35, (gWorld.z + dropWorld.z) / 2);
                railL.rotation.x = 0.22;
                conveyorGroup.add(railL);

                const railR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, chuteLen), railMat);
                railR.position.set(gWorld.x + 0.6, beltH - 0.35, (gWorld.z + dropWorld.z) / 2);
                railR.rotation.x = 0.22;
                conveyorGroup.add(railR);

                // Điểm thả (Drop Pad)
                const dropPad = new THREE.Mesh(
                    new THREE.PlaneGeometry(1.4, 1.4),
                    new THREE.MeshBasicMaterial({ color: gate.color, transparent: true, opacity: 0.35 })
                );
                dropPad.rotation.x = -Math.PI / 2;
                dropPad.position.set(dropWorld.x, 0.02, dropWorld.z);
                this.scene.add(dropPad);

                // Điểm chờ của AMR (Home Wait Pad)
                const homeWorld = this.gridToWorld(gate.waitX, gate.waitY);
                const homePad = new THREE.Mesh(
                    new THREE.PlaneGeometry(1.4, 1.4),
                    new THREE.MeshBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.25 })
                );
                homePad.rotation.x = -Math.PI / 2;
                homePad.position.set(homeWorld.x, 0.02, homeWorld.z);
                this.scene.add(homePad);
            });

            this.scene.add(conveyorGroup);
        }

        // =========================================================================
        // C. CỔNG AI XANH LƠ (TEAL) + BOUNDING BOX + NHÃN "YOLOv12n: xx.x%"
        // =========================================================================
        buildAIPortal() {
            const gPos = this.gridToWorld(6, this.config.CONVEYOR_Y);
            const portalGroup = new THREE.Group();

            // Khung cổng màu xanh lơ (Teal)
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

            // Bounding box xanh lơ ôm kiện hàng khi đi qua
            const bboxGeo = new THREE.BoxGeometry(0.85, 0.7, 0.85);
            const bboxEdges = new THREE.EdgesGeometry(bboxGeo);
            const bbox = new THREE.LineSegments(bboxEdges, new THREE.LineBasicMaterial({ color: 0x06b6d4, linewidth: 2 }));
            bbox.position.set(gPos.x, 1.6, gPos.z);
            portalGroup.add(bbox);
            this.meshes.aiBoundingBox = bbox;

            // Nhãn nổi lơ lửng "YOLOv12n: 98.4%"
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
        // D. 9 Ô KỆ PHÂN LOẠI (THÙNG XẾP TẦNG TỐI ĐA 6 KIỆN + NHÃN NỔI)
        // =========================================================================
        build9ProvinceRacks() {
            const rackGroup = new THREE.Group();

            this.config.PROVINCES.forEach(p => {
                const wPos = this.gridToWorld(p.x, p.y);
                const singleRack = new THREE.Group();
                singleRack.position.set(wPos.x, 0, wPos.z);

                // Khung bục kệ
                const body = new THREE.Mesh(
                    new THREE.BoxGeometry(1.8, 0.4, 1.6),
                    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.4 })
                );
                body.position.y = 0.2;
                singleRack.add(body);

                // Mặt bục phân màu miền
                const topPlate = new THREE.Mesh(
                    new THREE.BoxGeometry(1.82, 0.06, 1.62),
                    new THREE.MeshBasicMaterial({ color: p.color })
                );
                topPlate.position.y = 0.42;
                singleRack.add(topPlate);

                // Thùng hàng xếp trên kệ (Dynamic Boxes)
                const boxesContainer = new THREE.Group();
                singleRack.add(boxesContainer);
                singleRack.userData = { boxesContainer, count: 0, provinceName: p.name, color: p.color };

                // Nhãn nổi: "Tên + số/6 ô"
                const labelCanvas = document.createElement("canvas");
                labelCanvas.width = 256;
                labelCanvas.height = 90;
                const lctx = labelCanvas.getContext("2d");
                lctx.fillStyle = "#ffffff";
                lctx.strokeStyle = p.color;
                lctx.lineWidth = 5;
                lctx.beginPath();
                lctx.roundRect(6, 6, 244, 78, 12);
                lctx.fill();
                lctx.stroke();
                lctx.fillStyle = "#0f172a";
                lctx.font = "bold 26px 'Plus Jakarta Sans', sans-serif";
                lctx.textAlign = "center";
                lctx.fillText(p.name, 128, 40);
                lctx.fillStyle = p.color;
                lctx.font = "bold 22px 'JetBrains Mono', sans-serif";
                lctx.fillText("0/6 ô", 128, 68);

                const labelTex = new THREE.CanvasTexture(labelCanvas);
                const labelMesh = new THREE.Mesh(
                    new THREE.PlaneGeometry(1.6, 0.58),
                    new THREE.MeshBasicMaterial({ map: labelTex, transparent: true })
                );
                labelMesh.position.set(0, 2.2, 0);
                singleRack.add(labelMesh);
                singleRack.userData.labelMesh = labelMesh;
                singleRack.userData.labelCanvas = labelCanvas;

                rackGroup.add(singleRack);
                this.meshes.racks[p.id] = singleRack;
            });

            this.scene.add(rackGroup);
        }

        // =========================================================================
        // E. 3 ROBOT AMR KHỐI THẤP, ĐÚNG MÀU LÀN & VỆT LASER A*
        // =========================================================================
        buildAMRs() {
            this.engine.amrs.forEach(amr => {
                const wPos = this.gridToWorld(amr.x, amr.y);
                const amrGroup = new THREE.Group();
                amrGroup.position.set(wPos.x, 0.15, wPos.z);

                // Thân xe khối thấp đặc công nghiệp
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

                // Thùng hàng khi xe chở
                const boxGeo = new THREE.BoxGeometry(0.7, 0.55, 0.7);
                const boxMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.5 });
                const carryingBox = new THREE.Mesh(boxGeo, boxMat);
                carryingBox.position.set(0, 0.52, 0);
                carryingBox.visible = false;
                amrGroup.add(carryingBox);

                // Nhãn tên xe trên đầu
                const nameCanvas = document.createElement("canvas");
                nameCanvas.width = 160;
                nameCanvas.height = 50;
                const nctx = nameCanvas.getContext("2d");
                nctx.fillStyle = amr.color;
                nctx.beginPath();
                nctx.roundRect(0, 0, 160, 50, 10);
                nctx.fill();
                nctx.fillStyle = "#ffffff";
                nctx.font = "bold 22px 'JetBrains Mono', sans-serif";
                nctx.textAlign = "center";
                nctx.fillText(amr.id, 80, 34);

                const nameTex = new THREE.CanvasTexture(nameCanvas);
                const nameMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.35), new THREE.MeshBasicMaterial({ map: nameTex, transparent: true }));
                nameMesh.position.set(0, 1.0, 0);
                amrGroup.add(nameMesh);

                amrGroup.userData = { id: amr.id, carryingBox, nameMesh };
                this.scene.add(amrGroup);
                this.meshes.amrs[amr.id] = amrGroup;

                // Dải đường màu xanh lơ hiển thị lộ trình A* đang chạy
                const trailGeo = new THREE.BufferGeometry();
                const positions = new Float32Array(60 * 3);
                trailGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
                const trailLine = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color: 0x06b6d4, linewidth: 2 }));
                this.scene.add(trailLine);
                this.meshes.aStarTrails[amr.id] = trailLine;
            });
        }

        // =========================================================================
        // F. CẬP NHẬT TRẠNG THÁI KHUNG HÌNH (RENDER LOOP)
        // =========================================================================
        animate() {
            requestAnimationFrame(this.animate);
            const now = performance.now();
            const dt = (now - this.lastTime) * 0.001;
            this.lastTime = now;

            // Đo đạc FPS
            this.fpsCounter++;
            if (now - this.fpsTimer >= 1000) {
                this.fps = this.fpsCounter;
                this.fpsCounter = 0;
                this.fpsTimer = now;
                const fpsEl = document.getElementById("hud-fps");
                if (fpsEl) fpsEl.textContent = this.fps;
            }

            // 1. Cập nhật Logic Engine
            this.engine.update(dt);

            // 2. Xoay con lăn băng chuyền
            this.meshes.rollers.forEach(r => { r.rotation.y += 0.08 * this.engine.speedMultiplier; });

            // 3. Cập nhật góc xoay cần gạt cơ khí thời gian thực
            this.engine.gates.forEach(g => {
                const div = this.meshes.diverters.find(d => d.id === g.id);
                if (div) {
                    div.targetAngle = g.diverterAngle || 0;
                    div.currentAngle += (div.targetAngle - div.currentAngle) * 0.18;
                    div.pivot.rotation.y = div.currentAngle;
                }
            });

            // 4. Cập nhật kiện hàng trên 3D Scene
            this.renderPackages();

            // 5. Cập nhật 3 Robot AMR & Vệt đường A*
            this.renderAMRs();

            // 6. Cập nhật 9 ô kệ (Số lượng & Thùng xếp tầng)
            this.renderRacks();

            // 7. Cập nhật vật cản A* do người dùng đặt
            this.renderObstacles();

            // 8. Cập nhật HUD & Event log
            this.updateHUD();

            // 9. Camera Follow (nếu bật)
            if (this.followCamActive) {
                const targetAmr = this.meshes.amrs[this.followAmrId];
                if (targetAmr) {
                    this.camera.position.set(targetAmr.position.x, 8, targetAmr.position.z + 9);
                    this.camera.lookAt(targetAmr.position.x, 0, targetAmr.position.z);
                    if (this.controls) this.controls.target.set(targetAmr.position.x, 0, targetAmr.position.z);
                }
            } else if (this.controls) {
                this.controls.update();
            }

            this.renderer.render(this.scene, this.camera);
        }

        renderPackages() {
            const currentIds = new Set();
            const beltH = 1.2;

            this.engine.packages.forEach(p => {
                currentIds.add(p.id);
                let pMesh = this.meshes.packages[p.id];
                const wPos = this.gridToWorld(p.x, p.y);

                if (!pMesh) {
                    const boxGeo = new THREE.BoxGeometry(0.68, 0.52, 0.68);
                    const boxMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.5 });
                    pMesh = new THREE.Mesh(boxGeo, boxMat);
                    this.scene.add(pMesh);
                    this.meshes.packages[p.id] = pMesh;
                }

                pMesh.position.x = wPos.x;
                pMesh.position.z = wPos.z;

                if (p.status === "ON_BELT") {
                    pMesh.position.y = beltH + 0.32;
                } else if (p.status === "DIVERTING") {
                    // Trượt dốc từ beltH xuống sàn
                    pMesh.position.y = beltH + 0.32 - p.divertProgress * 1.1;
                } else if (p.status === "AT_DROP") {
                    pMesh.position.y = 0.28;
                } else if (p.status === "CARRIED") {
                    pMesh.position.y = 0.65; // Nằm trên lưng AMR
                }
            });

            // Xóa các kiện đã hoàn thành
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
                amrMesh.userData.carryingBox.visible = (amr.state === "DELIVERING" || amr.state === "UNLOADING");

                // Cập nhật vệt đường A* màu xanh lơ
                const trailLine = this.meshes.aStarTrails[amr.id];
                if (trailLine) {
                    if (amr.path && amr.path.length > 0) {
                        trailLine.visible = true;
                        const positions = trailLine.geometry.attributes.position.array;
                        let count = 0;

                        // Điểm xuất phát từ robot
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
                        trailLine.geometry.setDrawRange(0, count);
                        trailLine.geometry.attributes.position.needsUpdate = true;
                    } else {
                        trailLine.visible = false;
                    }
                }
            });
        }

        renderRacks() {
            this.config.PROVINCES.forEach(p => {
                const rackGroup = this.meshes.racks[p.id];
                const logicRack = this.engine.racks[p.id];
                if (!rackGroup || !logicRack) return;

                // Nếu số lượng thay đổi, xếp lại các thùng hàng
                if (rackGroup.userData.count !== logicRack.count) {
                    rackGroup.userData.count = logicRack.count;
                    const container = rackGroup.userData.boxesContainer;
                    container.innerHTML = "";
                    while (container.children.length > 0) {
                        container.remove(container.children[0]);
                    }

                    const boxGeo = new THREE.BoxGeometry(0.65, 0.5, 0.65);
                    const boxMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.5 });

                    for (let i = 0; i < logicRack.count; i++) {
                        const box = new THREE.Mesh(boxGeo, boxMat);
                        const col = i % 2;
                        const row = Math.floor(i / 2);
                        box.position.set(-0.35 + col * 0.7, 0.45 + 0.25 + row * 0.52, 0);
                        container.add(box);
                    }

                    // Cập nhật nhãn nổi
                    const canvas = rackGroup.userData.labelCanvas;
                    const lctx = canvas.getContext("2d");
                    lctx.fillStyle = "#ffffff";
                    lctx.strokeStyle = p.color;
                    lctx.lineWidth = 5;
                    lctx.beginPath();
                    lctx.roundRect(6, 6, 244, 78, 12);
                    lctx.fill();
                    lctx.stroke();
                    lctx.fillStyle = "#0f172a";
                    lctx.font = "bold 26px 'Plus Jakarta Sans', sans-serif";
                    lctx.textAlign = "center";
                    lctx.fillText(p.name, 128, 40);
                    lctx.fillStyle = p.color;
                    lctx.font = "bold 22px 'JetBrains Mono', sans-serif";
                    lctx.fillText(`${logicRack.count}/6 ô`, 128, 68);
                    rackGroup.userData.labelMesh.material.map.needsUpdate = true;
                }
            });
        }

        renderObstacles() {
            const currentKeys = new Set(this.engine.obstacles);

            // Tạo mesh cho vật cản mới
            currentKeys.forEach(k => {
                if (!this.meshes.obstacles[k]) {
                    const [gx, gy] = k.split(",").map(Number);
                    const wPos = this.gridToWorld(gx, gy);

                    const obsGroup = new THREE.Group();
                    obsGroup.position.set(wPos.x, 0.35, wPos.z);

                    // Khối cản màu đỏ an toàn
                    const obsMesh = new THREE.Mesh(
                        new THREE.BoxGeometry(0.85, 0.7, 0.85),
                        new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.4 })
                    );
                    obsGroup.add(obsMesh);

                    // Sọc cảnh báo vàng
                    const stripeMesh = new THREE.Mesh(
                        new THREE.BoxGeometry(0.87, 0.15, 0.87),
                        new THREE.MeshBasicMaterial({ color: 0xfacc15 })
                    );
                    stripeMesh.position.y = 0.1;
                    obsGroup.add(stripeMesh);

                    this.scene.add(obsGroup);
                    this.meshes.obstacles[k] = obsGroup;
                }
            });

            // Xóa vật cản đã gỡ
            for (let k in this.meshes.obstacles) {
                if (!currentKeys.has(k)) {
                    this.scene.remove(this.meshes.obstacles[k]);
                    delete this.meshes.obstacles[k];
                }
            }
        }

        updateHUD() {
            // Chỉ số KPI
            const processedEl = document.getElementById("hud-processed");
            if (processedEl) processedEl.textContent = this.engine.totalProcessed;

            const waitingEl = document.getElementById("hud-waiting");
            if (waitingEl) waitingEl.textContent = this.engine.packages.length;

            const accEl = document.getElementById("hud-accuracy");
            if (accEl) {
                const avg = this.engine.totalConfScanned > 0 ? (this.engine.totalConfidenceSum / this.engine.totalConfScanned * 100).toFixed(1) : "98.4";
                accEl.textContent = `${avg}%`;
            }

            // Trạng thái 3 AMR
            this.engine.amrs.forEach((a, idx) => {
                const stEl = document.getElementById(`hud-amr-state-${idx + 1}`);
                if (stEl) {
                    const stMap = {
                        "IDLE": "Rảnh (Chờ máng)",
                        "GOING_TO_PICK": "Đi nhận hàng",
                        "PICKING": "Đang bốc hàng",
                        "DELIVERING": "Vận chuyển A*",
                        "UNLOADING": "Đang đặt lên kệ",
                        "RETURNING": "Quay về điểm chờ"
                    };
                    stEl.textContent = stMap[a.state] || a.state;
                }
            });

            // Dòng sự kiện trực tiếp 7 mục gần nhất
            const logContainer = document.getElementById("hud-event-logs");
            if (logContainer) {
                const logs7 = this.engine.events.slice(0, 7);
                logContainer.innerHTML = logs7.map(e => `
                    <div class="hud-log-row log-${e.type.toLowerCase()}">
                        <span class="log-time">${e.time}</span>
                        <span class="log-text">${e.text}</span>
                    </div>
                `).join("");
            }
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

            // Click chuột lên sàn để Đặt / Gỡ vật cản A* (Raycast y=0)
            this.renderer.domElement.addEventListener("pointerdown", (event) => {
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
                this.camera.position.set(0, 26, 26);
                this.camera.lookAt(0, 0, 0);
                if (this.controls) this.controls.target.set(0, 0, 0);
            } else if (mode === "top") {
                this.camera.position.set(0, 34, 0.1);
                this.camera.lookAt(0, 0, 0);
                if (this.controls) this.controls.target.set(0, 0, 0);
            }
        }
    }

    window.SimulationRenderer3D = SimulationRenderer3D;
})(window);

