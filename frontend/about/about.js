// about.js — subpage transition logic + image track + card expansion
// Replaces subpage.js on about.html. Do NOT also load subpage.js.

// ============================================================
// SUBPAGE TRANSITION (mirrors subpage.js exactly)
// ============================================================

const getShapeSize = () => {
    const vwSize = window.innerWidth * 0.25;
    return Math.min(225, Math.max(120, vwSize));
};

const getPageColor = () => {
    const rgb = getComputedStyle(document.body).backgroundColor;
    const match = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
    if (!match) return rgb;
    const hex = x => ("0" + parseInt(x).toString(16)).slice(-2).toUpperCase();
    return "#" + hex(match[1]) + hex(match[2]) + hex(match[3]);
};

const storedColor = sessionStorage.getItem('transitionColor') || '#000000';
const storedX = sessionStorage.getItem('transitionX');
const storedY = sessionStorage.getItem('transitionY');

const size = getShapeSize();
const halfSize = size / 2;
const centerX = storedX ? parseFloat(storedX) : window.innerWidth / 2;
const centerY = storedY ? parseFloat(storedY) : window.innerHeight / 2;

const vpWidth = window.innerWidth;
const vpHeight = Math.max(window.innerHeight, document.documentElement.clientHeight, window.screen.height);
const maxDistX = Math.max(centerX + 50, vpWidth - centerX + 50);
const maxDistY = Math.max(centerY + 50, vpHeight - centerY + 50);
const fullRadius = Math.sqrt(maxDistX * maxDistX + maxDistY * maxDistY) + 100;

// Entry overlay: full screen → shrinks to circle
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

function doExitTransition() {
    const homeUrl = document.querySelector('.home-btn').getAttribute('href') || 'index.html';
    sessionStorage.setItem('transitionColor', getPageColor());
    sessionStorage.setItem('returningFromSubpage', 'true');
    window.location.href = homeUrl;
}

window.addEventListener('DOMContentLoaded', () => {
    history.pushState({ page: 'subpage' }, '');

    // Shrink entry overlay
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            entryOverlay.style.clipPath = `circle(${halfSize}px at ${centerX + 50}px ${centerY + 50}px)`;
            setTimeout(() => {
                entryOverlay.style.opacity = '0';
                setTimeout(() => entryOverlay.remove(), 200);
            }, 400);
        });
    });

    // Home button
    document.querySelector('.home-btn').addEventListener('click', e => {
        e.preventDefault();
        doExitTransition();
    });
});

window.addEventListener('pagehide', () => {
    sessionStorage.setItem('transitionColor', getPageColor());
    sessionStorage.setItem('returningFromSubpage', 'true');
});

window.addEventListener('popstate', () => { history.back(); });

window.addEventListener('pageshow', e => {
    if (e.persisted) {
        const overlay = document.getElementById('shape-transition');
        if (overlay) overlay.remove();
    }
});

// ============================================================
// MOUSETRAILER (same as subpage.js)
// ============================================================

window.addEventListener('DOMContentLoaded', () => {
    const mousetrailer = document.getElementById('mousetrailer');

    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
        window.addEventListener('mousemove', e => {
            const x = e.clientX - mousetrailer.offsetWidth / 2;
            const y = e.clientY - mousetrailer.offsetHeight / 2;
            mousetrailer.style.transform = `translate(${x}px, ${y}px)`;
        });
    }
});

// ============================================================
// IMAGE TRACK (desktop only - hover devices)
// ============================================================

const track = document.getElementById('image-track');
const dragZone = document.getElementById('drag-zone');
let hasDragged = false;

// Only enable drag on devices with hover (desktop)
if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const handleOnDown = e => {
        track.dataset.mouseDownAt = e.clientX;
        hasDragged = false;
        dragZone.classList.add('dragging');
    };

    const handleOnUp = () => {
        track.dataset.mouseDownAt = '0';
        track.dataset.prevPercentage = track.dataset.percentage || '0';
        dragZone.classList.remove('dragging');
    };

    const handleOnMove = e => {
        if (track.dataset.mouseDownAt === '0') return;

        const mouseDelta = parseFloat(track.dataset.mouseDownAt) - e.clientX;

        // Mark as dragged if moved more than 5px
        if (Math.abs(mouseDelta) > 5) hasDragged = true;

        const maxDelta = window.innerWidth / 2;

        const percentage = (mouseDelta / maxDelta) * -100;
        const nextPercentageUnclamped = parseFloat(track.dataset.prevPercentage || '0') + percentage;
        const nextPercentage = Math.max(Math.min(nextPercentageUnclamped, 0), -100);

        track.dataset.percentage = nextPercentage;

        track.animate(
            { transform: `translate(${nextPercentage}%, -50%)` },
            { duration: 1200, fill: 'forwards' }
        );

        for (const image of track.getElementsByClassName('image')) {
            image.animate(
                { objectPosition: `${100 + nextPercentage}% center` },
                { duration: 1200, fill: 'forwards' }
            );
        }
    };

    dragZone.addEventListener('mousedown', e => handleOnDown(e));
    window.addEventListener('mouseup', () => handleOnUp());
    window.addEventListener('mousemove', e => handleOnMove(e));
}

// ============================================================
// CARD EXPANSION
// ============================================================

const overlay = document.getElementById('expanded-overlay');
const expandedImg = document.getElementById('expanded-media-img');
const expandedVideo = document.getElementById('expanded-media-video');
const expandedDesc = document.getElementById('expanded-description');
const closeBtn = document.getElementById('close-expanded');

document.querySelectorAll('.gallery-card').forEach(card => {
    card.addEventListener('click', () => {
        // Don't expand if user was dragging
        if (hasDragged) return;

        const img = card.querySelector('img.image');
        const video = card.querySelector('video.image');
        const desc = card.dataset.description;

        if (video) {
            expandedImg.classList.add('hidden');
            expandedVideo.classList.remove('hidden');
            expandedVideo.src = video.src;
            expandedVideo.play();
        } else if (img) {
            expandedVideo.classList.add('hidden');
            expandedImg.classList.remove('hidden');
            expandedImg.src = img.src;
        }

        expandedDesc.textContent = desc;
        overlay.classList.add('active');
    });
});

function closeOverlay() {
    overlay.classList.remove('active');
    expandedVideo.pause();
    expandedVideo.src = '';
}

if (closeBtn) {
    closeBtn.addEventListener('click', closeOverlay);
}

if (overlay) {
    overlay.addEventListener('click', e => {
        if (e.target === overlay) closeOverlay();
    });
}

document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && overlay && overlay.classList.contains('active')) {
        closeOverlay();
    }
});