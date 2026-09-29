// =============================================================================
// SHARED UTILS
// =============================================================================

const getShapeSize = () => {
    const vwSize = window.innerWidth * 0.25;
    return Math.min(225, Math.max(120, vwSize));
};

const getPageColor = () => {
    const rgb = getComputedStyle(document.body).backgroundColor;
    const match = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
    if (!match) return rgb;
    const hex = (x) => ("0" + parseInt(x).toString(16)).slice(-2).toUpperCase();
    return "#" + hex(match[1]) + hex(match[2]) + hex(match[3]);
};

// Creates a full-screen overlay that shrinks to a circle (used on page entry from homepage)
function playShrinkOverlay(color, cx, cy, targetRadius) {
    const vpWidth = window.innerWidth;
    const vpHeight = Math.max(window.innerHeight, document.documentElement.clientHeight, window.screen?.height || 0);
    const mxX = Math.max(cx + 50, vpWidth - cx + 50);
    const mxY = Math.max(cy + 50, vpHeight - cy + 50);
    const startRadius = Math.sqrt(mxX * mxX + mxY * mxY) + 100;

    const overlay = document.createElement('div');
    overlay.id = 'return-transition';
    overlay.style.cssText = `
        position: fixed;
        top: -50px; left: -50px; right: -50px; bottom: -50px;
        background-color: ${color};
        z-index: 9999;
        pointer-events: none;
        clip-path: circle(${startRadius}px at ${cx + 50}px ${cy + 50}px);
        transition: clip-path 400ms cubic-bezier(0.4, 0, 0.2, 1), opacity 200ms ease;
    `;
    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            overlay.style.clipPath = `circle(${targetRadius}px at ${cx + 50}px ${cy + 50}px)`;
            setTimeout(() => {
                overlay.style.opacity = '0';
                setTimeout(() => overlay.remove(), 200);
            }, 400);
        });
    });
}

// Creates a full-screen overlay that shrinks to a rectangle (used when returning to projects)
function playRectShrinkOverlay(color, targetCard) {
    const rect = targetCard.getBoundingClientRect();
    const vpWidth = window.innerWidth;
    const vpHeight = window.innerHeight;
    
    // Calculate inset values to shrink to the card position
    const top = rect.top;
    const right = vpWidth - rect.right;
    const bottom = vpHeight - rect.bottom;
    const left = rect.left;
    
    const overlay = document.createElement('div');
    overlay.id = 'return-transition';
    overlay.style.cssText = `
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background-color: ${color};
        z-index: 9999;
        pointer-events: none;
        clip-path: inset(0);
        transition: clip-path 400ms cubic-bezier(0.4, 0, 0.2, 1), opacity 200ms ease;
    `;
    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            overlay.style.clipPath = `inset(${top}px ${right}px ${bottom}px ${left}px round 10px)`;
            setTimeout(() => {
                overlay.style.opacity = '0';
                setTimeout(() => overlay.remove(), 200);
            }, 400);
        });
    });
}

// =============================================================================
// CARD GRID (projects.html â€” has #cards)
// =============================================================================

const cardsContainer = document.getElementById('cards');

if (cardsContainer) {

    // --- Entry animation from homepage shape click ---
    // Same as subpage.js: shrink overlay to reveal page
    const storedColor = sessionStorage.getItem('transitionColor') || '#000000';
    const storedX = sessionStorage.getItem('transitionX');
    const storedY = sessionStorage.getItem('transitionY');
    const centerX = storedX ? parseFloat(storedX) : window.innerWidth / 2;
    const centerY = storedY ? parseFloat(storedY) : window.innerHeight / 2;
    const halfSize = getShapeSize() / 2;

    // Only play if we're NOT returning from a detail page (that has its own animation)
    const returningToProjects = sessionStorage.getItem('returningToProjects');

    if (returningToProjects) {
        // --- Return from detail page: shrink overlay to card position ---
        sessionStorage.removeItem('returningToProjects');

        const color = sessionStorage.getItem('transitionColor') || '#000000';
        const projectId = sessionStorage.getItem('projectId');
        const targetCard = projectId
            ? document.querySelector(`.card[data-project="${projectId}"]`)
            : null;

        if (targetCard) {
            // The grid scrolls now, so bring the card on screen before shrinking to it.
            targetCard.scrollIntoView({ block: 'center', behavior: 'instant' });
            playRectShrinkOverlay(color, targetCard);
        } else {
            // Fallback to circle if card not found
            const cx = window.innerWidth / 2;
            const cy = window.innerHeight / 2;
            playShrinkOverlay(color, cx, cy, halfSize);
        }

    } else {
        // --- Entry from homepage: shrink overlay to center ---
        // (Always plays on first load â€” matches subpage.js behavior)
        const vpWidth = window.innerWidth;
        const vpHeight = Math.max(window.innerHeight, document.documentElement.clientHeight, window.screen?.height || 0);
        const mxX = Math.max(centerX + 50, vpWidth - centerX + 50);
        const mxY = Math.max(centerY + 50, vpHeight - centerY + 50);
        const fullRadius = Math.sqrt(mxX * mxX + mxY * mxY) + 100;

        const entryOverlay = document.createElement('div');
        entryOverlay.id = 'shape-transition';
        entryOverlay.style.cssText = `
            position: fixed;
            top: -50px; left: -50px; right: -50px; bottom: -50px;
            background-color: ${storedColor};
            z-index: 9999;
            pointer-events: none;
            clip-path: circle(${fullRadius}px at ${centerX + 50}px ${centerY + 50}px);
            transition: clip-path 400ms cubic-bezier(0.4, 0, 0.2, 1), opacity 200ms ease;
        `;
        document.body.appendChild(entryOverlay);

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                entryOverlay.style.clipPath = `circle(${halfSize}px at ${centerX + 50}px ${centerY + 50}px)`;
                setTimeout(() => {
                    entryOverlay.style.opacity = '0';
                    setTimeout(() => entryOverlay.remove(), 200);
                }, 400);
            });
        });
    }

    // --- Mouse tracking glow ---
    cardsContainer.onmousemove = e => {
        for (const card of document.getElementsByClassName('card')) {
            const rect = card.getBoundingClientRect(),
                  x = e.clientX - rect.left,
                  y = e.clientY - rect.top;
            card.style.setProperty('--mouse-x', `${x}px`);
            card.style.setProperty('--mouse-y', `${y}px`);
        }
    };

    // --- Card click: scale card to fill viewport, then navigate ---
    document.querySelectorAll('.card').forEach(card => {
        card.addEventListener('click', (e) => {
            e.preventDefault();
            const href = card.getAttribute('href');
            const project = card.dataset.project;
            const rect = card.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;

            sessionStorage.setItem('transitionColor', '#663399'); // Match homepage shape color
            sessionStorage.setItem('transitionX', cx);
            sessionStorage.setItem('transitionY', cy);
            sessionStorage.setItem('projectForward', 'true');
            sessionStorage.setItem('projectId', project);

            // Scale card to cover viewport (same as homepage shape expand)
            const maxDistX = Math.max(cx, window.innerWidth - cx);
            const maxDistY = Math.max(cy, window.innerHeight - cy);
            const maxDist = Math.sqrt(maxDistX * maxDistX + maxDistY * maxDistY);
            const scale = (maxDist * 2) / rect.width * 1.5;

            card.classList.add('expanding');
            card.style.transition = 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1), border-radius 300ms cubic-bezier(0.4, 0, 0.2, 1)';
            card.style.transform = `scale(${scale})`;

            setTimeout(() => {
                window.location.href = href;
            }, 350);
        });
    });

    // --- Home button exit (same as subpage.js) ---
    document.addEventListener('DOMContentLoaded', () => {
        const homeBtn = document.querySelector('.home-btn');
        if (homeBtn) {
            homeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                sessionStorage.setItem('transitionColor', getPageColor());
                sessionStorage.setItem('returningFromSubpage', 'true');
                window.location.href = homeBtn.getAttribute('href') || 'index.html';
            });
        }
    });

    // --- History / back button ---
    history.pushState({ page: 'subpage' }, '');

    window.addEventListener('popstate', () => {
        history.back();
    });

    window.addEventListener('pagehide', () => {
        sessionStorage.setItem('transitionColor', getPageColor());
        sessionStorage.setItem('returningFromSubpage', 'true');
    });
}

// =============================================================================
// DETAIL PAGES (has .back-btn)
// =============================================================================

const backBtn = document.querySelector('.back-btn');

if (backBtn) {

    // Clear the forward flag (no entry animation needed - card expansion already filled screen)
    sessionStorage.removeItem('projectForward');

    // --- History ---
    history.pushState({ page: 'project-detail' }, '');

    // --- Back button: go to projects.html with card-shrink animation ---
    backBtn.addEventListener('click', (e) => {
        e.preventDefault();
        sessionStorage.setItem('transitionColor', getPageColor());
        sessionStorage.setItem('returningToProjects', 'true');
        window.location.href = backBtn.getAttribute('href');
    });

    // --- Home button: go to index.html with homepage return animation ---
    const homeBtn = document.querySelector('.home-btn');
    if (homeBtn) {
        homeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            sessionStorage.setItem('transitionColor', getPageColor());
            sessionStorage.setItem('returningFromSubpage', 'true');
            window.location.href = homeBtn.getAttribute('href');
        });
    }

    window.addEventListener('pagehide', () => {
        sessionStorage.setItem('transitionColor', getPageColor());
        sessionStorage.setItem('returningFromSubpage', 'true');
    });

    window.addEventListener('popstate', () => {
        history.back();
    });
}

// =============================================================================
// BFCACHE CLEANUP
// =============================================================================

window.addEventListener('pageshow', (e) => {
    if (e.persisted) {
        const o1 = document.getElementById('return-transition');
        const o2 = document.getElementById('shape-transition');
        const o3 = document.getElementById('entry-overlay');
        if (o1) o1.remove();
        if (o2) o2.remove();
        if (o3) o3.remove();

        if (cardsContainer) {
            document.querySelectorAll('.card.expanding').forEach(card => {
                card.classList.remove('expanding');
                card.style.transition = '';
                card.style.transform = '';
            });
        }
    }
});

// =============================================================================
// MOUSETRAILER (both pages)
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
    const mousetrailer = document.getElementById('mousetrailer');
    if (mousetrailer && window.matchMedia('(hover: hover), (pointer: fine)').matches) {
        window.onmousemove = e => {
            const x = e.clientX - mousetrailer.offsetWidth / 2;
            const y = e.clientY - mousetrailer.offsetHeight / 2;
            mousetrailer.style.transform = `translate(${x}px, ${y}px)`;
        };
    }
});