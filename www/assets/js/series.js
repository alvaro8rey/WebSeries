/* ================= SERIES VIEW ================= */

/**
 * Abre la vista de una serie
 */
async function openSerie(id, page = 0) {
    if (window.Player) window.Player.stop();

    const foundSerie = series.find(s => s.id === id);
    if (!foundSerie) return;

    if (!window.isPopState) {
        history.pushState({ view: 'serie', id: id, page: page }, foundSerie.title, `#serie-${id}`);
    }
    window.isPopState = false;

    window.AppState.setCurrentSerie(foundSerie);
    window.AppState.setCurrentSeasonIndex(0);
    window.AppState.setCurrentEpisodePage(page);

    let serverWatched = [];
    if (localStorage.getItem("ws_token")) {
        try {
            const resp = await window.API.fetchWithAuth(`${API_BASE}/series-progress/${id}`);
            serverWatched = await resp.json();
        } catch (e) {
            console.error("Error al pedir progreso", e);
        }
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

/**
 * Renderiza la vista de la serie con sus episodios
 */
function renderSerieView() {
    const currentSerie = window.AppState.getCurrentSerie();
    if (!currentSerie) return;

    const globalBackBtn = document.getElementById("backBtn");
    if (globalBackBtn) globalBackBtn.style.display = "block";

    const allEpisodes = window.AppUtils.getEpisodesFromSerie(currentSerie);
    const totalEpisodes = allEpisodes.length;
    const totalPages = Math.ceil(totalEpisodes / window.AppState.getEpisodesPerPage());
    const currentEpisodePage = window.AppState.getCurrentEpisodePage();
    const start = currentEpisodePage * window.AppState.getEpisodesPerPage();
    const episodes = allEpisodes.slice(start, start + window.AppState.getEpisodesPerPage());

    const isSerieFav = window.AppState.getFavoritesList().includes(String(currentSerie.id));

    // Selector de temporadas
    const hasSeasons = currentSerie.seasons && currentSerie.seasons.length > 0;
    const currentSeasonIndex = window.AppState.getCurrentSeasonIndex();
    const seasonSelector = hasSeasons ? `
        <select class="season-select" onchange="window.SeriesView.changeSeason(this.value)">
            ${currentSerie.seasons.map((s, i) => `
                <option value="${i}" ${i === currentSeasonIndex ? "selected" : ""}>
                    ${s.title || `Temporada ${s.season}`}
                </option>
            `).join("")}
        </select>
    ` : "";

    // Buscador GOTO
    const gotoHTML = (!hasSeasons && totalEpisodes > 20) ? `
        <div class="goto-episode">
            <span class="goto-label-desktop">EP</span>
            <input type="number" id="goto-input" placeholder="EP..."
                onkeyup="if(event.key==='Enter') window.SeriesView.goToEpisode(this.value)">
            <button onclick="window.SeriesView.goToEpisode(document.getElementById('goto-input').value)" class="goto-btn-minimal">
                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="4" fill="none">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
            </button>
        </div>
    ` : "";

    // Paginación
    let paginationHTML = "";
    if (totalPages > 1) {
        let pages = [];
        const delta = window.innerWidth < 600 ? 1 : 2;

        pages.push(`<button class="page-btn" ${currentEpisodePage === 0 ? 'disabled' : ''} onclick="window.SeriesView.changePageTo(0)">«</button>`);
        pages.push(`<button class="page-btn" ${currentEpisodePage === 0 ? 'disabled' : ''} onclick="window.SeriesView.changePageTo(${currentEpisodePage - 1})">‹</button>`);

        for (let i = 0; i < totalPages; i++) {
            if (i === 0 || i === totalPages - 1 || (i >= currentEpisodePage - delta && i <= currentEpisodePage + delta)) {
                pages.push(`<button class="page-btn ${i === currentEpisodePage ? 'active' : ''}" onclick="window.SeriesView.changePageTo(${i})">${i + 1}</button>`);
            } else if (i === currentEpisodePage - delta - 1 || i === currentEpisodePage + delta + 1) {
                pages.push(`<span class="page-dots">...</span>`);
            }
        }

        pages.push(`<button class="page-btn" ${currentEpisodePage >= totalPages - 1 ? 'disabled' : ''} onclick="window.SeriesView.changePageTo(${currentEpisodePage + 1})">›</button>`);
        pages.push(`<button class="page-btn" ${currentEpisodePage >= totalPages - 1 ? 'disabled' : ''} onclick="window.SeriesView.changePageTo(${totalPages - 1})">»</button>`);

        paginationHTML = `<div class="pagination"><div class="pagination-numbers">${pages.join("")}</div></div>`;
    }

    // Renderizado Final
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
                    <button id="fav-main-btn" class="btn-fav-compact ${isSerieFav ? 'active' : ''}" onclick="window.Favorites.handleMainClick(event, '${currentSerie.id}')">
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
                const displayTitle = window.AppUtils.cleanEpisodeTitle(e.title);
                const episodeMatch = e.id.match(/\d+(\.\d+)?/);
                let displayNum = episodeMatch ? (Number.isInteger(parseFloat(episodeMatch[0])) ? parseFloat(episodeMatch[0]) : episodeMatch[0]) : realIndex + 1;

                return `
                    <div class="episode ${isWatched ? "watched" : ""}" id="ep-card-${e.id}" onclick='window.Player.playEpisode(${JSON.stringify(e)}, this, ${realIndex})'>
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

/**
 * Cambia la temporada actual
 */
function changeSeason(i) {
    window.AppState.setCurrentSeasonIndex(parseInt(i));
    window.AppState.setCurrentEpisodePage(0);
    renderSerieView();
}

/**
 * Cambia la página de episodios
 */
function changePageTo(pageIndex) {
    const currentSerie = window.AppState.getCurrentSerie();
    const allEpisodes = window.AppUtils.getEpisodesFromSerie(currentSerie);
    const totalPages = Math.ceil(allEpisodes.length / window.AppState.getEpisodesPerPage());

    if (pageIndex >= 0 && pageIndex < totalPages) {
        window.AppState.setCurrentEpisodePage(pageIndex);
        renderSerieView();
    }
}

/**
 * Salta a un episodio específico
 */
function goToEpisode(number) {
    const currentSerie = window.AppState.getCurrentSerie();
    if (!number || !currentSerie) return;

    const allEpisodes = window.AppUtils.getEpisodesFromSerie(currentSerie);
    const epIndex = allEpisodes.findIndex(e => {
        const match = e.id.match(/\d+/);
        return match && parseInt(match[0]) === parseInt(number);
    });

    if (epIndex !== -1) {
        const targetPage = Math.floor(epIndex / window.AppState.getEpisodesPerPage());
        window.AppState.setCurrentEpisodePage(targetPage);
        renderSerieView();

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

/**
 * Sincroniza el estado de episodios vistos desde el servidor
 */
async function syncServerWatchedStatus() {
    if (!localStorage.getItem("ws_token")) return;

    try {
        const resp = await window.API.fetchWithAuth(`${API_BASE}/continue-watching`);
        const serverProgress = await resp.json();
        const currentSerie = window.AppState.getCurrentSerie();

        serverProgress.forEach(sp => {
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

/* ================= EXPORTS ================= */
window.SeriesView = {
    open: openSerie,
    render: renderSerieView,
    changeSeason,
    changePageTo,
    goToEpisode,
    syncWatchedStatus: syncServerWatchedStatus
};
