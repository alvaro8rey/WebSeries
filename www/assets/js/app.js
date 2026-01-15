/* ================= STATE ================= */
window.series = [];
window.movies = [];
window.catalogReady = false;
window.isNavigatingToHash = false;
window.isPopState = false;
// Variables de estado local (pueden ser let)
let currentSerie = null;
let currentSeasonIndex = 0;
let currentEpisodePage = 0;
let favoritesList = [];
let searchIndex = [];
const EPISODES_PER_PAGE = 20;
/* ================= EMERGENCY HASH CAPTURE ================= */
// Capturamos el hash original ANTES de que cualquier script lo toque
(function() {
    const originalHash = window.location.hash;
    if (originalHash && originalHash !== "#home" && originalHash !== "#") {
        console.log("🔒 Enlace protegido al arranque:", originalHash);
        localStorage.setItem("pending_navigation", originalHash);
    }
})();
// Variables del reproductor
let hlsInstance = null;
let currentEpisodeElement = null;
let autoplayTimer = null;
/* ================= INITIAL CHECKS ================= */
// Bloqueo preventivo de navegación si el usuario no tiene token
if (!localStorage.getItem("ws_token")) {
    document.body.classList.add("auth-required");
   
    // Si el usuario trae un enlace pero no está logueado, lo protegemos
    // en el "bolsillo" para que no se pierda tras el login
    if (window.location.hash && window.location.hash !== "#home") {
        localStorage.setItem("pending_navigation", window.location.hash);
    }
}
/* ================= LOCAL FALLBACK STORAGE ================= */
const getLocalProgress = () => {
  try {
    return JSON.parse(localStorage.getItem("webseries_progress") || "{}");
  } catch (e) {
    console.error("Error parsing webseries_progress:", e);
    return {};
  }
};
const saveLocalProgress = (key, data) => {
  const p = getLocalProgress();
  p[key] = data;
  localStorage.setItem("webseries_progress", JSON.stringify(p));
};
const getWatched = () => {
  try {
    return JSON.parse(localStorage.getItem("webseries_watched") || "{}");
  } catch (e) {
    console.error("Error parsing webseries_watched:", e);
    return {};
  }
};
const markWatched = (key) => {
  const w = getWatched();
  w[key] = true;
  localStorage.setItem("webseries_watched", JSON.stringify(w));
};
/* ================= AUTH HELPERS (desde auth.js) ================= */
async function fetchWithAuth(url, options = {}) {
  const headers = {
    ...options.headers,
    ...getAuthHeader(),
    "Content-Type": "application/json"
  };
  try {
    const response = await fetch(url, { ...options, headers });
    if (response.status === 401) {
      logout();
      throw new Error("Sesión expirada");
    }
    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }
    return response;
  } catch (err) {
    console.error("Error en fetchWithAuth:", err);
    throw err;
  }
}
/* ================= LOAD CATALOG ================= */
fetch("catalog.json")
    .then(r => {
        if (!r.ok) throw new Error("No se pudo cargar catalog.json");
        return r.json();
    })
    .then(data => {
        series = data.series || [];
        movies = data.movies || [];
        catalogReady = true;
        handleHashNavigation();
    })
    .catch(err => {
        console.error("ERROR CRÍTICO:", err);
        document.body.innerHTML += "<div style='color:white; padding:20px;'>Error cargando el catálogo.</div>";
    });
/* ================= HELPERS ================= */
function getEpisodesFromSerie(serie) {
  let eps = [];
  if (serie.seasons && serie.seasons.length) {
    eps = serie.seasons[currentSeasonIndex].episodes || [];
  } else {
    eps = serie.episodes || [];
  }
  // Sort una sola vez al cargar la serie
  if (!serie.sortedEpisodes) {
    serie.sortedEpisodes = [...eps].sort((a, b) => {
      const cleanA = a.id.replace(/-/g, ".").replace(/[^\d.]/g, "");
      const cleanB = b.id.replace(/-/g, ".").replace(/[^\d.]/g, "");
      const na = parseFloat(cleanA) || 0;
      const nb = parseFloat(cleanB) || 0;
      return na - nb;
    });
  }
  return serie.sortedEpisodes;
}
function formatTime(sec) {
  if (!sec || isNaN(sec)) return "0:00";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return h > 0 ? `${h}:${m.toString().padStart(2, "0")}:${s}` : `${m}:${s}`;
}
function episodeNumberFromId(id) {
  const n = parseInt(id.replace(/\D/g, ""), 10);
  return isNaN(n) ? "" : n;
}
async function handleHashNavigation() {
    let hash = decodeURIComponent(window.location.hash);
    const pending = localStorage.getItem("pending_navigation");
    // Si la URL se volvió #home pero tenemos un pendiente, LO FORZAMOS
    if (pending && (!hash || hash === "" || hash === "#home")) {
        console.log("⚠️ Detectada redirección no deseada a Home. Restaurando enlace...");
        hash = pending;
        history.replaceState({ view: pending.split('-')[0].replace('#', '') }, "", pending);
    }
    if (!hash || hash === "" || hash === "#home") {
        window.isNavigatingToHash = false;
        showHome();
        localStorage.removeItem("pending_navigation");
        return;
    }
    window.isNavigatingToHash = true;
    if (!window.series || window.series.length === 0) {
        setTimeout(handleHashNavigation, 100);
        return;
    }
    // Si llegamos aquí, ya podemos limpiar el 'bolsillo'
    localStorage.removeItem("pending_navigation");
    window.isPopState = true;
    if (hash.startsWith('#movie-')) {
        openMovie(hash.replace('#movie-', ''));
    } else if (hash.startsWith('#serie-')) {
        openSerie(hash.replace('#serie-', ''));
    } else {
        showHome();
    }
    setTimeout(() => { window.isNavigatingToHash = false; window.isPopState = false; }, 500);
}
/* ================= HOME ================= */
function showHome() {
    // 1. ESCUDO RADICAL
    // Si el enrutador está procesando un enlace o la URL tiene contenido, abortamos.
    const hash = window.location.hash;
    if (window.isNavigatingToHash) {
        console.log("showHome bloqueado: isNavigatingToHash está activo.");
        return;
    }
    if (hash && hash !== "" && hash !== "#" && hash !== "#home" && !window.isPopState) {
        if (hash.startsWith('#movie-') || hash.startsWith('#serie-') || hash === '#favorites' || hash.startsWith('#search') || hash === '#series' || hash === '#movies') {
            console.log("showHome bloqueado: detectado enlace directo en hash.");
            return;
        }
    }
    // 2. LIMPIEZA DE ESTADO
    if (typeof stopPlayer === "function") stopPlayer();
    currentSerie = null;
    // 3. GESTIÓN DE HISTORIAL
    if (!window.isPopState) {
        // Solo forzamos #home si realmente estamos en la raíz
        if (!hash || hash === "" || hash === "#" || hash === "#home") {
            history.pushState({ view: 'home' }, "Home", "#home");
        }
    }
    window.isPopState = false;
    // 4. CONTROL DE VISIBILIDAD
    const homeEl = document.getElementById("home");
    const viewEl = document.getElementById("view");
    const backBtn = document.getElementById("backBtn");
   
    if (homeEl) homeEl.style.display = "block";
    if (viewEl) {
        viewEl.style.display = "none";
        viewEl.innerHTML = "";
    }
    if (backBtn) backBtn.style.display = "none";
    // 5. RENDERIZAR "CONTINUAR VIENDO"
    if (typeof renderContinueWatching === "function") {
        renderContinueWatching();
    }
    // 6. RENDERIZAR CARRUSEL DE SERIES
    const seriesRowEl = document.getElementById("seriesRow");
    // Usamos las variables globales que definiste al inicio
    if (seriesRowEl && typeof series !== 'undefined' && series.length > 0) {
        const latestSeries = [...series]
            .sort((a, b) => (new Date(b.updated_at || 0)) - (new Date(a.updated_at || 0)))
            .slice(0, 10);
        seriesRowEl.innerHTML = `
            <div class="row-container">
                <button class="nav-btn left is-hidden" onclick="sideScroll(this, 'left')">‹</button>
                <div class="row" onscroll="checkScrollArrows()">
                    ${latestSeries.map(cardHTMLSerie).join("")}
                </div>
                <button class="nav-btn right" onclick="sideScroll(this, 'right')">›</button>
            </div>
        `;
    }
    // 7. RENDERIZAR CARRUSEL DE PELÍCULAS
    const moviesRowEl = document.getElementById("moviesRow");
    if (moviesRowEl && typeof movies !== 'undefined' && movies.length > 0) {
        const latestMovies = [...movies]
            .sort((a, b) => (new Date(b.updated_at || 0)) - (new Date(a.updated_at || 0)))
            .slice(0, 10);
        moviesRowEl.innerHTML = `
            <div class="row-container">
                <button class="nav-btn left is-hidden" onclick="sideScroll(this, 'left')">‹</button>
                <div class="row" onscroll="checkScrollArrows()">
                    ${latestMovies.map(cardHTMLMovie).join('')}
                </div>
                <button class="nav-btn right" onclick="sideScroll(this, 'right')">›</button>
            </div>
        `;
    }
    // 8. FINALIZAR UI
    window.scrollTo(0, 0);
    setTimeout(() => {
        if (typeof checkScrollArrows === "function") checkScrollArrows();
    }, 300);
}
async function renderContinueWatching() {
    const contEl = document.getElementById("continue");
    if (!contEl) return;
    const token = localStorage.getItem("ws_token");
    if (!token) {
        contEl.innerHTML = "";
        return;
    }
    try {
        const response = await fetchWithAuth(`${API_BASE}/continue-watching`);
        const lasts = await response.json();
        if (!lasts || lasts.length === 0) {
            contEl.innerHTML = "";
            return;
        }
        contEl.innerHTML = `
            <div class="section-header"><h2>▶️ Continuar viendo</h2></div>
            <div class="row-container">
                <div class="row">
                    ${lasts.map(item => {
                        const percent = Math.min(100, (item.time / item.duration) * 100);
                        const seriesDisplayName = item.series_id.replace(/_/g, ' ').toUpperCase();
                       
                        // Aplicamos la limpieza aquí para la tarjeta del Home
                        const displayEpisodeTitle = cleanEpisodeTitle(item.episode_title);
                       
                        return `
                            <div class="continue-card" onclick="playFromHome('${item.series_id}','${item.url}','${item.episode_id}')">
                                <button class="delete-continue-btn" onclick="removeProgress(event, '${item.series_id}', '${item.episode_id}')">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                                        <path d="M18 6L6 18M6 6l12 12"/>
                                    </svg>
                                </button>
                                <img src="images/${item.series_id}.jpg" onerror="this.src='images/default.jpg'">
                                <div class="continue-info">
                                    <div class="continue-top-row">
                                        <div class="continue-series-name">${seriesDisplayName}</div>
                                    </div>
                                    <div class="continue-title-container">
                                        <div class="continue-episode-title">${displayEpisodeTitle}</div>
                                    </div>
                                    <div class="continue-bottom-info">
                                        <div class="continue-time">${formatTime(item.time)} / ${formatTime(item.duration)}</div>
                                        <div class="progress-bar"><div class="progress" style="width:${percent}%"></div></div>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join("")}
                </div>
            </div>
        `;
    } catch (err) {
        console.error("Error en renderContinueWatching:", err);
    }
}
// Función para ejecutar el borrado
async function removeProgress(event, seriesId, episodeId) {
    event.stopPropagation(); // Evita que se abra el video al hacer clic en la X
   
    try {
        const response = await fetch(`${API_BASE}/progress/${seriesId}/${episodeId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem("ws_token")}`
            }
        });
        if (response.ok) {
            renderContinueWatching();
        }
    } catch (error) {
        console.error("Error al borrar progreso:", error);
    }
}
/* ================= CARDS ================= */
function isNew(timestamp) {
    if (!timestamp) return false;
   
    const now = Date.now();
    // Multiplicamos por 1000 porque el mtime de Python viene en segundos
    const updatedMs = timestamp * 1000;
    const fiveDaysInMs = 5 * 24 * 60 * 60 * 1000;
   
    const diff = now - updatedMs;
    // Es nuevo si la diferencia es positiva (no es del futuro) y menor a 5 días
    return diff > 0 && diff < fiveDaysInMs;
}
function cardHTMLSerie(serie) {
    const flags = {
    "es": {
        svg: `<svg width="16" height="16" viewBox="0 0 512 512">
                <circle cx="256" cy="256" r="256" fill="#f0f0f0"/>
                <path d="M0 256c0 31.3 5.6 61.3 15.9 89h480.2c10.3-27.7 15.9-57.7 15.9-89s-5.6-61.3-15.9-89H15.9C5.6 194.7 0 224.7 0 256z" fill="#ffda44"/>
                <path d="M496.1 167a256 256 0 0 0-480.2 0h480.2zM15.9 345a256 256 0 0 0 480.2 0H15.9z" fill="#d80027"/>
             </svg>`,
        label: "ES"
    },
    "gl": {
        svg: `<svg width="16" height="16" viewBox="0 0 512 512">
                <rect width="512" height="512" fill="#fff"/>
                <path d="M560 420L-50 20v130L560 550z" fill="#0099cc"/>
             </svg>`,
        label: "GL"
    }
};
    const langData = flags[serie.lang] || { svg: "", label: "" };
    const isFav = favoritesList.includes(String(serie.id));
    // Lógica de etiqueta Nuevo (Esquina Izquierda)
    const newBadge = isNew(serie.updated_at) ? `<div class="badge-new">¡Nuevo!</div>` : '';
    return `
    <div class="card" onclick="openSerie('${serie.id}')">
        <div class="card-img-container">
            ${newBadge}
            <span class="fav-star ${isFav ? 'active' : ''}" onclick="toggleFavoriteGlobal(event, '${serie.id}', 'serie')">★</span>
            <img src="images/${serie.id}.jpg" loading="lazy" onerror="this.src='images/default.jpg'">
            <div class="lang-tag">${langData.label} ${langData.svg}</div>
        </div>
        <div class="meta">
            <div class="title-container">
                <div class="title scroll-title">${serie.title}</div>
            </div>
        </div>
    </div>`;
}
function cardHTMLMovie(movie) {
    const flags = {
    "es": {
        svg: `<svg width="16" height="16" viewBox="0 0 512 512">
                <circle cx="256" cy="256" r="256" fill="#f0f0f0"/>
                <path d="M0 256c0 31.3 5.6 61.3 15.9 89h480.2c10.3-27.7 15.9-57.7 15.9-89s-5.6-61.3-15.9-89H15.9C5.6 194.7 0 224.7 0 256z" fill="#ffda44"/>
                <path d="M496.1 167a256 256 0 0 0-480.2 0h480.2zM15.9 345a256 256 0 0 0 480.2 0H15.9z" fill="#d80027"/>
             </svg>`,
        label: "ES"
    },
    "gl": {
        svg: `<svg width="16" height="16" viewBox="0 0 512 512">
                <rect width="512" height="512" fill="#fff"/>
                <path d="M560 420L-50 20v130L560 550z" fill="#0099cc"/>
             </svg>`,
        label: "GL"
    }
};
    const langData = flags[movie.lang] || { svg: "", label: "" };
    const isFav = favoritesList.includes(String(movie.id));
    // Lógica de etiqueta Nuevo (Esquina Izquierda)
    const newBadge = isNew(movie.updated_at) ? `<div class="badge-new">¡Nuevo!</div>` : '';
    return `
    <div class="card" onclick="openMovie('${movie.id}')">
        <div class="card-img-container">
            ${newBadge}
            <span class="fav-star ${isFav ? 'active' : ''}" onclick="toggleFavoriteGlobal(event, '${movie.id}', 'movie')">★</span>
            <img src="images/${movie.id}.jpg" loading="lazy" onerror="this.src='images/default.jpg'">
            <div class="lang-tag">${langData.label} ${langData.svg}</div>
        </div>
        <div class="meta">
            <div class="title-container">
                <div class="title scroll-title">${movie.title}</div>
            </div>
        </div>
    </div>`;
}
/* ================= SYNC SERVER ============ */
function syncProgressToServer(sId, eId, title, url, time, duration) {
    // Si el usuario ya vio más del 98% o terminó, enviamos un tiempo que
    // el filtro del servidor (el de los 15 segundos) detectará como "finalizado"
    let timeToSend = time;
    if (time > duration - 10) {
        timeToSend = duration; // Forzamos que sea igual a la duración
    }
    fetchWithAuth(`${API_BASE}/progress`, {
        method: "POST",
        body: JSON.stringify({
            series_id: sId,
            episode_id: eId,
            episode_title: title || "Sin título",
            url: url || "",
            time: timeToSend,
            duration: duration
        })
    }).then(() => {
        // Opcional: Si el tiempo enviado fue el final, refrescar el home
        // para que la tarjeta desaparezca inmediatamente
        if (timeToSend === duration) {
            renderContinueWatching();
        }
    }).catch(err => console.error("Error de sincronización:", err));
}
function restoreProgress(player, savedTime, savedDuration) {
    // 1. Bloqueamos el inicio automático y mostramos carga
    player.pause();
    player.addClass('vjs-waiting');
    // 2. Si el tiempo es muy pequeño o ya terminó, no hacemos nada
    if (!savedTime || savedTime < 10 || savedTime > (savedDuration - 15)) {
        player.removeClass('vjs-waiting');
        return;
    }
    // 3. Intentamos el salto
    player.currentTime(savedTime);
    // 4. Verificamos que el salto se ha realizado con éxito
    const checkJump = setInterval(() => {
        // Si el tiempo actual del player es casi igual al guardado (margen de 1s)
        if (Math.abs(player.currentTime() - savedTime) < 1) {
            console.log("Salto completado con éxito a:", savedTime);
            player.removeClass('vjs-waiting');
            clearInterval(checkJump);
        }
    }, 200);
    // Seguridad: Si a los 5 segundos no ha saltado, desbloqueamos para no romper el player
    setTimeout(() => {
        clearInterval(checkJump);
        player.removeClass('vjs-waiting');
    }, 5000);
}
/* ================= SERIE VIEW ================= */
function goToEpisode(number) {
    if (!number || !currentSerie) return;
    const allEpisodes = getEpisodesFromSerie(currentSerie);
   
    // Buscamos el episodio cuyo ID o título contenga el número exacto
    // (Ajustamos según cómo sea el formato de tus IDs, ej: "ep005" o "5")
    const epIndex = allEpisodes.findIndex(e => {
        const match = e.id.match(/\d+/); // Extrae el número del ID
        return match && parseInt(match[0]) === parseInt(number);
    });
    if (epIndex !== -1) {
        const targetPage = Math.floor(epIndex / EPISODES_PER_PAGE);
       
        // Cambiamos la página global y renderizamos
        currentEpisodePage = targetPage;
        renderSerieView();
        // Pequeño delay para que el DOM se dibuje y podamos hacer scroll
        setTimeout(() => {
            const targetId = allEpisodes[epIndex].id;
            const el = document.getElementById(`ep-card-${targetId}`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.style.background = "rgba(56, 189, 248, 0.4)";
                setTimeout(() => el.style.background = "", 2500);
            }
        }, 300);
    } else {
        alert("Episodio no encontrado");
    }
}
function cleanEpisodeTitle(title) {
    if (!title) return "Sin título";

    // 1. Buscar la posición del primer " - "
    const firstDashIndex = title.indexOf(' - ');

    // 2. Si existe, devolver TODO lo que viene DESPUÉS (incluyendo guiones posteriores)
    if (firstDashIndex !== -1) {
        return title.substring(firstDashIndex + 3).trim();  // +3 para saltar " - "
    }

    // 3. Si no hay " - ", intentamos quitar solo el prefijo "Shin Chan XXX" por si acaso
    // (por si algún episodio viene sin guion)
    return title.replace(/^Shin Chan\s*\d+\s*-?\s*/i, '').trim() || "Episodio sin descripción";
}
async function openSerie(id, page = 0) { // Añadimos 'page = 0'
    stopPlayer();
    // Tu variable se llama 'series', así que la usamos:
    const foundSerie = series.find(s => s.id === id);
    if (!foundSerie) return;
    if (!window.isPopState) {
        history.pushState({ view: 'serie', id: id, page: page }, foundSerie.title, `#serie-${id}`);
    }
    window.isPopState = false;
    currentSerie = foundSerie;
    currentSeasonIndex = 0;
    currentEpisodePage = page; // <--- Ahora usa el parámetro que le enviamos
    let serverWatched = [];
    if (localStorage.getItem("ws_token")) {
        try {
            const resp = await fetchWithAuth(`${API_BASE}/series-progress/${id}`);
            serverWatched = await resp.json();
        } catch (e) { console.error("Error al pedir progreso", e); }
    }
    window.currentSerieWatched = serverWatched;
    const sections = ["home", "all-series", "movies", "favorites", "search-results"];
    sections.forEach(s => {
        const el = document.getElementById(s);
        if (el) el.style.display = "none";
    });
    document.getElementById("view").style.display = "block";
    renderSerieView();
}
function renderSerieView() {
    if (!currentSerie) return;
    // Aseguramos que tu botón de volver original se vea
    const globalBackBtn = document.getElementById("backBtn");
    if (globalBackBtn) globalBackBtn.style.display = "block";
    const allEpisodes = getEpisodesFromSerie(currentSerie);
    const totalEpisodes = allEpisodes.length;
    const totalPages = Math.ceil(totalEpisodes / EPISODES_PER_PAGE);
    const start = currentEpisodePage * EPISODES_PER_PAGE;
    const episodes = allEpisodes.slice(start, start + EPISODES_PER_PAGE);
   
    const isSerieFav = favoritesList.includes(String(currentSerie.id));
    // 1. Selector de temporadas
    const hasSeasons = currentSerie.seasons && currentSerie.seasons.length > 0;
    const seasonSelector = hasSeasons ? `
        <select class="season-select" onchange="changeSeason(this.value)">
            ${currentSerie.seasons.map((s, i) => `
                <option value="${i}" ${i === currentSeasonIndex ? "selected" : ""}>
                    ${s.title || `Temporada ${s.season}`}
                </option>
            `).join("")}
        </select>
    ` : "";
    // 2. Buscador GOTO
    const gotoHTML = (!hasSeasons && totalEpisodes > 20) ? `
        <div class="goto-episode">
            <span class="goto-label-desktop">EP</span>
            <input type="number" id="goto-input" placeholder="EP..."
                onkeyup="if(event.key==='Enter') goToEpisode(this.value)">
            <button onclick="goToEpisode(document.getElementById('goto-input').value)" class="goto-btn-minimal">
                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="4" fill="none">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
            </button>
        </div>
    ` : "";
    // 3. Paginación
    let paginationHTML = "";
    if (totalPages > 1) {
        let pages = [];
        const delta = window.innerWidth < 600 ? 1 : 2;
        pages.push(`<button class="page-btn" ${currentEpisodePage === 0 ? 'disabled' : ''} onclick="changePageTo(0)">«</button>`);
        pages.push(`<button class="page-btn" ${currentEpisodePage === 0 ? 'disabled' : ''} onclick="changePageTo(${currentEpisodePage - 1})">‹</button>`);
        for (let i = 0; i < totalPages; i++) {
            if (i === 0 || i === totalPages - 1 || (i >= currentEpisodePage - delta && i <= currentEpisodePage + delta)) {
                pages.push(`<button class="page-btn ${i === currentEpisodePage ? 'active' : ''}" onclick="changePageTo(${i})">${i + 1}</button>`);
            } else if (i === currentEpisodePage - delta - 1 || i === currentEpisodePage + delta + 1) {
                pages.push(`<span class="page-dots">...</span>`);
            }
        }
        pages.push(`<button class="page-btn" ${currentEpisodePage >= totalPages - 1 ? 'disabled' : ''} onclick="changePageTo(${currentEpisodePage + 1})">›</button>`);
        pages.push(`<button class="page-btn" ${currentEpisodePage >= totalPages - 1 ? 'disabled' : ''} onclick="changePageTo(${totalPages - 1})">»</button>`);
        paginationHTML = `<div class="pagination"><div class="pagination-numbers">${pages.join("")}</div></div>`;
    }
    // 4. Renderizado Final - Solo actualiza partes dinámicas para evitar parpadeo
    const viewEl = document.getElementById("view");
    viewEl.innerHTML = `
        <div class="serie-detail-header">
            <img src="images/${currentSerie.id}.jpg" onerror="this.src='images/default.jpg'" class="serie-poster">
            <div class="serie-info-text">
                <h2>${currentSerie.title}</h2>
                <p class="muted">${totalEpisodes} episodios</p>
                <div class="header-actions">
                    ${seasonSelector}
                    ${gotoHTML}
                    <button id="fav-main-btn" class="btn-fav-compact ${isSerieFav ? 'active' : ''}" onclick="handleMainFavClick(event, '${currentSerie.id}')">
                        <svg class="heart-icon" viewBox="0 0 24 24" fill="none"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" stroke="currentColor" stroke-width="2"/></svg>
                        <span class="btn-text">${isSerieFav ? 'Favorito' : 'Añadir'}</span>
                    </button>
                </div>
            </div>
        </div>
        <div class="episodes" id="episodesList">
            ${episodes.map((e, i) => {
                const realIndex = start + i;
                const isWatched = window.currentSerieWatched && window.currentSerieWatched.includes(String(e.id));
                const displayTitle = cleanEpisodeTitle(e.title);
                const episodeMatch = e.id.match(/\d+(\.\d+)?/);
                let displayNum = episodeMatch ? (Number.isInteger(parseFloat(episodeMatch[0])) ? parseFloat(episodeMatch[0]) : episodeMatch[0]) : realIndex + 1;
                return `
                    <div class="episode ${isWatched ? "watched" : ""}" id="ep-card-${e.id}" onclick='playEpisode(${JSON.stringify(e)}, this, ${realIndex})'>
                        <div class="episode-row">
                            <div class="episode-num">${displayNum}.</div>
                            <div class="episode-title-main">${displayTitle}</div>
                            ${isWatched ? '<div class="watched-check" style="color: #4caf50; margin-left: auto;">✔</div>' : ''}
                        </div>
                    </div>
                `;
            }).join("")}
        </div>
        ${paginationHTML}
    `;
}
// Nueva función de apoyo para evitar el parpadeo
async function syncServerWatchedStatus() {
    if (!localStorage.getItem("ws_token")) return;
    try {
        const resp = await fetchWithAuth(`${API_BASE}/continue-watching`);
        const serverProgress = await resp.json();
       
        serverProgress.forEach(sp => {
            // Si el servidor dice que está visto (falta menos de 15s)
            if (sp.series_id === currentSerie.id && (sp.duration - sp.time) < 15) {
                const epEl = document.getElementById(`ep-card-${sp.episode_id}`);
                if (epEl && !epEl.classList.contains('watched')) {
                    epEl.classList.add('watched');
                    const row = epEl.querySelector('.episode-row');
                    if (row && !row.querySelector('.watched-check')) {
                        row.insertAdjacentHTML('beforeend', '<div class="watched-check" style="color: #4caf50; margin-left: auto;">✔</div>');
                    }
                }
            }
        });
    } catch (e) {
        console.log("Sincronización silenciosa fallida");
    }
}
function changePageTo(pageIndex) {
    const allEpisodes = getEpisodesFromSerie(currentSerie);
    const totalPages = Math.ceil(allEpisodes.length / EPISODES_PER_PAGE);
    if (pageIndex >= 0 && pageIndex < totalPages) {
        currentEpisodePage = pageIndex;
       
        renderSerieView();
    }
}
function changeSeason(i) {
    currentSeasonIndex = parseInt(i);
    currentEpisodePage = 0;
    renderSerieView();
}
/* ================= MOVIE VIEW ================= */
async function openMovie(movieId) {
    stopPlayer();
    const movie = movies.find(m => m.id === movieId);
    if (!movie) return;

    if (!window.isPopState) {
        history.pushState({ view: 'movie', id: movieId }, movie.title, `#movie-${movieId}`);
    }
    window.isPopState = false;

    const sections = ["home", "all-series", "movies", "favorites", "search-results"];
    sections.forEach(s => {
        const el = document.getElementById(s);
        if (el) el.style.display = "none";
    });

    const viewEl = document.getElementById("view");
    viewEl.style.display = "block";
    window.scrollTo(0, 0);
   
    const isMovieFav = favoritesList.includes(String(movie.id));
    const key = movie.id + "_" + movie.id;

    viewEl.innerHTML = `
        <div class="serie-detail-header movie-detail-header">
            <img src="images/${movie.id}.jpg" onerror="this.src='images/default.jpg'" class="serie-poster">
            <div class="serie-info-text movie-info-container">
                <div class="movie-meta-top">
                    <span class="movie-year">${movie.year || 'N/A'}</span>
                </div>
                <h2>${movie.title}</h2>
                <p class="movie-description">${movie.description || 'Sin sinopsis disponible.'}</p>
                <div class="movie-actions header-actions">
                    <button class="auth-btn" onclick="document.getElementById('moviePlayerTarget').scrollIntoView({behavior:'smooth'})">
                        Ver ahora
                    </button>
                    <button id="fav-main-btn" class="btn-fav-compact ${isMovieFav ? 'active' : ''}" onclick="handleMainFavClick(event, '${movie.id}')">
                        <svg class="heart-icon" viewBox="0 0 24 24" fill="none"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" stroke="currentColor" stroke-width="2"/></svg>
                        <span class="btn-text">${isMovieFav ? 'Favorito' : 'Añadir'}</span>
                    </button>
                </div>
            </div>
        </div>
        <div id="moviePlayerTarget" class="player-container movie-player-box">
            <style>
                .video-js .vjs-play-progress:before, .video-js .vjs-play-progress:after { display: none !important; }
                .video-js .vjs-play-progress { border-right: 2px solid #fff; }
                .video-js .vjs-progress-holder { height: 8px !important; }
            </style>
            <video id="vjs-movie-player" class="video-js vjs-default-skin vjs-big-play-centered" playsinline></video>
        </div>
    `;

    const player = videojs('vjs-movie-player', {
        controls: true,
        autoplay: false,
        fluid: false,
        fill: true,
        responsive: true,
        html5: { vhs: { overrideNative: true } }
    });

    player.src({ src: movie.url, type: 'application/x-mpegURL' });
    window.currentVjs = player;

    // Lógica de miniaturas para películas
    player.ready(() => {
        const vttUrl = `/Peliculas_HLS/${movie.title}/thumbnails/index/index_thumbnails.vtt`;
        fetch(vttUrl)
            .then(r => { if(!r.ok) throw new Error(); return r.text(); })
            .then(text => {
                const cues = [];
                const lines = text.split(/\r?\n/);
                const vttBase = vttUrl.substring(0, vttUrl.lastIndexOf('/') + 1);
                for (let i = 0; i < lines.length; i++) {
                    const timeMatch = lines[i].match(/^(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})$/);
                    if (timeMatch) {
                        const start = timeToSeconds(timeMatch[1]);
                        const end = timeToSeconds(timeMatch[2]);
                        const refMatch = (lines[++i] || '').match(/^(.+?)#xywh=(\d+),(\d+),(\d+),(\d+)$/);
                        if (refMatch) cues.push({ start, end, sprite: vttBase + refMatch[1], x: parseInt(refMatch[2]), y: parseInt(refMatch[3]), w: parseInt(refMatch[4]), h: parseInt(refMatch[5]) });
                    }
                }
                if (cues.length === 0) return;
                const progressControl = player.controlBar.progressControl.el();
                const rail = player.controlBar.progressControl.seekBar.el();
                let tooltip = document.createElement('div');
                tooltip.className = 'custom-thumb-tooltip';
                rail.appendChild(tooltip);

                const updateTooltip = (clientX) => {
                    const rect = rail.getBoundingClientRect();
                    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
                    const time = (x / rect.width) * (player.duration() || cues[cues.length-1].end);
                    const cue = cues.find(c => time >= c.start && time < c.end);
                    if (!cue) { tooltip.classList.remove('visible'); return; }
                    tooltip.style.display = 'block';
                    requestAnimationFrame(() => tooltip.classList.add('visible'));
                    tooltip.style.left = `${x}px`;
                    tooltip.style.backgroundImage = `url("${cue.sprite}")`;
                    tooltip.style.backgroundPosition = `-${cue.x}px -${cue.y}px`;
                    tooltip.style.width = `${cue.w}px`;
                    tooltip.style.height = `${cue.h}px`;
                };
                progressControl.addEventListener('mousemove', e => updateTooltip(e.clientX));
                progressControl.addEventListener('mouseleave', () => tooltip.classList.remove('visible'));
            })
            .catch(() => {});

        // Recuperar progreso
        if (localStorage.getItem("ws_token")) {
            fetchWithAuth(`${API_BASE}/progress/${movie.id}/${movie.id}`)
                .then(r => r.json())
                .then(p => { if (p && p.time && p.time < (p.duration - 30)) player.currentTime(p.time); })
                .catch(() => {});
        }
    });

    let lastSavedSecondMovie = -1;
    player.on('timeupdate', () => {
        const curTime = player.currentTime();
        const duration = player.duration();
        const currentSecond = Math.floor(curTime);
        saveLocalProgress(key, { time: curTime, duration: duration });
        if (localStorage.getItem("ws_token") && currentSecond % 10 === 0 && currentSecond !== lastSavedSecondMovie) {
            lastSavedSecondMovie = currentSecond;
            syncProgressToServer(movie.id, movie.id, movie.title, movie.url, curTime, duration);
        }
    });

    player.on('ended', () => {
        if (localStorage.getItem("ws_token")) syncProgressToServer(movie.id, movie.id, movie.title, movie.url, player.duration(), player.duration());
        renderContinueWatching();
    });
}
/* ================= PLAYER ================= */
function playEpisode(ep, el, index) {
    if (currentEpisodeElement === el) {
        stopPlayer();
        currentEpisodeElement = null;
        return;
    }
    stopPlayer();
    currentEpisodeElement = el;

    const box = document.createElement("div");
    box.className = "player-container";
    box.innerHTML = `
        <style>
            .video-js .vjs-play-progress:before,
            .video-js .vjs-play-progress:after {
                display: none !important;
            }
            .video-js .vjs-play-progress {
                border-right: 2px solid #fff;
            }
            .video-js .vjs-progress-holder {
                height: 8px !important;
            }
        </style>
        <video id="vjs-player" class="video-js vjs-default-skin vjs-big-play-centered" playsinline></video>
        <button id="floatingNextBtn" class="btn-next-floating hidden">
            Siguiente episodio ➔
        </button>
        <div class="autoplay"></div>`;
    el.after(box);

    const seriesId = currentSerie ? currentSerie.id : ep.id;
    const key = seriesId + "_" + ep.id;

    const player = videojs('vjs-player', {
        controls: true,
        autoplay: false,
        fluid: false,
        fill: true,
        responsive: true,
        html5: { vhs: { overrideNative: true } }
    });

    window.currentVjs = player;
    player.src({ src: ep.url, type: 'application/x-mpegURL' });

    /* ================= MINIATURAS - RUTA CORRECTA CON/SIN TEMPORADA ================= */
    player.ready(() => {
        let seasonNum = null;

        // Buscar la temporada que contiene este episodio
        if (currentSerie && currentSerie.seasons) {
            for (const season of currentSerie.seasons) {
                if (season.episodes && season.episodes.some(e => e.id === ep.id)) {
                    seasonNum = season.season;
                    break;
                }
            }
        }

        const seasonFolder = seasonNum ? `Season ${String(seasonNum).padStart(2, '0')}/` : '';
        const epFolder = `ep${String(index + 1).padStart(3, '0')}`;

        // Ruta final correcta
        const vttUrl = `/Series_HLS/${encodeURIComponent(currentSerie.title)}/${seasonFolder}${epFolder}/thumbnails/index/index_thumbnails.vtt`;

        console.log("Intentando VTT:", vttUrl);

        fetch(vttUrl)
            .then(r => {
                if (!r.ok) {
                    console.warn(`VTT no encontrado: ${r.status} - ${vttUrl}`);
                    return null;
                }
                return r.text();
            })
            .then(text => {
                if (!text) return;

                const cues = [];
                const lines = text.split(/\r?\n/);
                const vttBase = vttUrl.substring(0, vttUrl.lastIndexOf('/') + 1);

                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i].trim();
                    const timeMatch = line.match(/^(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})$/);
                    if (timeMatch) {
                        const start = timeToSeconds(timeMatch[1]);
                        const end = timeToSeconds(timeMatch[2]);
                        const refLine = (lines[++i] || '').trim();
                        const refMatch = refLine.match(/^(.+?)#xywh=(\d+),(\d+),(\d+),(\d+)$/);
                        if (refMatch) {
                            cues.push({
                                start, end,
                                sprite: vttBase + refMatch[1],
                                x: parseInt(refMatch[2]), y: parseInt(refMatch[3]),
                                w: parseInt(refMatch[4]), h: parseInt(refMatch[5])
                            });
                        }
                    }
                }

                if (cues.length === 0) return;

                const progressControl = player.controlBar.progressControl.el();
                const rail = player.controlBar.progressControl.seekBar.el(); 
                if (!rail) return;

                let tooltip = rail.querySelector('.custom-thumb-tooltip');
                if (!tooltip) {
                    tooltip = document.createElement('div');
                    tooltip.className = 'custom-thumb-tooltip';
                    rail.appendChild(tooltip);
                }

                const getDuration = () => player.duration() || (cues.length > 0 ? cues[cues.length - 1].end : 0);

                function updateTooltip(clientX) {
                    const rect = rail.getBoundingClientRect();
                    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
                    const pct = x / rect.width;
                    const time = pct * getDuration();
                    const cue = cues.find(c => time >= c.start && time < c.end);

                    if (!cue) {
                        tooltip.classList.remove('visible');
                        setTimeout(() => { if(!tooltip.classList.contains('visible')) tooltip.style.display = 'none'; }, 150);
                        return;
                    }

                    tooltip.style.display = 'block';
                    requestAnimationFrame(() => tooltip.classList.add('visible'));
                    tooltip.style.left = `${x}px`;
                    tooltip.style.backgroundImage = `url("${cue.sprite}")`;
                    tooltip.style.backgroundPosition = `-${cue.x}px -${cue.y}px`;
                    tooltip.style.width = `${cue.w}px`;
                    tooltip.style.height = `${cue.h}px`;
                }

                progressControl.addEventListener('mousemove', e => updateTooltip(e.clientX));
                progressControl.addEventListener('mouseenter', () => {
                    tooltip.style.display = 'block';
                    requestAnimationFrame(() => tooltip.classList.add('visible'));
                });
                progressControl.addEventListener('mouseleave', () => {
                    tooltip.classList.remove('visible');
                    setTimeout(() => { tooltip.style.display = 'none'; }, 150);
                });
            })
            .catch(() => { /* Falla silenciosa si no hay miniaturas */ });
    });

    // === PROGRESO Y EVENTOS (tu código original intacto) ===
player.on('loadedmetadata', async () => {
    player.addClass('vjs-waiting');   // Bloquea todo inmediatamente
    player.pause();                   // Evita cualquier reproducción accidental

    let savedTime = 0;
    let shouldRestore = false;

    if (localStorage.getItem("ws_token")) {
        try {
            const r = await fetchWithAuth(`${API_BASE}/progress/${seriesId}/${ep.id}`);
            if (r.ok) {
                const p = await r.json();
                if (p && p.time > 5 && p.time < (p.duration - 15)) {
                    savedTime = p.time;
                    player.currentTime(p.time);
                    shouldRestore = true;
                }
            }
        } catch (e) {
            console.error("Error recuperando progreso:", e);
        }
    }

    // Esperamos estrictamente hasta que el tiempo actual coincida
    const start = Date.now();
    const maxWait = 12000; // 12 segundos máximo

    const interval = setInterval(() => {
        const current = player.currentTime();

        const timeMatched = shouldRestore && Math.abs(current - savedTime) < 1; // Margen muy ajustado (1 segundo)

        if (
            timeMatched || 
            (!shouldRestore) || 
            (Date.now() - start > maxWait)
        ) {
            // Buffer extra: esperamos 400 ms más para que el contenido se haya cargado visualmente
            setTimeout(() => {
                player.removeClass('vjs-waiting');
                clearInterval(interval);
            }, timeMatched ? 400 : 0); // Solo buffer si hubo salto
        }
    }, 100); // Comprobamos cada 100 ms para máxima precisión

    // Seguridad absoluta: desbloqueo forzado a los 15 segundos
    setTimeout(() => {
        player.removeClass('vjs-waiting');
        clearInterval(interval);
    }, 15000);
});

    let lastSavedSecondSeries = -1;
    let markAsWatchedFired = false;

    player.on('timeupdate', () => {
        const curTime = player.currentTime();
        const duration = player.duration();
        const currentSecond = Math.floor(curTime);
        const floatingBtn = box.querySelector("#floatingNextBtn");

        saveLocalProgress(key, { time: curTime, duration: duration });

        if (duration > 0 && (duration - curTime) <= 10 && (duration - curTime) > 0.5) {
            if (floatingBtn && floatingBtn.classList.contains('hidden')) {
                const allEpisodes = getEpisodesFromSerie(currentSerie);
                const nextEp = allEpisodes[index + 1];
                if (nextEp) {
                    floatingBtn.classList.remove('hidden');
                    floatingBtn.onclick = (e) => {
                        e.stopPropagation();
                        if (localStorage.getItem("ws_token")) {
                            syncProgressToServer(seriesId, ep.id, ep.title, ep.url, duration, duration);
                        }
                        markWatched(key);
                        stopPlayer();
                        startNextEpisode(nextEp, index + 1);
                    };
                }
            }
        } else if (floatingBtn) {
            floatingBtn.classList.add('hidden');
        }

        if (duration > 0 && (duration - curTime) < 30 && !markAsWatchedFired) {
            markAsWatchedFired = true;
            markWatched(key);
            if (currentEpisodeElement) currentEpisodeElement.classList.add('watched');
        }

        if (localStorage.getItem("ws_token") && currentSecond % 10 === 0 && currentSecond !== lastSavedSecondSeries) {
            lastSavedSecondSeries = currentSecond;
            syncProgressToServer(seriesId, ep.id, ep.title, ep.url, curTime, duration);
        }
    });

    player.on('ended', () => {
        const duration = player.duration();
        if (localStorage.getItem("ws_token")) syncProgressToServer(seriesId, ep.id, ep.title, ep.url, duration, duration);
        markWatched(key);
        renderContinueWatching();
        if (currentSerie) {
            const autoplayContainer = box.querySelector(".autoplay");
            autoplayNext(index, autoplayContainer);
        }
    });
}
function autoplayNext(currentIndex, container) {
    // 1. Limpiar cualquier timer previo
    if (autoplayTimer) clearInterval(autoplayTimer);
   
    let countdown = 15; // Bajamos de 15 a 10 segundos como pediste
    const allEpisodes = getEpisodesFromSerie(currentSerie);
    const nextIndex = currentIndex + 1;
    // Si no hay más episodios, no mostramos nada
    if (nextIndex >= allEpisodes.length) return;
    const nextEp = allEpisodes[nextIndex];
    // 2. Crear el HTML del overlay (estilo React)
    container.innerHTML = `
        <div class="next-episode-overlay">
            <div class="overlay-content">
                <h3 id="countdown-text">Siguiente episodio en ${countdown}...</h3>
                <div class="overlay-btns">
                    <button id="btn-play-now" class="btn-next">Reproducir ahora</button>
                    <button id="btn-cancel-next" class="btn-cancel">Cancelar</button>
                </div>
            </div>
        </div>
    `;
    // 3. Lógica de los botones
    document.getElementById("btn-play-now").onclick = () => {
        clearInterval(autoplayTimer);
        startNextEpisode(nextEp, nextIndex);
    };
    document.getElementById("btn-cancel-next").onclick = () => {
        clearInterval(autoplayTimer);
        container.innerHTML = ""; // Quitamos el overlay
    };
    // 4. Iniciar cuenta atrás
    autoplayTimer = setInterval(() => {
        countdown--;
        const textEl = document.getElementById("countdown-text");
       
        if (textEl) {
            textEl.innerText = `Siguiente episodio en ${countdown}...`;
        }
        if (countdown <= 0) {
            clearInterval(autoplayTimer);
            startNextEpisode(nextEp, nextIndex);
        }
    }, 1000);
}
function startNextEpisode(nextEp, nextIndex) {
    // Buscamos el elemento del DOM del siguiente episodio para que se dibuje allí el player
    const episodeElements = document.querySelectorAll('.episode');
    // Nota: El índice puede variar si hay paginación,
    // pero usualmente es el siguiente en la lista actual.
    const nextEl = episodeElements[nextIndex % EPISODES_PER_PAGE];
   
    if (nextEl) {
        playEpisode(nextEp, nextEl, nextIndex);
        // Scroll suave al nuevo episodio que se está reproduciendo
        nextEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}
async function playFromHome(seriesId, episodeUrl, episodeId) {
    console.log("Iniciando playFromHome para:", seriesId, episodeId);
    if (!seriesId) return;
    // --- CASO PELÍCULA ---
    const movie = movies.find(m => m.id === seriesId);
    if (movie) {
        console.log("Es una película, abriendo...");
        await openMovie(seriesId);
       
        // En las películas no hay lista de episodios, el reproductor ya está en pantalla.
        // Esperamos un segundo para que Video.js cargue y le damos al Play.
        setTimeout(() => {
            if (window.currentVjs) {
                window.currentVjs.play();
                document.getElementById('moviePlayerTarget').scrollIntoView({behavior:'smooth'});
            }
        }, 1000);
        return;
    }
    // --- CASO SERIE ---
    const foundSerie = series.find(s => s.id === seriesId);
    let targetPage = 0;
    if (foundSerie) {
        const allEpisodes = getEpisodesFromSerie(foundSerie);
        const epIndex = allEpisodes.findIndex(e => e.id === episodeId);
        if (epIndex !== -1) {
            targetPage = Math.floor(epIndex / EPISODES_PER_PAGE);
            console.log("Página serie detectada:", targetPage);
        }
    }
    // Esperamos a que la serie cargue la página correcta
    await openSerie(seriesId, targetPage);
    // Buscamos el episodio en la lista para clicarlo
    let attempts = 0;
    const maxAttempts = 30;
    const searchInterval = setInterval(() => {
        const target = document.getElementById(`ep-card-${episodeId}`);
       
        if (target) {
            clearInterval(searchInterval);
            target.click();
            setTimeout(() => {
                target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                target.style.background = "rgba(56, 189, 248, 0.3)";
                setTimeout(() => target.style.background = "", 2000);
            }, 500);
            return;
        }
        attempts++;
        if (attempts > maxAttempts) {
            clearInterval(searchInterval);
            console.error("Episodio no encontrado después de intentos.");
        }
    }, 250);
}
function stopPlayer() {
  if (window.currentVjs) {
    window.currentVjs.off();
    window.currentVjs.dispose();
    window.currentVjs = null;
  }
  if (autoplayTimer) clearInterval(autoplayTimer);
  document.querySelectorAll(".player-container").forEach(p => p.remove());
}
/* ================= HEADER ACTIONS ================= */
function showAllSeries() {
    stopPlayer();
   
    // Gestión de historial para botón atrás
    if (!window.isPopState) history.pushState({ view: 'all-series' }, "Series", "#series");
    window.isPopState = false;
    // Asegurar visibilidad correcta
    document.getElementById("home").style.display = "none";
    const viewEl = document.getElementById("view");
    viewEl.style.display = "block";
    // Ordenamos de la A a la Z
    const sortedSeries = [...series].sort((a, b) => a.title.localeCompare(b.title));
    viewEl.innerHTML = `
        <div class="section-header">
            <h2>Todas las series</h2>
        </div>
        <div class="grid-container">
            ${sortedSeries.map(cardHTMLSerie).join("")}
        </div>
    `;
    window.scrollTo(0, 0);
}
function showAllMovies() {
    stopPlayer();
   
    // Gestión de historial para botón atrás
    if (!window.isPopState) history.pushState({ view: 'all-movies' }, "Películas", "#movies");
    window.isPopState = false;
    // Asegurar visibilidad correcta
    document.getElementById("home").style.display = "none";
    const viewEl = document.getElementById("view");
    viewEl.style.display = "block";
    // Ordenamos de la A a la Z
    const sortedMovies = [...movies].sort((a, b) => a.title.localeCompare(b.title));
    viewEl.innerHTML = `
        <div class="section-header">
            <h2>Todas las películas</h2>
        </div>
        <div class="grid-container">
            ${sortedMovies.map(cardHTMLMovie).join("")}
        </div>
    `;
    window.scrollTo(0, 0);
}
async function showFavorites() {
    stopPlayer();
   
    // Gestión de historial
    if (!window.isPopState) history.pushState({ view: 'favorites' }, "Favoritos", "#favorites");
    window.isPopState = false;
    // Control de visibilidad
    document.getElementById("home").style.display = "none";
    const view = document.getElementById("view");
    view.style.display = "block";
    view.innerHTML = '<div class="section-header"><h2>⭐ Cargando favoritos...</h2></div>';
    try {
        const r = await fetchWithAuth(`${API_BASE}/favorites`);
        if (!r.ok) throw new Error("Error API");
       
        const favs = await r.json();
        // Extraer IDs únicos asegurando que son strings y no undefined
        const uniqueIds = [...new Set(favs.map(f => String(f.seriesId || f.series_id)))].filter(id => id !== "undefined" && id !== "");
        let seriesHtml = "";
        let moviesHtml = "";
        let totalSeries = 0;
        let totalMovies = 0;
        uniqueIds.forEach(id => {
            const sObj = series.find(s => String(s.id) === id);
            const mObj = movies.find(m => String(m.id) === id);
            if (sObj) {
                seriesHtml += cardHTMLSerie(sObj);
                totalSeries++;
            } else if (mObj) {
                moviesHtml += cardHTMLMovie(mObj);
                totalMovies++;
            }
        });
        if (totalSeries === 0 && totalMovies === 0) {
            view.innerHTML = `
                <div class="section-header"><h2>⭐ Mis Favoritos</h2></div>
                <div class="search-results-empty"><p>No tienes favoritos guardados todavía.</p></div>
            `;
            return;
        }
        view.innerHTML = `
            <div class="section-header"><h2>⭐ Mis Favoritos</h2></div>
           
            ${totalSeries > 0 ? `
                <div class="section-category">
                    <h3 style="margin: 20px; color: #ffda44;">📺 Series (${totalSeries})</h3>
                    <div class="grid-container">${seriesHtml}</div>
                </div>
            ` : ''}
            ${totalMovies > 0 ? `
                <div class="section-category" style="margin-top: 40px;">
                    <h3 style="margin: 20px; color: #ffda44;">🎬 Películas (${totalMovies})</h3>
                    <div class="grid-container">${moviesHtml}</div>
                </div>
            ` : ''}
        `;
        window.scrollTo(0, 0);
    } catch (e) {
        console.error("Error cargando favoritos:", e);
        view.innerHTML = "<h2>❌ Error: No se pudieron cargar los favoritos.</h2>";
    }
}
/* ================= NAV ================= */
document.getElementById("backBtn").onclick = showHome;
/* ================= INICIALIZACIÓN ================= */
async function initAuth() {
  const token = localStorage.getItem("ws_token");
  const overlay = document.getElementById("authOverlay");
  const mainContent = document.getElementById("main-content");
  // Esta función "enciende la luz" de la página solo cuando el JS sabe qué mostrar
  const revealPage = () => {
    document.body.style.visibility = "visible";
  };
  if (!token) {
    // Si no hay token, activamos el login y mostramos la página inmediatamente
    document.body.classList.add("auth-required");
    if (overlay) overlay.style.display = "flex";
    revealPage();
    return;
  }
  try {
    const r = await fetchWithAuth(`${API_BASE}/me`);
    const data = await r.json();
    if (data.username) {
      localStorage.setItem("ws_username", data.username);
    }
    // Quitamos el estado de login requerido
    document.body.classList.remove("auth-required");
    // Limpiamos el overlay
    if (overlay) {
      overlay.style.display = "none";
      overlay.remove();
    }
    // Mostramos el contenido principal
    if (mainContent) {
      mainContent.style.display = "block";
    }
    // Actualizamos UI
    const userNameEl = document.getElementById("userName");
    if (userNameEl) {
      userNameEl.textContent = data.username || "Usuario";
    }
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) logoutBtn.style.display = "inline-block";
   
    syncFavoritesFromServer();
    // --- RECUPERAR ENLACE PENDIENTE TRAS LOGIN ---
    const pending = localStorage.getItem("pending_navigation");
    if (pending) {
        console.log("Restaurando enlace pendiente:", pending);
        history.pushState(null, '', pending);
        window.location.hash = pending;
        localStorage.removeItem("pending_navigation"); // Limpiamos para que no se repita
    }
    // Ahora sí, ejecutamos la navegación con el hash restaurado
    handleHashNavigation();
    revealPage();
  } catch (err) {
    console.error("Error validando sesión:", err);
    // Si falla la validación, limpiamos y forzamos el login
    logout();
    document.body.classList.add("auth-required");
    if (overlay) overlay.style.display = "flex";
    revealPage();
  }
}
async function toggleFavoriteGlobal(event, id, type) {
    event.stopPropagation();
    const stringId = String(id);
   
    // 1. Actualizar Array Global y LocalStorage
    if (favoritesList.includes(stringId)) {
        favoritesList = favoritesList.filter(favId => favId !== stringId);
        localStorage.removeItem(`fav_${stringId}`);
        if (event.target) event.target.classList.remove('active');
    } else {
        favoritesList.push(stringId);
        localStorage.setItem(`fav_${stringId}`, "true");
        if (event.target) event.target.classList.add('active');
    }
    // 2. API: Sincronizar (Igual que lo tenías)
    if (localStorage.getItem("ws_token")) {
        try {
            await fetchWithAuth(`${API_BASE}/favorites`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ seriesId: id })
            });
        } catch (e) { console.error("Error de red:", e); }
    }
    // 3. Refrescar UI si es necesario (ej. estrellas)
    if (document.getElementById("view").style.display === "block") {
        renderSerieView(); // O renderMovie si es movie
    }
}
async function handleMainFavClick(event, id) {
    const btn = event.currentTarget;
    await toggleFavoriteGlobal({
        stopPropagation: () => event.stopPropagation(),
        target: btn
    }, id, 'serie');
    const isFav = btn.classList.contains('active');
    const textSpan = btn.querySelector('.btn-text');
    if (textSpan) textSpan.innerText = isFav ? 'Favorito' : 'Añadir';
}
/* ================= LÓGICA DE BÚSQUEDA AVANZADA ================= */
const searchBox = document.getElementById('searchBox');
const suggestBox = document.getElementById('suggest');
/* ================= LÓGICA DE BÚSQUEDA AVANZADA (CORREGIDA) ================= */
searchBox.addEventListener('input', () => {
    const query = searchBox.value.toLowerCase().trim();
   
    if (query.length < 2) {
        suggestBox.classList.add('hidden');
        return;
    }
    const allItems = [
        ...series.map(s => ({...s, searchType: 'serie'})),
        ...movies.map(m => ({...m, searchType: 'movie'}))
    ];
    const matches = allItems
        .filter(item => item.title.toLowerCase().includes(query))
        .slice(0, 4);
    if (matches.length > 0) {
        let html = matches.map(item => `
            <div class="s-item" onclick="selectSearch('${item.id}', '${item.searchType}')">
                <img src="images/${item.id}.jpg" class="s-thumb" onerror="this.src='images/default.jpg'">
                <div class="s-info">
                    <div class="s-title">${item.title}</div>
                    <div class="s-muted">${item.searchType === 'serie' ? 'Serie' : 'Película'}</div>
                </div>
            </div>
        `).join('');
        html += `<div class="s-more" onclick="performSearch('${query}')">Ver todos</div>`;
        suggestBox.innerHTML = html;
        suggestBox.classList.remove('hidden');
    } else {
        suggestBox.innerHTML = '<div class="s-item"><div class="s-info">No hay sugerencias</div></div>';
        suggestBox.classList.remove('hidden');
    }
});
searchBox.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const query = searchBox.value.trim();
        if (query.length > 0) performSearch(query);
    }
});
function performSearch(query) {
    stopPlayer();
   
    // Gestión de historial para la búsqueda
    if (!window.isPopState) history.pushState({ view: 'search', query: query }, "Búsqueda", "#search");
    window.isPopState = false;
    const q = query.toLowerCase();
    suggestBox.classList.add('hidden');
    searchBox.blur();
    // Control de visibilidad
    document.getElementById("home").style.display = "none";
    const viewEl = document.getElementById("view");
    viewEl.style.display = "block";
   
    const resSeries = series.filter(s => s.title.toLowerCase().includes(q));
    const resMovies = movies.filter(m => m.title.toLowerCase().includes(q));
    if (resSeries.length === 0 && resMovies.length === 0) {
        viewEl.innerHTML = `
            <div class="search-results-empty">
                <h2>No se encontraron resultados para "${query}"</h2>
                <p style="margin-top:10px; color: #aaa;">Prueba con otros términos o revisa la ortografía.</p>
            </div>`;
    } else {
        viewEl.innerHTML = `
            <div class="section-header"><h2>Resultados para: "${query}"</h2></div>
           
            ${resSeries.length ? `
                <h3 style="margin: 20px 0 10px 0; color: #ffda44;">📺 Series encontradas</h3>
                <div class="grid-container">
                    ${resSeries.map(cardHTMLSerie).join("")}
                </div>` : ""}
           
            ${resMovies.length ? `
                <h3 style="margin: 30px 0 10px 0; color: #ffda44;">🎬 Películas encontradas</h3>
                <div class="grid-container">
                    ${resMovies.map(cardHTMLMovie).join("")}
                </div>` : ""}
        `;
    }
    window.scrollTo(0, 0);
}
function selectSearch(id, type) {
    searchBox.value = "";
    suggestBox.classList.add('hidden');
    if (type === 'movie') openMovie(id);
    else openSerie(id);
}
document.addEventListener('click', (e) => {
    if (!e.target.closest('.search')) suggestBox.classList.add('hidden');
});
document.addEventListener("DOMContentLoaded", () => {
  initAuth();
  // Asegurar que el logo lleve a home desde cualquier vista
  const logoEl = document.getElementById("logo"); // Asumiendo que el logo tiene id="logo"
  if (logoEl) {
    logoEl.onclick = (e) => {
      e.preventDefault();
      showHome();
    };
  }
});
function jumpToEpisode(number) {
    goToEpisode(number); // Unificar con goToEpisode
}
function updateArrows(container) {
    const row = container.querySelector('.row');
    const leftArrow = container.querySelector('.nav-btn.left');
    const rightArrow = container.querySelector('.nav-btn.right');
    if (!row || !leftArrow || !rightArrow) return;
    const scrollLeft = row.scrollLeft;
    const maxScroll = row.scrollWidth - row.clientWidth;
    // Si scrollLeft es 0 (o casi 0), ocultamos flecha izquierda
    if (scrollLeft <= 5) {
        leftArrow.classList.add('is-hidden');
    } else {
        leftArrow.classList.remove('is-hidden');
    }
    // Si hemos llegado al final del scroll, ocultamos flecha derecha
    // Usamos -5 como margen de error para diferentes navegadores
    if (scrollLeft >= maxScroll - 5) {
        rightArrow.classList.add('is-hidden');
    } else {
        rightArrow.classList.remove('is-hidden');
    }
}
function sideScroll(btn, direction) {
    const container = btn.parentElement;
    const row = container.querySelector('.row');
    // Desplazamos casi todo el ancho visible para una navegación fluida
    const scrollAmount = row.clientWidth * 0.9;
    if (direction === 'left') {
        row.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    } else {
        row.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
    // El chequeo de flechas se dispara solo al terminar el movimiento
    setTimeout(checkScrollArrows, 500);
}
function checkScrollArrows() {
    const containers = document.querySelectorAll('.row-container');
   
    containers.forEach(container => {
        const row = container.querySelector('.row');
        const leftBtn = container.querySelector('.nav-btn.left');
        const rightBtn = container.querySelector('.nav-btn.right');
        if (!row || !leftBtn || !rightBtn) return;
        const scrollLeft = row.scrollLeft;
        const scrollWidth = row.scrollWidth;
        const clientWidth = row.clientWidth;
        const maxScroll = scrollWidth - clientWidth;
        // 1. ¿Hay scroll posible?
        const canScroll = scrollWidth > clientWidth + 1;
        // 2. Control de Flecha y Gradiente IZQUIERDO
        if (canScroll && scrollLeft > 10) {
            leftBtn.classList.remove('is-hidden');
            container.classList.add('has-left-gradient');
        } else {
            leftBtn.classList.add('is-hidden');
            container.classList.remove('has-left-gradient');
        }
        // 3. Control de Flecha y Gradiente DERECHO
        if (canScroll && scrollLeft < maxScroll - 10) {
            rightBtn.classList.remove('is-hidden');
            container.classList.add('has-right-gradient');
        } else {
            rightBtn.classList.add('is-hidden');
            container.classList.remove('has-right-gradient');
        }
    });
}
function forceGoHome() {
    // 1. Limpiamos cualquier estado de navegación en curso
    window.isNavigatingToHash = false;
    window.isPopState = false;

    // 2. Borramos el hash de la URL (esto dispara hashchange y onpopstate)
    history.pushState({ view: 'home' }, "Home", "#home");
    window.location.hash = "#home";

    // 3. Forzamos la llamada a showHome() directamente
    showHome();

    // 4. Limpiamos cualquier player o overlay que pueda quedar
    stopPlayer();

    // 5. Scroll arriba por si acaso
    window.scrollTo({ top: 0, behavior: 'smooth' });

    console.log("Forzado retorno a Home desde logo");
}
// Opcional: Escuchar el scroll manual (con el dedo o ratón)
window.addEventListener('resize', checkScrollArrows); // Re-chequear si cambian el tamaño de la ventana
function setupCarouselLogic() {
    const containers = document.querySelectorAll('.row-container');
   
    containers.forEach(container => {
        const row = container.querySelector('.row');
       
        // 1. Ejecutar al cargar para ocultar la flecha izquierda inicialmente
        updateArrows(container);
        // 2. Escuchar el evento de scroll en la fila
        row.addEventListener('scroll', () => {
            updateArrows(container);
        });
        // 3. Si tienes botones de flecha que hacen scroll por código,
        // asegúrate de que también disparen el chequeo
        const arrows = container.querySelectorAll('.nav-btn');
        arrows.forEach(arrow => {
            arrow.addEventListener('click', () => {
                // Pequeño delay para esperar a que termine la animación del scroll
                setTimeout(() => updateArrows(container), 300);
            });
        });
    });
}
async function syncFavoritesFromServer() {
    try {
        const r = await fetchWithAuth(`${API_BASE}/favorites`);
        if (r.ok) {
            const favs = await r.json();
            favoritesList = favs.map(f => String(f.seriesId || f.series_id)); // Guardamos en el array global
            favoritesList.forEach(id => {
                localStorage.setItem(`fav_${id}`, "true");
            });
            // Refrescar UI si es necesario
            if (document.getElementById("view").style.display === "block") {
                renderSerieView(); // O similar
            }
        }
    } catch (e) { console.error("Error sincronizando:", e); }
}
window.addEventListener('beforeunload', () => {
    if (window.currentVjs && !window.currentVjs.paused()) {
        const player = window.currentVjs;
    }
});
// Este evento detecta cuando el usuario pulsa el botón físico de atrás
window.onpopstate = function(event) {
    window.isPopState = true;
    if (event.state) {
        const { view, id, page, query } = event.state;
       
        switch(view) {
            case 'serie':
                openSerie(id, page || 0);
                break;
            case 'movie':
                openMovie(id);
                break;
            case 'favorites':
                showFavorites();
                break;
            case 'all-series':
                showAllSeries();
                break;
            case 'all-movies':
                showAllMovies();
                break;
            case 'search':
                performSearch(query);
                break;
            case 'home':
            default:
                showHome();
                break;
        }
    } else {
        showHome();
    }
    window.isPopState = false;
};
// Al cargar por primera vez la página, inicializamos el estado
window.addEventListener('load', () => {
    if (!history.state) {
        history.replaceState({ view: 'home' }, "Home", "#home");
    }
});
// Si el usuario cambia el hash manualmente o pega un link estando ya dentro
window.addEventListener('hashchange', handleHashNavigation);

// Sistema global de thumbnails manual (como en tu prueba)
function attachVttThumbnails(player, vttUrl) {
    if (!player || !vttUrl) return;

    let cues = [];

    // Cargar y parsear VTT
    fetch(vttUrl)
        .then(r => {
            if (!r.ok) throw new Error(`VTT ${vttUrl} no cargado: ${r.status}`);
            return r.text();
        })
        .then(text => {
            const lines = text.split(/\r?\n/);
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                const timeMatch = line.match(/^(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})$/);
                if (timeMatch) {
                    const start = timeToSeconds(timeMatch[1]);
                    const end = timeToSeconds(timeMatch[2]);
                    const refLine = (lines[++i] || '').trim();
                    const refMatch = refLine.match(/^(.+?)#xywh=(\d+),(\d+),(\d+),(\d+)$/);
                    if (refMatch) {
                        cues.push({
                            start,
                            end,
                            sprite: new URL(refMatch[1], vttUrl).href, // Ruta absoluta
                            x: parseInt(refMatch[2]),
                            y: parseInt(refMatch[3]),
                            w: parseInt(refMatch[4]),
                            h: parseInt(refMatch[5])
                        });
                    }
                }
            }
            console.log(`Cargados ${cues.length} thumbnails de ${vttUrl}`);
            createTooltip(player, cues);
        })
        .catch(err => console.error("Error cargando VTT:", err));
}

function timeToSeconds(timeStr) {
    const [h, m, sMs] = timeStr.split(':');
    const [s, ms] = sMs.split('.');
    return parseInt(h)*3600 + parseInt(m)*60 + parseInt(s) + (parseInt(ms)/1000);
}

// Sistema manual de thumbnails (parsea VTT y muestra tooltip como en tu prueba)
function attachManualThumbnails(player, vttUrl) {
    if (!player || !vttUrl) return;

    let cues = [];

    fetch(vttUrl)
        .then(r => {
            if (!r.ok) throw new Error(`VTT no cargado: ${r.status}`);
            return r.text();
        })
        .then(text => {
            const lines = text.split(/\r?\n/);
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                const timeMatch = line.match(/^(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})$/);
                if (timeMatch) {
                    const start = timeToSeconds(timeMatch[1]);
                    const end = timeToSeconds(timeMatch[2]);
                    const refLine = (lines[++i] || '').trim();
                    const refMatch = refLine.match(/^(.+?)#xywh=(\d+),(\d+),(\d+),(\d+)$/);
                    if (refMatch) {
                        cues.push({
                            start,
                            end,
                            sprite: new URL(refMatch[1], vttUrl).href, // Ruta absoluta del sprite
                            x: parseInt(refMatch[2]),
                            y: parseInt(refMatch[3]),
                            w: parseInt(refMatch[4]),
                            h: parseInt(refMatch[5])
                        });
                    }
                }
            }
            console.log(`Cargados ${cues.length} thumbnails de ${vttUrl}`);
            createTooltip(player, cues);
        })
        .catch(err => console.error("Error cargando VTT:", err));
}

function timeToSeconds(timeStr) {
    const [h, m, sMs] = timeStr.split(':');
    const [s, ms] = sMs.split('.');
    return parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s) + (parseInt(ms) / 1000);
}

function createTooltip(player, cues) {
    const progress = player.controlBar.progressControl.el();
    const rail = progress.querySelector('.vjs-progress-holder');
    if (!progress || !rail) return console.warn("No encontrado rail de progreso");

    let tooltip = rail.querySelector('.custom-thumb-tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.className = 'custom-thumb-tooltip';
        rail.appendChild(tooltip);
    }

    const getDuration = () => player.duration() || cues[cues.length - 1]?.end || 0;

    function updateTooltip(clientX) {
        const rect = rail.getBoundingClientRect();
        const x = Math.max(8, Math.min(clientX - rect.left, rect.width - 8));
        const pct = x / rect.width;
        const time = pct * getDuration();

        let cue = null;
        for (const c of cues) {
            if (time >= c.start && time < c.end) {
                cue = c;
                break;
            }
        }

        if (!cue) {
            tooltip.style.display = 'none';
            return;
        }

        tooltip.style.display = 'block';
        tooltip.style.left = `${x}px`;
        tooltip.style.backgroundImage = `url("${cue.sprite}")`;
        tooltip.style.backgroundPosition = `-${cue.x}px -${cue.y}px`;
        tooltip.style.width = `${cue.w}px`;
        tooltip.style.height = `${cue.h}px`;
    }

    // Eventos PC
    rail.addEventListener('mousemove', e => updateTooltip(e.clientX));
    rail.addEventListener('mouseenter', () => {
        tooltip.style.display = 'block';
    });

    // Timeout para ocultar después de salir (se queda visible 800ms)
    let hideTimeout = null;
    rail.addEventListener('mouseleave', () => {
        hideTimeout = setTimeout(() => {
            tooltip.style.display = 'none';
        }, 800); // ← Ajusta aquí: 800 = 0.8s, 1500 = 1.5s, etc.
    });

    // Cancela ocultado si vuelves a entrar rápido
    rail.addEventListener('mouseenter', () => {
        if (hideTimeout) clearTimeout(hideTimeout);
    });

    // Eventos móvil
    rail.addEventListener('touchstart', e => {
        const touch = e.touches[0];
        if (touch) {
            updateTooltip(touch.clientX);
            tooltip.style.display = 'block';
        }
    }, { passive: true });

    rail.addEventListener('touchmove', e => {
        const touch = e.touches[0];
        if (touch) updateTooltip(touch.clientX);
    }, { passive: true });

    rail.addEventListener('touchend', () => {
        setTimeout(() => {
            tooltip.style.display = 'none';
        }, 800); // Se queda visible 0.8s después de soltar
    }, { passive: true });

    rail.addEventListener('touchcancel', () => {
        tooltip.style.display = 'none';
    }, { passive: true });
}