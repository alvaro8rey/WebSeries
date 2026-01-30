/* ================= ESTADO GLOBAL ================= */

// Variables globales del catálogo
window.series = [];
window.movies = [];
window.catalogReady = false;

// Variables de navegación
window.isNavigatingToHash = false;
window.isPopState = false;

// Variables de estado local
let currentSerie = null;
let currentSeasonIndex = 0;
let currentEpisodePage = 0;
let favoritesList = [];
let searchIndex = [];

// Constantes
const EPISODES_PER_PAGE = 20;

// Variables del reproductor
let hlsInstance = null;
let currentEpisodeElement = null;
let autoplayTimer = null;

/* ================= EMERGENCY HASH CAPTURE ================= */
// Capturamos el hash original ANTES de que cualquier script lo toque
(function() {
    const originalHash = window.location.hash;
    if (originalHash && originalHash !== "#home" && originalHash !== "#") {
        console.log("🔒 Enlace protegido al arranque:", originalHash);
        localStorage.setItem("pending_navigation", originalHash);
    }
})();

/* ================= INITIAL CHECKS ================= */
// Bloqueo preventivo de navegación si el usuario no tiene token
if (!localStorage.getItem("ws_token")) {
    document.body.classList.add("auth-required");

    // Si el usuario trae un enlace pero no está logueado, lo protegemos
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

/* ================= EXPORTS ================= */
window.AppState = {
    // Getters y setters para variables locales
    getCurrentSerie: () => currentSerie,
    setCurrentSerie: (serie) => { currentSerie = serie; },

    getCurrentSeasonIndex: () => currentSeasonIndex,
    setCurrentSeasonIndex: (index) => { currentSeasonIndex = index; },

    getCurrentEpisodePage: () => currentEpisodePage,
    setCurrentEpisodePage: (page) => { currentEpisodePage = page; },

    getFavoritesList: () => favoritesList,
    setFavoritesList: (list) => { favoritesList = list; },

    getSearchIndex: () => searchIndex,
    setSearchIndex: (index) => { searchIndex = index; },

    getEpisodesPerPage: () => EPISODES_PER_PAGE,

    // Variables del reproductor
    getHlsInstance: () => hlsInstance,
    setHlsInstance: (instance) => { hlsInstance = instance; },

    getCurrentEpisodeElement: () => currentEpisodeElement,
    setCurrentEpisodeElement: (element) => { currentEpisodeElement = element; },

    getAutoplayTimer: () => autoplayTimer,
    setAutoplayTimer: (timer) => { autoplayTimer = timer; },

    // Funciones de storage
    getLocalProgress,
    saveLocalProgress,
    getWatched,
    markWatched
};
