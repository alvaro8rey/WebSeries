/* ================= PLAYER (SIMPLIFICADO Y ARREGLADO) ================= */

/**
 * Reproduce un episodio de una serie
 */
function playEpisode(ep, el, index) {
    stopPlayer();
    window.AppState.setCurrentEpisodeElement(el);

    // Detectar si estamos en el modal
    const modalContainer = document.querySelector('.player-modal.active .player-container');
    let box;

    if (modalContainer) {
        // Usar el contenedor del modal
        box = modalContainer;
        box.innerHTML = `
            <video id="vjs-player" class="video-js vjs-default-skin vjs-big-play-centered" playsinline></video>
            <button id="floatingNextBtn" class="btn-next-floating hidden">
                Siguiente episodio ➔
            </button>
            <div class="autoplay"></div>`;
    } else {
        // Crear contenedor tradicional (no usado actualmente, pero por compatibilidad)
        box = document.createElement("div");
        box.className = "player-container";
        box.innerHTML = `
            <video id="vjs-player" class="video-js vjs-default-skin vjs-big-play-centered" playsinline></video>
            <button id="floatingNextBtn" class="btn-next-floating hidden">
                Siguiente episodio ➔
            </button>
            <div class="autoplay"></div>`;
        if (el) el.after(box);
    }

    const currentSerie = window.AppState.getCurrentSerie();
    const seriesId = currentSerie ? currentSerie.id : ep.id;
    const key = seriesId + "_" + ep.id;

    // Esperar un momento antes de inicializar videojs
    setTimeout(() => {
        const videoElement = document.getElementById('vjs-player');
        if (!videoElement) {
            console.error("No se encontró el elemento de video");
            return;
        }

        const player = videojs('vjs-player', {
            controls: true,
            autoplay: true,
            fluid: false,
            fill: true,
            responsive: true,
            html5: { vhs: { overrideNative: true } }
        });

        window.currentVjs = player;
        player.src({ src: ep.url, type: 'application/x-mpegURL' });

        // Listener para tecla Escape si estamos en modal
        if (modalContainer) {
            const escapeHandler = (e) => {
                if (e.key === 'Escape') {
                    window.SeriesView.closePlayer();
                    document.removeEventListener('keydown', escapeHandler);
                }
            };
            document.addEventListener('keydown', escapeHandler);
        }

        // MINIATURAS VTT
        player.ready(() => {
            let seasonNum = null;

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
            const vttUrl = `/Series_HLS/${encodeURIComponent(currentSerie.title)}/${seasonFolder}${epFolder}/thumbnails/index/index_thumbnails.vtt`;

            fetch(vttUrl)
                .then(r => {
                    if (!r.ok) return null;
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
                            const start = window.AppUtils.timeToSeconds(timeMatch[1]);
                            const end = window.AppUtils.timeToSeconds(timeMatch[2]);
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
                .catch(() => {});
        });

        // PROGRESO Y EVENTOS
        player.on('loadedmetadata', async () => {
            let savedTime = 0;
            let shouldRestore = false;

            if (localStorage.getItem("ws_token")) {
                try {
                    const r = await window.API.fetchWithAuth(`${API_BASE}/progress/${seriesId}/${ep.id}`);
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
        });

        let lastSavedSecondSeries = -1;
        let markAsWatchedFired = false;

        player.on('timeupdate', () => {
            const curTime = player.currentTime();
            const duration = player.duration();
            const currentSecond = Math.floor(curTime);
            const floatingBtn = box.querySelector("#floatingNextBtn");

            window.AppState.saveLocalProgress(key, { time: curTime, duration: duration });

            if (duration > 0 && (duration - curTime) <= 10 && (duration - curTime) > 0.5) {
                if (floatingBtn && floatingBtn.classList.contains('hidden')) {
                    const allEpisodes = window.AppUtils.getEpisodesFromSerie(currentSerie);
                    const nextEp = allEpisodes[index + 1];
                    if (nextEp) {
                        floatingBtn.classList.remove('hidden');
                        floatingBtn.onclick = (e) => {
                            e.stopPropagation();
                            if (localStorage.getItem("ws_token")) {
                                window.API.syncProgressToServer(seriesId, ep.id, ep.title, ep.url, duration, duration);
                            }
                            window.AppState.markWatched(key);
                            startNextEpisode(nextEp, index + 1);
                        };
                    }
                }
            } else if (floatingBtn) {
                floatingBtn.classList.add('hidden');
            }

            if (duration > 0 && (duration - curTime) < 30 && !markAsWatchedFired) {
                markAsWatchedFired = true;
                window.AppState.markWatched(key);
                if (el) el.classList.add('watched');
            }

            if (localStorage.getItem("ws_token") && currentSecond % 10 === 0 && currentSecond !== lastSavedSecondSeries) {
                lastSavedSecondSeries = currentSecond;
                window.API.syncProgressToServer(seriesId, ep.id, ep.title, ep.url, curTime, duration);
            }
        });

        player.on('ended', () => {
            const duration = player.duration();
            if (localStorage.getItem("ws_token")) {
                window.API.syncProgressToServer(seriesId, ep.id, ep.title, ep.url, duration, duration);
            }
            window.AppState.markWatched(key);
            if (window.ContinueWatching) {
                window.ContinueWatching.render();
            }
            if (currentSerie) {
                const autoplayContainer = box.querySelector(".autoplay");
                autoplayNext(index, autoplayContainer);
            }
        });
    }, 100);
}

/**
 * Inicia autoplay del siguiente episodio
 */
function autoplayNext(currentIndex, container) {
    const autoplayTimer = window.AppState.getAutoplayTimer();
    if (autoplayTimer) clearInterval(autoplayTimer);

    let countdown = 15;
    const currentSerie = window.AppState.getCurrentSerie();
    const allEpisodes = window.AppUtils.getEpisodesFromSerie(currentSerie);
    const nextIndex = currentIndex + 1;

    if (nextIndex >= allEpisodes.length) {
        // Si estamos en modal, cerrar automáticamente
        const modal = document.querySelector('.player-modal.active');
        if (modal) {
            setTimeout(() => window.SeriesView.closePlayer(), 2000);
        }
        return;
    }

    const nextEp = allEpisodes[nextIndex];

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

    document.getElementById("btn-play-now").onclick = () => {
        clearInterval(window.AppState.getAutoplayTimer());
        startNextEpisode(nextEp, nextIndex);
    };

    document.getElementById("btn-cancel-next").onclick = () => {
        clearInterval(window.AppState.getAutoplayTimer());
        container.innerHTML = "";

        // Si estamos en modal, cerrar
        const modal = document.querySelector('.player-modal.active');
        if (modal) {
            window.SeriesView.closePlayer();
        }
    };

    const timer = setInterval(() => {
        countdown--;
        const textEl = document.getElementById("countdown-text");

        if (textEl) {
            textEl.innerText = `Siguiente episodio en ${countdown}...`;
        }

        if (countdown <= 0) {
            clearInterval(timer);
            startNextEpisode(nextEp, nextIndex);
        }
    }, 1000);

    window.AppState.setAutoplayTimer(timer);
}

/**
 * Inicia el siguiente episodio
 */
function startNextEpisode(nextEp, nextIndex) {
    // Siempre usar modal
    const modal = document.querySelector('.player-modal.active');
    if (modal) {
        window.SeriesView.playEpisodeModal(nextIndex);
    }
}

/**
 * Reproduce desde el home (continuar viendo)
 */
async function playFromHome(seriesId, episodeUrl, episodeId) {
    console.log("Iniciando playFromHome para:", seriesId, episodeId);
    if (!seriesId) return;

    // CASO PELÍCULA
    const movie = movies.find(m => m.id === seriesId);
    if (movie) {
        console.log("Es una película, abriendo...");
        await window.MoviesView.open(seriesId);

        setTimeout(() => {
            if (window.currentVjs) {
                window.currentVjs.play();
                document.getElementById('moviePlayerTarget').scrollIntoView({behavior:'smooth'});
            }
        }, 1000);
        return;
    }

    // CASO SERIE - Abrir en modal
    const foundSerie = series.find(s => s.id === seriesId);

    if (foundSerie) {
        await window.SeriesView.open(seriesId, 0);

        // Buscar el episodio
        setTimeout(() => {
            const allEpisodes = window.AppUtils.getEpisodesFromSerie(foundSerie);
            const epIndex = allEpisodes.findIndex(e => e.id === episodeId);

            if (epIndex !== -1) {
                window.SeriesView.playEpisodeModal(epIndex);
            }
        }, 500);
    }
}

/**
 * Detiene el reproductor actual
 */
function stopPlayer() {
  if (window.currentVjs) {
    try {
      window.currentVjs.dispose();
    } catch (e) {
      console.error("Error al dispose del player:", e);
    }
    window.currentVjs = null;
  }

  const autoplayTimer = window.AppState.getAutoplayTimer();
  if (autoplayTimer) clearInterval(autoplayTimer);

  document.querySelectorAll(".player-container:not(.player-modal .player-container)").forEach(p => p.remove());
}

/* ================= EXPORTS ================= */
window.Player = {
    playEpisode,
    autoplayNext,
    startNextEpisode,
    playFromHome,
    stop: stopPlayer
};
