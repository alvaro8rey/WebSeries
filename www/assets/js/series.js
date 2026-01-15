/* ================= SERIES VIEW (DISNEY+ STYLE) ================= */

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
 * Renderiza la vista de la serie con sus episodios (estilo Disney+)
 */
function renderSerieView() {
    const currentSerie = window.AppState.getCurrentSerie();
    if (!currentSerie) return;

    const globalBackBtn = document.getElementById("backBtn");
    if (globalBackBtn) globalBackBtn.style.display = "block";

    const allEpisodes = window.AppUtils.getEpisodesFromSerie(currentSerie);
    const isSerieFav = window.AppState.getFavoritesList().includes(String(currentSerie.id));

    // Obtener episodio actual
    const currentEp = findCurrentEpisode();
    const hasSeasons = currentSerie.seasons && currentSerie.seasons.length > 0;
    const currentSeasonIndex = window.AppState.getCurrentSeasonIndex();

    // Hero Section
    const heroHTML = `
        <div class="serie-hero" style="background-image: url('images/${currentSerie.id}.jpg');">
            <div class="serie-hero-content">
                <h1 class="serie-hero-title">${currentSerie.title}</h1>
                <p class="serie-hero-subtitle">
                    ${currentEp.progress ? `Continuar viendo · Episodio ${currentEp.index + 1}` : `${allEpisodes.length} episodios`}
                </p>
                <div class="serie-hero-actions">
                    <button class="btn-hero-play" onclick="window.SeriesView.playHeroEpisode()">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M8 5v14l11-7z"/>
                        </svg>
                        ${currentEp.progress ? 'Continuar' : 'Reproducir'}
                    </button>
                    <button class="btn-hero-secondary" onclick="window.Favorites.handleMainClick(event, '${currentSerie.id}')">
                        ${isSerieFav ? '✓ En Mi Lista' : '+ Mi Lista'}
                    </button>
                </div>
            </div>
        </div>
    `;

    // Selector de temporadas estilo Disney+
    let seasonSelectorHTML = '';
    if (hasSeasons) {
        seasonSelectorHTML = `
            <div class="season-selector-disney">
                ${currentSerie.seasons.map((s, i) => `
                    <button class="season-tab ${i === currentSeasonIndex ? 'active' : ''}" onclick="window.SeriesView.changeSeason(${i})">
                        ${s.title || `Temporada ${s.season}`}
                    </button>
                `).join('')}
            </div>
        `;
    }

    // Grid de episodios
    const episodesGridHTML = `
        <div class="episodes-grid">
            ${allEpisodes.map((ep, index) => {
                const episodeProgress = (window.seriesProgress || []).find(p => p.episode_id === ep.id);
                const progressPercent = episodeProgress ? Math.min(100, (episodeProgress.time / episodeProgress.duration) * 100) : 0;
                const isWatched = window.currentSerieWatched && window.currentSerieWatched.includes(String(ep.id));
                const displayTitle = window.AppUtils.cleanEpisodeTitle(ep.title);

                // Calcular número de episodio
                const episodeMatch = ep.id.match(/\d+(\.\d+)?/);
                let displayNum = episodeMatch ? (Number.isInteger(parseFloat(episodeMatch[0])) ? parseFloat(episodeMatch[0]) : episodeMatch[0]) : index + 1;

                return `
                    <div class="episode-card-disney" onclick="window.SeriesView.playEpisodeDisney(${index})">
                        <div class="episode-thumbnail">
                            <img src="images/${currentSerie.id}.jpg" onerror="this.src='images/default.jpg'">
                            <div class="episode-play-overlay">
                                <div class="play-icon-large">▶</div>
                            </div>
                            ${isWatched ? '<div class="episode-watched-badge">✓ Visto</div>' : ''}
                        </div>
                        <div class="episode-info-disney">
                            <div class="episode-header-disney">
                                <span class="episode-number-disney">Episodio ${displayNum}</span>
                                <span class="episode-duration">45 min</span>
                            </div>
                            <h3 class="episode-title-disney">${displayTitle}</h3>
                            <p class="episode-description">
                                ${displayTitle}
                            </p>
                            ${progressPercent > 0 ? `
                                <div class="episode-progress-bar">
                                    <div class="episode-progress-fill" style="width: ${progressPercent}%"></div>
                                </div>
                            ` : ''}
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
        <div class="episodes-grid-container">
            <div class="section-header">
                <h2>Episodios</h2>
            </div>
            ${seasonSelectorHTML}
            ${episodesGridHTML}
        </div>
    `;

    window.scrollTo(0, 0);
}

/**
 * Reproduce el episodio del hero
 */
function playHeroEpisode() {
    const currentEp = findCurrentEpisode();
    playEpisodeDisney(currentEp.index);
}

/**
 * Reproduce un episodio en modal de pantalla completa
 */
function playEpisodeDisney(episodeIndex) {
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
                <video id="vjs-player-disney" class="video-js vjs-default-skin vjs-big-play-centered" playsinline></video>
            </div>
        </div>
    `;

    modal.classList.add('active');

    // Inicializar Video.js
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
                openSerie(currentSerie.id, 0);
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
        playEpisodeDisney(epIndex);
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
    playHeroEpisode,
    playEpisodeDisney,
    closePlayer
};
