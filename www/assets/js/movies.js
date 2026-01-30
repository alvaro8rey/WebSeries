/* ================= MOVIES VIEW ================= */

/**
 * Abre la vista de una película
 */
async function openMovie(movieId) {
    if (window.Player) window.Player.stop();

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

    const isMovieFav = window.AppState.getFavoritesList().includes(String(movie.id));
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
                    <button id="fav-main-btn" class="btn-fav-compact ${isMovieFav ? 'active' : ''}" onclick="window.Favorites.handleMainClick(event, '${movie.id}')">
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
                        const start = window.AppUtils.timeToSeconds(timeMatch[1]);
                        const end = window.AppUtils.timeToSeconds(timeMatch[2]);
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

                    if (!cue) {
                        tooltip.classList.remove('visible');
                        return;
                    }

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
            window.API.fetchWithAuth(`${API_BASE}/progress/${movie.id}/${movie.id}`)
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

        window.AppState.saveLocalProgress(key, { time: curTime, duration: duration });

        if (localStorage.getItem("ws_token") && currentSecond % 10 === 0 && currentSecond !== lastSavedSecondMovie) {
            lastSavedSecondMovie = currentSecond;
            window.API.syncProgressToServer(movie.id, movie.id, movie.title, movie.url, curTime, duration);
        }
    });

    player.on('ended', () => {
        if (localStorage.getItem("ws_token")) {
            window.API.syncProgressToServer(movie.id, movie.id, movie.title, movie.url, player.duration(), player.duration());
        }
        if (window.ContinueWatching) {
            window.ContinueWatching.render();
        }
    });
}

/* ================= EXPORTS ================= */
window.MoviesView = {
    open: openMovie
};
