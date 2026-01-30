/* ================= FAVORITES ================= */

/**
 * Alterna el estado de favorito de una serie/película
 */
async function toggleFavoriteGlobal(event, id, type) {
    event.stopPropagation();
    const stringId = String(id);
    let favoritesList = window.AppState.getFavoritesList();

    // Actualizar Array Global y LocalStorage
    if (favoritesList.includes(stringId)) {
        favoritesList = favoritesList.filter(favId => favId !== stringId);
        localStorage.removeItem(`fav_${stringId}`);
        if (event.target) event.target.classList.remove('active');
    } else {
        favoritesList.push(stringId);
        localStorage.setItem(`fav_${stringId}`, "true");
        if (event.target) event.target.classList.add('active');
    }

    window.AppState.setFavoritesList(favoritesList);

    // API: Sincronizar
    if (localStorage.getItem("ws_token")) {
        try {
            await window.API.fetchWithAuth(`${API_BASE}/favorites`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ seriesId: id })
            });
        } catch (e) {
            console.error("Error de red:", e);
        }
    }

    // Refrescar UI si es necesario
    if (document.getElementById("view").style.display === "block") {
        if (window.SeriesView && window.AppState.getCurrentSerie()) {
            window.SeriesView.render();
        }
    }
}

/**
 * Maneja el click en el botón principal de favorito
 */
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

/**
 * Muestra la vista de favoritos
 */
async function showFavorites() {
    if (window.Player) window.Player.stop();

    if (!window.isPopState) {
        history.pushState({ view: 'favorites' }, "Favoritos", "#favorites");
    }
    window.isPopState = false;

    document.getElementById("home").style.display = "none";
    const view = document.getElementById("view");
    view.style.display = "block";
    view.innerHTML = '<div class="section-header"><h2>⭐ Cargando favoritos...</h2></div>';

    try {
        const r = await window.API.fetchWithAuth(`${API_BASE}/favorites`);
        if (!r.ok) throw new Error("Error API");

        const favs = await r.json();
        const uniqueIds = [...new Set(favs.map(f => String(f.seriesId || f.series_id)))].filter(id => id !== "undefined" && id !== "");

        let seriesHtml = "";
        let moviesHtml = "";
        let totalSeries = 0;
        let totalMovies = 0;

        uniqueIds.forEach(id => {
            const sObj = series.find(s => String(s.id) === id);
            const mObj = movies.find(m => String(m.id) === id);

            if (sObj) {
                seriesHtml += window.Cards.renderSerie(sObj);
                totalSeries++;
            } else if (mObj) {
                moviesHtml += window.Cards.renderMovie(mObj);
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

/* ================= EXPORTS ================= */
window.Favorites = {
    toggle: toggleFavoriteGlobal,
    handleMainClick: handleMainFavClick,
    show: showFavorites
};
