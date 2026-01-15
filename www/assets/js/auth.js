const API_BASE = "/api"; // Al estar en el mismo dominio seriegal.com, puedes dejarlo vacío o "/api" si usas un proxy

function getAuthToken() {
    return localStorage.getItem("ws_token");
}

function setAuthToken(token) {
    if (token) {
        localStorage.setItem("ws_token", token);
    } else {
        localStorage.removeItem("ws_token");
    }
}

// --- NUEVA FUNCIÓN PARA EL CONTADOR REAL ---
function startLockoutTimer(seconds, messageEl) {
    const submitBtn = document.getElementById("authSubmitBtn");
    const inputs = document.querySelectorAll("#authForm input");
    let remaining = seconds;

    // Bloqueamos la interfaz y aplicamos estilo visual
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.style.opacity = "0.5";
        submitBtn.style.cursor = "not-allowed";
    }
    
    inputs.forEach(i => {
        i.disabled = true;
        i.style.backgroundColor = "#2a2a2a"; // Un gris oscuro de fondo
        i.style.color = "#777";             // Texto gris
        i.style.cursor = "not-allowed";
        i.style.opacity = "0.6";            // El toque clave de "desactivado"
    });

    const interval = setInterval(() => {
        if (messageEl) {
            messageEl.textContent = `Demasiados intentos. Espera ${remaining} segundos.`;
            messageEl.style.color = "#ff6b6b";
        }
        
        remaining--;

        if (remaining < 0) {
            clearInterval(interval);
            // Restauramos todo a la normalidad
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.style.opacity = "1";
                submitBtn.style.cursor = "pointer";
            }
            inputs.forEach(i => {
                i.disabled = false;
                i.style.backgroundColor = ""; // Vuelve al original del CSS
                i.style.color = "";
                i.style.cursor = "text";
                i.style.opacity = "1";
            });
            if (messageEl) messageEl.textContent = "";
        }
    }, 1000);
}

async function doAuth(mode = "login") {
    const username = document.getElementById("authUsername")?.value?.trim();
    const password = document.getElementById("authPassword")?.value;
    const confirmPass = document.getElementById("authConfirmPassword")?.value;
    const messageEl = document.getElementById("authMessage");

    if (!username || !password) {
        if (messageEl) messageEl.textContent = "Usuario y contraseña son obligatorios";
        return;
    }

    if (mode === "register" && password !== confirmPass) {
        if (messageEl) messageEl.textContent = "Las contraseñas no coinciden";
        return;
    }

    try {
        const endpoint = mode === "register" ? "/register" : "/login";
        const res = await fetch(`${API_BASE}${endpoint}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });

        // --- LÓGICA PARA BLOQUEO POR FUERZA BRUTA (429) ---
        if (res.status === 429) {
            // Sacamos el tiempo del header Retry-After que envía tu Python
            const retryAfter = parseInt(res.headers.get("Retry-After")) || 60;
            startLockoutTimer(retryAfter, messageEl);
            return; // Salimos para que no ejecute el resto
        }

        if (!res.ok) {
            const err = await res.text();
            throw new Error(err || "Error en el servidor");
        }

        const data = await res.json();
        setAuthToken(data.token);

        if (window.location.hash && window.location.hash !== "#home") {
            localStorage.setItem("pending_navigation", window.location.hash);
        }

        const overlay = document.getElementById("authOverlay");
        if (overlay) {
            overlay.style.display = "none";
            overlay.remove();
        }

        document.body.classList.remove("auth-required");
        location.reload();

    } catch (e) {
        if (messageEl) {
            messageEl.textContent = e.message.includes("ya existe") 
                ? "El usuario ya existe" 
                : e.message;
        }
    }
}

// El resto de funciones se mantienen igual
document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("authForm");
    if (form) {
        form.addEventListener("submit", (e) => {
            e.preventDefault();
            const activeTab = document.querySelector(".tab-btn.active");
            const mode = activeTab ? activeTab.dataset.mode : "login";
            doAuth(mode);
        });
    }

    document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");

            const mode = btn.dataset.mode;
            const titleEl = document.getElementById("authTitle");
            const btnEl = document.getElementById("authSubmitBtn");
            const confirmGroup = document.getElementById("confirmPasswordGroup");

            if (titleEl) titleEl.textContent = mode === "register" ? "Crear cuenta" : "Iniciar sesión";
            if (btnEl) btnEl.textContent = mode === "register" ? "Registrarse" : "Entrar";
            if (confirmGroup) confirmGroup.style.display = mode === "register" ? "block" : "none";
            const msg = document.getElementById("authMessage");
            if (msg) msg.textContent = "";
        });
    });
});

function logout() {
    setAuthToken(null);
    location.reload();
}

async function fetchMe() {
    const token = getAuthToken();
    if (!token) return null;

    try {
        const res = await fetch(`${API_BASE}/me`, {
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (!res.ok) throw new Error("Sesión inválida");

        const data = await res.json();
        localStorage.setItem("ws_username", data.username || "Usuario");
        return data;
    } catch {
        logout();
        return null;
    }
}

async function initAuth() {
    const token = getAuthToken();
    if (!token) {
        document.body.classList.add("auth-required");
        return;
    }

    try {
        const user = await fetchMe();
        if (user) {
            document.body.classList.remove("auth-required");
            const overlay = document.getElementById("authOverlay");
            if (overlay) {
                overlay.style.display = "none";
                overlay.remove();
            }
            const mainContent = document.getElementById("main-content");
            if (mainContent) mainContent.style.display = "block";
            const logoutBtn = document.getElementById("logoutBtn");
            if (logoutBtn) logoutBtn.style.display = "inline-block";
            const userNameEl = document.getElementById("userName");
            if (userNameEl) {
                userNameEl.textContent = localStorage.getItem("ws_username") || "Usuario";
            }
        }
    } catch (err) {
        logout();
        document.body.classList.add("auth-required");
    }
}

function getAuthHeader() {
    const token = getAuthToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}