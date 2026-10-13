// Mousetrailer
const mousetrailer = document.getElementById("mousetrailer");

if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {

    window.onmousemove = e => {
        const x = e.clientX - mousetrailer.offsetWidth / 2;
        const y = e.clientY - mousetrailer.offsetHeight / 2;

        mousetrailer.style.transform = `translate(${x}px, ${y}px)`;
    }
}

// Shape bouncing and morphing
const shapes = document.querySelectorAll('.nav-shape');

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);

const uniqueRand = (min, max, prev) => {
    let next = prev;
    while (prev === next) next = rand(min, max);
    return next;
}

// Get responsive shape size (matches CSS clamp)
const getShapeSize = () => {
    const vwSize = window.innerWidth * 0.25;
    return Math.min(225, Math.max(120, vwSize));
}

// Border-radius options for morphing on edge collision (px; the shapes start at 6rem)
const roundnessOptions = [0, 10, 20, 40, 60];
const START_RADIUS = 96;

// DVD-style bouncing physics. Units are px and seconds, so the speed is the
// same on 60 Hz and 120 Hz screens (the old per-frame step doubled on 120 Hz).
const shapeData = [];
const baseSpeed = 120;          // px/s, the old 2 px/frame at 60 Hz
const SPIN_KICK = 0.35;         // how much a glancing hit changes the spin
const SPIN_SETTLE = 0.6;        // per second, spin drifts back toward its base
const SQUASH = 0.09;            // peak squash on impact (9%)

// Distance from a spinning rounded square's centre to its furthest point along
// an axis. Collisions use this instead of the unrotated box, so a shape turns
// around exactly when it visually touches the edge.
const halfExtent = (size, radius, rotationDeg) => {
    const half = size / 2;
    const r = Math.min(radius, half);
    const a = rotationDeg * Math.PI / 180;
    return (half - r) * (Math.abs(Math.cos(a)) + Math.abs(Math.sin(a))) + r;
};

shapes.forEach((shape, index) => {
    const size = getShapeSize();

    // Random starting position
    const x = rand(0, window.innerWidth - size);
    const y = rand(0, window.innerHeight - size);

    // Random direction with consistent speed
    const angle = Math.random() * 2 * Math.PI;
    const speed = baseSpeed + Math.random() * 30;
    const baseSpin = (Math.random() - 0.5) * 120; // deg/s

    shapeData.push({
        el: shape,
        x: x,                    // top-left, as the page transitions expect
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        rotation: 0,
        spin: baseSpin,
        baseSpin: baseSpin,
        radius: START_RADIUS,    // target corner radius
        radiusShown: START_RADIUS, // eased toward the target, drives the outline
        prevRoundness: -1,
        squash: 0,               // 0..1, decays after an impact
        squashAxis: 'x',
        scale: 1,                // eased toward 1.15 while hovered
        isHovering: false
    });

    // Set initial position using transform (GPU accelerated)
    shape.style.left = '0';
    shape.style.top = '0';
    shape.style.transform = `translate(${x}px, ${y}px)`;

    shape.addEventListener('mouseenter', () => { shapeData[index].isHovering = true; });
    shape.addEventListener('mouseleave', () => { shapeData[index].isHovering = false; });
});

function impact(data, axis, tangentialVelocity) {
    // Morph the corners, as before
    const roundnessIndex = uniqueRand(0, roundnessOptions.length - 1, data.prevRoundness);
    data.radius = roundnessOptions[roundnessIndex];
    data.prevRoundness = roundnessIndex;

    // A glancing hit drags the spin the way wall friction would (CSS rotation is
    // clockwise-positive; callers pass the slide velocity signed to match)
    data.spin += tangentialVelocity * SPIN_KICK;
    data.squash = 1;
    data.squashAxis = axis;
}

let lastTime = performance.now();

function animate(now) {
    // Clamp the step so a backgrounded tab doesn't teleport shapes on return
    const dt = Math.min((now - lastTime) / 1000, 1 / 20) || 0;
    lastTime = now;

    const w = window.innerWidth;
    const h = window.innerHeight;
    const size = getShapeSize();
    const half = size / 2;

    shapeData.forEach(data => {
        // Mid page-transition the click handler owns the transform
        if (data.el.classList.contains('expanding')) return;

        // Corners ease to the new radius over ~150 ms (replaces the CSS
        // transition, so the outline used below matches what's drawn)
        data.radiusShown += (data.radius - data.radiusShown) * (1 - Math.exp(-dt * 20));
        data.el.style.borderRadius = `${data.radiusShown.toFixed(1)}px`;

        if (!data.isHovering) {
            data.x += data.vx * dt;
            data.y += data.vy * dt;
            data.rotation += data.spin * dt;
            data.spin += (data.baseSpin - data.spin) * Math.min(1, SPIN_SETTLE * dt);

            const ext = halfExtent(size, data.radiusShown, data.rotation);
            const cx = data.x + half;
            const cy = data.y + half;

            // The visible outline never crosses an edge: a corner swinging into
            // the wall pushes the shape off it. Only a shape moving into the
            // wall bounces (and morphs).
            if (cx - ext < 0) {
                data.x = ext - half;
                if (data.vx < 0) { data.vx *= -1; impact(data, 'x', data.vy); }
            } else if (cx + ext > w) {
                data.x = w - ext - half;
                if (data.vx > 0) { data.vx *= -1; impact(data, 'x', -data.vy); }
            }
            if (cy - ext < 0) {
                data.y = ext - half;
                if (data.vy < 0) { data.vy *= -1; impact(data, 'y', -data.vx); }
            } else if (cy + ext > h) {
                data.y = h - ext - half;
                if (data.vy > 0) { data.vy *= -1; impact(data, 'y', data.vx); }
            }
        }


        // Squash decays like a stiff spring settling (~200 ms)
        data.squash *= Math.exp(-dt * 18);
        if (data.squash < 0.001) data.squash = 0;
        const s = data.squash * SQUASH;
        const sx = data.squashAxis === 'x' ? 1 - s : 1 + s * 0.6;
        const sy = data.squashAxis === 'x' ? 1 + s * 0.6 : 1 - s;

        // Hover eases to 1.15 instead of snapping
        const target = data.isHovering ? 1.15 : 1;
        data.scale += (target - data.scale) * Math.min(1, dt * 14);

        // scale() before rotate() squashes along the screen axis the shape hit,
        // not the shape's own spinning axes
        data.el.style.transform = `translate(${data.x}px, ${data.y}px) scale(${sx * data.scale}, ${sy * data.scale}) rotate(${data.rotation}deg)`;
    });

    requestAnimationFrame(animate);
}

requestAnimationFrame(animate);

// Page color mapping
const pageColors = {
    'about': '#cc0000',
    'projects': '#663399', // rebeccapurple
    'experience': '#D4A017',
    'misc': '#069494'
};

// Check if returning from subpage
const returningFromSubpage = sessionStorage.getItem('returningFromSubpage');
if (returningFromSubpage) {
    sessionStorage.removeItem('returningFromSubpage');

    const color = sessionStorage.getItem('transitionColor') || '#000000';
    const size = getShapeSize();
    const halfSize = size / 2;

    // Find which shape matches this color (case-insensitive)
    let targetShapeData = null;
    const colorLower = color.toLowerCase();
    for (const page in pageColors) {
        if (pageColors[page].toLowerCase() === colorLower) {
            const shapeEl = document.querySelector(`[data-page="${page}"]`);
            if (shapeEl) {
                const index = Array.from(shapes).indexOf(shapeEl);
                if (index !== -1) {
                    targetShapeData = shapeData[index];
                }
            }
            break;
        }
    }

    // Get target position (center of screen if no match)
    const liveX = targetShapeData ? targetShapeData.x + halfSize : window.innerWidth / 2;
    const liveY = targetShapeData ? targetShapeData.y + halfSize : window.innerHeight / 2;

    // Calculate initial circle radius to cover entire screen from target point
    // Use larger viewport estimate to handle iOS Safari dynamic viewport
    const vpWidth = window.innerWidth;
    const vpHeight = Math.max(window.innerHeight, document.documentElement.clientHeight, window.screen.height);
    const maxDistX = Math.max(liveX, vpWidth - liveX);
    const maxDistY = Math.max(liveY, vpHeight - liveY);
    const startRadius = Math.sqrt(maxDistX * maxDistX + maxDistY * maxDistY) + 100;

    // Create full-screen overlay with clip-path
    const returnOverlay = document.createElement('div');
    returnOverlay.id = 'return-transition';
    returnOverlay.style.cssText = `
        position: fixed;
        top: -50px;
        left: -50px;
        right: -50px;
        bottom: -50px;
        background-color: ${color};
        z-index: 9999;
        pointer-events: none;
        clip-path: circle(${startRadius}px at ${liveX + 50}px ${liveY + 50}px);
        transition: clip-path 400ms cubic-bezier(0.4, 0, 0.2, 1), opacity 200ms ease;
    `;
    document.body.appendChild(returnOverlay);

    // Animate clip-path to shrink to shape size
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            returnOverlay.style.clipPath = `circle(${halfSize}px at ${liveX + 50}px ${liveY + 50}px)`;

            setTimeout(() => {
                returnOverlay.style.opacity = '0';
                setTimeout(() => returnOverlay.remove(), 200);
            }, 400);
        });
    });
}

// Page transition: expanding shape fills screen
shapes.forEach((shape, index) => {
    shape.addEventListener('click', (e) => {
        e.preventDefault();

        shapeData[index].isHovering = true; // disable hover state during transition

        const page = shape.dataset.page;
        const data = shapeData[index];
        const rect = shape.getBoundingClientRect();

        // Store shape info for back transition
        sessionStorage.setItem('transitionColor', pageColors[page]);
        sessionStorage.setItem('transitionX', rect.left + rect.width / 2);
        sessionStorage.setItem('transitionY', rect.top + rect.height / 2);

        // Hide label immediately during expansion (use visibility to bypass CSS !important on opacity)
        const label = shape.querySelector('.shape-label');
        if (label) {
            label.style.visibility = 'hidden';
        }

        // Calculate scale needed to cover viewport
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const maxDistX = Math.max(centerX, window.innerWidth - centerX);
        const maxDistY = Math.max(centerY, window.innerHeight - centerY);
        const maxDist = Math.sqrt(maxDistX * maxDistX + maxDistY * maxDistY);
        const scale = (maxDist * 2) / rect.width * 1.5;

        // Add expanding class and apply transform with current position
        shape.classList.add('expanding');
        shape.style.transition = 'transform 500ms cubic-bezier(0.4, 0, 0.2, 1), border-radius 300ms cubic-bezier(0.4, 0, 0.2, 1)';
        shape.style.transform = `translate(${data.x}px, ${data.y}px) rotate(0deg) scale(${scale})`;

        // Navigate after transition completes
        setTimeout(() => {
            const href = page === 'projects' ? 'projects.html' : `${page}.html`;
            window.location.href = href;
        }, 450);
    });
});

// Handle browser back button (bfcache) - reset expanding shapes
window.addEventListener('pageshow', (e) => {
    if (e.persisted) {
        // Remove any stuck overlay
        const stuckOverlay = document.getElementById('return-transition');
        if (stuckOverlay) stuckOverlay.remove();

        // Reset ALL shapes immediately
        shapes.forEach((shape, index) => {
            shape.classList.remove('expanding');
            shape.style.transition = '';
            shape.style.borderRadius = '';
            shape.style.zIndex = '';

            const data = shapeData[index];
            data.isHovering = false;
            data.radius = data.radiusShown = START_RADIUS;
            shape.style.transform = `translate(${data.x}px, ${data.y}px) rotate(${data.rotation}deg)`;

            const label = shape.querySelector('.shape-label');
            if (label) {
                label.style.visibility = '';
            }
        });

        // Check if returning from subpage - play animation
        const returningFromSubpage = sessionStorage.getItem('returningFromSubpage');
        if (returningFromSubpage) {
            sessionStorage.removeItem('returningFromSubpage');

            const color = sessionStorage.getItem('transitionColor') || '#000000';
            const size = getShapeSize();
            const halfSize = size / 2;

            let targetShapeData = null;
            const colorLower = color.toLowerCase();
            for (const page in pageColors) {
                if (pageColors[page].toLowerCase() === colorLower) {
                    const shapeEl = document.querySelector(`[data-page="${page}"]`);
                    if (shapeEl) {
                        const idx = Array.from(shapes).indexOf(shapeEl);
                        if (idx !== -1) targetShapeData = shapeData[idx];
                    }
                    break;
                }
            }

            const liveX = targetShapeData ? targetShapeData.x + halfSize : window.innerWidth / 2;
            const liveY = targetShapeData ? targetShapeData.y + halfSize : window.innerHeight / 2;

            const vpWidth = window.innerWidth;
            const vpHeight = Math.max(window.innerHeight, document.documentElement.clientHeight, window.screen.height);
            const maxDistX = Math.max(liveX, vpWidth - liveX);
            const maxDistY = Math.max(liveY, vpHeight - liveY);
            const startRadius = Math.sqrt(maxDistX * maxDistX + maxDistY * maxDistY) + 100;

            const returnOverlay = document.createElement('div');
            returnOverlay.id = 'return-transition';
            returnOverlay.style.cssText = `
                position: fixed;
                top: -50px; left: -50px; right: -50px; bottom: -50px;
                background-color: ${color};
                z-index: 9999;
                pointer-events: none;
                clip-path: circle(${startRadius}px at ${liveX + 50}px ${liveY + 50}px);
                transition: clip-path 400ms cubic-bezier(0.4, 0, 0.2, 1), opacity 200ms ease;
            `;
            document.body.appendChild(returnOverlay);

            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    returnOverlay.style.clipPath = `circle(${halfSize}px at ${liveX + 50}px ${liveY + 50}px)`;
                    setTimeout(() => {
                        returnOverlay.style.opacity = '0';
                        setTimeout(() => returnOverlay.remove(), 200);
                    }, 400);
                });
            });
        }
    }
});
// Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(reg => reg.update());
    });
}