/* ================= PLAYER (SIMPLIFICADO Y ARREGLADO) ================= */

/**
 * Configura los controles personalizados del reproductor
 */
function setupCustomControls(player, currentIndex, container) {
    const currentSerie = window.AppState.getCurrentSerie();
    const allEpisodes = window.AppUtils.getEpisodesFromSerie(currentSerie);

    const prevBtn = container.querySelector('#prevEpisodeBtn');
    const nextBtn = container.querySelector('#nextEpisodeBtn');
    const playPauseBtn = container.querySelector('#playPauseBtn');
    const rewindBtn = container.querySelector('#rewind10Btn');
    const forwardBtn = container.querySelector('#forward10Btn');
    const controlsContainer = container.querySelector('.custom-player-controls');

    // Control de visibilidad de los controles
    let controlsTimeout;

    function showControls() {
        controlsContainer.classList.add('visible');
        clearTimeout(controlsTimeout);
        controlsTimeout = setTimeout(() => {
            if (!player.paused()) {
                controlsContainer.classList.remove('visible');
            }
        }, 3000);
    }

    function hideControls() {
        if (!player.paused()) {
            controlsContainer.classList.remove('visible');
        }
    }

    // Mostrar controles al mover el mouse o tocar la pantalla
    container.addEventListener('mousemove', showControls);
    container.addEventListener('touchstart', showControls);
    container.addEventListener('click', (e) => {
        if (e.target.closest('.control-btn') || e.target.closest('.vjs-control-bar')) return;
        showControls();
    });

    // Actualizar estado play/pause
    function updatePlayPauseIcon() {
        const playIcon = playPauseBtn.querySelector('.play-icon');
        const pauseIcon = playPauseBtn.querySelector('.pause-icon');

        if (player.paused()) {
            playIcon.classList.remove('hidden');
            pauseIcon.classList.add('hidden');
            controlsContainer.classList.add('visible');
        } else {
            playIcon.classList.add('hidden');
            pauseIcon.classList.remove('hidden');
        }
    }

    player.on('play', updatePlayPauseIcon);
    player.on('pause', updatePlayPauseIcon);

    // Botón Play/Pause
    playPauseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (player.paused()) {
            player.play();
        } else {
            player.pause();
        }
    });

    // Botón retroceder 10s
    rewindBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const currentTime = player.currentTime();
        player.currentTime(Math.max(0, currentTime - 10));
        showControls();
    });

    // Botón avanzar 10s
    forwardBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const currentTime = player.currentTime();
        const duration = player.duration();
        player.currentTime(Math.min(duration, currentTime + 10));
        showControls();
    });

    // Botón episodio anterior
    if (currentIndex > 0) {
        prevBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            window.SeriesView.playEpisodeModal(currentIndex - 1);
        });
    } else {
        prevBtn.disabled = true;
        prevBtn.style.opacity = '0.3';
    }

    // Botón episodio siguiente
    if (currentIndex < allEpisodes.length - 1) {
        nextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            window.SeriesView.playEpisodeModal(currentIndex + 1);
        });
    } else {
        nextBtn.disabled = true;
        nextBtn.style.opacity = '0.3';
    }

    // Atajos de teclado
    const keyHandler = (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        switch(e.key) {
            case ' ':
            case 'k':
                e.preventDefault();
                if (player.paused()) {
                    player.play();
                } else {
                    player.pause();
                }
                break;
            case 'ArrowLeft':
                e.preventDefault();
                player.currentTime(Math.max(0, player.currentTime() - 10));
                showControls();
                break;
            case 'ArrowRight':
                e.preventDefault();
                player.currentTime(Math.min(player.duration(), player.currentTime() + 10));
                showControls();
                break;
            case 'n':
                e.preventDefault();
                if (currentIndex < allEpisodes.length - 1) {
                    window.SeriesView.playEpisodeModal(currentIndex + 1);
                }
                break;
            case 'p':
                e.preventDefault();
                if (currentIndex > 0) {
                    window.SeriesView.playEpisodeModal(currentIndex - 1);
                }
                break;
        }
    };

    document.addEventListener('keydown', keyHandler);

    // Limpiar al destruir el player
    player.on('dispose', () => {
        document.removeEventListener('keydown', keyHandler);
        clearTimeout(controlsTimeout);
    });

    // Mostrar controles al inicio
    showControls();
}

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
            <div class="custom-player-controls">
                <div class="controls-row">
                    <button class="control-btn" id="prevEpisodeBtn" title="Episodio anterior">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
                        </svg>
                    </button>
                    <button class="control-btn" id="rewind10Btn" title="Retroceder 10s">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M11.99 5V1l-5 5 5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6h-2c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
                            <text x="9" y="16" font-size="8" fill="currentColor" font-weight="bold">10</text>
                        </svg>
                    </button>
                    <button class="control-btn control-btn-play" id="playPauseBtn" title="Play/Pause">
                        <svg class="play-icon" width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M8 5v14l11-7z"/>
                        </svg>
                        <svg class="pause-icon hidden" width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                        </svg>
                    </button>
                    <button class="control-btn" id="forward10Btn" title="Avanzar 10s">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/>
                            <text x="11" y="16" font-size="8" fill="currentColor" font-weight="bold">10</text>
                        </svg>
                    </button>
                    <button class="control-btn" id="nextEpisodeBtn" title="Episodio siguiente">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
                        </svg>
                    </button>
                </div>
            </div>
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
            <div class="custom-player-controls">
                <div class="controls-row">
                    <button class="control-btn" id="prevEpisodeBtn" title="Episodio anterior">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
                        </svg>
                    </button>
                    <button class="control-btn" id="rewind10Btn" title="Retroceder 10s">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M11.99 5V1l-5 5 5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6h-2c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
                            <text x="9" y="16" font-size="8" fill="currentColor" font-weight="bold">10</text>
                        </svg>
                    </button>
                    <button class="control-btn control-btn-play" id="playPauseBtn" title="Play/Pause">
                        <svg class="play-icon" width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M8 5v14l11-7z"/>
                        </svg>
                        <svg class="pause-icon hidden" width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                        </svg>
                    </button>
                    <button class="control-btn" id="forward10Btn" title="Avanzar 10s">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/>
                            <text x="11" y="16" font-size="8" fill="currentColor" font-weight="bold">10</text>
                        </svg>
                    </button>
                    <button class="control-btn" id="nextEpisodeBtn" title="Episodio siguiente">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
                        </svg>
                    </button>
                </div>
            </div>
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
        window.currentEpisodeIndex = index;
        player.src({ src: ep.url, type: 'application/x-mpegURL' });

        // Configurar controles personalizados
        setupCustomControls(player, index, box);

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
