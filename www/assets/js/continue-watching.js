/* ================= CONTINUE WATCHING ================= */

/**
 * Renderiza la sección "Continuar viendo"
 */
async function renderContinueWatching() {
    const contEl = document.getElementById("continue");
    if (!contEl) return;

    const token = localStorage.getItem("ws_token");
    if (!token) {
        contEl.innerHTML = "";
        return;
    }

    try {
        const response = await window.API.fetchWithAuth(`${API_BASE}/continue-watching`);
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
                        const displayEpisodeTitle = window.AppUtils.cleanEpisodeTitle(item.episode_title);

                        return `
                            <div class="continue-card" onclick="window.Player.playFromHome('${item.series_id}','${item.url}','${item.episode_id}')">
                                <button class="delete-continue-btn" onclick="window.ContinueWatching.removeProgress(event, '${item.series_id}', '${item.episode_id}')">
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
                                        <div class="continue-time">${window.AppUtils.formatTime(item.time)} / ${window.AppUtils.formatTime(item.duration)}</div>
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

/**
 * Elimina un progreso de la lista "Continuar viendo"
 */
async function removeProgress(event, seriesId, episodeId) {
    event.stopPropagation();

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

/* ================= EXPORTS ================= */
window.ContinueWatching = {
    render: renderContinueWatching,
    removeProgress: removeProgress
};
