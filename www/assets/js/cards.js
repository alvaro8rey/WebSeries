/* ================= CARDS ================= */

/**
 * Genera el HTML de una tarjeta de serie
 */
function cardHTMLSerie(serie) {
    const flags = {
        "es": {
            svg: `<svg width="16" height="16" viewBox="0 0 512 512">
                    <circle cx="256" cy="256" r="256" fill="#f0f0f0"/>
                    <path d="M0 256c0 31.3 5.6 61.3 15.9 89h480.2c10.3-27.7 15.9-57.7 15.9-89s-5.6-61.3-15.9-89H15.9C5.6 194.7 0 224.7 0 256z" fill="#ffda44"/>
                    <path d="M496.1 167a256 256 0 0 0-480.2 0h480.2zM15.9 345a256 256 0 0 0 480.2 0H15.9z" fill="#d80027"/>
                 </svg>`,
            label: "ES"
        },
        "gl": {
            svg: `<svg width="16" height="16" viewBox="0 0 512 512">
                    <rect width="512" height="512" fill="#fff"/>
                    <path d="M560 420L-50 20v130L560 550z" fill="#0099cc"/>
                 </svg>`,
            label: "GL"
        }
    };

    const langData = flags[serie.lang] || { svg: "", label: "" };
    const isFav = window.AppState.getFavoritesList().includes(String(serie.id));
    const newBadge = window.AppUtils.isNew(serie.updated_at) ? `<div class="badge-new">¡Nuevo!</div>` : '';

    return `
    <div class="card" onclick="window.SeriesView.open('${serie.id}')">
        <div class="card-img-container">
            ${newBadge}
            <span class="fav-star ${isFav ? 'active' : ''}" onclick="window.Favorites.toggle(event, '${serie.id}', 'serie')">★</span>
            <img src="images/${serie.id}.jpg" loading="lazy" onerror="this.src='images/default.jpg'">
            <div class="lang-tag">${langData.label} ${langData.svg}</div>
        </div>
        <div class="meta">
            <div class="title-container">
                <div class="title scroll-title">${serie.title}</div>
            </div>
        </div>
    </div>`;
}

/**
 * Genera el HTML de una tarjeta de película
 */
function cardHTMLMovie(movie) {
    const flags = {
        "es": {
            svg: `<svg width="16" height="16" viewBox="0 0 512 512">
                    <circle cx="256" cy="256" r="256" fill="#f0f0f0"/>
                    <path d="M0 256c0 31.3 5.6 61.3 15.9 89h480.2c10.3-27.7 15.9-57.7 15.9-89s-5.6-61.3-15.9-89H15.9C5.6 194.7 0 224.7 0 256z" fill="#ffda44"/>
                    <path d="M496.1 167a256 256 0 0 0-480.2 0h480.2zM15.9 345a256 256 0 0 0 480.2 0H15.9z" fill="#d80027"/>
                 </svg>`,
            label: "ES"
        },
        "gl": {
            svg: `<svg width="16" height="16" viewBox="0 0 512 512">
                    <rect width="512" height="512" fill="#fff"/>
                    <path d="M560 420L-50 20v130L560 550z" fill="#0099cc"/>
                 </svg>`,
            label: "GL"
        }
    };

    const langData = flags[movie.lang] || { svg: "", label: "" };
    const isFav = window.AppState.getFavoritesList().includes(String(movie.id));
    const newBadge = window.AppUtils.isNew(movie.updated_at) ? `<div class="badge-new">¡Nuevo!</div>` : '';

    return `
    <div class="card" onclick="window.MoviesView.open('${movie.id}')">
        <div class="card-img-container">
            ${newBadge}
            <span class="fav-star ${isFav ? 'active' : ''}" onclick="window.Favorites.toggle(event, '${movie.id}', 'movie')">★</span>
            <img src="images/${movie.id}.jpg" loading="lazy" onerror="this.src='images/default.jpg'">
            <div class="lang-tag">${langData.label} ${langData.svg}</div>
        </div>
        <div class="meta">
            <div class="title-container">
                <div class="title scroll-title">${movie.title}</div>
            </div>
        </div>
    </div>`;
}

/* ================= EXPORTS ================= */
window.Cards = {
    renderSerie: cardHTMLSerie,
    renderMovie: cardHTMLMovie
};
