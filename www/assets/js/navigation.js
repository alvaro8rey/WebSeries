/* ================= NAVIGATION ================= */

/**
 * Maneja la navegación basada en el hash de la URL
 */
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

    localStorage.removeItem("pending_navigation");
    window.isPopState = true;

    if (hash.startsWith('#movie-')) {
        window.MoviesView.open(hash.replace('#movie-', ''));
    } else if (hash.startsWith('#serie-')) {
        window.SeriesView.open(hash.replace('#serie-', ''));
    } else {
        showHome();
    }

    setTimeout(() => {
        window.isNavigatingToHash = false;
        window.isPopState = false;
    }, 500);
}

/**
 * Muestra la vista principal (home)
 */
function showHome() {
    const hash = window.location.hash;

    // ESCUDO RADICAL
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

    // LIMPIEZA DE ESTADO
    if (window.Player) window.Player.stop();
    window.AppState.setCurrentSerie(null);

    // GESTIÓN DE HISTORIAL
    if (!window.isPopState) {
        if (!hash || hash === "" || hash === "#" || hash === "#home") {
            history.pushState({ view: 'home' }, "Home", "#home");
        }
    }
    window.isPopState = false;

    // CONTROL DE VISIBILIDAD
    const homeEl = document.getElementById("home");
    const viewEl = document.getElementById("view");
    const backBtn = document.getElementById("backBtn");

    if (homeEl) homeEl.style.display = "block";
    if (viewEl) {
        viewEl.style.display = "none";
        viewEl.innerHTML = "";
    }
    if (backBtn) backBtn.style.display = "none";

    // RENDERIZAR "CONTINUAR VIENDO"
    if (window.ContinueWatching) {
        window.ContinueWatching.render();
    }

    // RENDERIZAR CARRUSEL DE SERIES
    const seriesRowEl = document.getElementById("seriesRow");
    if (seriesRowEl && typeof series !== 'undefined' && series.length > 0) {
        const latestSeries = [...series]
            .sort((a, b) => (new Date(b.updated_at || 0)) - (new Date(a.updated_at || 0)))
            .slice(0, 10);

        seriesRowEl.innerHTML = `
            <div class="row-container">
                <button class="nav-btn left is-hidden" onclick="window.Carousel.sideScroll(this, 'left')">‹</button>
                <div class="row" onscroll="window.Carousel.checkScrollArrows()">
                    ${latestSeries.map(window.Cards.renderSerie).join("")}
                </div>
                <button class="nav-btn right" onclick="window.Carousel.sideScroll(this, 'right')">›</button>
            </div>
        `;
    }

    // RENDERIZAR CARRUSEL DE PELÍCULAS
    const moviesRowEl = document.getElementById("moviesRow");
    if (moviesRowEl && typeof movies !== 'undefined' && movies.length > 0) {
        const latestMovies = [...movies]
            .sort((a, b) => (new Date(b.updated_at || 0)) - (new Date(a.updated_at || 0)))
            .slice(0, 10);

        moviesRowEl.innerHTML = `
            <div class="row-container">
                <button class="nav-btn left is-hidden" onclick="window.Carousel.sideScroll(this, 'left')">‹</button>
                <div class="row" onscroll="window.Carousel.checkScrollArrows()">
                    ${latestMovies.map(window.Cards.renderMovie).join('')}
                </div>
                <button class="nav-btn right" onclick="window.Carousel.sideScroll(this, 'right')">›</button>
            </div>
        `;
    }

    window.scrollTo(0, 0);
    setTimeout(() => {
        if (window.Carousel) window.Carousel.checkScrollArrows();
    }, 300);
}

/**
 * Muestra todas las series
 */
function showAllSeries() {
    if (window.Player) window.Player.stop();

    if (!window.isPopState) {
        history.pushState({ view: 'all-series' }, "Series", "#series");
    }
    window.isPopState = false;

    document.getElementById("home").style.display = "none";
    const viewEl = document.getElementById("view");
    viewEl.style.display = "block";

    const sortedSeries = [...series].sort((a, b) => a.title.localeCompare(b.title));

    viewEl.innerHTML = `
        <div class="section-header">
            <h2>Todas las series</h2>
        </div>
        <div class="grid-container">
            ${sortedSeries.map(window.Cards.renderSerie).join("")}
        </div>
    `;

    window.scrollTo(0, 0);
}

/**
 * Muestra todas las películas
 */
function showAllMovies() {
    if (window.Player) window.Player.stop();

    if (!window.isPopState) {
        history.pushState({ view: 'all-movies' }, "Películas", "#movies");
    }
    window.isPopState = false;

    document.getElementById("home").style.display = "none";
    const viewEl = document.getElementById("view");
    viewEl.style.display = "block";

    const sortedMovies = [...movies].sort((a, b) => a.title.localeCompare(b.title));

    viewEl.innerHTML = `
        <div class="section-header">
            <h2>Todas las películas</h2>
        </div>
        <div class="grid-container">
            ${sortedMovies.map(window.Cards.renderMovie).join("")}
        </div>
    `;

    window.scrollTo(0, 0);
}

/**
 * Fuerza el retorno al home
 */
function forceGoHome() {
    window.isNavigatingToHash = false;
    window.isPopState = false;
    history.pushState({ view: 'home' }, "Home", "#home");
    window.location.hash = "#home";
    showHome();
    if (window.Player) window.Player.stop();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    console.log("Forzado retorno a Home desde logo");
}

/* ================= EXPORTS ================= */
window.Navigation = {
    handleHash: handleHashNavigation,
    showHome,
    showAllSeries,
    showAllMovies,
    forceGoHome
};
