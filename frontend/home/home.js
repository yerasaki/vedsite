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

// Border-radius options for morphing on edge collision
const roundnessOptions = ['0rem', '10px', '20px', '40px', '60px'];

// DVD-style bouncing physics
const shapeData = [];
const baseSpeed = 2;

shapes.forEach((shape, index) => {
    const size = getShapeSize();

    // Random starting position
    const x = rand(0, window.innerWidth - size);
    const y = rand(0, window.innerHeight - size);

    // Random direction with consistent speed
    const angle = Math.random() * 2 * Math.PI;
    const speed = baseSpeed + Math.random() * 0.5;

    shapeData.push({
        el: shape,
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        rotation: 0,
        rotationSpeed: (Math.random() - 0.5) * 2,
        prevRoundness: 0,
        isHovering: false
    });

    // Set initial position using transform (GPU accelerated)
    shape.style.left = '0';
    shape.style.top = '0';
    shape.style.transform = `translate(${x}px, ${y}px)`;

    shape.addEventListener('mouseenter', () => {
        shapeData[index].isHovering = true;
        // Apply hover scale along with current position
        const data = shapeData[index];
        shape.style.transform = `translate(${data.x}px, ${data.y}px) rotate(${data.rotation}deg) scale(1.15)`;
    });

    shape.addEventListener('mouseleave', () => {
        shapeData[index].isHovering = false;
        // Remove hover scale
        const data = shapeData[index];
        shape.style.transform = `translate(${data.x}px, ${data.y}px) rotate(${data.rotation}deg)`;
    });
});

function animate() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const size = getShapeSize();

    shapeData.forEach(data => {
        if (data.isHovering) {
            return; // Skip this shape, continue to next
        }

        // Update position
        data.x += data.vx;
        data.y += data.vy;

        // Update rotation
        data.rotation += data.rotationSpeed;

        let hitEdge = false;

        // Bounce off edges (DVD style - reverse velocity component)
        if (data.x <= 0) {
            data.x = 0;
            data.vx *= -1;
            hitEdge = true;
        } else if (data.x >= w - size) {
            data.x = w - size;
            data.vx *= -1;
            hitEdge = true;
        }

        if (data.y <= 0) {
            data.y = 0;
            data.vy *= -1;
            hitEdge = true;
        } else if (data.y >= h - size) {
            data.y = h - size;
            data.vy *= -1;
            hitEdge = true;
        }

        // Morph shape on edge collision
        if (hitEdge) {
            const roundnessIndex = uniqueRand(0, roundnessOptions.length - 1, data.prevRoundness);
            data.el.style.borderRadius = roundnessOptions[roundnessIndex];
            data.prevRoundness = roundnessIndex;
        }

        // Apply position and rotation via transform (GPU accelerated)
        data.el.style.transform = `translate(${data.x}px, ${data.y}px) rotate(${data.rotation}deg)`;

    });

    requestAnimationFrame(animate);
}

animate();

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