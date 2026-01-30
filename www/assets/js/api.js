/* ================= API HELPERS ================= */

/**
 * Realiza peticiones autenticadas al servidor
 */
async function fetchWithAuth(url, options = {}) {
  const headers = {
    ...options.headers,
    ...getAuthHeader(),
    "Content-Type": "application/json"
  };

  try {
    const response = await fetch(url, { ...options, headers });

    if (response.status === 401) {
      logout();
      throw new Error("Sesión expirada");
    }

    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }

    return response;
  } catch (err) {
    console.error("Error en fetchWithAuth:", err);
    throw err;
  }
}

/**
 * Sincroniza el progreso de visualización con el servidor
 */
function syncProgressToServer(sId, eId, title, url, time, duration) {
    // Si el usuario ya vio más del 98% o terminó, enviamos un tiempo que
    // el filtro del servidor detectará como "finalizado"
    let timeToSend = time;
    if (time > duration - 10) {
        timeToSend = duration;
    }

    fetchWithAuth(`${API_BASE}/progress`, {
        method: "POST",
        body: JSON.stringify({
            series_id: sId,
            episode_id: eId,
            episode_title: title || "Sin título",
            url: url || "",
            time: timeToSend,
            duration: duration
        })
    }).then(() => {
        // Si el tiempo enviado fue el final, refrescar el home
        if (timeToSend === duration && window.ContinueWatching) {
            window.ContinueWatching.render();
        }
    }).catch(err => console.error("Error de sincronización:", err));
}

/**
 * Restaura el progreso guardado en el reproductor
 */
function restoreProgress(player, savedTime, savedDuration) {
    player.pause();
    player.addClass('vjs-waiting');

    if (!savedTime || savedTime < 10 || savedTime > (savedDuration - 15)) {
        player.removeClass('vjs-waiting');
        return;
    }

    player.currentTime(savedTime);

    const checkJump = setInterval(() => {
        if (Math.abs(player.currentTime() - savedTime) < 1) {
            console.log("Salto completado con éxito a:", savedTime);
            player.removeClass('vjs-waiting');
            clearInterval(checkJump);
        }
    }, 200);

    setTimeout(() => {
        clearInterval(checkJump);
        player.removeClass('vjs-waiting');
    }, 5000);
}

/**
 * Sincroniza los favoritos desde el servidor
 */
async function syncFavoritesFromServer() {
    try {
        const r = await fetchWithAuth(`${API_BASE}/favorites`);
        if (r.ok) {
            const favs = await r.json();
            const favoritesList = favs.map(f => String(f.seriesId || f.series_id));
            window.AppState.setFavoritesList(favoritesList);

            favoritesList.forEach(id => {
                localStorage.setItem(`fav_${id}`, "true");
            });

            // Refrescar UI si es necesario
            if (document.getElementById("view").style.display === "block") {
                if (window.SeriesView && window.AppState.getCurrentSerie()) {
                    window.SeriesView.render();
                }
            }
        }
    } catch (e) {
        console.error("Error sincronizando favoritos:", e);
    }
}

/* ================= EXPORTS ================= */
window.API = {
    fetchWithAuth,
    syncProgressToServer,
    restoreProgress,
    syncFavoritesFromServer
};
