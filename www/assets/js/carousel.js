/* ================= CAROUSEL ================= */

/**
 * Desplazamiento lateral del carrusel
 */
function sideScroll(btn, direction) {
    const container = btn.parentElement;
    const row = container.querySelector('.row');
    const scrollAmount = row.clientWidth * 0.9;

    if (direction === 'left') {
        row.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    } else {
        row.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }

    setTimeout(checkScrollArrows, 500);
}

/**
 * Actualiza la visibilidad de las flechas de navegación
 */
function updateArrows(container) {
    const row = container.querySelector('.row');
    const leftArrow = container.querySelector('.nav-btn.left');
    const rightArrow = container.querySelector('.nav-btn.right');

    if (!row || !leftArrow || !rightArrow) return;

    const scrollLeft = row.scrollLeft;
    const maxScroll = row.scrollWidth - row.clientWidth;

    if (scrollLeft <= 5) {
        leftArrow.classList.add('is-hidden');
    } else {
        leftArrow.classList.remove('is-hidden');
    }

    if (scrollLeft >= maxScroll - 5) {
        rightArrow.classList.add('is-hidden');
    } else {
        rightArrow.classList.remove('is-hidden');
    }
}

/**
 * Verifica y actualiza todas las flechas de scroll
 */
function checkScrollArrows() {
    const containers = document.querySelectorAll('.row-container');

    containers.forEach(container => {
        const row = container.querySelector('.row');
        const leftBtn = container.querySelector('.nav-btn.left');
        const rightBtn = container.querySelector('.nav-btn.right');

        if (!row || !leftBtn || !rightBtn) return;

        const scrollLeft = row.scrollLeft;
        const scrollWidth = row.scrollWidth;
        const clientWidth = row.clientWidth;
        const maxScroll = scrollWidth - clientWidth;
        const canScroll = scrollWidth > clientWidth + 1;

        // Control de Flecha y Gradiente IZQUIERDO
        if (canScroll && scrollLeft > 10) {
            leftBtn.classList.remove('is-hidden');
            container.classList.add('has-left-gradient');
        } else {
            leftBtn.classList.add('is-hidden');
            container.classList.remove('has-left-gradient');
        }

        // Control de Flecha y Gradiente DERECHO
        if (canScroll && scrollLeft < maxScroll - 10) {
            rightBtn.classList.remove('is-hidden');
            container.classList.add('has-right-gradient');
        } else {
            rightBtn.classList.add('is-hidden');
            container.classList.remove('has-right-gradient');
        }
    });
}

/**
 * Configura los event listeners de los carruseles
 */
function setupCarouselLogic() {
    const containers = document.querySelectorAll('.row-container');

    containers.forEach(container => {
        const row = container.querySelector('.row');

        updateArrows(container);

        row.addEventListener('scroll', () => {
            updateArrows(container);
        });

        const arrows = container.querySelectorAll('.nav-btn');
        arrows.forEach(arrow => {
            arrow.addEventListener('click', () => {
                setTimeout(() => updateArrows(container), 300);
            });
        });
    });
}

/* ================= EXPORTS ================= */
window.Carousel = {
    sideScroll,
    updateArrows,
    checkScrollArrows,
    setup: setupCarouselLogic
};
