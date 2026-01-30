/* ================= MAIN APP ================= */

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
        window.Navigation.handleHash();
    })
    .catch(err => {
        console.error("ERROR CRÍTICO:", err);
        document.body.innerHTML += "<div style='color:white; padding:20px;'>Error cargando el catálogo.</div>";
    });

/* ================= INICIALIZACIÓN ================= */
async function initAuth() {
  const token = localStorage.getItem("ws_token");
  const overlay = document.getElementById("authOverlay");
  const mainContent = document.getElementById("main-content");

  const revealPage = () => {
    document.body.style.visibility = "visible";
  };

  if (!token) {
    document.body.classList.add("auth-required");
    if (overlay) overlay.style.display = "flex";
    revealPage();
    return;
  }

  try {
    const r = await window.API.fetchWithAuth(`${API_BASE}/me`);
    const data = await r.json();

    if (data.username) {
      localStorage.setItem("ws_username", data.username);
    }

    document.body.classList.remove("auth-required");

    if (overlay) {
      overlay.style.display = "none";
      overlay.remove();
    }

    if (mainContent) {
      mainContent.style.display = "block";
    }

    const userNameEl = document.getElementById("userName");
    if (userNameEl) {
      userNameEl.textContent = data.username || "Usuario";
    }

    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) logoutBtn.style.display = "inline-block";

    window.API.syncFavoritesFromServer();

    // Recuperar enlace pendiente tras login
    const pending = localStorage.getItem("pending_navigation");
    if (pending) {
        console.log("Restaurando enlace pendiente:", pending);
        history.pushState(null, '', pending);
        window.location.hash = pending;
        localStorage.removeItem("pending_navigation");
    }

    window.Navigation.handleHash();
    revealPage();
  } catch (err) {
    console.error("Error validando sesión:", err);
    logout();
    document.body.classList.add("auth-required");
    if (overlay) overlay.style.display = "flex";
    revealPage();
  }
}

/* ================= EVENT LISTENERS ================= */
document.addEventListener("DOMContentLoaded", () => {
  initAuth();

  // Back button
  const backBtn = document.getElementById("backBtn");
  if (backBtn) {
    backBtn.onclick = window.Navigation.showHome;
  }

  // Logo to home
  const logoEl = document.querySelector(".brand");
  if (logoEl) {
    logoEl.onclick = (e) => {
      e.preventDefault();
      window.Navigation.forceGoHome();
    };
  }

  // Initialize search
  if (window.Search) {
    window.Search.init();
  }

  // Resize event for carousels
  window.addEventListener('resize', () => {
    if (window.Carousel) window.Carousel.checkScrollArrows();
  });
});

// History navigation
window.onpopstate = function(event) {
    window.isPopState = true;

    if (event.state) {
        const { view, id, page, query } = event.state;

        switch(view) {
            case 'serie':
                window.SeriesView.open(id, page || 0);
                break;
            case 'movie':
                window.MoviesView.open(id);
                break;
            case 'favorites':
                window.Favorites.show();
                break;
            case 'all-series':
                window.Navigation.showAllSeries();
                break;
            case 'all-movies':
                window.Navigation.showAllMovies();
                break;
            case 'search':
                window.Search.perform(query);
                break;
            case 'home':
            default:
                window.Navigation.showHome();
                break;
        }
    } else {
        window.Navigation.showHome();
    }

    window.isPopState = false;
};

// Hash change
window.addEventListener('hashchange', () => {
    window.Navigation.handleHash();
});

// Initial state
window.addEventListener('load', () => {
    if (!history.state) {
        history.replaceState({ view: 'home' }, "Home", "#home");
    }
});

// Before unload cleanup
window.addEventListener('beforeunload', () => {
    if (window.currentVjs && !window.currentVjs.paused()) {
        // Cleanup if needed
    }
});

/* ================= GLOBAL EXPORTS FOR ONCLICK HANDLERS ================= */
// Estas funciones necesitan estar en el scope global para los onclick del HTML
window.showAllSeries = window.Navigation.showAllSeries;
window.showAllMovies = window.Navigation.showAllMovies;
window.showFavorites = window.Favorites.show;
window.forceGoHome = window.Navigation.forceGoHome;
window.sideScroll = window.Carousel.sideScroll;
window.checkScrollArrows = window.Carousel.checkScrollArrows;
window.toggleFavoriteGlobal = window.Favorites.toggle;
window.handleMainFavClick = window.Favorites.handleMainClick;
