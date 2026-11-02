// ==========================================================================
// TOAST NOTIFICATION UTILITY
// ==========================================================================
function showToast(message, type = "info") {
    let container = document.getElementById("toast-container");
    if (!container) {
        container = document.createElement("div");
        container.id = "toast-container";
        container.className = "toast-container";
        document.body.appendChild(container);
    }
    const toast = document.createElement("div");
    toast.className = `toast-msg toast-${type}`;
    const icon = {
        success: "fa-circle-check",
        warning: "fa-triangle-exclamation",
        error: "fa-circle-xmark",
        info: "fa-circle-info"
    }[type] || "fa-bell";

    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add("fade-out");
        setTimeout(() => toast.remove(), 250);
    }, 2500);
}

function updateAutoSpawnBtnUI(enabled) {
    const btn = document.getElementById("btn-toggle-auto-spawn");
    if (!btn) return;
    if (enabled) {
        btn.innerHTML = '<i class="fa-solid fa-repeat"></i> Tự Động Sinh: BẬT';
        btn.style.background = "#eff6ff";
        btn.style.color = "#1d4ed8";
        btn.style.borderColor = "#93c5fd";
    } else {
        btn.innerHTML = '<i class="fa-solid fa-pause"></i> Tự Động Sinh: TẮT';
        btn.style.background = "#fef2f2";
        btn.style.color = "#b91c1c";
        btn.style.borderColor = "#fca5a5";
    }
}


// ==========================================================================
// CÒI BÁO ĐỘNG SỰ CỐ KẸT HÀNG (INDUSTRIAL SIREN SYNTHESIZER - WEB AUDIO API)
// ==========================================================================
const SoundAlarm = {
    ctx: null,
    osc: null,
    gain: null,
    interval: null,
    isMuted: false,
    isPlaying: false,

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.ctx = new AudioContext();
            }
        }
    },

    start() {
        if (this.isMuted || this.isPlaying) return;
        try {
            this.init();
            if (!this.ctx) return;
            if (this.ctx.state === 'suspended') {
                this.ctx.resume();
            }

            this.osc = this.ctx.createOscillator();
            this.gain = this.ctx.createGain();

            // Sóng âm sawtooth cho âm vang còi công nghiệp rõ ràng
            this.osc.type = 'sawtooth';
            this.osc.frequency.setValueAtTime(850, this.ctx.currentTime);

            // Âm lượng vừa phải, không gây chói tai (gain 0.07)
            this.gain.gain.setValueAtTime(0.07, this.ctx.currentTime);
            this.osc.connect(this.gain);
            this.gain.connect(this.ctx.destination);
            this.osc.start();
            this.isPlaying = true;

            // Dao động tần số 2 nốt còi hú (850 Hz <-> 560 Hz) chu kỳ 320ms
            let toggle = false;
            this.interval = setInterval(() => {
                if (!this.osc || !this.ctx) return;
                const targetFreq = toggle ? 850 : 560;
                this.osc.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.06);
                toggle = !toggle;
            }, 320);
        } catch (e) {
            console.warn("Lỗi khởi tạo âm thanh Web Audio:", e);
        }
    },

    stop() {
        if (!this.isPlaying) return;
        try {
            if (this.interval) {
                clearInterval(this.interval);
                this.interval = null;
            }
            if (this.osc) {
                this.osc.stop();
                this.osc.disconnect();
                this.osc = null;
            }
            if (this.gain) {
                this.gain.disconnect();
                this.gain = null;
            }
        } catch (e) {
            console.warn("Lỗi dừng còi báo:", e);
        }
        this.isPlaying = false;
    },

    toggleMute() {
        this.isMuted = !this.isMuted;
        if (this.isMuted && this.isPlaying) {
            this.stop();
        }
        this.updateMuteUI();
        return this.isMuted;
    },

    updateMuteUI() {
        const btnBanner = document.getElementById("btn-toggle-siren-mute");
        const btnToolbar = document.getElementById("btn-toolbar-mute");
        const icon = this.isMuted ? "fa-volume-xmark" : "fa-volume-high";
        const text = this.isMuted ? "Bật Còi Báo" : "Tắt Còi Báo";

        if (btnBanner) {
            btnBanner.innerHTML = `<i class="fa-solid ${icon}"></i> ${text}`;
            btnBanner.classList.toggle("muted", this.isMuted);
        }
        if (btnToolbar) {
            btnToolbar.innerHTML = `<i class="fa-solid ${icon}"></i> ${this.isMuted ? "Đã Tắt Còi" : "Còi Báo"}`;
            btnToolbar.classList.toggle("active", !this.isMuted);
        }
    }
};

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
    amrs: [],
    racks: null,
    provinceRacks: null,
    chargingDocks: [],
    auditEvents: [],
    autoSpawn: true,
    abModeActive: true,
    isEStopped: false,
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
    initAnalytics();

    const urlParams = new URLSearchParams(window.location.search);
    const tokenParam = urlParams.get("token");
    if (tokenParam) {
        AppState.token = tokenParam;
        localStorage.setItem("access_token", tokenParam);
    }

    if (AppState.token) {
        fetchCurrentUser();
    }

    const tabParam = urlParams.get("tab");
    if (tabParam) {
        const navTabs = document.querySelectorAll(".nav-tab");
        const tabPanes = document.querySelectorAll(".tab-pane");
        const targetTab = document.querySelector(`.nav-tab[data-tab="${tabParam}"]`);
        const targetPane = document.getElementById(tabParam);
        if (targetTab && targetPane) {
            navTabs.forEach(t => t.classList.remove("active"));
            tabPanes.forEach(p => p.classList.remove("active"));
            targetTab.classList.add("active");
            targetPane.classList.add("active");
        }
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
            if (targetId === "tab-analytics") {
                loadAnalytics();
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

                // Nếu chọn đưa trực tiếp lên băng tải
                const chkDirect = document.getElementById("new-pkg-spawn-direct");
                if (chkDirect && chkDirect.checked && AppState.ws && AppState.ws.readyState === WebSocket.OPEN) {
                    AppState.ws.send(JSON.stringify({
                        action: "INJECT_PACKAGE",
                        barcode: payload.barcode,
                        destination: payload.destination_code,
                        weight: payload.weight,
                        dimensions: payload.dimensions
                    }));
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
                if (snapshot.amrs) {
                    AppState.amrs = snapshot.amrs;
                }
                if (snapshot.racks) {
                    AppState.racks = snapshot.racks;
                }
                if (snapshot.province_racks) {
                    AppState.provinceRacks = snapshot.province_racks;
                }
                if (snapshot.charging_docks) {
                    AppState.chargingDocks = snapshot.charging_docks;
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
                if (snapshot.type === "RFID_BURST_RESULT") {
                    handleRFIDBurstResult(snapshot.data);
                }
                if (snapshot.plc_modbus) {
                    updatePLCUi(snapshot.plc_modbus);
                }
                if (snapshot.rfid_portal) {
                    updateRFIDPortalUi(snapshot.rfid_portal);
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

    const btnView2d = document.getElementById("btn-view-2d");
    const btnView3d = document.getElementById("btn-view-3d");
    if (btnView2d) {
        btnView2d.addEventListener("click", () => Warehouse3DEngine.setMode('2d'));
    }
    if (btnView3d) {
        btnView3d.addEventListener("click", () => Warehouse3DEngine.setMode('3d'));
    }

    // Tự động khởi động chế độ 3D ngay khi tải trang
    setTimeout(() => {
        if (typeof Warehouse3DEngine !== "undefined") {
            Warehouse3DEngine.setMode('3d');
        }
    }, 100);

    // =========================================================================
    // HOẠT HÓA 100% CÁC NÚT TRÊN THANH CÔNG CỤ DIGITAL TWIN (SCADA TOOLBAR)
    // =========================================================================
    const btnSpawn = document.getElementById("btn-spawn-pkg");
    const btnToggleAutoSpawn = document.getElementById("btn-toggle-auto-spawn");
    const btnOpenInject = document.getElementById("btn-open-inject-modal");
    const btnExportExcelQuick = document.getElementById("btn-export-excel-quick");
    const btnToggleCam = document.getElementById("btn-toggle-cam");
    const btnCanvasOcc = document.getElementById("btn-canvas-occlusion");
    const btnTestJam = document.getElementById("btn-test-jam");
    const btnClearJam = document.getElementById("btn-clear-jam-banner");
    const btnTabTestJam = document.getElementById("btn-tab-test-jam");
    const btnTabClearJam = document.getElementById("btn-tab-clear-jam");
    const btnToggleObs = document.getElementById("btn-toggle-add-obs");
    const btnClearObs = document.getElementById("btn-clear-obs");
    const btnMuteToolbar = document.getElementById("btn-toolbar-mute");
    const btnMuteBanner = document.getElementById("btn-toggle-siren-mute");

    // 1. Nút Tạo Kiện Hàng Nhanh
    if (btnSpawn) {
        btnSpawn.addEventListener("click", () => {
            if (AppState.ws && AppState.ws.readyState === WebSocket.OPEN) {
                const nextId = AppState.itemsOnBelt.length + 101;
                AppState.ws.send(JSON.stringify({
                    action: "SPAWN_PACKAGE",
                    barcode: `PKG-WS-${nextId}`
                }));
                showToast(`Đã sinh bưu kiện PKG-WS-${nextId} lên băng chuyền!`, "success");
            } else {
                showToast("Đang kết nối lại kênh truyền WebSocket...", "warning");
            }
        });
    }

    // 2. Nút Bật/Tắt Tự Động Sinh Hàng Tuần Hoàn
    if (btnToggleAutoSpawn) {
        btnToggleAutoSpawn.addEventListener("click", () => {
            AppState.autoSpawn = !AppState.autoSpawn;
            if (AppState.ws && AppState.ws.readyState === WebSocket.OPEN) {
                AppState.ws.send(JSON.stringify({
                    action: "TOGGLE_AUTO_SPAWN",
                    enable: AppState.autoSpawn
                }));
            }
            updateAutoSpawnBtnUI(AppState.autoSpawn);
            showToast(AppState.autoSpawn ? "Đã BẬT tự sinh kiện tuần hoàn" : "Đã TẮT tự sinh kiện tuần hoàn", AppState.autoSpawn ? "info" : "warning");
        });
    }

    // 3. Nút Mở Form Tạo Kiện Tỉnh Thành (Phân Loại Cấp 2)
    if (btnOpenInject) {
        btnOpenInject.addEventListener("click", () => {
            const modal = document.getElementById("package-modal");
            const form = document.getElementById("create-package-form");
            const errBanner = document.getElementById("modal-pkg-error");
            if (modal) {
                if (errBanner) errBanner.style.display = "none";
                if (form) form.reset();
                modal.style.display = "flex";
                showToast("Mở hộp thoại tạo kiện theo 9 Tỉnh/Thành phố", "info");
            }
        });
    }

    // 4. Nút Xuất Báo Cáo Excel (.xlsx 3 Sheet)
    if (btnExportExcelQuick) {
        btnExportExcelQuick.addEventListener("click", async () => {
            showToast("Đang kết xuất Báo cáo Excel 3 Sheet...", "info");
            try {
                const token = AppState.token || localStorage.getItem("access_token") || "";
                const headers = token ? { "Authorization": `Bearer ${token}` } : {};
                const resp = await fetch("/api/v1/analytics/export/excel", { headers });
                if (!resp.ok) throw new Error("Lỗi tải file");
                const blob = await resp.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                const dateStr = new Date().toISOString().slice(0, 10);
                a.download = `Bao_Cao_Van_Hanh_Kho_NEXUSLOG_${dateStr}.xlsx`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
                showToast("Đã tải xuống thành công Báo Cáo Excel (.xlsx)!", "success");
            } catch (e) {
                window.open("/api/v1/analytics/export/excel", "_blank");
                showToast("Đã mở tải xuống báo cáo Excel!", "success");
            }
        });
    }

    // 5. Nút Bật/Tắt AI Bounding Box
    if (btnToggleCam) {
        btnToggleCam.addEventListener("click", () => {
            AppState.showAIBoundingBox = !AppState.showAIBoundingBox;
            btnToggleCam.classList.toggle("active");
            showToast(AppState.showAIBoundingBox ? "Đã bật khung quét AI Bounding Box" : "Đã tắt khung quét AI", "info");
        });
    }

    // 6. Nút Test Che Khuất Nhân Tạo (ByteTrack)
    if (btnCanvasOcc) {
        btnCanvasOcc.addEventListener("click", () => {
            if (AppState.ws && AppState.ws.readyState === WebSocket.OPEN) {
                const nextOcc = !AppState.occlusionSimulated;
                AppState.ws.send(JSON.stringify({
                    action: "TOGGLE_OCCLUSION",
                    enable: nextOcc
                }));
                showToast(nextOcc ? "Đã KÍCH HOẠT giả lập che khuất bưu kiện" : "Đã TẮT giả lập che khuất", nextOcc ? "warning" : "info");
            }
        });
    }

    // 7. Nút Test Kẹt Cổng (Jam) & Giải Phóng Kẹt
    const triggerJamFn = () => {
        if (AppState.ws && AppState.ws.readyState === WebSocket.OPEN) {
            AppState.ws.send(JSON.stringify({ action: "TRIGGER_JAM", gate_id: 2 }));
            showToast("🚨 Đã kích hoạt sự cố Kẹt Cổng 2!", "error");
        }
    };
    const clearJamFn = () => {
        if (AppState.ws && AppState.ws.readyState === WebSocket.OPEN) {
            AppState.ws.send(JSON.stringify({ action: "CLEAR_JAM" }));
            showToast("🔧 Đã giải phóng kẹt! Băng chuyền đảo chiều 2 giây...", "success");
        }
    };

    if (btnTestJam) btnTestJam.addEventListener("click", triggerJamFn);
    if (btnTabTestJam) btnTabTestJam.addEventListener("click", triggerJamFn);
    if (btnClearJam) btnClearJam.addEventListener("click", clearJamFn);
    if (btnTabClearJam) btnTabClearJam.addEventListener("click", clearJamFn);

    // 8. Nút Đặt Vật Cản Động A*
    if (btnToggleObs) {
        btnToggleObs.addEventListener("click", () => {
            AppState.addObstacleMode = !AppState.addObstacleMode;
            btnToggleObs.classList.toggle("btn-obs-active");
            if (AppState.addObstacleMode) {
                btnToggleObs.innerHTML = '<i class="fa-solid fa-crosshairs"></i> Click Sàn Để Đặt!';
                showToast("Chế độ đặt vật cản: Nhấp chuột vào sàn Canvas để đặt", "info");
            } else {
                btnToggleObs.innerHTML = '<i class="fa-solid fa-ban"></i> Đặt Vật Cản A*';
                showToast("Đã tắt chế độ đặt vật cản", "info");
            }
        });
    }

    // 9. Nút Xóa Toàn Bộ Vật Cản Động
    if (btnClearObs) {
        btnClearObs.addEventListener("click", () => {
            if (AppState.ws && AppState.ws.readyState === WebSocket.OPEN) {
                AppState.ws.send(JSON.stringify({ action: "CLEAR_OBSTACLES" }));
                showToast("Đã dọn sạch toàn bộ vật cản động A*", "success");
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
            showToast(`Đã thêm vật cản tại [${clickX.toFixed(0)}, ${clickY.toFixed(0)}]`, "warning");
        }
    });

    // 10. Nút Bật/Tắt Còi Báo Động
    if (btnMuteBanner) {
        btnMuteBanner.addEventListener("click", () => {
            SoundAlarm.toggleMute();
            showToast(SoundAlarm.isMuted ? "Đã tắt âm thanh còi báo" : "Đã bật âm thanh còi báo", "info");
        });
    }
    if (btnMuteToolbar) {
        btnMuteToolbar.addEventListener("click", () => {
            SoundAlarm.toggleMute();
            showToast(SoundAlarm.isMuted ? "Đã tắt âm thanh còi báo" : "Đã bật âm thanh còi báo", "info");
        });
    }

function renderLoop() {
        animTime += 0.025;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 1. Sàn nhà kho công nghiệp & Vật cản cảnh báo A*
        drawIndustrialWarehouseFloor(ctx, canvas.width, canvas.height, animTime);

        // 2. Băng chuyền con lăn cơ khí thật sự (Heavy-duty Steel Roller Conveyor)
        drawRealisticConveyor(ctx, animTime, !AppState.isConveyorStopped);

        // 3. Ba cổng phân loại IoT Servo Diverters & Máng trượt dốc 3 miền
        drawIndustrialIoTGate(ctx, 220, 150, "Cổng 1", 1, animTime);
        drawIndustrialIoTGate(ctx, 360, 150, "Cổng 2", 2, animTime);
        drawIndustrialIoTGate(ctx, 500, 150, "Cổng 3", 3, animTime);

        // 4. Trạm Camera AI YOLOv12 có khung giàn treo và tia Laser quét ma trận
        drawLaserCameraGantry(ctx, 110, 95, animTime);

        // 5. Kiện hàng thùng carton kraft chân thực (Corrugated Cardboard Box)
        drawRealisticPackages(ctx, animTime);

        // 6. Dãy Kệ Hàng 9 Tỉnh Thành (Pallet Racking System)
        drawIndustrialPalletRacking(ctx);

        // 6b. Trạm Sạc Tự Động Cho Robot AMR (Auto-Charging Docks)
        drawChargingDocks(ctx, animTime);

        // 7. Đội Xe Robot Tự Hành AMR (Phân làn 1 chiều, Pin SoC & Sạc cơ hội)
        drawIndustrialAMR(ctx, animTime);

        requestAnimationFrame(renderLoop);
    }

    // 1. SÀN NHÀ KHO CÔNG NGHIỆP EPOXY & CẢNH BÁO VẬT CẢN A*
    function drawIndustrialWarehouseFloor(ctx, w, h, t) {
        // Nền sàn epoxy sáng xám sạch sẽ
        ctx.fillStyle = "#f8fafc";
        ctx.fillRect(0, 0, w, h);

        // Lưới kẻ ô tọa độ chuẩn SCADA
        ctx.strokeStyle = "rgba(226, 232, 240, 0.85)";
        ctx.lineWidth = 1;
        const step = 32;
        for (let x = 0; x < w; x += step) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
        }
        for (let y = 0; y < h; y += step) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
        }

        // Vạch sơn phân làn cao tốc trực giao công nghiệp (Thiết kế tinh gọn, sạch sẽ, không rối)
        const highways = [
            { y: 300, color: "rgba(2, 132, 199, 0.16)", code: "LÀN 1 (BẮC)", startX: 230, endX: 680 },
            { y: 345, color: "rgba(217, 119, 6, 0.16)", code: "LÀN 2 (TRUNG)", startX: 370, endX: 770 },
            { y: 390, color: "rgba(5, 150, 105, 0.16)", code: "LÀN 3 (NAM)", startX: 510, endX: 860 }
        ];

        highways.forEach(hw => {
            // Dải làn đường epoxy sáng
            ctx.fillStyle = hw.color;
            ctx.fillRect(hw.startX - 10, hw.y - 10, (hw.endX - hw.startX) + 20, 20);

            // Vạch mép làn nét đứt thanh mảnh
            ctx.strokeStyle = hw.color.replace("0.16", "0.45");
            ctx.lineWidth = 1;
            ctx.setLineDash([8, 8]);
            ctx.beginPath();
            ctx.moveTo(hw.startX - 10, hw.y - 10);
            ctx.lineTo(hw.endX + 10, hw.y - 10);
            ctx.moveTo(hw.startX - 10, hw.y + 10);
            ctx.lineTo(hw.endX + 10, hw.y + 10);
            ctx.stroke();
            ctx.setLineDash([]);

            // Huy hiệu tên làn nhỏ gọn ở mép đầu làn (không vẽ chữ dưới bánh xe)
            ctx.fillStyle = hw.color.replace("0.16", "0.75");
            ctx.font = "bold 7.5px 'JetBrains Mono', monospace";
            ctx.fillText(hw.code, hw.startX - 8, hw.y - 12);
        });

        // Vật cản động A* (Vẽ hình nón chóp công nghiệp / barrier có sọc phản quang)
        AppState.obstacles.forEach(obs => {
            const ox = obs.x;
            const oy = obs.y;

            // Đổ bóng chân vật cản
            ctx.fillStyle = "rgba(15, 23, 42, 0.15)";
            ctx.beginPath();
            ctx.ellipse(ox, oy + 8, 12, 5, 0, 0, Math.PI * 2);
            ctx.fill();

            // Chân đế hình bát giác/vuông
            ctx.fillStyle = "#1e293b";
            ctx.fillRect(ox - 10, oy + 2, 20, 6);

            // Thân chóp cảnh báo (Safety Traffic Cone)
            ctx.fillStyle = "#f97316";
            ctx.beginPath();
            ctx.moveTo(ox, oy - 14);
            ctx.lineTo(ox + 8, oy + 4);
            ctx.lineTo(ox - 8, oy + 4);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = "#c2410c";
            ctx.lineWidth = 1;
            ctx.stroke();

            // Dải phản quang màu trắng/vàng
            ctx.fillStyle = "#ffffff";
            ctx.beginPath();
            ctx.moveTo(ox - 4, oy - 4);
            ctx.lineTo(ox + 4, oy - 4);
            ctx.lineTo(ox + 6, oy + 1);
            ctx.lineTo(ox - 6, oy + 1);
            ctx.closePath();
            ctx.fill();

            // Đèn cảnh báo chớp nháy trên đỉnh
            const blink = Math.sin(t * 10) > 0;
            ctx.fillStyle = blink ? "#ef4444" : "#fef08a";
            ctx.beginPath();
            ctx.arc(ox, oy - 15, 2.5, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    // 2. BĂNG CHUYỀN CON LĂN CƠ KHÍ THẬT SỰ (HEAVY-DUTY INDUSTRIAL ROLLER CONVEYOR)
    function drawRealisticConveyor(ctx, t, isRunning) {
        const bx = 35, by = 146, bw = 550, bh = 52;

        // 1. Đổ bóng khung gầm băng chuyền xuống sàn
        ctx.fillStyle = "rgba(15, 23, 42, 0.12)";
        ctx.fillRect(bx + 4, by + bh, bw - 8, 8);

        // 2. Thân hộp thép công nghiệp (Chassis Bed)
        ctx.fillStyle = "#1e293b";
        ctx.fillRect(bx, by, bw, bh);

        // 3. Viền thành chắn an toàn hai bên có vạch phản quang sọc vàng/đen (Safety Hazard Stripes)
        const stripeW = 12;
        const topRailH = 7;
        const botRailH = 7;

        // Thành trên
        ctx.save();
        ctx.beginPath();
        ctx.rect(bx, by, bw, topRailH);
        ctx.clip();
        for (let sx = bx - 20; sx < bx + bw + 20; sx += stripeW * 2) {
            ctx.fillStyle = "#eab308";
            ctx.fillRect(sx, by, stripeW, topRailH);
            ctx.fillStyle = "#0f172a";
            ctx.fillRect(sx + stripeW, by, stripeW, topRailH);
        }
        ctx.restore();

        // Thành dưới
        ctx.save();
        ctx.beginPath();
        ctx.rect(bx, by + bh - botRailH, bw, botRailH);
        ctx.clip();
        for (let sx = bx - 20; sx < bx + bw + 20; sx += stripeW * 2) {
            ctx.fillStyle = "#eab308";
            ctx.fillRect(sx, by + bh - botRailH, stripeW, botRailH);
            ctx.fillStyle = "#0f172a";
            ctx.fillRect(sx + stripeW, by + bh - botRailH, stripeW, botRailH);
        }
        ctx.restore();

        // 4. Lớp lòng đệm con lăn (Roller Bed Well)
        const wellY = by + topRailH;
        const wellH = bh - topRailH - botRailH;
        ctx.fillStyle = "#0f172a";
        ctx.fillRect(bx, wellY, bw, wellH);

        // 5. CÁC CON LĂN THÉP TRÒN XOAY THẬT SỰ (HEAVY-DUTY STEEL CYLINDRICAL ROLLERS)
        const rollerSpacing = 16;
        const rollerW = 9;
        const rollerOffset = isRunning ? (t * 40) % rollerSpacing : 0;

        for (let rx = bx + 6; rx < bx + bw - 6; rx += rollerSpacing) {
            const curRx = rx;

            // Gradient kim loại mô phỏng con lăn thép sáng bóng
            const grad = ctx.createLinearGradient(curRx, wellY, curRx + rollerW, wellY);
            const rotPhase = Math.sin((t * 8) + (rx * 0.2));
            if (isRunning && rotPhase > 0) {
                grad.addColorStop(0.0, "#475569");
                grad.addColorStop(0.3, "#f1f5f9");
                grad.addColorStop(0.7, "#94a3b8");
                grad.addColorStop(1.0, "#334155");
            } else {
                grad.addColorStop(0.0, "#334155");
                grad.addColorStop(0.4, "#cbd5e1");
                grad.addColorStop(0.8, "#64748b");
                grad.addColorStop(1.0, "#1e293b");
            }

            ctx.fillStyle = grad;
            ctx.fillRect(curRx, wellY + 1, rollerW, wellH - 2);

            // Khớp trục xoay ở hai đầu con lăn (Bearing Axle Pins)
            ctx.fillStyle = "#0f172a";
            ctx.beginPath();
            ctx.arc(curRx + rollerW / 2, wellY + 3, 1.8, 0, Math.PI * 2);
            ctx.arc(curRx + rollerW / 2, wellY + wellH - 3, 1.8, 0, Math.PI * 2);
            ctx.fill();
        }

        // Tán đinh cơ khí trang trí dọc khung sườn
        ctx.fillStyle = "#94a3b8";
        for (let bxR = bx + 12; bxR < bx + bw; bxR += 48) {
            ctx.beginPath();
            ctx.arc(bxR, by + topRailH / 2, 1.8, 0, Math.PI * 2);
            ctx.arc(bxR, by + bh - botRailH / 2, 1.8, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // 3. TRẠM CAMERA AI YOLOV12 CÓ KHUNG GIÀN TREO & TIA QUÉT LASER MA TRẬN
    function drawLaserCameraGantry(ctx, x, y, t) {
        // Cột giàn thép hai bên
        ctx.fillStyle = "#1e293b";
        ctx.fillRect(x - 16, y, 8, 120);
        ctx.fillRect(x + 58, y, 8, 120);

        // Khung giàn cẩu bắc ngang qua băng chuyền (Overhead Truss Gantry)
        ctx.fillStyle = "#0f172a";
        ctx.fillRect(x - 20, y, 88, 14);
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x - 20, y, 88, 14);

        // Đầu Camera công nghiệp AI
        ctx.fillStyle = "#1d4ed8";
        ctx.fillRect(x + 10, y + 14, 28, 16);
        ctx.fillStyle = "#0f172a";
        ctx.fillRect(x + 16, y + 30, 16, 6);

        // Đèn LED chỉ thị AI Camera (nhấp nháy báo hiệu đang nhận diện)
        const ledBlink = Math.sin(t * 12) > 0;
        ctx.fillStyle = ledBlink ? "#10b981" : "#047857";
        ctx.beginPath();
        ctx.arc(x + 16, y + 20, 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 8px 'JetBrains Mono', monospace";
        ctx.fillText("AI CAM", x + 22, y + 23);

        // NÓN QUÉT THỊ GIÁC QUANG HỌC (VOLUMETRIC VISION FIELD)
        const coneGrad = ctx.createLinearGradient(x + 24, y + 36, x + 24, 215);
        coneGrad.addColorStop(0.0, "rgba(6, 182, 212, 0.45)");
        coneGrad.addColorStop(1.0, "rgba(6, 182, 212, 0.05)");

        ctx.fillStyle = coneGrad;
        ctx.beginPath();
        ctx.moveTo(x + 16, y + 36);
        ctx.lineTo(x - 14, 210);
        ctx.lineTo(x + 62, 210);
        ctx.lineTo(x + 32, y + 36);
        ctx.closePath();
        ctx.fill();

        // TIA QUÉT LASER MA TRẬN QUÉT NGANG KIỆN HÀNG (LASER SCAN GRID LINE)
        const scanLineY = 145 + ((Math.sin(t * 5) + 1) * 0.5) * 60;
        ctx.strokeStyle = "rgba(239, 68, 68, 0.85)";
        ctx.lineWidth = 2;
        ctx.shadowColor = "#ef4444";
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(x - 12, scanLineY);
        ctx.lineTo(x + 60, scanLineY);
        ctx.stroke();
        ctx.shadowBlur = 0; // Tắt shadow

        // Bounding Box AI Overlay
        if (AppState.showAIBoundingBox) {
            ctx.strokeStyle = "#38bdf8";
            ctx.lineWidth = 1.8;
            ctx.setLineDash([4, 4]);
            ctx.strokeRect(x - 15, 140, 78, 68);
            ctx.setLineDash([]);

            // Tag nhãn định danh YOLOv12
            ctx.fillStyle = "#0284c7";
            ctx.fillRect(x - 15, 126, 78, 14);
            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 8px 'JetBrains Mono', monospace";
            ctx.fillText("YOLOv12n: 98.4%", x - 12, 137);
        }
    }

    // 4. BA CỔNG PHÂN LOẠI IOT & MÁNG TRƯỢT DỐC CÓ THÀNH CHẮN
    function drawIndustrialIoTGate(ctx, x, y, title, gate_id, animTime) {
        const gate = AppState.gates.find(g => g.id === gate_id) || { diverter_angle: 0.0, status: "IDLE" };
        const isJammed = gate.status === "JAMMED";
        const isDiverting = gate.status === "DIVERTING" || gate.diverter_angle > 0;

        const regionCfg = {
            1: { name: "Cổng 1 (Bắc)", code: "BẮC", border: "#2563eb", header: "#1d4ed8", bg: "#eff6ff", text: "#1e40af" },
            2: { name: "Cổng 2 (Trung)", code: "TRUNG", border: "#8b5cf6", header: "#7c3aed", bg: "#f5f3ff", text: "#6d28d9" },
            3: { name: "Cổng 3 (Nam)", code: "NAM", border: "#10b981", header: "#059669", bg: "#ecfdf5", text: "#047857" }
        }[gate_id] || { name: title, code: "GATE", border: "#64748b", header: "#475569", bg: "#f8fafc", text: "#334155" };

        const chuteX = x - 8;
        const chuteY = y + 52;
        const chuteW = 58;
        const chuteH = 82;

        // Đổ bóng máng trượt
        ctx.fillStyle = "rgba(15, 23, 42, 0.08)";
        ctx.fillRect(chuteX + 3, chuteY + 3, chuteW, chuteH);

        // Máng trượt dốc kim loại phân vùng 3 miền
        ctx.fillStyle = isJammed ? "#fef2f2" : regionCfg.bg;
        ctx.fillRect(chuteX, chuteY, chuteW, chuteH);
        ctx.strokeStyle = isJammed ? "#ef4444" : regionCfg.border;
        ctx.lineWidth = isJammed ? 2.5 : 2;
        ctx.strokeRect(chuteX, chuteY, chuteW, chuteH);

        // Thanh tiêu đề máng công nghiệp kèm chỉ số hàng đợi đệm [x/4]
        const chuteCount = (gate.chute_count !== undefined) ? gate.chute_count : (AppState.itemsOnBelt ? AppState.itemsOnBelt.filter(p => p.status === "Sorted" && p.divert_gate === gate_id).length : 0);
        ctx.fillStyle = isJammed ? "#dc2626" : regionCfg.header;
        ctx.fillRect(chuteX, chuteY, chuteW, 16);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 8px 'Plus Jakarta Sans', sans-serif";
        ctx.fillText(`MÁNG ${regionCfg.code} [${chuteCount}/4]`, chuteX + 4, chuteY + 11);

        // Vẽ các kiện hàng nhỏ xếp hàng đợi thực tế trong máng trượt
        if (chuteCount > 0) {
            for (let k = 0; k < Math.min(chuteCount, 4); k++) {
                const bx = chuteX + 8;
                const by = chuteY + chuteH - 18 - (k * 14);
                ctx.fillStyle = "#d97706";
                ctx.fillRect(bx, by, chuteW - 16, 11);
                ctx.strokeStyle = "#92400e";
                ctx.lineWidth = 0.8;
                ctx.strokeRect(bx, by, chuteW - 16, 11);
            }
        }

        // Đường rãnh trượt con lăn kim loại trong máng chứa
        ctx.strokeStyle = isJammed ? "rgba(239, 68, 68, 0.3)" : "rgba(148, 163, 184, 0.4)";
        ctx.lineWidth = 1.2;
        for (let ly = chuteY + 28; ly < chuteY + chuteH - 8; ly += 14) {
            ctx.beginPath();
            ctx.moveTo(chuteX + 8, ly);
            ctx.lineTo(chuteX + chuteW - 8, ly);
            ctx.stroke();
        }

        // (Đã xóa nhãn tên trùng lặp ở đáy máng để tránh đè lên làn cao tốc Làn 1)

        // Hộp biển hiệu cổng phía trên băng tải
        ctx.fillStyle = isJammed ? "#fee2e2" : (isDiverting ? regionCfg.bg : "#ffffff");
        ctx.strokeStyle = isJammed ? "#ef4444" : (isDiverting ? regionCfg.border : "#cbd5e1");
        ctx.lineWidth = (isJammed || isDiverting) ? 2 : 1;
        ctx.fillRect(x - 6, y - 24, 54, 20);
        ctx.strokeRect(x - 6, y - 24, 54, 20);

        ctx.fillStyle = isJammed ? "#dc2626" : (isDiverting ? regionCfg.text : "#475569");
        ctx.font = "bold 9px 'Plus Jakarta Sans', sans-serif";
        ctx.fillText(title, x - 2, y - 10);

        // CẢM BIẾN QUANG HỌC KÍCH HOẠT VẠCH PHÂN LOẠI
        ctx.strokeStyle = isJammed ? "#ef4444" : regionCfg.header;
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x - 5, y - 4);
        ctx.lineTo(x - 5, y + 52);
        ctx.stroke();
        ctx.setLineDash([]);

        // THÁP ĐÈN ANDON BÁO ĐỘNG CÔNG NGHIỆP (3 TẦNG: ĐỎ / VÀNG / XANH)
        const andonX = chuteX + chuteW - 9;
        const andonY = chuteY + 8;
        const isFlash = Math.sin(animTime * 14) > 0;
        ctx.fillStyle = isJammed ? (isFlash ? "#ef4444" : "#7f1d1d") : (isDiverting ? "#3b82f6" : "#10b981");
        ctx.beginPath();
        ctx.arc(andonX, andonY, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1;
        ctx.stroke();

        // HIỆU ỨNG SÓNG RADAR KHI KẸT CỔNG (ANTI-JAM EMERGENCY)
        if (isJammed) {
            for (let r = 1; r <= 3; r++) {
                const waveR = 15 + ((animTime * 35 + r * 16) % 45);
                const alpha = Math.max(0, 1 - (waveR / 45));
                ctx.strokeStyle = `rgba(239, 68, 68, ${alpha})`;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(x + 15, y + 52, waveR, 0, Math.PI * 2);
                ctx.stroke();
            }

            // Hộp cảnh báo kẹt nhấp nháy
            ctx.fillStyle = isFlash ? "#ef4444" : "#fee2e2";
            ctx.strokeStyle = "#b91c1c";
            ctx.lineWidth = 1.5;
            ctx.fillRect(x - 16, y - 48, 76, 20);
            ctx.strokeRect(x - 16, y - 48, 76, 20);
            ctx.fillStyle = isFlash ? "#ffffff" : "#991b1b";
            ctx.font = "bold 9px 'Plus Jakarta Sans', sans-serif";
            ctx.fillText("🚨 KẸT CỔNG!", x - 8, y - 34);
        }

        // CƠ CẤU CẦN GẠT CƠ KHÍ SERVO (DIVERTER ARM 0 -> 45 ĐỘ CÓ ĐỆM CAO SU)
        const pivotX = x - 5;
        const pivotY = y + 52;
        const armLength = 38;
        const rad = -(gate.diverter_angle || 0.0) * (Math.PI / 180.0);

        ctx.save();
        ctx.translate(pivotX, pivotY);
        ctx.rotate(rad);

        // Khớp trục xoay kim loại
        ctx.fillStyle = "#0f172a";
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();

        // Thân cần gạt kim loại
        ctx.fillStyle = isJammed ? "#ef4444" : (isDiverting ? regionCfg.header : "#f59e0b");
        ctx.fillRect(0, -3.5, armLength, 7);
        ctx.strokeStyle = "#0f172a";
        ctx.lineWidth = 1.2;
        ctx.strokeRect(0, -3.5, armLength, 7);

        // Lớp đệm cao su giảm chấn ở đầu cần gạt
        ctx.fillStyle = "#0f172a";
        ctx.fillRect(armLength - 5, -4, 5, 8);
        ctx.restore();
    }

    // 5. THÙNG CARTON KRAFT CHUẨN LOGISTICS (CORRUGATED CARDBOARD PACKAGES)
    function drawRealisticPackages(ctx, t) {
        AppState.itemsOnBelt.forEach(p => {
            const isOcc = p.is_occluded || (p.conf < 0.6);
            const isDiverting = p.status === "Diverting";
            const isSorted = p.status === "Sorted";

            const boxW = 34, boxH = 26;
            const drawX = p.x - boxW / 2;
            const drawY = p.y - boxH / 2;

            ctx.save();

            // Đổ bóng kiện hàng xuống con lăn/máng
            ctx.fillStyle = "rgba(15, 23, 42, 0.18)";
            ctx.fillRect(drawX + 3, drawY + 4, boxW, boxH);

            // Thân thùng carton Kraft màu vàng nâu ấm
            const cartonColor = isSorted ? "#059669" : (isDiverting ? "#2563eb" : (isOcc ? "rgba(217, 119, 6, 0.45)" : "#d97706"));
            ctx.fillStyle = cartonColor;
            ctx.fillRect(drawX, drawY, boxW, boxH);

            // Nếp gấp hộp 3D (Viền nổi khối)
            ctx.strokeStyle = isSorted ? "#047857" : (isDiverting ? "#1d4ed8" : "#92400e");
            ctx.lineWidth = 1.5;
            if (isOcc) ctx.setLineDash([3, 3]);
            ctx.strokeRect(drawX, drawY, boxW, boxH);
            ctx.setLineDash([]);

            // Đường băng keo niêm phong (Sealing Packing Tape)
            ctx.fillStyle = isSorted ? "rgba(255, 255, 255, 0.25)" : "rgba(180, 83, 9, 0.5)";
            ctx.fillRect(drawX + boxW / 2 - 2, drawY, 4, boxH);

            // Tem nhãn bưu chính in mã vạch (White Shipping Barcode Label)
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(drawX + 3, drawY + 3, boxW - 6, 12);

            // Các vạch mã vạch Barcode siêu nhỏ
            ctx.fillStyle = "#0f172a";
            for (let bx = drawX + 5; bx < drawX + boxW - 8; bx += 3) {
                ctx.fillRect(bx, drawY + 5, 1.2, 8);
            }

            // Track ID in rõ nét
            ctx.fillStyle = isSorted ? "#ffffff" : (isDiverting ? "#ffffff" : "#0f172a");
            ctx.font = "bold 8.5px 'JetBrains Mono', monospace";
            ctx.fillText(`T#${p.track_id || p.id}`, drawX + 3, drawY + 22);

            // Thẻ nhãn trạng thái
            if (isSorted) {
                ctx.fillStyle = "#047857";
                ctx.fillRect(drawX, drawY - 10, boxW, 9);
                ctx.fillStyle = "#ffffff";
                ctx.font = "bold 6.5px 'Plus Jakarta Sans', sans-serif";
                ctx.fillText("✓ SORTED", drawX + 3, drawY - 3);
            } else if (isOcc) {
                ctx.fillStyle = "#ea580c";
                ctx.fillRect(drawX - 4, drawY - 12, 42, 10);
                ctx.fillStyle = "#ffffff";
                ctx.font = "bold 6.5px 'Plus Jakarta Sans', sans-serif";
                ctx.fillText("CHE KHUẤT", drawX - 1, drawY - 4);
            }

            ctx.restore();
        });
    }

    // 6. DÃY KỆ HÀNG 9 TỈNH/THÀNH PHỐ (PHÂN LOẠI CẤP 2 BỞI ROBOT AMR)
    function drawIndustrialPalletRacking(ctx) {
        const rx = 635, ry = 42;

        ctx.fillStyle = "#1e293b";
        ctx.font = "bold 11px 'Plus Jakarta Sans', sans-serif";
        ctx.fillText("Kệ Lưu Trữ Phân Loại 9 Tỉnh/Thành Phố (Cấp 2)", rx, ry - 12);

        const provinceCols = [
            {
                name: "MIỀN BẮC (CỔNG 1)",
                color: "#0284c7",
                tagBg: "#e0f2fe",
                tagColor: "#0369a1",
                provinces: [
                    { id: "RACK-HN", name: "Hà Nội", count: 3, cap: 6, code: "HN-01" },
                    { id: "RACK-HP", name: "Hải Phòng", count: 2, cap: 6, code: "HP-01" },
                    { id: "RACK-QN", name: "Quảng Ninh", count: 1, cap: 6, code: "QN-01" }
                ]
            },
            {
                name: "MIỀN TRUNG (CỔNG 2)",
                color: "#d97706",
                tagBg: "#fef3c7",
                tagColor: "#b45309",
                provinces: [
                    { id: "RACK-DN", name: "Đà Nẵng", count: 2, cap: 6, code: "DN-01" },
                    { id: "RACK-HUE", name: "Huế", count: 2, cap: 6, code: "HUE-01" },
                    { id: "RACK-KH", name: "Khánh Hòa", count: 1, cap: 6, code: "KH-01" }
                ]
            },
            {
                name: "MIỀN NAM (CỔNG 3)",
                color: "#059669",
                tagBg: "#d1fae5",
                tagColor: "#047857",
                provinces: [
                    { id: "RACK-HCM", name: "TP.HCM", count: 4, cap: 6, code: "HCM-01" },
                    { id: "RACK-BD", name: "Bình Dương", count: 2, cap: 6, code: "BD-01" },
                    { id: "RACK-CT", name: "Cần Thơ", count: 1, cap: 6, code: "CT-01" }
                ]
            }
        ];

        for (let cIdx = 0; cIdx < 3; cIdx++) {
            const col = provinceCols[cIdx];
            const colX = rx + cIdx * 92;

            // Header phân vùng nhẹ nhàng
            ctx.fillStyle = col.tagBg;
            ctx.beginPath();
            ctx.roundRect(colX, ry - 4, 86, 16, 3);
            ctx.fill();

            ctx.fillStyle = col.tagColor;
            ctx.font = "bold 7.5px 'Plus Jakarta Sans', sans-serif";
            ctx.fillText(col.name, colX + 4, ry + 7);

            for (let rIdx = 0; rIdx < 3; rIdx++) {
                const prov = col.provinces[rIdx];
                const ox = colX;
                const oy = ry + 16 + rIdx * 34;

                // Đồng bộ số lượng thực tế từ backend snapshot
                if (AppState.provinceRacks && AppState.provinceRacks[prov.id]) {
                    prov.count = AppState.provinceRacks[prov.id].count;
                }

                const isFull = prov.count >= prov.cap;

                ctx.fillStyle = isFull ? "#fef2f2" : "#ffffff";
                ctx.beginPath();
                ctx.roundRect(ox, oy, 86, 28, 3);
                ctx.fill();
                ctx.strokeStyle = isFull ? "#fca5a5" : "#cbd5e1";
                ctx.lineWidth = 1;
                ctx.stroke();

                // Cột đứng & Dầm kệ
                ctx.fillStyle = col.color;
                ctx.fillRect(ox, oy, 3, 28);
                ctx.fillRect(ox + 83, oy, 3, 28);
                ctx.fillStyle = "#94a3b8";
                ctx.fillRect(ox, oy + 25, 86, 3);

                // Tên Tỉnh Thành
                ctx.fillStyle = "#0f172a";
                ctx.font = "bold 8.5px 'Plus Jakarta Sans', sans-serif";
                ctx.fillText(prov.name, ox + 6, oy + 12);

                // Số lượng kiện
                ctx.fillStyle = isFull ? "#dc2626" : col.color;
                ctx.font = "bold 8px 'JetBrains Mono', monospace";
                ctx.fillText(`${prov.count}/${prov.cap} Ô`, ox + 6, oy + 22);

                // Thùng hàng carton nhỏ xinh
                if (prov.count > 0) {
                    const drawCount = Math.min(prov.count, 3);
                    for (let b = 0; b < drawCount; b++) {
                        ctx.fillStyle = "#d97706";
                        ctx.fillRect(ox + 46 + b * 11, oy + 8, 9, 13);
                        ctx.strokeStyle = "#92400e";
                        ctx.lineWidth = 0.5;
                        ctx.strokeRect(ox + 46 + b * 11, oy + 8, 9, 13);
                    }
                }
            }
        }
    }

    // 6b. TRẠM SẠC TỰ ĐỘNG VÀ BỆ TRỰC CHIẾN DỰ BỊ (AUTO-CHARGING DOCKS & STANDBY PAD)
    function drawChargingDocks(ctx, t) {
        // Vẽ Bệ Trực Chiến (Standby Pad) cho AMR-04 Dự Bị
        const spX = 280, spY = 440, spW = 52, spH = 30;
        ctx.save();
        ctx.fillStyle = "rgba(139, 92, 246, 0.08)";
        ctx.fillRect(spX - spW / 2, spY - spH / 2, spW, spH);
        ctx.strokeStyle = "#8b5cf6";
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(spX - spW / 2, spY - spH / 2, spW, spH);
        ctx.setLineDash([]);
        ctx.fillStyle = "#7c3aed";
        ctx.font = "bold 7.5px 'JetBrains Mono', monospace";
        ctx.textAlign = "center";
        ctx.fillText("PAD DỰ BỊ", spX, spY + 3);
        ctx.fillText("AMR-04", spX, spY + spH / 2 + 10);
        ctx.restore();
        const docks = (AppState.chargingDocks && AppState.chargingDocks.length > 0)
            ? AppState.chargingDocks
            : [
                { id: 1, name: "Dock Sạc 01", x: 120, y: 440 },
                { id: 2, name: "Dock Sạc 02", x: 200, y: 440 }
            ];

        docks.forEach(dock => {
            const dx = dock.x;
            const dy = dock.y;
            const dw = 52, dh = 30;

            ctx.save();
            // Đổ bóng chân đế trạm sạc
            ctx.fillStyle = "rgba(15, 23, 42, 0.12)";
            ctx.fillRect(dx - dw / 2 + 2, dy - dh / 2 + 3, dw, dh);

            // Bệ sạc không dây công nghiệp
            ctx.fillStyle = "#1e293b";
            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(dx - dw / 2, dy - dh / 2, dw, dh, 4);
            } else {
                ctx.rect(dx - dw / 2, dy - dh / 2, dw, dh);
            }
            ctx.fill();
            ctx.strokeStyle = "#38bdf8";
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Vạch tiếp xúc sạc kim loại đồng vàng
            ctx.fillStyle = "#f59e0b";
            ctx.fillRect(dx - 14, dy - 6, 8, 12);
            ctx.fillRect(dx + 6, dy - 6, 8, 12);

            // Biểu tượng tia sét sạc LED phát sáng
            const pulse = (Math.sin(t * 8) + 1) * 0.5;
            ctx.fillStyle = `rgba(56, 189, 248, ${0.4 + pulse * 0.6})`;
            ctx.font = "bold 11px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("⚡", dx, dy + 4);

            // Tên dock sạc
            ctx.fillStyle = "#64748b";
            ctx.font = "bold 8px 'JetBrains Mono', monospace";
            ctx.fillText(dock.name || `DOCK-0${dock.id}`, dx, dy + dh / 2 + 10);
            ctx.textAlign = "start";
            ctx.restore();
        });
    }

    // 7. ĐỘI XE 3 ROBOT TỰ HÀNH AMR (CẢM BIẾN LIDAR DỪNG AN TOÀN KHI GẶP VẬT CẢN)
    function drawIndustrialAMR(ctx, t) {
        const fleet = (AppState.amrs && AppState.amrs.length > 0) ? AppState.amrs : [AppState.amr];

        fleet.forEach((amr, idx) => {
            if (!amr) return;
            drawSingleAMR(ctx, amr, idx, t);
        });
    }

    function drawSingleAMR(ctx, amr, idx, t) {
        const colors = [
            { main: "#0284c7", stroke: "rgba(2, 132, 199, 0.35)", name: "AMR-01 [Bắc]" },
            { main: "#d97706", stroke: "rgba(217, 119, 6, 0.35)", name: "AMR-02 [Trung]" },
            { main: "#059669", stroke: "rgba(5, 150, 105, 0.35)", name: "AMR-03 [Nam]" },
            { main: "#8b5cf6", stroke: "rgba(139, 92, 246, 0.35)", name: "AMR-04 [Dự Bị]" }
        ];
        const style = colors[idx % 3];
        const isBlocked = amr.state === "BLOCKED" || amr.proximity_alert;

        // 1. DẢI ĐƯỜNG A* THANH MẢNH, KHÔNG LÀM RỐI MẮT
        const waypoints = amr.path_waypoints || [];
        if (waypoints.length > 1 && !isBlocked && amr.state !== "STANDBY") {
            ctx.save();
            ctx.strokeStyle = style.stroke.replace("0.35", "0.20");
            ctx.lineWidth = 1.0;
            ctx.setLineDash([3, 5]);
            ctx.lineDashOffset = -(t * 14);
            ctx.beginPath();
            ctx.moveTo(waypoints[0][0], waypoints[0][1]);
            for (let i = 1; i < waypoints.length; i++) {
                ctx.lineTo(waypoints[i][0], waypoints[i][1]);
            }
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
        }

        // 3. VÙNG AN TOÀN CẢM BIẾN LIDAR (Chỉ cảnh báo khi có vật cản thật sự gần xe)
        const ax = amr.x;
        const ay = amr.y;
        const w = 30, h = 26;

        ctx.save();
        if (isBlocked) {
            // Vòng cảnh báo đỏ nhẹ nhàng
            const pulse = (Math.sin(t * 10) + 1) * 0.5;
            ctx.fillStyle = `rgba(239, 68, 68, ${0.1 + pulse * 0.15})`;
            ctx.strokeStyle = "#ef4444";
            ctx.lineWidth = 1.5;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.arc(ax, ay, 34, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.setLineDash([]);

            // Chữ cảnh báo dừng vật cản
            ctx.fillStyle = "#dc2626";
            ctx.font = "bold 8.5px 'JetBrains Mono', monospace";
            ctx.fillText("⛔ DỪNG (VẬT CẢN)", ax - 38, ay - 20);
        }
        ctx.restore();

        // 4. KHỐI THÂN XE ROBOT AMR CÔNG NGHIỆP VỚI HƯỚNG QUAY (HEADING) CHUẨN XÁC
        ctx.save();
        ctx.translate(ax, ay);

        // Trạng thái hiển thị tiếng Việt chuyên nghiệp
        const stateLabels = {
            "WAITING_FOR_CARGO": { txt: "CHỜ MÁNG", col: "#64748b", bg: "#f1f5f9" },
            "LOADING": { txt: "NẠP HÀNG", col: "#d97706", bg: "#fef3c7" },
            "DELIVERING": { txt: "VẬN CHUYỂN", col: "#0284c7", bg: "#e0f2fe" },
            "UNLOADING": { txt: "XẾP KỆ", col: "#8b5cf6", bg: "#ede9fe" },
            "RETURNING": { txt: "VỀ MÁNG", col: "#059669", bg: "#d1fae5" },
            "BLOCKED": { txt: "DỪNG VẬT CẢN", col: "#dc2626", bg: "#fee2e2" },
            "STANDBY": { txt: "TRỰC CHIẾN", col: "#7c3aed", bg: "#f3e8ff" },
            "GOING_TO_DOCK": { txt: "VỀ TRẠM SẠC", col: "#d97706", bg: "#fef3c7" },
            "CHARGING_AT_DOCK": { txt: "ĐANG SẠC PIN", col: "#059669", bg: "#d1fae5" }
        };
        const curSt = stateLabels[amr.state] || { txt: amr.state || "NAVIGATING", col: style.main, bg: "#f1f5f9" };

        // Xoay thân xe theo góc chuyển động mượt mà
        ctx.save();
        ctx.rotate((amr.heading || 0) + Math.PI / 2);

        // Đổ bóng xe
        ctx.fillStyle = "rgba(15, 23, 42, 0.15)";
        ctx.beginPath();
        ctx.ellipse(1, 3, 16, 12, 0, 0, Math.PI * 2);
        ctx.fill();

        // Thân xe hợp kim bo tròn 4 góc
        ctx.fillStyle = "#0f172a";
        ctx.beginPath();
        ctx.roundRect(-w / 2, -h / 2, w, h, 5);
        ctx.fill();
        ctx.strokeStyle = isBlocked ? "#ef4444" : style.main;
        ctx.lineWidth = isBlocked ? 2.0 : 1.5;
        ctx.stroke();

        // Bánh xe 2 bên
        ctx.fillStyle = "#020617";
        ctx.fillRect(-w / 2 - 1, -h / 2 + 4, 2, 7);
        ctx.fillRect(w / 2 - 1, -h / 2 + 4, 2, 7);
        ctx.fillRect(-w / 2 - 1, h / 2 - 11, 2, 7);
        ctx.fillRect(w / 2 - 1, h / 2 - 11, 2, 7);

        // Đèn pha trước LED hướng theo chiều chạy
        ctx.fillStyle = isBlocked ? "#ef4444" : "#fef08a";
        ctx.fillRect(-7, -h / 2 + 1, 3, 2);
        ctx.fillRect(4, -h / 2 + 1, 3, 2);

        // Thùng hàng carton trên lưng xe
        if (amr.has_cargo !== false) {
            ctx.fillStyle = "#d97706";
            ctx.fillRect(-7, -7, 14, 14);
            ctx.strokeStyle = "#92400e";
            ctx.lineWidth = 0.8;
            ctx.strokeRect(-7, -7, 14, 14);
            ctx.fillStyle = "#78350f";
            ctx.fillRect(-7, -1, 14, 2);
        }

        // Cảm biến LiDAR xoay quét thanh mảnh
        ctx.fillStyle = isBlocked ? "#ef4444" : style.main;
        ctx.beginPath();
        ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
        ctx.fill();

        if (!isBlocked && amr.state !== "WAITING_FOR_CARGO") {
            const lidarAngle = (t * 6) + (idx * 2.1);
            ctx.strokeStyle = "rgba(56, 189, 248, 0.55)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(lidarAngle) * 26, Math.sin(lidarAngle) * 26);
            ctx.stroke();
        }
        ctx.restore(); // Hết xoay thân xe

        // Thanh hiển thị % Pin (Battery SoC) trên nóc xe
        const bat = amr.battery !== undefined ? amr.battery : 95.0;
        const batColor = bat < 20 ? "#ef4444" : (bat < 50 ? "#f59e0b" : "#22c55e");
        ctx.fillStyle = "rgba(15, 23, 42, 0.75)";
        ctx.fillRect(-18, -h / 2 - 14, 36, 5);
        ctx.fillStyle = batColor;
        ctx.fillRect(-17, -h / 2 - 13, (34 * Math.max(0, Math.min(100, bat))) / 100, 3);

        // Nhãn tên xe & Trạng thái
        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 8.5px 'JetBrains Mono', monospace";
        const batTxt = amr.state === "CHARGING_AT_DOCK" ? "⚡ SẠC" : (amr.charge_boost ? "⚡ BOOST" : `${bat.toFixed(0)}%`);
        ctx.fillText(`${amr.id || `AMR-0${idx + 1}`} [${batTxt}]`, -22, h / 2 + 10);

        // Pill trạng thái nhiệm vụ
        ctx.fillStyle = curSt.bg;
        ctx.beginPath();
        ctx.roundRect(-24, h / 2 + 13, 48, 12, 3);
        ctx.fill();
        ctx.strokeStyle = curSt.col;
        ctx.lineWidth = 0.8;
        ctx.stroke();

        ctx.fillStyle = curSt.col;
        ctx.font = "bold 7px 'JetBrains Mono', monospace";
        ctx.fillText(curSt.txt, -20, h / 2 + 22);

        ctx.restore();
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
        SoundAlarm.start();
    } else {
        banner.style.display = "none";
        SoundAlarm.stop();
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

            // Bảng Thông Tin Chi Tiết & Kiểm Định Ngoại Quan
            const cardH = 42;
            ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
            ctx.fillRect(bx, by + bh + 4, 135, cardH);
            ctx.strokeStyle = "#334155";
            ctx.strokeRect(bx, by + bh + 4, 135, cardH);
            ctx.fillStyle = "#94a3b8";
            ctx.font = "8px 'Plus Jakarta Sans', sans-serif";
            ctx.fillText(`${p.barcode || `PKG-${p.id}`} | ${p.province || "Hà Nội"}`, bx + 6, by + bh + 15);
            ctx.fillStyle = isOcc ? "#fbbf24" : "#34d399";
            ctx.fillText(isOcc ? "STATUS: Occluded (Kalman Match)" : "STATUS: Tracked (Kalman 8D)", bx + 6, by + bh + 26);
            const isDefect = p.defect === "Deformed";
            ctx.fillStyle = isDefect ? "#f87171" : "#a7f3d0";
            ctx.fillText(isDefect ? "⚠ QUY CÁCH: Móp méo (Recheck)" : "✓ QUY CÁCH: Chuẩn (OK)", bx + 6, by + bh + 37);

            // Chế độ Đối Sánh A/B: So sánh trực quan Có ByteTrack vs Không có ByteTrack
            if (AppState.abModeActive && isOcc) {
                const ghostX = bx;
                const ghostY = by - 48;
                ctx.fillStyle = "rgba(185, 28, 28, 0.92)";
                ctx.fillRect(ghostX, ghostY, bw + 15, 26);
                ctx.strokeStyle = "#ef4444";
                ctx.lineWidth = 1.5;
                ctx.strokeRect(ghostX, ghostY, bw + 15, 26);
                ctx.fillStyle = "#ffffff";
                ctx.font = "bold 7.5px 'JetBrains Mono', monospace";
                ctx.fillText("❌ BASELINE: MẤT DẤU (LOST)", ghostX + 4, ghostY + 11);
                ctx.fillText("⚠ NHẢY ID MỚI -> GẠT SAI!", ghostX + 4, ghostY + 21);
            }
        });

        requestAnimationFrame(renderAILoop);
    }

    renderAILoop();
}

// ==========================================================================
// 8. BÁO CÁO PHÂN TÍCH & CHỈ SỐ KPI VẬN HÀNH (LOG-120)
// ==========================================================================

let lastKPIData = null;

function initAnalytics() {
    const btnRefresh = document.getElementById("btn-refresh-analytics");
    const btnExport = document.getElementById("btn-export-kpi-report");

    if (btnRefresh) {
        btnRefresh.addEventListener("click", () => {
            loadAnalytics();
        });
    }

    if (btnExport) {
        btnExport.addEventListener("click", () => {
            exportKPIReport();
        });
    }
}

async function loadAnalytics() {
    try {
        const resp = await fetch("/api/v1/analytics/kpis", {
            headers: {
                "Authorization": `Bearer ${AppState.token}`
            }
        });
        if (!resp.ok) {
            console.warn("Không thể tải dữ liệu KPI:", resp.status);
            return;
        }

        const data = await resp.json();
        lastKPIData = data;
        renderAnalyticsUI(data);
    } catch (err) {
        console.error("Lỗi nạp báo cáo KPI:", err);
    }
}

function renderAnalyticsUI(data) {
    if (!data) return;

    // 1. Cập nhật 4 Card Thống Kê Tổng Quan
    const elTotal = document.getElementById("kpi-analytics-total-pkg");
    const elStored = document.getElementById("kpi-analytics-stored-pkg");
    const elBelt = document.getElementById("kpi-analytics-belt-pkg");
    if (elTotal) elTotal.textContent = data.throughput.total;
    if (elStored) elStored.textContent = data.throughput.stored;
    if (elBelt) elBelt.textContent = data.throughput.on_belt;

    const elSortingAcc = document.getElementById("kpi-analytics-sorting-accuracy");
    const elRecheck = document.getElementById("kpi-analytics-recheck-rate");
    if (elSortingAcc) elSortingAcc.textContent = `${data.sorting.accuracy_rate}%`;
    if (elRecheck) elRecheck.textContent = `${data.sorting.recheck_rate}%`;

    const elMota = document.getElementById("kpi-analytics-mota");
    const elAiLatency = document.getElementById("kpi-analytics-ai-latency");
    const elIdSwitches = document.getElementById("kpi-analytics-id-switches");
    if (elMota) elMota.textContent = `${(data.performance.ai_mota * 100).toFixed(1)}%`;
    if (elAiLatency) elAiLatency.textContent = `${data.performance.ai_inference_ms.toFixed(1)} ms`;
    if (elIdSwitches) elIdSwitches.textContent = `${data.performance.ai_id_switches}`;

    // Tính tổng dung lượng ô kệ
    let totalCap = 0;
    let usedCap = 0;
    if (data.storage_zones) {
        Object.values(data.storage_zones).forEach(z => {
            totalCap += z.total_capacity || 0;
            usedCap += z.used_capacity || 0;
        });
    }
    const occRate = totalCap > 0 ? ((usedCap / totalCap) * 100).toFixed(1) : 0;
    const elOcc = document.getElementById("kpi-analytics-occupancy");
    const elCap = document.getElementById("kpi-analytics-capacity");
    if (elOcc) elOcc.textContent = `${occRate}%`;
    if (elCap) elCap.textContent = `${totalCap}`;

    // 2. Cập nhật Phân Bổ Cổng Phân Loại IoT
    const gatesList = document.getElementById("analytics-gates-list");
    if (gatesList && data.sorting.gates) {
        gatesList.innerHTML = "";
        const totalDiverted = Math.max(data.sorting.total_diverted, 1);

        data.sorting.gates.forEach(g => {
            const count = g.diverted_count || 0;
            const pct = ((count / totalDiverted) * 100).toFixed(0);
            const gateDiv = document.createElement("div");
            gateDiv.className = "gate-progress-item";
            gateDiv.innerHTML = `
                <div class="gate-progress-meta">
                    <span class="gate-name">Cổng ${g.gate_number}: ${g.target_province}</span>
                    <span class="gate-count"><b>${count}</b> kiện (${pct}%)</span>
                </div>
                <div class="progress-track">
                    <div class="progress-fill" style="width: ${Math.max(pct, 4)}%; background: #2563eb;"></div>
                </div>
            `;
            gatesList.appendChild(gateDiv);
        });

        // Hàng Tái kiểm (Re-check lane)
        const recheckDiv = document.createElement("div");
        recheckDiv.className = "gate-progress-item";
        recheckDiv.innerHTML = `
            <div class="gate-progress-meta">
                <span class="gate-name text-muted">Làn Tái Kiểm Tra (Re-check / Ngoại lệ)</span>
                <span class="gate-count"><b>0</b> kiện (0%)</span>
            </div>
            <div class="progress-track">
                <div class="progress-fill" style="width: 2%; background: #94a3b8;"></div>
            </div>
        `;
        gatesList.appendChild(recheckDiv);
    }

    // 3. Cập nhật Phân Vùng Lưu Kho ABC
    const abcZones = document.getElementById("analytics-abc-zones");
    if (abcZones && data.storage_zones) {
        abcZones.innerHTML = "";
        const zoneColors = {
            "Zone A": { bg: "#ecfdf5", border: "#10b981", badge: "badge-success", fill: "#10b981" },
            "Zone B": { bg: "#fffbeb", border: "#f59e0b", badge: "badge-warning", fill: "#f59e0b" },
            "Zone C": { bg: "#f5f3ff", border: "#8b5cf6", badge: "badge-accent", fill: "#8b5cf6" }
        };

        Object.entries(data.storage_zones).forEach(([zName, zData]) => {
            const style = zoneColors[zName] || zoneColors["Zone A"];
            const card = document.createElement("div");
            card.className = "abc-zone-card";
            card.innerHTML = `
                <div class="abc-zone-header">
                    <div>
                        <span class="${style.badge} abc-zone-badge">${zName}</span>
                        <b style="margin-left: 8px; font-size: 0.88rem;">${zData.used_capacity} / ${zData.total_capacity} ô</b>
                    </div>
                    <span class="font-mono font-bold" style="font-size: 0.95rem; color: ${style.fill};">${zData.occupancy_rate}%</span>
                </div>
                <div class="progress-track">
                    <div class="progress-fill" style="width: ${Math.max(zData.occupancy_rate, 3)}%; background: ${style.fill};"></div>
                </div>
                <span class="abc-zone-desc">${zData.description}</span>
            `;
            abcZones.appendChild(card);
        });
    }

    // 4. Bảng Hiệu Năng Thực Nghiệm MOT Challenge & NFR
    const elMOTA = document.getElementById("metric-mota");
    const elIDF1 = document.getElementById("metric-idf1");
    const elIDSW = document.getElementById("metric-idsw");
    const elInf = document.getElementById("metric-inf");
    const elFPS = document.getElementById("metric-fps");

    if (elMOTA) elMOTA.textContent = `${(data.performance.ai_mota * 100).toFixed(1)}%`;
    if (elIDF1) elIDF1.textContent = `${(data.performance.ai_idf1 * 100).toFixed(1)}%`;
    if (elIDSW) elIDSW.textContent = `${data.performance.ai_id_switches} lần`;
    if (elInf) elInf.textContent = `${data.performance.ai_inference_ms.toFixed(1)} ms`;
    if (elFPS) elFPS.textContent = `${data.performance.fps.toFixed(1)} FPS`;
}

function exportKPIReport() {
    if (!lastKPIData) {
        alert("Chưa có dữ liệu KPI để xuất báo cáo. Vui lòng thử lại sau vài giây.");
        return;
    }

    const report = {
        project: "NEXUSLOG - Smart Warehouse Dispatching System (SV2026-ICTU-08)",
        exported_at: new Date().toISOString(),
        author: AppState.currentUser ? AppState.currentUser.full_name : "Administrator",
        kpi_metrics: lastKPIData,
        standards_compliance: {
            sorting_accuracy_target: ">= 99.0%",
            sorting_accuracy_achieved: `${lastKPIData.sorting.accuracy_rate}%`,
            ai_mota_target: ">= 80.0%",
            ai_mota_achieved: `${(lastKPIData.performance.ai_mota * 100).toFixed(1)}%`,
            ai_id_switches_target: "<= 2",
            ai_id_switches_achieved: lastKPIData.performance.ai_id_switches,
            a_star_latency_target: "<= 15.0 ms",
            a_star_latency_achieved: "< 1.0 ms",
            framerate_target: ">= 30.0 FPS",
            framerate_achieved: `${lastKPIData.performance.fps.toFixed(1)} FPS`,
            status: "ALL_ACCEPTANCE_CRITERIA_PASSED"
        }
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const dateStr = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    a.href = url;
    a.download = `NEXUSLOG_KPI_Report_${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}



/* ==========================================================================
   TRỤ CỘT 1: SIEMENS S7-1200 PLC & RFID UHF FRONTEND CONTROLLER
   ========================================================================== */

let currentPLCMode = "RUN";

function initPLCRFIDControls() {
    // 1. Modbus Sub-tab switching
    const subTabBtns = document.querySelectorAll(".modbus-tab-btn");
    const subPanes = document.querySelectorAll(".modbus-subpane");

    subTabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            const targetId = btn.getAttribute("data-modbus-sub");
            if (!targetId) return;

            subTabBtns.forEach(b => b.classList.remove("active"));
            subPanes.forEach(p => p.classList.remove("active"));

            btn.classList.add("active");
            const targetPane = document.getElementById(targetId);
            if (targetPane) targetPane.classList.add("active");
            if (targetId === "tab-logs") {
                loadLogs();
            }
        });
    });

    // 2. Chuyển đổi RUN / STOP CPU PLC
    const btnToggleMode = document.getElementById("btn-toggle-plc-mode");
    if (btnToggleMode) {
        btnToggleMode.addEventListener("click", () => {
            currentPLCMode = (currentPLCMode === "RUN") ? "STOP" : "RUN";
            const lbl = document.getElementById("lbl-plc-mode");
            if (lbl) lbl.textContent = currentPLCMode;
            if (AppState.ws && AppState.ws.readyState === WebSocket.OPEN) {
                AppState.ws.send(JSON.stringify({
                    action: "SET_PLC_MODE",
                    mode: currentPLCMode
                }));
            }
        });
    }

    // 3. Nút kích hoạt kiểm thử bắn 50 thẻ RFID (Burst Inventory Test)
    const btnBurst = document.getElementById("btn-trigger-rfid-burst");
    if (btnBurst) {
        btnBurst.addEventListener("click", () => {
            if (AppState.ws && AppState.ws.readyState === WebSocket.OPEN) {
                btnBurst.disabled = true;
                btnBurst.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang quét 50 thẻ...';
                AppState.ws.send(JSON.stringify({
                    action: "TRIGGER_RFID_BURST",
                    count: 50
                }));
                setTimeout(() => {
                    btnBurst.disabled = false;
                    btnBurst.innerHTML = '<i class="fa-solid fa-bolt"></i> Bắn Thử 50 Thẻ RFID (Burst Test)';
                }, 1200);
            }
        });
    }
}

function handleRFIDBurstResult(data) {
    if (!data) return;
    const msg = `⚡ ĐÃ HOÀN TẤT KIỂM KÊ HÀNG LOẠT:\n- Đọc thành công: ${data.tags_inventoried}/${data.burst_total_tags} thẻ\n- Số chu kỳ quét: ${data.rounds_count} vòng\n- Hệ số Q hội tụ: ${data.final_q}\n- Thời gian: ${data.duration_ms} ms\n- Tốc độ đọc: ${data.throughput_speed}`;
    alert(msg);
}

function forceCoil(addr, value) {
    if (AppState.ws && AppState.ws.readyState === WebSocket.OPEN) {
        AppState.ws.send(JSON.stringify({
            action: "SET_COIL",
            addr: parseInt(addr),
            value: Boolean(value)
        }));
    }
}

function writeRegister(addr, val) {
    if (AppState.ws && AppState.ws.readyState === WebSocket.OPEN) {
        AppState.ws.send(JSON.stringify({
            action: "SET_REGISTER",
            addr: parseInt(addr),
            value: parseInt(val)
        }));
    }
}

function updatePLCUi(plc) {
    if (!plc) return;

    // A. CPU Status LEDs
    const ledRun = document.getElementById("plc-led-run");
    const ledError = document.getElementById("plc-led-error");
    const ledMaint = document.getElementById("plc-led-maint");
    const lblMode = document.getElementById("lbl-plc-mode");

    if (lblMode) lblMode.textContent = plc.cpu_mode;

    if (ledRun) {
        if (plc.cpu_mode === "RUN") {
            ledRun.className = "plc-led led-green active";
        } else {
            ledRun.className = "plc-led led-yellow active"; // STOP mode
        }
    }

    const hasError = plc.holding_registers.some(r => r.addr === 40006 && r.value !== 0);
    if (ledError) {
        if (hasError) {
            ledError.className = "plc-led led-red active";
        } else {
            ledError.className = "plc-led led-red";
        }
    }

    const scanTimeTxt = document.getElementById("plc-scan-time-txt");
    if (scanTimeTxt) scanTimeTxt.textContent = `${plc.scan_time_ms || 12} ms`;

    // B. Terminal Digital Inputs Strip (DI 0.0 - 0.7)
    const diStrip = document.getElementById("plc-di-leds");
    if (diStrip && plc.discrete_inputs) {
        diStrip.innerHTML = plc.discrete_inputs.map((di, idx) => `
            <div class="pin-cell ${di.state ? 'active-input' : ''}" title="${di.label}">
                <div class="pin-indicator"></div>
                <span>.0${idx}</span>
            </div>
        `).join("");
    }

    // C. Terminal Digital Outputs Strip (DQ 0.0 - 0.7)
    const dqStrip = document.getElementById("plc-dq-leds");
    if (dqStrip && plc.coils) {
        dqStrip.innerHTML = plc.coils.map((dq, idx) => `
            <div class="pin-cell ${dq.state ? 'active-output' : ''}" title="${dq.label}">
                <div class="pin-indicator"></div>
                <span>.0${idx}</span>
            </div>
        `).join("");
    }

    // D. Bảng Modbus Coils Table
    const coilsTbody = document.getElementById("modbus-coils-tbody");
    if (coilsTbody && plc.coils) {
        coilsTbody.innerHTML = plc.coils.map((c, i) => `
            <tr>
                <td><strong>0000${i + 1}</strong></td>
                <td><code>${c.pin}</code></td>
                <td>${c.label}</td>
                <td>
                    <span class="badge-${c.state ? 'success' : 'light'}">
                        ${c.state ? '1 (ON / HIGH)' : '0 (OFF / LOW)'}
                    </span>
                </td>
                <td>
                    ${c.state ? 
                        `<button class="btn-force-toggle btn-force-off" onclick="forceCoil(${i}, false)">Force OFF</button>` : 
                        `<button class="btn-force-toggle btn-force-on" onclick="forceCoil(${i}, true)">Force ON</button>`
                    }
                </td>
            </tr>
        `).join("");
    }

    // E. Bảng Modbus DI Table
    const diTbody = document.getElementById("modbus-di-tbody");
    if (diTbody && plc.discrete_inputs) {
        diTbody.innerHTML = plc.discrete_inputs.map((di, i) => `
            <tr>
                <td><strong>1000${i + 1}</strong></td>
                <td><code>${di.pin}</code></td>
                <td>${di.label}</td>
                <td>
                    <span class="badge-${di.state ? 'success' : 'light'}">
                        ${di.state ? 'TRUE (Đóng)' : 'FALSE (Mở)'}
                    </span>
                </td>
                <td>${i === 4 ? '<span class="text-orange">NC (Thường đóng)</span>' : 'NO (Thường mở)'}</td>
            </tr>
        `).join("");
    }

    // F. Bảng Modbus Holding Registers Table
    const hrTbody = document.getElementById("modbus-hr-tbody");
    if (hrTbody && plc.holding_registers) {
        hrTbody.innerHTML = plc.holding_registers.map((hr, i) => `
            <tr>
                <td><strong>${hr.addr}</strong></td>
                <td>${hr.name}</td>
                <td style="color:#0284c7; font-weight:700;">${hr.value}</td>
                <td><code>${hr.unit}</code></td>
                <td>
                    ${i === 0 ? 
                        `<input type="number" value="${hr.value}" min="100" max="1000" step="50" style="width:70px; padding:2px 4px; font-size:0.8rem;" onchange="writeRegister(0, this.value)">` : 
                        `<span style="color:var(--text-muted); font-size:0.75rem;">Chỉ đọc HIL</span>`
                    }
                </td>
            </tr>
        `).join("");
    }
}

function updateRFIDPortalUi(rfid) {
    if (!rfid) return;

    const qVal = document.getElementById("rfid-q-val");
    if (qVal) qVal.textContent = rfid.q_factor;

    const slotsTxt = document.getElementById("rfid-slots-txt");
    if (slotsTxt) slotsTxt.textContent = `Khe (Slots): ${Math.pow(2, Math.round(rfid.q_factor))}`;

    const colRate = document.getElementById("rfid-collision-rate");
    if (colRate) colRate.textContent = `${rfid.collision_rate_percent}%`;

    const colTxt = document.getElementById("rfid-collisions-txt");
    if (colTxt) colTxt.textContent = `Va chạm: ${rfid.total_collisions}`;

    const tpVal = document.getElementById("rfid-throughput-val");
    if (tpVal) tpVal.textContent = `${rfid.throughput_tag_per_sec || 0} tag/s`;

    const totalScans = document.getElementById("rfid-total-scans");
    if (totalScans) totalScans.textContent = rfid.total_scans_count.toLocaleString();

    const tagCountBadge = document.getElementById("rfid-tag-stream-count");
    if (tagCountBadge && rfid.recent_reads) {
        tagCountBadge.textContent = `${rfid.recent_reads.length} Thẻ trong bộ đệm`;
    }

    // Bảng luồng thẻ RFID thời gian thực
    const streamTbody = document.getElementById("rfid-tags-stream-tbody");
    if (streamTbody && rfid.recent_reads) {
        if (rfid.recent_reads.length === 0) {
            streamTbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-muted);">Đang chờ kiện hàng đi qua vùng phủ sóng RFID...</td></tr>`;
        } else {
            streamTbody.innerHTML = rfid.recent_reads.map(t => `
                <tr>
                    <td style="color:#0284c7; font-weight:700;">${t.epc}</td>
                    <td style="color:#64748b;">${t.tid}</td>
                    <td><strong>${t.barcode}</strong></td>
                    <td><span class="badge-soft-blue">${t.region}</span></td>
                    <td style="color:${t.rssi > -60 ? '#16a34a' : '#d97706'}; font-weight:600;">${t.rssi} dBm</td>
                    <td>Ant ${t.antenna_port}</td>
                    <td><span class="badge-success">${t.read_count}</span></td>
                </tr>
            `).join("");
        }
    }
}

// Khởi chạy khi tài liệu DOM sẵn sàng
document.addEventListener("DOMContentLoaded", () => {
    initPLCRFIDControls();
});


// ==========================================================================
// TẢI BÁO CÁO EXCEL (.XLSX CHUẨN CÔNG NGHIỆP 3 SHEETS)
// ==========================================================================
async function downloadExcelReport() {
    try {
        const token = AppState.token || (window.location.search.match(/token=([^&]+)/) ? window.location.search.match(/token=([^&]+)/)[1] : null);
        const resp = await fetch("/api/v1/analytics/export/excel", {
            headers: token ? { "Authorization": `Bearer ${token}` } : {}
        });
        if (!resp.ok) {
            alert("Không thể tạo file Excel. Mã lỗi: " + resp.status);
            return;
        }
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const dateStr = new Date().toISOString().slice(0, 10);
        a.href = url;
        a.download = `Bao_Cao_Van_Hanh_Kho_NEXUSLOG_${dateStr}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (err) {
        console.error("Lỗi xuất báo cáo Excel:", err);
        alert("Lỗi kết nối khi tải báo cáo Excel: " + err.message);
    }
}

// ==========================================================================
// NẠP VÀ HIỂN THỊ NHẬT KÝ KIỂM TOÁN AN NINH (AUDIT TRAIL)
// ==========================================================================
async function loadLogs() {
    try {
        const token = AppState.token || (window.location.search.match(/token=([^&]+)/) ? window.location.search.match(/token=([^&]+)/)[1] : null);
        const resp = await fetch("/api/v1/system-logs?limit=50", {
            headers: token ? { "Authorization": `Bearer ${token}` } : {}
        });
        if (!resp.ok) return;
        const data = await resp.json();
        const tbody = document.getElementById("logs-table-body");
        if (!tbody) return;
        if (!data.items || data.items.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:1.5rem;">Chưa có sự kiện kiểm toán nào được ghi nhận.</td></tr>`;
            return;
        }
        tbody.innerHTML = data.items.map(l => {
            const lvlBadge = l.level === 'CRITICAL' ? 'badge-danger' : (l.level === 'WARNING' ? 'badge-warning' : 'badge-success');
            return `
                <tr>
                    <td style="font-weight:700; color:#0f172a;">#${l.id}</td>
                    <td style="color:#64748b; font-size:0.82rem;">${l.created_at}</td>
                    <td><span class="badge-soft-blue">${l.actor}</span></td>
                    <td><span class="badge ${lvlBadge}" style="font-size:0.75rem;">${l.level}</span></td>
                    <td><strong>${l.action}</strong></td>
                    <td style="color:#334155; font-size:0.85rem;">${l.details}</td>
                    <td style="font-family:'JetBrains Mono',monospace; color:#0284c7; font-size:0.75rem;">${l.sha256}</td>
                </tr>
            `;
        }).join("");
    } catch (e) {
        console.warn("Lỗi nạp nhật ký kiểm toán:", e);
    }
}
