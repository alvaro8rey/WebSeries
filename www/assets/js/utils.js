/* ================= UTILIDADES ================= */

/**
 * Formatea segundos en formato HH:MM:SS o MM:SS
 */
function formatTime(sec) {
  if (!sec || isNaN(sec)) return "0:00";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return h > 0 ? `${h}:${m.toString().padStart(2, "0")}:${s}` : `${m}:${s}`;
}

/**
 * Extrae el número de episodio de su ID
 */
function episodeNumberFromId(id) {
  const n = parseInt(id.replace(/\D/g, ""), 10);
  return isNaN(n) ? "" : n;
}

/**
 * Convierte tiempo en formato HH:MM:SS.mmm a segundos
 */
function timeToSeconds(timeStr) {
    const [h, m, sMs] = timeStr.split(':');
    const [s, ms] = sMs.split('.');
    return parseInt(h)*3600 + parseInt(m)*60 + parseInt(s) + (parseInt(ms)/1000);
}

/**
 * Comprueba si un timestamp es "nuevo" (últimos 5 días)
 */
function isNew(timestamp) {
    if (!timestamp) return false;
    const now = Date.now();
    const updatedMs = timestamp * 1000;
    const fiveDaysInMs = 5 * 24 * 60 * 60 * 1000;
    const diff = now - updatedMs;
    return diff > 0 && diff < fiveDaysInMs;
}

/**
 * Limpia el título del episodio quitando prefijos redundantes
 */
function cleanEpisodeTitle(title) {
    if (!title) return "Sin título";

    // Buscar la posición del primer " - "
    const firstDashIndex = title.indexOf(' - ');

    // Si existe, devolver TODO lo que viene DESPUÉS
    if (firstDashIndex !== -1) {
        return title.substring(firstDashIndex + 3).trim();
    }

    // Si no hay " - ", intentamos quitar solo el prefijo "Shin Chan XXX"
    return title.replace(/^Shin Chan\s*\d+\s*-?\s*/i, '').trim() || "Episodio sin descripción";
}

/**
 * Obtiene los episodios de una serie según la temporada actual
 */
function getEpisodesFromSerie(serie) {
  const currentSeasonIndex = window.AppState.getCurrentSeasonIndex();
  let eps = [];

  if (serie.seasons && serie.seasons.length) {
    eps = serie.seasons[currentSeasonIndex].episodes || [];
  } else {
    eps = serie.episodes || [];
  }

  // Sort una sola vez al cargar la serie
  if (!serie.sortedEpisodes) {
    serie.sortedEpisodes = [...eps].sort((a, b) => {
      const cleanA = a.id.replace(/-/g, ".").replace(/[^\d.]/g, "");
      const cleanB = b.id.replace(/-/g, ".").replace(/[^\d.]/g, "");
      const na = parseFloat(cleanA) || 0;
      const nb = parseFloat(cleanB) || 0;
      return na - nb;
    });
  }

  return serie.sortedEpisodes;
}

/* ================= EXPORTS ================= */
window.AppUtils = {
    formatTime,
    episodeNumberFromId,
    timeToSeconds,
    isNew,
    cleanEpisodeTitle,
    getEpisodesFromSerie
};
