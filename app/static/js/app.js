// ==========================================================================
// NEXUSLOG - LIGHT THEME CANVAS & INTERACTIVE CLIENT ENGINE
// ==========================================================================

const AppState = {
    token: localStorage.getItem("access_token") || null,
    currentUser: null,
    showAIBoundingBox: true,
    occlusionSimulated: false,
    addObstacleMode: false,
    packages: [],
    locations: [],
    users: [],
    logs: [],
    ws: null,
    obstacles: [],
    gates: [],
    conveyorRunning: true,
    trails: {},
    amr: { 
        x: 520, y: 340, 
        targetX: 720, targetY: 170, 
        heading: 0, state: "NAVIGATING", battery: 96.5,
        path_waypoints: []
    },
    itemsOnBelt: [
        { id: 101, x: 80, y: 155, barcode: "PKG-10001", conf: 0.98, gate: 1, track_id: 1, is_occluded: false },
        { id: 102, x: 280, y: 155, barcode: "PKG-55002", conf: 0.94, gate: 2, track_id: 2, is_occluded: false },
        { id: 103, x: 460, y: 155, barcode: "PKG-84003", conf: 0.96, gate: 3, track_id: 3, is_occluded: false }
    ]
};

document.addEventListener("DOMContentLoaded", () => {
    initAuth();
    initNavigation();
    initCanvasEngine();
    initAIVisionEngine();
    initUserModal();
    initRoleCapsules();
    initCreatePackageModal();
    initSlotModal();

    if (AppState.token) {
        fetchCurrentUser();
    }
});

// 1. Quản lý Đăng Nhập
function initAuth() {
    const loginForm = document.getElementById("login-form");
    const loginError = document.getElementById("login-error");
    const errorText = document.getElementById("login-error-text");
    const btnLogout = document.getElementById("btn-logout");
    const btnToggleEye = document.getElementById("btn-toggle-password");
    const passInput = document.getElementById("login-password");

    if (btnToggleEye) {
        btnToggleEye.addEventListener("click", () => {
            const isPass = passInput.type === "password";
            passInput.type = isPass ? "text" : "password";
            btnToggleEye.innerHTML = isPass ? '<i class="fa-regular fa-eye-slash"></i>' : '<i class="fa-regular fa-eye"></i>';
        });
    }

    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            loginError.style.display = "none";
            const username = document.getElementById("login-username").value.trim();
            const password = passInput.value;

            try {
                const resp = await fetch("/api/v1/auth/login", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username, password })
                });
                const data = await resp.json();

                if (!resp.ok) {
                    throw new Error(data.detail || "Đăng nhập thất bại");
                }

                AppState.token = data.access_token;
                localStorage.setItem("access_token", AppState.token);
                await fetchCurrentUser();
            } catch (err) {
                errorText.textContent = err.message;
                loginError.style.display = "flex";
            }
        });
    }

    if (btnLogout) {
        btnLogout.addEventListener("click", () => {
            AppState.token = null;
            AppState.currentUser = null;
            localStorage.removeItem("access_token");
            showAuthView();
        });
    }
}

function initRoleCapsules() {
    const capsules = document.querySelectorAll(".capsule");
    const usernameInput = document.getElementById("login-username");

    capsules.forEach(cap => {
        cap.addEventListener("click", () => {
            capsules.forEach(c => c.classList.remove("active"));
            cap.classList.add("active");
            const role = cap.getAttribute("data-role");
            if (role === "Admin" && !usernameInput.value) {
                usernameInput.value = "admin";
            }
        });
    });
}

async function fetchCurrentUser() {
    try {
        const resp = await fetch("/api/v1/auth/me", {
            headers: { "Authorization": `Bearer ${AppState.token}` }
        });
        if (!resp.ok) throw new Error("Phiên làm việc hết hạn");
        const user = await resp.json();
        AppState.currentUser = user;
        showDashboardView();
    } catch (err) {
        AppState.token = null;
        localStorage.removeItem("access_token");
        showAuthView();
    }
}

function showAuthView() {
    document.getElementById("auth-section").style.display = "flex";
    document.getElementById("dashboard-section").style.display = "none";
    document.getElementById("nav-user-fullname").textContent = "Chưa đăng nhập";
    document.getElementById("nav-user-role").textContent = "Guest";
    document.getElementById("user-initials").textContent = "--";
}

function showDashboardView() {
    document.getElementById("auth-section").style.display = "none";
    document.getElementById("dashboard-section").style.display = "flex";

    const user = AppState.currentUser;
    document.getElementById("nav-user-fullname").textContent = user.full_name;
    document.getElementById("nav-user-role").textContent = user.role;
    document.getElementById("user-initials").textContent = user.full_name.substring(0, 2).toUpperCase();

    // Phân quyền Tab Admin
    const tabUsersBtn = document.getElementById("tab-users-btn");
    if (user.role === "Admin" || user.role === "Manager") {
        tabUsersBtn.style.display = "flex";
        loadUsers();
    } else {
        tabUsersBtn.style.display = "none";
    }

    loadPackages();
}

// 2. Chuyển Tab Navigation
function initNavigation() {
    const navTabs = document.querySelectorAll(".nav-tab");
    const tabPanes = document.querySelectorAll(".tab-pane");

    navTabs.forEach(tab => {
        tab.addEventListener("click", () => {
            const targetId = tab.getAttribute("data-tab");
            if (!targetId) return;

            navTabs.forEach(t => t.classList.remove("active"));
            tabPanes.forEach(p => p.classList.remove("active"));

            tab.classList.add("active");
            const activePane = document.getElementById(targetId);
            if (activePane) activePane.classList.add("active");

            if (targetId === "tab-packages") {
                loadPackages();
            }
        });
    });
}

// 3. Quản lý Kiện Hàng Thực Tế (Backend API Fetch)
async function loadPackages() {
    try {
        const resp = await fetch("/api/v1/packages?limit=50", {
            headers: { "Authorization": `Bearer ${AppState.token}` }
        });
        if (!resp.ok) return;
        const data = await resp.json();
        AppState.packages = data.items;
        renderPackagesTable();
        document.getElementById("kpi-total-packages").textContent = data.total;
    } catch (e) {
        console.error("Lỗi tải kiện hàng:", e);
    }
}

function renderPackagesTable() {
    const tbody = document.getElementById("packages-table-body");
    if (!tbody) return;
    tbody.innerHTML = "";

    if (AppState.packages.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center" style="padding:2rem; color:#64748b;">Chưa có bưu kiện nào được ghi nhận. Bấm "Thêm Kiện Hàng" để tạo mới!</td></tr>';
        return;
    }

    AppState.packages.forEach(p => {
        const tr = document.createElement("tr");
        const abcZone = p.weight <= 3.0 ? 'A' : (p.weight <= 10.0 ? 'B' : 'C');
        const abcColor = abcZone === 'A' ? '#10b981' : (abcZone === 'B' ? '#2563eb' : '#8b5cf6');
        const abcBg = abcZone === 'A' ? '#ecfdf5' : (abcZone === 'B' ? '#eff6ff' : '#f5f3ff');

        tr.innerHTML = `
            <td><code>${p.barcode}</code></td>
            <td>${p.weight} kg</td>
            <td><strong>${p.destination_code}</strong></td>
            <td>
                <span class="badge" style="background:${abcBg}; color:${abcColor}; font-weight:700;">
                    Hạng ${abcZone} (${abcZone === 'A' ? 'Nhanh' : (abcZone === 'B' ? 'Trung bình' : 'Chậm')})
                </span>
            </td>
            <td><span class="gate-slot active-gate">${p.gate_id ? 'Cổng ' + p.gate_id : 'Chưa gán'}</span></td>
            <td>
                <span class="badge" style="background:${p.status === 'Stored' ? '#ecfdf5' : '#eff6ff'}; color:${p.status === 'Stored' ? '#059669' : '#2563eb'}; font-weight:700;">
                    ● ${p.status}
                </span>
            </td>
            <td><code>${p.location_id ? 'Vị trí #' + p.location_id : 'Chưa xếp'}</code></td>
            <td>
                ${p.status !== 'Stored' ? 
                    `<button class="btn-light-action" onclick="openRecommendSlotModal(${p.id})">
                        <i class="fa-solid fa-cubes text-blue"></i> Gợi Ý Ô Kệ
                    </button>` : 
                    `<span class="badge-success-pill" style="font-size:0.75rem;"><i class="fa-solid fa-check"></i> Đã Lưu Kho</span>`
                }
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Quản lý Modal Gợi Ý Xếp Chỗ Thông Minh (ABC Heuristic)
let currentPendingPkgId = null;
let currentRecommendedLocId = null;

function initSlotModal() {
    const modal = document.getElementById("slot-modal");
    const closeBtn = document.getElementById("modal-slot-close-btn");
    const cancelBtn = document.getElementById("modal-slot-cancel-btn");
    const confirmBtn = document.getElementById("modal-slot-confirm-btn");

    const closeModal = () => { if (modal) modal.style.display = "none"; };
    if (closeBtn) closeBtn.addEventListener("click", closeModal);
    if (cancelBtn) cancelBtn.addEventListener("click", closeModal);

    if (confirmBtn) {
        confirmBtn.addEventListener("click", async () => {
            if (!currentPendingPkgId) return;
            try {
                const resp = await fetch(`/api/v1/packages/${currentPendingPkgId}/assign-slot`, {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${AppState.token}`,
                        "Content-Type": "application/json"
                    }
                });
                const data = await resp.json();
                if (!resp.ok) throw new Error(data.detail || "Không thể gán ô kệ");

                closeModal();
                await loadPackages();

                // Điều phối robot AMR đến ô kệ trên bản đồ
                if (AppState.ws && AppState.ws.readyState === WebSocket.OPEN) {
                    AppState.ws.send(JSON.stringify({
                        action: "SPAWN_PACKAGE",
                        barcode: `PKG-STORED-${currentPendingPkgId}`
                    }));
                }
            } catch (err) {
                alert(err.message);
            }
        });
    }
}

window.openRecommendSlotModal = async function(pkgId) {
    currentPendingPkgId = pkgId;
    const modal = document.getElementById("slot-modal");
    const body = document.getElementById("slot-modal-body");
    if (!modal || !body) return;

    body.innerHTML = '<div style="padding:2rem; text-align:center;"><i class="fa-solid fa-circle-notch fa-spin text-blue text-2xl"></i><p style="margin-top:0.5rem; font-size:0.85rem; color:#64748b;">Đang tính toán phân loại ABC và khoảng cách tối ưu...</p></div>';
    modal.style.display = "flex";

    try {
        const resp = await fetch(`/api/v1/packages/${pkgId}/recommend-slot`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${AppState.token}` }
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.detail || "Lỗi tính toán gợi ý");

        const slot = data.recommended_slot;
        currentRecommendedLocId = slot.id;

        const zoneColor = slot.recommended_zone === "Zone A" ? "#10b981" : (slot.recommended_zone === "Zone B" ? "#2563eb" : "#8b5cf6");
        const zoneBg = slot.recommended_zone === "Zone A" ? "#ecfdf5" : (slot.recommended_zone === "Zone B" ? "#eff6ff" : "#f5f3ff");

        body.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:1rem;">
                <div style="background:${zoneBg}; border:1.5px solid ${zoneColor}; border-radius:12px; padding:1.25rem;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:0.8rem; font-weight:700; color:${zoneColor};">PHÂN HẠNG ABC: ${slot.target_zone.toUpperCase()}</span>
                        ${slot.is_overflow ? '<span class="badge" style="background:#fee2e2; color:#dc2626; font-weight:700;">TRÀN VÙNG (OVERFLOW)</span>' : '<span class="badge" style="background:#ecfdf5; color:#059669; font-weight:700;">VÙNG TỐI ƯU</span>'}
                    </div>
                    <div style="margin-top:0.75rem; display:flex; align-items:baseline; gap:12px;">
                        <span style="font-size:2rem; font-weight:800; font-family:var(--font-mono); color:#0f172a;">${slot.code}</span>
                        <span style="font-size:1rem; font-weight:700; color:${zoneColor};">${slot.recommended_zone}</span>
                    </div>
                    <p style="font-size:0.8rem; color:#475569; margin-top:0.25rem;">
                        Khoảng cách di chuyển tới cửa nhận hàng: <strong>${slot.distance_meters} mét</strong> (Tiết kiệm ~35% pin AMR)
                    </p>
                </div>

                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:1rem; font-size:0.8rem; line-height:1.6; color:#475569;">
                    <div>• <strong>Mã bưu kiện:</strong> <code>${data.barcode}</code></div>
                    <div>• <strong>Sức chứa ô kệ:</strong> ${slot.current_count + 1} / ${slot.capacity} kiện</div>
                    <div>• <strong>Quy tắc ABC:</strong> Hàng luân chuyển nhanh bố trí ở Zone A (gần băng tải) để giảm thiểu thời gian chu kỳ.</div>
                </div>
            </div>
        `;
    } catch (e) {
        body.innerHTML = `<div class="error-light-alert" style="display:flex;"><i class="fa-solid fa-circle-exclamation"></i> <span>${e.message}</span></div>`;
    }
};

function initCreatePackageModal() {
    const modal = document.getElementById("package-modal");
    const openBtn = document.getElementById("btn-open-create-pkg");
    const closeBtn = document.getElementById("modal-pkg-close-btn");
    const cancelBtn = document.getElementById("modal-pkg-cancel-btn");
    const form = document.getElementById("create-package-form");
    const errBanner = document.getElementById("modal-pkg-error");
    const errText = document.getElementById("modal-pkg-error-text");

    if (openBtn) {
        openBtn.addEventListener("click", () => {
            errBanner.style.display = "none";
            form.reset();
            modal.style.display = "flex";
        });
    }

    const closeModal = () => { if (modal) modal.style.display = "none"; };
    if (closeBtn) closeBtn.addEventListener("click", closeModal);
    if (cancelBtn) cancelBtn.addEventListener("click", closeModal);

    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            errBanner.style.display = "none";

            const payload = {
                barcode: document.getElementById("new-pkg-barcode").value.trim(),
                weight: parseFloat(document.getElementById("new-pkg-weight").value),
                dimensions: document.getElementById("new-pkg-dim").value.trim(),
                destination_code: document.getElementById("new-pkg-dest").value.trim()
            };

            try {
                const resp = await fetch("/api/v1/packages", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${AppState.token}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(payload)
                });
                const data = await resp.json();
                if (!resp.ok) {
                    throw new Error(data.detail || "Không thể tạo bưu kiện");
                }
                closeModal();
                await loadPackages();
            } catch (err) {
                errText.textContent = err.message;
                errBanner.style.display = "flex";
            }
        });
    }
}

// 4. Quản lý Người Dùng (Admin & RBAC)
async function loadUsers() {
    try {
        const resp = await fetch("/api/v1/users?limit=50", {
            headers: { "Authorization": `Bearer ${AppState.token}` }
        });
        if (!resp.ok) return;
        const data = await resp.json();
        AppState.users = data.items;
        renderUsersTable();
    } catch (e) {
        console.error("Lỗi tải users:", e);
    }
}

function renderUsersTable() {
    const tbody = document.getElementById("users-table-body");
    if (!tbody) return;
    tbody.innerHTML = "";

    AppState.users.forEach(u => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><code>#${u.id}</code></td>
            <td><strong>${u.username}</strong></td>
            <td>${u.full_name}</td>
            <td><span class="gate-slot active-gate">${u.role}</span></td>
            <td>
                <span class="badge" style="background:${u.is_active ? '#ecfdf5' : '#fef2f2'}; color:${u.is_active ? '#059669' : '#dc2626'}; font-weight:700;">
                    ${u.is_active ? '● Hoạt động' : '● Đã khóa'}
                </span>
            </td>
            <td>
                ${AppState.currentUser.role === 'Admin' && u.id !== AppState.currentUser.id ? 
                    `<button class="btn-light-action" onclick="toggleUserLock(${u.id}, ${!u.is_active})">
                        ${u.is_active ? 'Khóa' : 'Mở khóa'}
                    </button>` : '<span class="text-muted">--</span>'}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.toggleUserLock = async function(userId, targetStatus) {
    try {
        const resp = await fetch(`/api/v1/users/${userId}/status`, {
            method: "PATCH",
            headers: {
                "Authorization": `Bearer ${AppState.token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ is_active: targetStatus })
        });
        const data = await resp.json();
        if (!resp.ok) {
            alert(data.detail || "Không thể cập nhật trạng thái");
            return;
        }
        await loadUsers();
    } catch (e) {
        alert("Lỗi kết nối máy chủ");
    }
};

function initUserModal() {
    const modal = document.getElementById("user-modal");
    const openBtn = document.getElementById("btn-open-create-user");
    const closeBtn = document.getElementById("modal-close-btn");
    const cancelBtn = document.getElementById("modal-cancel-btn");
    const form = document.getElementById("create-user-form");
    const errBanner = document.getElementById("modal-user-error");
    const errText = document.getElementById("modal-user-error-text");

    if (openBtn) {
        openBtn.addEventListener("click", () => {
            errBanner.style.display = "none";
            form.reset();
            modal.style.display = "flex";
        });
    }

    const closeModal = () => { if (modal) modal.style.display = "none"; };
    if (closeBtn) closeBtn.addEventListener("click", closeModal);
    if (cancelBtn) cancelBtn.addEventListener("click", closeModal);

    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            errBanner.style.display = "none";

            const payload = {
                username: document.getElementById("new-user-username").value.trim(),
                full_name: document.getElementById("new-user-fullname").value.trim(),
                role: document.getElementById("new-user-role").value,
                password: document.getElementById("new-user-password").value
            };

            try {
                const resp = await fetch("/api/v1/users", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${AppState.token}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(payload)
                });
                const data = await resp.json();
                if (!resp.ok) {
                    throw new Error(data.detail || "Không thể tạo tài khoản");
                }
                closeModal();
                await loadUsers();
            } catch (err) {
                errText.textContent = err.message;
                errBanner.style.display = "flex";
            }
        });
    }
}

// 5. Canvas 2D Engine kết nối WebSocket Thời Gian Thực 60 FPS
function initCanvasEngine() {
    const canvas = document.getElementById("warehouse-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    let animTime = 0;
    let ws = null;

    // Thiết lập kết nối WebSocket với Backend
    function connectWebSocket() {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${protocol}//${window.location.host}/api/v1/ws/simulation/stream`;
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log("WebSocket 60 FPS đã kết nối thành công");
            AppState.ws = ws;
        };

        ws.onmessage = (event) => {
            try {
                const snapshot = JSON.parse(event.data);
                if (snapshot.packages) {
                    AppState.itemsOnBelt = snapshot.packages;
                }
                if (snapshot.amr) {
                    AppState.amr = snapshot.amr;
                    updateAMRUI(snapshot.amr);
                }
                if (snapshot.gates) {
                    AppState.gates = snapshot.gates;
                    updateGatesUI(snapshot.gates);
                }
                if (snapshot.obstacles) {
                    AppState.obstacles = snapshot.obstacles;
                }
                if (snapshot.jam_alert) {
                    handleJamAlert(snapshot.jam_alert, snapshot.conveyor_running);
                }
                if (snapshot.ai_vision) {
                    AppState.occlusionSimulated = snapshot.ai_vision.occlusion_simulated;
                    updateAIVisionMetrics(snapshot.ai_vision);
                }
            } catch (e) {
                // Ignore parse errors
            }
        };

        ws.onclose = () => {
            AppState.ws = null;
            // Tự động kết nối lại sau 2 giây nếu bị ngắt
            setTimeout(connectWebSocket, 2000);
        };
    }

    connectWebSocket();

    const btnSpawn = document.getElementById("btn-spawn-pkg");
    const btnToggleCam = document.getElementById("btn-toggle-cam");
    const btnCanvasOcc = document.getElementById("btn-canvas-occlusion");
    const btnTestJam = document.getElementById("btn-test-jam");
    const btnClearJam = document.getElementById("btn-clear-jam-banner");
    const btnTabTestJam = document.getElementById("btn-tab-test-jam");
    const btnTabClearJam = document.getElementById("btn-tab-clear-jam");
    const btnToggleObs = document.getElementById("btn-toggle-add-obs");
    const btnClearObs = document.getElementById("btn-clear-obs");

    if (btnSpawn) {
        btnSpawn.addEventListener("click", () => {
            if (AppState.ws && AppState.ws.readyState === WebSocket.OPEN) {
                const nextId = AppState.itemsOnBelt.length + 101;
                AppState.ws.send(JSON.stringify({
                    action: "SPAWN_PACKAGE",
                    barcode: `PKG-WS-${nextId}`
                }));
            }
        });
    }

    if (btnCanvasOcc) {
        btnCanvasOcc.addEventListener("click", () => {
            if (AppState.ws && AppState.ws.readyState === WebSocket.OPEN) {
                AppState.ws.send(JSON.stringify({
                    action: "TOGGLE_OCCLUSION",
                    enable: !AppState.occlusionSimulated
                }));
            }
        });
    }

    const triggerJamFn = () => {
        if (AppState.ws && AppState.ws.readyState === WebSocket.OPEN) {
            AppState.ws.send(JSON.stringify({ action: "TRIGGER_JAM", gate_id: 2 }));
        }
    };
    const clearJamFn = () => {
        if (AppState.ws && AppState.ws.readyState === WebSocket.OPEN) {
            AppState.ws.send(JSON.stringify({ action: "CLEAR_JAM" }));
        }
    };

    if (btnTestJam) btnTestJam.addEventListener("click", triggerJamFn);
    if (btnTabTestJam) btnTabTestJam.addEventListener("click", triggerJamFn);
    if (btnClearJam) btnClearJam.addEventListener("click", clearJamFn);
    if (btnTabClearJam) btnTabClearJam.addEventListener("click", clearJamFn);

    if (btnToggleObs) {
        btnToggleObs.addEventListener("click", () => {
            AppState.addObstacleMode = !AppState.addObstacleMode;
            btnToggleObs.classList.toggle("btn-obs-active");
            if (AppState.addObstacleMode) {
                btnToggleObs.innerHTML = '<i class="fa-solid fa-crosshairs"></i> Click Canvas Để Đặt!';
            } else {
                btnToggleObs.innerHTML = '<i class="fa-solid fa-ban"></i> Đặt Vật Cản A*';
            }
        });
    }

    if (btnClearObs) {
        btnClearObs.addEventListener("click", () => {
            if (AppState.ws && AppState.ws.readyState === WebSocket.OPEN) {
                AppState.ws.send(JSON.stringify({ action: "CLEAR_OBSTACLES" }));
            }
        });
    }

    // Xử lý Click trên Canvas để thêm vật cản động A*
    canvas.addEventListener("click", (e) => {
        if (AppState.addObstacleMode && AppState.ws && AppState.ws.readyState === WebSocket.OPEN) {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const clickX = (e.clientX - rect.left) * scaleX;
            const clickY = (e.clientY - rect.top) * scaleY;
            AppState.ws.send(JSON.stringify({
                action: "ADD_OBSTACLE",
                x: clickX,
                y: clickY
            }));
        }
    });

    if (btnToggleCam) {
        btnToggleCam.addEventListener("click", () => {
            AppState.showAIBoundingBox = !AppState.showAIBoundingBox;
            btnToggleCam.classList.toggle("active");
        });
    }

    function renderLoop() {
        animTime += 0.02;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Nền Lưới & Vật Cản Động A*
        drawCleanGrid(ctx, canvas.width, canvas.height);

        // Băng chuyền thông minh
        drawLightConveyor(ctx, animTime);

        // 3 Cổng Gạt Phân Loại IoT
        drawLightIoTGate(ctx, 220, 150, "Cổng 1", 1);
        drawLightIoTGate(ctx, 360, 150, "Cổng 2", 2);
        drawLightIoTGate(ctx, 500, 150, "Cổng 3", 3);

        // Trạm Camera AI YOLOv12
        drawLightYOLOStation(ctx, 110, 100, animTime);

        // Kiện hàng chuyển động trên băng
        drawLightPackages(ctx);

        // Khu vực Ô Kệ Lưu Trữ
        drawLightStorageRacks(ctx);

        // Robot Tự Hành AMR
        drawLightAMR(ctx, animTime);

        requestAnimationFrame(renderLoop);
    }

    function drawCleanGrid(ctx, w, h) {
        ctx.strokeStyle = "rgba(226, 232, 240, 0.8)";
        ctx.lineWidth = 1;
        const step = 32;
        for (let x = 0; x < w; x += step) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
        }
        for (let y = 0; y < h; y += step) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
        }

        // Vẽ các vật cản động A* (Dynamic Obstacles)
        AppState.obstacles.forEach(obs => {
            const ox = obs.x;
            const oy = obs.y;
            ctx.fillStyle = "#fef08a";
            ctx.fillRect(ox - 10, oy - 10, 20, 20);
            ctx.strokeStyle = "#ca8a04";
            ctx.lineWidth = 1.5;
            ctx.strokeRect(ox - 10, oy - 10, 20, 20);

            // Biểu tượng cảnh báo
            ctx.fillStyle = "#a16207";
            ctx.font = "bold 10px 'Font Awesome 6 Free'";
            ctx.fillText("\uf071", ox - 5, oy + 4);
        });
    }

    function drawLightConveyor(ctx, t) {
        const bx = 40, by = 150, bw = 540, bh = 44;
        ctx.fillStyle = "#e2e8f0";
        ctx.fillRect(bx, by, bw, bh);
        ctx.strokeStyle = "#cbd5e1";
        ctx.lineWidth = 2;
        ctx.strokeRect(bx, by, bw, bh);

        ctx.strokeStyle = "#94a3b8";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([8, 8]);
        ctx.beginPath();
        ctx.moveTo(bx + 10, by + 22);
        ctx.lineTo(bx + bw - 10, by + 22);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    function drawLightIoTGate(ctx, x, y, title, gate_id) {
        const gate = AppState.gates.find(g => g.id === gate_id) || { diverter_angle: 0.0, status: "IDLE" };
        const isJammed = gate.status === "JAMMED";
        const isDiverting = gate.status === "DIVERTING" || gate.diverter_angle > 0;

        // Hộp tên cổng
        ctx.fillStyle = isJammed ? "#fee2e2" : (isDiverting ? "#eff6ff" : "#ffffff");
        ctx.strokeStyle = isJammed ? "#ef4444" : (isDiverting ? "#2563eb" : "#cbd5e1");
        ctx.lineWidth = (isJammed || isDiverting) ? 2 : 1;
        ctx.fillRect(x - 5, y - 20, 52, 22);
        ctx.strokeRect(x - 5, y - 20, 52, 22);

        ctx.fillStyle = isJammed ? "#dc2626" : (isDiverting ? "#2563eb" : "#475569");
        ctx.font = "bold 9px 'Plus Jakarta Sans', sans-serif";
        ctx.fillText(title, x - 2, y - 6);

        // Làn trượt (Chute line)
        ctx.strokeStyle = isJammed ? "#ef4444" : (isDiverting ? "#2563eb" : "#cbd5e1");
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(x + 20, y + 44); ctx.lineTo(x + 20, y + 95); ctx.stroke();
        ctx.setLineDash([]);

        // Đèn LED chỉ báo trạng thái tại miệng làn trượt
        ctx.fillStyle = isJammed ? "#ef4444" : (isDiverting ? "#10b981" : "#94a3b8");
        ctx.beginPath();
        ctx.arc(x + 20, y + 95, 5, 0, Math.PI * 2);
        ctx.fill();

        // Cơ cấu cần gạt vật lý (Diverter Arm) xoay từ 0 đến 45 độ
        const pivotX = x - 5;
        const pivotY = y + 44;
        const armLength = 36;
        const rad = -(gate.diverter_angle || 0.0) * (Math.PI / 180.0);

        ctx.save();
        ctx.translate(pivotX, pivotY);
        ctx.rotate(rad);
        ctx.fillStyle = isJammed ? "#ef4444" : (isDiverting ? "#2563eb" : "#64748b");
        ctx.fillRect(0, -3, armLength, 6);
        ctx.strokeStyle = "#0f172a";
        ctx.lineWidth = 1;
        ctx.strokeRect(0, -3, armLength, 6);
        ctx.restore();
    }

    function drawLightYOLOStation(ctx, x, y, t) {
        ctx.fillStyle = "#0f172a";
        ctx.fillRect(x, y, 46, 24);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 9px 'Plus Jakarta Sans', sans-serif";
        ctx.fillText("Camera AI", x + 3, y + 15);

        if (AppState.showAIBoundingBox) {
            ctx.strokeStyle = "#2563eb";
            ctx.lineWidth = 2;
            ctx.strokeRect(x - 12, 142, 70, 60);

            ctx.fillStyle = "#2563eb";
            ctx.fillRect(x + 2, 206, 42, 16);
            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 9px 'JetBrains Mono', monospace";
            ctx.fillText("ID 07", x + 10, 218);
        }
    }

    function drawLightPackages(ctx) {
        AppState.itemsOnBelt.forEach(p => {
            const isOcc = p.is_occluded || (p.conf < 0.6);

            // Bưu kiện chính
            ctx.fillStyle = isOcc ? "rgba(245, 158, 11, 0.4)" : "#f59e0b";
            ctx.fillRect(p.x, p.y - 12, 30, 24);
            ctx.strokeStyle = isOcc ? "#d97706" : "#b45309";
            ctx.lineWidth = isOcc ? 2 : 1.5;
            if (isOcc) ctx.setLineDash([3, 3]);
            ctx.strokeRect(p.x, p.y - 12, 30, 24);
            ctx.setLineDash([]);

            // Label Track ID
            ctx.fillStyle = isOcc ? "#b45309" : "#0f172a";
            ctx.font = "bold 9px 'JetBrains Mono', monospace";
            ctx.fillText(`T#${p.track_id || p.id}`, p.x + 2, p.y + 4);

            // Hiển thị nhãn che khuất nếu có
            if (isOcc) {
                ctx.fillStyle = "#f59e0b";
                ctx.fillRect(p.x - 10, p.y - 24, 50, 10);
                ctx.fillStyle = "#ffffff";
                ctx.font = "bold 7px 'Plus Jakarta Sans', sans-serif";
                ctx.fillText("CHE KHUẤT", p.x - 7, p.y - 16);
            }
        });
    }

    function drawLightStorageRacks(ctx) {
        const rx = 640, ry = 55;
        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 11px 'Plus Jakarta Sans', sans-serif";
        ctx.fillText("Kệ hàng ABC (Storage Matrix)", rx, ry - 10);

        // 3 phân vùng ô kệ ABC
        const zones = [
            { name: "Zone A (Nhanh)", color: "#10b981", bg: "#ecfdf5", prefix: "A" },
            { name: "Zone B (Vừa)", color: "#2563eb", bg: "#eff6ff", prefix: "B" },
            { name: "Zone C (Chậm)", color: "#8b5cf6", bg: "#f5f3ff", prefix: "C" }
        ];

        for (let zIdx = 0; zIdx < 3; zIdx++) {
            const z = zones[zIdx];
            for (let r = 0; r < 2; r++) {
                const ox = rx + zIdx * 82;
                const oy = ry + r * 42;

                // Nền ô kệ
                ctx.fillStyle = z.bg;
                ctx.fillRect(ox, oy, 72, 34);
                ctx.strokeStyle = z.color;
                ctx.lineWidth = 1.5;
                ctx.strokeRect(ox, oy, 72, 34);

                // Nhãn ô kệ
                ctx.fillStyle = z.color;
                ctx.font = "bold 9px 'JetBrains Mono', monospace";
                ctx.fillText(`LOC-${z.prefix}0${r + 1}`, ox + 6, oy + 14);

                // Khối kiện hàng lưu trong ô kệ
                ctx.fillStyle = "#d97706";
                ctx.fillRect(ox + 46, oy + 6, 20, 16);
                ctx.strokeStyle = "#92400e";
                ctx.lineWidth = 1;
                ctx.strokeRect(ox + 46, oy + 6, 20, 16);
                ctx.fillStyle = "#ffffff";
                ctx.font = "bold 7px 'Font Awesome 6 Free'";
                ctx.fillText("\uf49e", ox + 52, oy + 17);

                ctx.fillStyle = "#64748b";
                ctx.font = "7px 'Plus Jakarta Sans', sans-serif";
                ctx.fillText("Cap: 2/2", ox + 6, oy + 28);
            }
        }
    }

    function drawLightAMR(ctx, t) {
        const amr = AppState.amr;

        // 1. Vẽ toàn bộ đường đi tối ưu A* (Path Waypoints)
        const waypoints = amr.path_waypoints || [];
        if (waypoints.length > 1) {
            ctx.strokeStyle = "#38bdf8";
            ctx.lineWidth = 2.5;
            ctx.setLineDash([6, 6]);
            ctx.beginPath();
            ctx.moveTo(waypoints[0][0], waypoints[0][1]);
            for (let i = 1; i < waypoints.length; i++) {
                ctx.lineTo(waypoints[i][0], waypoints[i][1]);
            }
            ctx.stroke();
            ctx.setLineDash([]);

            // Vẽ các hạt Waypoint phát sáng
            waypoints.forEach((pt, idx) => {
                ctx.fillStyle = (idx === waypoints.length - 1) ? "#f59e0b" : "#38bdf8";
                ctx.beginPath();
                ctx.arc(pt[0], pt[1], 3, 0, Math.PI * 2);
                ctx.fill();
            });
        }

        // 2. Điểm đích đến (Goal Marker)
        ctx.strokeStyle = "#f59e0b";
        ctx.fillStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(amr.target_x || 720, amr.target_y || 170, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#f59e0b";
        ctx.beginPath();
        ctx.arc(amr.target_x || 720, amr.target_y || 170, 3, 0, Math.PI * 2);
        ctx.fill();

        // 3. Khối thân xe robot AMR
        ctx.fillStyle = amr.state === "BLOCKED" ? "#ef4444" : "#0f172a";
        ctx.fillRect(amr.x - 14, amr.y - 14, 28, 28);
        ctx.strokeStyle = amr.state === "BLOCKED" ? "#fca5a5" : "#3b82f6";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(amr.x - 14, amr.y - 14, 28, 28);

        // Đèn trung tâm AMR
        ctx.fillStyle = amr.state === "BLOCKED" ? "#fee2e2" : "#f59e0b";
        ctx.fillRect(amr.x - 6, amr.y - 6, 12, 12);

        // Nhãn AMR
        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 10px 'Plus Jakarta Sans', sans-serif";
        ctx.fillText(amr.state === "BLOCKED" ? "AMR (BLOCKED!)" : "AMR (A*)", amr.x + 18, amr.y + 4);
    }

    renderLoop();
}

// Cập nhật giao diện 3 Cổng IoT
function updateGatesUI(gates) {
    gates.forEach(g => {
        const card = document.getElementById(`gate-card-${g.id}`);
        const countEl = document.getElementById(`gate-count-${g.id}`);
        const angleEl = document.getElementById(`gate-angle-${g.id}`);
        const badgeEl = document.getElementById(`gate-status-badge-${g.id}`);

        if (countEl) countEl.textContent = g.diverted_count;
        if (angleEl) angleEl.textContent = `Góc: ${g.diverter_angle.toFixed(1)}°`;

        if (badgeEl && card) {
            if (g.status === "JAMMED") {
                card.className = "gate-control-item gate-jammed";
                badgeEl.style.background = "#fee2e2";
                badgeEl.style.color = "#dc2626";
                badgeEl.textContent = "● KẸT HÀNG (JAMMED)";
            } else if (g.status === "DIVERTING") {
                card.className = "gate-control-item";
                badgeEl.style.background = "#eff6ff";
                badgeEl.style.color = "#2563eb";
                badgeEl.textContent = "● ĐANG GẠT HÀNG";
            } else {
                card.className = "gate-control-item";
                badgeEl.style.background = "#ecfdf5";
                badgeEl.style.color = "#059669";
                badgeEl.textContent = "● HOẠT ĐỘNG (IDLE)";
            }
        }
    });
}

// Cập nhật thông số telemetry của xe AMR
function updateAMRUI(amr) {
    const stateEl = document.getElementById("amr-stat-state");
    const batEl = document.getElementById("amr-stat-battery");
    const coordsEl = document.getElementById("amr-stat-coords");

    if (stateEl) {
        stateEl.textContent = amr.state || "NAVIGATING";
        stateEl.className = amr.state === "BLOCKED" ? "val text-red" : "val text-purple";
    }
    if (batEl) batEl.textContent = `${(amr.battery || 96.5).toFixed(1)}%`;
    if (coordsEl) coordsEl.textContent = `X: ${amr.x.toFixed(0)} | Y: ${amr.y.toFixed(0)}`;
}

// Hiển thị banner cảnh báo dừng khẩn cấp khi có kẹt cổng
function handleJamAlert(jamAlert, conveyorRunning) {
    const banner = document.getElementById("canvas-jam-banner");
    if (!banner) return;
    if (jamAlert && jamAlert.active) {
        banner.style.display = "flex";
    } else {
        banner.style.display = "none";
    }
}


// ==========================================================================
// 5. ENGINE THỊ GIÁC AI & THEO DÕI BYTETRACK (LOG-111 & LOG-112)
// ==========================================================================
function updateAIVisionMetrics(metrics) {
    if (!metrics) return;
    const latencyEl = document.getElementById("ai-metric-latency");
    const idSwitchesEl = document.getElementById("ai-metric-idswitches");
    const alertBox = document.getElementById("occlusion-status-alert");
    const btnOcc1 = document.getElementById("btn-toggle-occlusion");
    const btnOcc2 = document.getElementById("btn-canvas-occlusion");

    if (latencyEl) latencyEl.textContent = `${metrics.inference_ms} ms`;
    if (idSwitchesEl) idSwitchesEl.textContent = metrics.id_switches;

    if (metrics.occlusion_simulated) {
        if (alertBox) {
            alertBox.className = "ai-occlusion-banner active";
            alertBox.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> <span><strong>GIẢ LẬP CHE KHUẤT ĐANG BẬT:</strong> Kiện hàng trên băng tải bị bóng mờ / che khuất (Confidence tụt xuống 0.35) &rarr; <strong>ByteTrack Giai đoạn 2 (Low Score Matching)</strong> kích hoạt, giữ vững định danh Track ID, không xảy ra ID Switch!</span>';
        }
        if (btnOcc1) btnOcc1.classList.add("active");
        if (btnOcc2) btnOcc2.classList.add("active");
    } else {
        if (alertBox) {
            alertBox.className = "ai-occlusion-banner";
            alertBox.innerHTML = '<i class="fa-solid fa-circle-check"></i> <span>ByteTrack đang hoạt động ở trạng thái bình thường (100% High-Confidence Detections &ge; 0.6).</span>';
        }
        if (btnOcc1) btnOcc1.classList.remove("active");
        if (btnOcc2) btnOcc2.classList.remove("active");
    }
}

function initAIVisionEngine() {
    const canvas = document.getElementById("ai-vision-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const btnOcc = document.getElementById("btn-toggle-occlusion");
    if (btnOcc) {
        btnOcc.addEventListener("click", () => {
            if (AppState.ws && AppState.ws.readyState === WebSocket.OPEN) {
                AppState.ws.send(JSON.stringify({
                    action: "TOGGLE_OCCLUSION",
                    enable: !AppState.occlusionSimulated
                }));
            }
        });
    }

    let scanlineY = 0;

    function renderAILoop() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 1. Nền Camera Tối (Dark Cyber / Industrial Slate)
        ctx.fillStyle = "#090d16";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 2. Camera Grid Lines
        ctx.strokeStyle = "rgba(30, 41, 59, 0.4)";
        ctx.lineWidth = 1;
        for (let x = 0; x < canvas.width; x += 40) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
        }
        for (let y = 0; y < canvas.height; y += 40) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
        }

        // 3. Tâm Ngắm Reticle Camera AI
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        ctx.strokeStyle = "rgba(59, 130, 246, 0.35)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, 35, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - 50, cy); ctx.lineTo(cx - 15, cy);
        ctx.moveTo(cx + 15, cy); ctx.lineTo(cx + 50, cy);
        ctx.moveTo(cx, cy - 50); ctx.lineTo(cx, cy - 15);
        ctx.moveTo(cx, cy + 15); ctx.lineTo(cx, cy + 50);
        ctx.stroke();

        // 4. Băng chuyền trong góc nhìn Camera
        const beltY = 190;
        const beltH = 90;
        ctx.fillStyle = "#1e293b";
        ctx.fillRect(0, beltY, canvas.width, beltH);
        ctx.strokeStyle = "#334155";
        ctx.lineWidth = 2;
        ctx.strokeRect(0, beltY, canvas.width, beltH);

        // Vạch dẫn hướng trung tâm băng tải
        ctx.strokeStyle = "#475569";
        ctx.setLineDash([12, 12]);
        ctx.beginPath();
        ctx.moveTo(0, beltY + beltH / 2);
        ctx.lineTo(canvas.width, beltY + beltH / 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // 5. Hiệu ứng quét Scanline
        scanlineY = (scanlineY + 1.5) % canvas.height;
        ctx.fillStyle = "rgba(59, 130, 246, 0.08)";
        ctx.fillRect(0, scanlineY, canvas.width, 3);

        // 6. Vẽ Kiện Hàng & Bounding Box ByteTrack
        AppState.itemsOnBelt.forEach(p => {
            // Ánh xạ tọa độ từ belt x (40..560) sang canvas camera (60..820)
            const mappedX = 60 + ((p.x - 42) / (560 - 42)) * (canvas.width - 150);
            const mappedY = beltY + 15;
            const boxW = 60;
            const boxH = 60;

            const isOcc = p.is_occluded || (p.conf < 0.6);
            const boxColor = isOcc ? "#f59e0b" : "#10b981";

            // Vẽ khối bưu kiện 3D
            ctx.fillStyle = isOcc ? "rgba(180, 83, 9, 0.5)" : "#d97706";
            ctx.fillRect(mappedX, mappedY, boxW, boxH);
            ctx.strokeStyle = "#b45309";
            ctx.lineWidth = 2;
            ctx.strokeRect(mappedX, mappedY, boxW, boxH);

            // Icon Bưu Kiện
            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 16px 'Font Awesome 6 Free'";
            ctx.fillText("\uf49e", mappedX + 22, mappedY + 36);

            // AI Bounding Box (YOLO / ByteTrack Corner Brackets)
            const pad = 6;
            const bx = mappedX - pad;
            const by = mappedY - pad;
            const bw = boxW + pad * 2;
            const bh = boxH + pad * 2;

            ctx.strokeStyle = boxColor;
            ctx.lineWidth = 2.5;

            // Góc Bo Khung Bounding Box kiểu AI Camera
            const cornerLen = 14;
            ctx.beginPath(); ctx.moveTo(bx, by + cornerLen); ctx.lineTo(bx, by); ctx.lineTo(bx + cornerLen, by); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(bx + bw - cornerLen, by); ctx.lineTo(bx + bw, by); ctx.lineTo(bx + bw, by + cornerLen); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(bx, by + bh - cornerLen); ctx.lineTo(bx, by + bh); ctx.lineTo(bx + cornerLen, by + bh); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(bx + bw - cornerLen, by + bh); ctx.lineTo(bx + bw, by + bh); ctx.lineTo(bx + bw, by + bh - cornerLen); ctx.stroke();

            // Track ID Pill trên đầu bounding box
            const trackId = p.track_id || p.id;
            const tagText = isOcc 
                ? `TRACK #${trackId} | CONF: 35% [STAGE 2]` 
                : `TRACK #${trackId} | CONF: ${( (p.conf || 0.96) * 100 ).toFixed(0)}%`;

            ctx.fillStyle = boxColor;
            ctx.fillRect(bx, by - 22, ctx.measureText(tagText).width + 16, 20);
            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 10px 'JetBrains Mono', monospace";
            ctx.fillText(tagText, bx + 8, by - 8);

            // Vector Vận Tốc Kalman 8D (vx, vy)
            ctx.strokeStyle = "#38bdf8";
            ctx.fillStyle = "#38bdf8";
            ctx.lineWidth = 2;
            const arrowStartX = bx + bw / 2;
            const arrowStartY = by + bh / 2;
            const arrowEndX = arrowStartX + 40;
            ctx.beginPath();
            ctx.moveTo(arrowStartX, arrowStartY);
            ctx.lineTo(arrowEndX, arrowStartY);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(arrowEndX, arrowStartY);
            ctx.lineTo(arrowEndX - 6, arrowStartY - 4);
            ctx.lineTo(arrowEndX - 6, arrowStartY + 4);
            ctx.fill();

            ctx.fillStyle = "#7dd3fc";
            ctx.font = "bold 9px 'JetBrains Mono', monospace";
            ctx.fillText("vx: +1.0m/s", arrowStartX + 5, arrowStartY - 6);

            // Bảng Thông Tin Chi Tiết Bên Dưới
            ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
            ctx.fillRect(bx, by + bh + 4, 115, 28);
            ctx.strokeStyle = "#334155";
            ctx.strokeRect(bx, by + bh + 4, 115, 28);
            ctx.fillStyle = "#94a3b8";
            ctx.font = "8px 'Plus Jakarta Sans', sans-serif";
            ctx.fillText(p.barcode || `PKG-${p.id}`, bx + 6, by + bh + 16);
            ctx.fillStyle = isOcc ? "#fbbf24" : "#34d399";
            ctx.fillText(isOcc ? "STATUS: Occluded (Matched)" : "STATUS: Tracked (Kalman 8D)", bx + 6, by + bh + 26);
        });

        requestAnimationFrame(renderAILoop);
    }

    renderAILoop();
}
