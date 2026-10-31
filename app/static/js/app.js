// ==========================================================================
// NEXUSLOG - LIGHT THEME CANVAS & INTERACTIVE CLIENT ENGINE
// ==========================================================================

const AppState = {
    token: localStorage.getItem("access_token") || null,
    currentUser: null,
    showAIBoundingBox: true,
    packages: [],
    locations: [],
    users: [],
    logs: [],
    amr: { 
        x: 520, y: 340, 
        targetX: 720, targetY: 170, 
        heading: 0, state: "ACTIVE", battery: 96 
    },
    itemsOnBelt: [
        { id: 7, x: 80, y: 155, barcode: "PKG-84001", conf: 0.98, gate: 1 },
        { id: 8, x: 280, y: 155, barcode: "PKG-84002", conf: 0.94, gate: 2 }
    ]
};

document.addEventListener("DOMContentLoaded", () => {
    initAuth();
    initNavigation();
    initCanvasEngine();
    initUserModal();
    initRoleCapsules();
    initCreatePackageModal();

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
        tbody.innerHTML = '<tr><td colspan="7" class="text-center" style="padding:2rem; color:#64748b;">Chưa có bưu kiện nào được ghi nhận. Bấm "Thêm Kiện Hàng" để tạo mới!</td></tr>';
        return;
    }

    AppState.packages.forEach(p => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><code>${p.barcode}</code></td>
            <td>${p.weight} kg</td>
            <td>${p.dimensions || '--'}</td>
            <td><strong>${p.destination_code}</strong></td>
            <td><span class="gate-slot active-gate">${p.gate_id ? 'Cổng ' + p.gate_id : 'Chưa phân làn'}</span></td>
            <td>
                <span class="badge" style="background:${p.status === 'Stored' ? '#ecfdf5' : '#eff6ff'}; color:${p.status === 'Stored' ? '#059669' : '#2563eb'}; font-weight:700;">
                    ● ${p.status}
                </span>
            </td>
            <td><code>${p.location_id ? 'Vị trí #' + p.location_id : 'Trên băng'}</code></td>
        `;
        tbody.appendChild(tr);
    });
}

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

// 5. Canvas 2D Engine (Clean Light Theme)
function initCanvasEngine() {
    const canvas = document.getElementById("warehouse-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    let animTime = 0;

    const btnSpawn = document.getElementById("btn-spawn-pkg");
    const btnToggleCam = document.getElementById("btn-toggle-cam");

    if (btnSpawn) {
        btnSpawn.addEventListener("click", () => {
            const nextId = AppState.itemsOnBelt.length + 7;
            AppState.itemsOnBelt.push({
                id: nextId,
                x: 60,
                y: 155,
                barcode: `PKG-${84000 + nextId}`,
                conf: (0.93 + Math.random() * 0.06).toFixed(2),
                gate: (nextId % 3) + 1
            });
        });
    }

    if (btnToggleCam) {
        btnToggleCam.addEventListener("click", () => {
            AppState.showAIBoundingBox = !AppState.showAIBoundingBox;
            btnToggleCam.classList.toggle("active");
        });
    }

    function renderLoop() {
        animTime += 0.02;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Nền Lưới
        drawCleanGrid(ctx, canvas.width, canvas.height);

        // Băng chuyền thông minh
        drawLightConveyor(ctx, animTime);

        // 3 Cổng Gạt Phân Loại IoT
        drawLightIoTGate(ctx, 220, 150, "Cổng 1", animTime);
        drawLightIoTGate(ctx, 360, 150, "Cổng 2", animTime + 1, true);
        drawLightIoTGate(ctx, 500, 150, "Cổng 3", animTime + 2);

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

    function drawLightIoTGate(ctx, x, y, title, t, isActive = false) {
        ctx.fillStyle = isActive ? "#eff6ff" : "#ffffff";
        ctx.strokeStyle = isActive ? "#2563eb" : "#cbd5e1";
        ctx.lineWidth = isActive ? 2 : 1;
        ctx.fillRect(x - 5, y - 18, 48, 22);
        ctx.strokeRect(x - 5, y - 18, 48, 22);

        ctx.fillStyle = isActive ? "#2563eb" : "#475569";
        ctx.font = "bold 10px 'Plus Jakarta Sans', sans-serif";
        ctx.fillText(title, x + 6, y - 3);

        ctx.strokeStyle = isActive ? "#2563eb" : "#cbd5e1";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(x + 19, y + 44); ctx.lineTo(x + 19, y + 95); ctx.stroke();
        ctx.setLineDash([]);
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
            p.x += 1.0;
            if (p.x > 560) p.x = 42;

            ctx.fillStyle = "#f59e0b";
            ctx.fillRect(p.x, p.y - 12, 30, 24);
            ctx.strokeStyle = "#d97706";
            ctx.lineWidth = 1.5;
            ctx.strokeRect(p.x, p.y - 12, 30, 24);
        });
    }

    function drawLightStorageRacks(ctx) {
        const rx = 650, ry = 60;
        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 12px 'Plus Jakarta Sans', sans-serif";
        ctx.fillText("Kệ hàng (Storage)", rx, ry - 12);

        for (let row = 0; row < 2; row++) {
            for (let col = 0; col < 4; col++) {
                const ox = rx + col * 48;
                const oy = ry + row * 40;
                ctx.fillStyle = "#e2e8f0";
                ctx.fillRect(ox, oy, 40, 32);
                ctx.strokeStyle = "#cbd5e1";
                ctx.lineWidth = 1;
                ctx.strokeRect(ox, oy, 40, 32);

                if ((row + col) % 2 === 0) {
                    ctx.fillStyle = "#3b82f6";
                    ctx.fillRect(ox + 8, oy + 8, 24, 16);
                }
            }
        }
    }

    function drawLightAMR(ctx, t) {
        const amr = AppState.amr;
        amr.x += (amr.targetX - amr.x) * 0.015;
        amr.y += (amr.targetY - amr.y) * 0.015;

        if (Math.hypot(amr.targetX - amr.x, amr.targetY - amr.y) < 10) {
            amr.targetX = amr.targetX === 720 ? 540 : 720;
            amr.targetY = amr.targetY === 170 ? 330 : 170;
        }

        ctx.strokeStyle = "#2563eb";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(amr.x, amr.y);
        ctx.lineTo(amr.targetX, amr.targetY);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.strokeStyle = "#2563eb";
        ctx.fillStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(amr.targetX, amr.targetY, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#0f172a";
        ctx.fillRect(amr.x - 14, amr.y - 14, 28, 28);
        ctx.fillStyle = "#f59e0b";
        ctx.fillRect(amr.x - 6, amr.y - 6, 12, 12);

        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 10px 'Plus Jakarta Sans', sans-serif";
        ctx.fillText("AMR", amr.x + 18, amr.y + 4);
    }

    renderLoop();
}
