/* ================= SERIES VIEW (MODERNA CON LISTA) ================= */

/**
 * Obtiene el progreso de todos los episodios desde el servidor
 */
async function getAllEpisodesProgress(seriesId) {
    if (!localStorage.getItem("ws_token")) return [];

    try {
        const resp = await window.API.fetchWithAuth(`${API_BASE}/continue-watching`);
        const allProgress = await resp.json();
        return allProgress.filter(p => p.series_id === seriesId);
    } catch (e) {
        console.error("Error al obtener progreso:", e);
        return [];
    }
}

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

    // Obtener progreso de todos los episodios
    window.seriesProgress = await getAllEpisodesProgress(id);

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
 * Encuentra el episodio actual (último visto o primero)
 */
function findCurrentEpisode() {
    const currentSerie = window.AppState.getCurrentSerie();
    const allEpisodes = window.AppUtils.getEpisodesFromSerie(currentSerie);
    const progress = window.seriesProgress || [];

    // Buscar el último episodio con progreso
    if (progress.length > 0) {
        const lastWatched = progress.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))[0];
        const episode = allEpisodes.find(e => e.id === lastWatched.episode_id);
        if (episode) {
            return {
                episode,
                index: allEpisodes.indexOf(episode),
                progress: lastWatched
            };
        }
    }

    // Si no hay progreso, devolver el primer episodio
    return {
        episode: allEpisodes[0],
        index: 0,
        progress: null
    };
}

/**
 * Renderiza la vista de la serie con sus episodios (LISTA MODERNA)
 */
function renderSerieView() {
    const currentSerie = window.AppState.getCurrentSerie();
    if (!currentSerie) return;

    const globalBackBtn = document.getElementById("backBtn");
    if (globalBackBtn) globalBackBtn.style.display = "block";

    const allEpisodes = window.AppUtils.getEpisodesFromSerie(currentSerie);
    const totalEpisodes = allEpisodes.length;
    const isSerieFav = window.AppState.getFavoritesList().includes(String(currentSerie.id));

    // Obtener episodio actual
    const currentEp = findCurrentEpisode();
    const hasSeasons = currentSerie.seasons && currentSerie.seasons.length > 0;
    const currentSeasonIndex = window.AppState.getCurrentSeasonIndex();

    // Paginación
    const totalPages = Math.ceil(totalEpisodes / window.AppState.getEpisodesPerPage());
    const currentEpisodePage = window.AppState.getCurrentEpisodePage();
    const start = currentEpisodePage * window.AppState.getEpisodesPerPage();
    const episodes = allEpisodes.slice(start, start + window.AppState.getEpisodesPerPage());

    // Hero Section (más compacto)
    const heroHTML = `
        <div class="serie-hero-modern" style="background-image: url('images/${currentSerie.id}.jpg');">
            <div class="serie-hero-content">
                <h1 class="serie-hero-title">${currentSerie.title}</h1>
                <p class="serie-hero-subtitle">
                    ${totalEpisodes} episodios${currentEp.progress ? ` · Continuar: Episodio ${currentEp.index + 1}` : ''}
                </p>
                <div class="serie-hero-actions">
                    <button class="btn-hero-play" onclick="window.SeriesView.playEpisodeModal(${currentEp.index})">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M8 5v14l11-7z"/>
                        </svg>
                        ${currentEp.progress ? 'Continuar' : 'Reproducir'}
                    </button>
                    <button class="btn-hero-secondary" onclick="window.Favorites.handleMainClick(event, '${currentSerie.id}')">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="${isSerieFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                        </svg>
                        ${isSerieFav ? 'En Mi Lista' : 'Mi Lista'}
                    </button>
                </div>
            </div>
        </div>
    `;

    // Selector de temporadas moderno
    let seasonSelectorHTML = '';
    if (hasSeasons) {
        seasonSelectorHTML = `
            <div class="season-selector-modern">
                ${currentSerie.seasons.map((s, i) => `
                    <button class="season-tab-modern ${i === currentSeasonIndex ? 'active' : ''}" onclick="window.SeriesView.changeSeason(${i})">
                        ${s.title || `Temporada ${s.season}`}
                    </button>
                `).join('')}
            </div>
        `;
    }

    // Paginación moderna
    let paginationHTML = "";
    if (totalPages > 1) {
        let pages = [];
        const delta = window.innerWidth < 600 ? 1 : 2;

        pages.push(`<button class="page-btn-modern" ${currentEpisodePage === 0 ? 'disabled' : ''} onclick="window.SeriesView.changePageTo(0)">«</button>`);
        pages.push(`<button class="page-btn-modern" ${currentEpisodePage === 0 ? 'disabled' : ''} onclick="window.SeriesView.changePageTo(${currentEpisodePage - 1})">‹</button>`);

        for (let i = 0; i < totalPages; i++) {
            if (i === 0 || i === totalPages - 1 || (i >= currentEpisodePage - delta && i <= currentEpisodePage + delta)) {
                pages.push(`<button class="page-btn-modern ${i === currentEpisodePage ? 'active' : ''}" onclick="window.SeriesView.changePageTo(${i})">${i + 1}</button>`);
            } else if (i === currentEpisodePage - delta - 1 || i === currentEpisodePage + delta + 1) {
                pages.push(`<span class="page-dots">...</span>`);
            }
        }

        pages.push(`<button class="page-btn-modern" ${currentEpisodePage >= totalPages - 1 ? 'disabled' : ''} onclick="window.SeriesView.changePageTo(${currentEpisodePage + 1})">›</button>`);
        pages.push(`<button class="page-btn-modern" ${currentEpisodePage >= totalPages - 1 ? 'disabled' : ''} onclick="window.SeriesView.changePageTo(${totalPages - 1})">»</button>`);

        paginationHTML = `<div class="pagination-modern"><div class="pagination-numbers">${pages.join("")}</div></div>`;
    }

    // Lista de episodios moderna
    const episodesListHTML = `
        <div class="episodes-list-modern">
            ${episodes.map((ep, i) => {
                const realIndex = start + i;
                const episodeProgress = (window.seriesProgress || []).find(p => p.episode_id === ep.id);
                const progressPercent = episodeProgress ? Math.min(100, (episodeProgress.time / episodeProgress.duration) * 100) : 0;
                const isWatched = window.currentSerieWatched && window.currentSerieWatched.includes(String(ep.id));
                const displayTitle = window.AppUtils.cleanEpisodeTitle(ep.title);
                const episodeMatch = ep.id.match(/\d+(\.\d+)?/);
                let displayNum = episodeMatch ? (Number.isInteger(parseFloat(episodeMatch[0])) ? parseFloat(episodeMatch[0]) : episodeMatch[0]) : realIndex + 1;

                return `
                    <div class="episode-item-modern ${isWatched ? 'watched' : ''}" onclick="window.SeriesView.playEpisodeModal(${realIndex})">
                        <div class="episode-number-badge">${displayNum}</div>
                        <div class="episode-content">
                            <div class="episode-title-modern">${displayTitle}</div>
                            ${progressPercent > 0 ? `
                                <div class="episode-progress-bar-modern">
                                    <div class="episode-progress-fill-modern" style="width: ${progressPercent}%"></div>
                                </div>
                            ` : ''}
                        </div>
                        <div class="episode-actions">
                            ${isWatched ? '<span class="watched-icon">✓</span>' : ''}
                            <svg class="play-icon-small" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M8 5v14l11-7z"/>
                            </svg>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;

    // Renderizado Final
    const viewEl = document.getElementById("view");
    viewEl.innerHTML = `
        ${heroHTML}
        <div class="episodes-container-modern">
            ${seasonSelectorHTML}
            <div class="section-header-modern">
                <h2>Episodios</h2>
                <span class="episodes-count">${start + 1}-${Math.min(start + episodes.length, totalEpisodes)} de ${totalEpisodes}</span>
            </div>
            ${episodesListHTML}
            ${paginationHTML}
        </div>
    `;

    window.scrollTo(0, 0);
}

/**
 * Reproduce un episodio en modal
 */
function playEpisodeModal(episodeIndex) {
    const currentSerie = window.AppState.getCurrentSerie();
    const allEpisodes = window.AppUtils.getEpisodesFromSerie(currentSerie);
    const episode = allEpisodes[episodeIndex];

    if (!episode) return;

    // Crear modal de reproductor
    let modal = document.getElementById('player-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'player-modal';
        modal.className = 'player-modal';
        document.body.appendChild(modal);
    }

    const displayTitle = window.AppUtils.cleanEpisodeTitle(episode.title);
    const episodeMatch = episode.id.match(/\d+(\.\d+)?/);
    let displayNum = episodeMatch ? (Number.isInteger(parseFloat(episodeMatch[0])) ? parseFloat(episodeMatch[0]) : episodeMatch[0]) : episodeIndex + 1;

    modal.innerHTML = `
        <div class="player-modal-header">
            <div class="player-modal-title">
                ${currentSerie.title} · Episodio ${displayNum}: ${displayTitle}
            </div>
            <button class="btn-close-player" onclick="window.SeriesView.closePlayer()">×</button>
        </div>
        <div class="player-modal-content">
            <div class="player-container">
                <video id="vjs-player" class="video-js vjs-default-skin vjs-big-play-centered" playsinline></video>
            </div>
        </div>
    `;

    modal.classList.add('active');

    // Inicializar reproductor
    setTimeout(() => {
        window.Player.playEpisode(episode, null, episodeIndex);
    }, 300);
}

/**
 * Cierra el reproductor modal
 */
function closePlayer() {
    const modal = document.getElementById('player-modal');
    if (modal) {
        modal.classList.remove('active');
        if (window.Player) window.Player.stop();

        // Recargar la vista para actualizar progresos
        setTimeout(() => {
            const currentSerie = window.AppState.getCurrentSerie();
            if (currentSerie) {
                openSerie(currentSerie.id, window.AppState.getCurrentEpisodePage());
            }
        }, 300);
    }
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
        window.scrollTo({ top: 0, behavior: 'smooth' });
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
        playEpisodeModal(epIndex);
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

        window.seriesProgress = serverProgress.filter(p => p.series_id === currentSerie.id);
        renderSerieView();
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
    syncWatchedStatus: syncServerWatchedStatus,
    playEpisodeModal,
    closePlayer
};
