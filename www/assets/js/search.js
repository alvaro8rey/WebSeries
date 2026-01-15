/* ================= SEARCH ================= */

const searchBox = document.getElementById('searchBox');
const suggestBox = document.getElementById('suggest');

/**
 * Realiza una búsqueda completa y muestra los resultados
 */
function performSearch(query) {
    if (window.Player) window.Player.stop();

    if (!window.isPopState) {
        history.pushState({ view: 'search', query: query }, "Búsqueda", "#search");
    }
    window.isPopState = false;

    const q = query.toLowerCase();
    suggestBox.classList.add('hidden');
    searchBox.blur();

    document.getElementById("home").style.display = "none";
    const viewEl = document.getElementById("view");
    viewEl.style.display = "block";

    const resSeries = series.filter(s => s.title.toLowerCase().includes(q));
    const resMovies = movies.filter(m => m.title.toLowerCase().includes(q));

    if (resSeries.length === 0 && resMovies.length === 0) {
        viewEl.innerHTML = `
            <div class="search-results-empty">
                <h2>No se encontraron resultados para "${query}"</h2>
                <p style="margin-top:10px; color: #aaa;">Prueba con otros términos o revisa la ortografía.</p>
            </div>`;
    } else {
        viewEl.innerHTML = `
            <div class="section-header"><h2>Resultados para: "${query}"</h2></div>

            ${resSeries.length ? `
                <h3 style="margin: 20px 0 10px 0; color: #ffda44;">📺 Series encontradas</h3>
                <div class="grid-container">
                    ${resSeries.map(window.Cards.renderSerie).join("")}
                </div>` : ""}

            ${resMovies.length ? `
                <h3 style="margin: 30px 0 10px 0; color: #ffda44;">🎬 Películas encontradas</h3>
                <div class="grid-container">
                    ${resMovies.map(window.Cards.renderMovie).join("")}
                </div>` : ""}
        `;
    }

    window.scrollTo(0, 0);
}

/**
 * Selecciona un resultado de las sugerencias
 */
function selectSearch(id, type) {
    searchBox.value = "";
    suggestBox.classList.add('hidden');

    if (type === 'movie') {
        window.MoviesView.open(id);
    } else {
        window.SeriesView.open(id);
    }
}

/**
 * Inicializa los event listeners de búsqueda
 */
function initSearch() {
    searchBox.addEventListener('input', () => {
        const query = searchBox.value.toLowerCase().trim();

        if (query.length < 2) {
            suggestBox.classList.add('hidden');
            return;
        }

        const allItems = [
            ...series.map(s => ({...s, searchType: 'serie'})),
            ...movies.map(m => ({...m, searchType: 'movie'}))
        ];

        const matches = allItems
            .filter(item => item.title.toLowerCase().includes(query))
            .slice(0, 4);

        if (matches.length > 0) {
            let html = matches.map(item => `
                <div class="s-item" onclick="window.Search.selectResult('${item.id}', '${item.searchType}')">
                    <img src="images/${item.id}.jpg" class="s-thumb" onerror="this.src='images/default.jpg'">
                    <div class="s-info">
                        <div class="s-title">${item.title}</div>
                        <div class="s-muted">${item.searchType === 'serie' ? 'Serie' : 'Película'}</div>
                    </div>
                </div>
            `).join('');
            html += `<div class="s-more" onclick="window.Search.perform('${query}')">Ver todos</div>`;
            suggestBox.innerHTML = html;
            suggestBox.classList.remove('hidden');
        } else {
            suggestBox.innerHTML = '<div class="s-item"><div class="s-info">No hay sugerencias</div></div>';
            suggestBox.classList.remove('hidden');
        }
    });

    searchBox.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const query = searchBox.value.trim();
            if (query.length > 0) performSearch(query);
        }
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search')) {
            suggestBox.classList.add('hidden');
        }
    });
}

/* ================= EXPORTS ================= */
window.Search = {
    perform: performSearch,
    selectResult: selectSearch,
    init: initSearch
};
