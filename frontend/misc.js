const API_BASE = 'https://api.vedsite.com/api';

// How many queue / last-played tracks to render. The API returns up to
// 10 so this can be raised without touching the backend.
const QUEUE_SLOTS = 6;

// UTILITY FUNCTIONS

// Everything from the API goes through this before touching innerHTML.
function esc(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Non-2xx responses (e.g. an HTML 404) throw here instead of inside res.json().
async function getJSON(path) {
    const res = await fetch(`${API_BASE}${path}`);
    if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
    return res.json();
}

function formatTime(ms) {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function ratingToStars(rating) {
    if (!rating) return 'No rating';
    const full = Math.floor(rating);
    const half = (rating - full) >= 0.5 ? '½' : '';
    const empty = 5 - full - (half ? 1 : 0);
    return '★'.repeat(full) + half + '☆'.repeat(empty);
}

function renderTrackSlots(tracks) {
    const slots = Array.from({ length: QUEUE_SLOTS }, (_, i) => tracks[i] || null);
    document.getElementById('queue-list').innerHTML = slots.map(track => track ? `
        <div class="queue-item">
            <img src="${esc(track.album_image)}" alt="${esc(track.track_name)} album art">
            <div class="queue-item-info">
                <div class="queue-track">${esc(track.track_name)}</div>
                <div class="queue-artist">${esc(track.artist_name)}</div>
            </div>
        </div>
    ` : `
        <div class="queue-item queue-item-empty">
            <div class="queue-item-info">
                <div class="queue-track">—</div>
                <div class="queue-artist">empty</div>
            </div>
        </div>
    `).join('');
}

// NOW PLAYING - Synced progress tracking

let currentTrack = {
    name: null,
    duration: 0,
    progress: 0,
    isPlaying: false,
    lastUpdate: Date.now()
};

// null until fetchNowPlaying determines mode. Keeps fetchQueue from racing
// the first paint and writing stale empty-state text into the grid.
let displayMode = null;

// Set when the recently-played grid failed to load, so the next poll retries
// instead of waiting for the paused track to change.
let recentFailedAt = null;
const RECENT_RETRY_MS = 10000;

function setMode(mode) {
    if (displayMode === mode) return;
    displayMode = mode;
    const np = document.getElementById('np-header');
    const qh = document.getElementById('queue-header');
    const playStatus = document.getElementById('play-status');

    // Progress bar stays visible in both modes so the card keeps the same
    // vertical height — and so a returning visitor sees the frozen progress.
    if (mode === 'paused') {
        np.textContent = 'last played';
        qh.textContent = 'recently played';
        playStatus.textContent = '⏸︎ Paused';
    } else {
        np.textContent = 'now playing';
        qh.textContent = 'current queue';
        playStatus.textContent = '⏯︎ Playing';
    }
}

async function fetchNowPlaying() {
    try {
        const data = await getJSON('/spotify/now-playing');

        if (data.error) {
            document.getElementById('track-name').textContent = 'Could not load';
            pollInterval = 5000; // back off to 5s on error
            return;
        }

        // Stay at 1s while page is active
        pollInterval = 1000;

        const prevMode = displayMode;
        setMode(data.is_playing ? 'playing' : 'paused');

        // Card always reflects the track currently in the player —
        // when playing, that's the live track; when paused, that's the
        // track you stopped on (not the one before it).
        const trackChanged = currentTrack.name !== data.track_name;
        currentTrack = {
            name: data.track_name,
            duration: data.duration_ms,
            progress: data.progress_ms,
            isPlaying: data.is_playing,
            lastUpdate: Date.now()
        };
        if (trackChanged) {
            document.getElementById('album-art').src = data.album_image;
            document.getElementById('album-art').alt = `${data.track_name} album art`;
            document.getElementById('track-name').textContent = data.track_name;
            document.getElementById('artist-name').textContent = data.artist_name;
            document.getElementById('progress-duration').textContent = formatTime(data.duration_ms);
        }
        updateProgressUI();

        // In paused mode, the queue slot becomes the songs played *before*
        // the paused track. Pass the paused track in so we can dedupe against it.
        // Only re-fetch when we just entered paused mode, the paused track
        // changed, or the last attempt failed — the recent-tracks endpoint does
        // a Spotify lookup per song, so we don't want to hammer it every 1s poll.
        if (!data.is_playing) {
            const retryDue = recentFailedAt !== null && Date.now() - recentFailedAt >= RECENT_RETRY_MS;
            if (prevMode !== 'paused' || trackChanged || retryDue) {
                await renderRecentlyPlayed(data.track_name, data.artist_name);
            }
            return;
        }

    } catch (err) {
        console.error('Error fetching now playing:', err);
        pollInterval = 5000; // Back off to 5s on error
    }
}

async function renderRecentlyPlayed(skipName, skipArtist) {
    const container = document.getElementById('queue-list');
    try {
        const data = await getJSON('/lastfm/recent-tracks');
        // Playback may have resumed while this request was in flight.
        if (displayMode !== 'paused') return;
        recentFailedAt = null;

        const tracks = data.tracks || [];
        if (tracks.length === 0) {
            container.innerHTML = '<p class="muted-note">nothing played recently</p>';
            return;
        }

        // Dedupe by name+artist preserving order, and skip the currently-
        // paused track so the card and queue never duplicate.
        const seen = new Set();
        if (skipName) seen.add(`${skipName}__${skipArtist}`);
        const unique = [];
        for (const t of tracks) {
            const key = `${t.track_name}__${t.artist_name}`;
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(t);
            }
        }

        // First QUEUE_SLOTS unique tracks are the songs played *before* the paused one.
        renderTrackSlots(unique);
    } catch (err) {
        console.error('Error fetching recently played:', err);
        recentFailedAt = Date.now();
        // Never leave the live queue sitting under the "recently played" header.
        if (displayMode === 'paused') {
            container.innerHTML = '<p class="muted-note">recently played unavailable</p>';
        }
    }
}

function updateProgressUI() {
    if (!currentTrack.name) return;

    // Calculate current progress based on time elapsed since last API update
    let displayProgress = currentTrack.progress;

    if (currentTrack.isPlaying) {
        const elapsed = Date.now() - currentTrack.lastUpdate;
        displayProgress = currentTrack.progress + elapsed;
    }

    // Clamp to duration
    displayProgress = Math.min(displayProgress, currentTrack.duration);

    const percent = (displayProgress / currentTrack.duration) * 100;
    document.getElementById('progress-bar').style.width = `${percent}%`;
    document.getElementById('progress-current').textContent = formatTime(displayProgress);
}

// Update progress display every 100ms for smooth animation
setInterval(updateProgressUI, 100);

// Visibility-aware polling with dynamic interval
let nowPlayingInterval;
let queueInterval;
let pollInterval = 1000; // 1s when page is active

function startPolling() {
    stopPolling();
    fetchNowPlaying();
    fetchQueue();
    scheduleNowPlaying();
    queueInterval = setInterval(fetchQueue, 1000);
}

function scheduleNowPlaying() {
    clearInterval(nowPlayingInterval);
    nowPlayingInterval = setInterval(() => {
        fetchNowPlaying();
        scheduleNowPlaying(); // Reschedule with potentially new interval
    }, pollInterval);
}

function stopPolling() {
    clearInterval(nowPlayingInterval);
    clearInterval(queueInterval);
}

document.addEventListener('visibilitychange', () => {
    document.hidden ? stopPolling() : startPolling();
});

// =============================================================================
// QUEUE
// =============================================================================

async function fetchQueue() {
    // Only render the live queue once we know we're in playing mode.
    // While paused (or before mode is determined), fetchNowPlaying owns the grid.
    if (displayMode !== 'playing') return;
    try {
        const data = await getJSON('/spotify/queue');
        // Checked again after the await: a request that left while playing can
        // land after a pause and would overwrite the recently-played grid.
        if (displayMode !== 'playing') return;

        if (!data.queue || data.queue.length === 0) {
            document.getElementById('queue-list').innerHTML = '<p class="muted-note"> no playback therefore no queue</p>';
            return;
        }

        renderTrackSlots(data.queue);
    } catch (err) {
        console.error('Error fetching queue:', err);
        if (displayMode === 'playing') {
            document.getElementById('queue-list').innerHTML = '<p class="muted-note">Queue unavailable</p>';
        }
    }
}

// =============================================================================
// TOP ARTISTS (Last.fm)
// =============================================================================

async function fetchTopArtists() {
    try {
        const data = await getJSON('/lastfm/top-artists');

        const container = document.getElementById('artists-grid');

        if (!data.artists || data.artists.length === 0) {
            container.innerHTML = '<p>No data</p>';
            return;
        }

        container.innerHTML = data.artists.map((artist, i) => `
            <a href="${esc(artist.url)}" target="_blank" class="artist-card card-link">
                ${artist.image ? `<img class="artist-img" src="${esc(artist.image)}" alt="${esc(artist.name)}">` : `<div class="rank">#${i + 1}</div>`}
                <div class="name">${esc(artist.name)}</div>
                <div class="plays">${esc(artist.playcount)} plays</div>
            </a>
        `).join('');
    } catch (err) {
        console.error('Error fetching artists:', err);
    }
}

// =============================================================================
// RECENT FILMS (Letterboxd)
// =============================================================================

async function fetchRecentFilms() {
    try {
        const data = await getJSON('/letterboxd/recent');

        const container = document.getElementById('films-grid');

        if (!data.films || data.films.length === 0) {
            container.innerHTML = '<p>No films</p>';
            return;
        }

        container.innerHTML = data.films.map(film => `
            <a href="${esc(film.url)}" target="_blank" class="film-card card-link">
                <img src="${esc(film.poster)}" alt="${esc(film.title)}">
                <div class="title">${esc(film.title)}</div>
                <div class="rating">${ratingToStars(film.rating)}</div>
                <div class="year">${esc(film.year)}</div>
            </a>
        `).join('');
    } catch (err) {
        console.error('Error fetching films:', err);
    }
}

// =============================================================================
// TOP 4 FILMS (Letterboxd)
// =============================================================================

async function fetchTop4() {
    try {
        const data = await getJSON('/letterboxd/top4');

        const container = document.getElementById('top4-grid');

        if (!data.films || data.films.length === 0) {
            container.innerHTML = '<p>No films</p>';
            return;
        }

        // Generate 8 fader images for the hover animation
        const faders = (poster, title) => Array(8).fill(0).map(() =>
            `<img class="top4-fader top4-image" src="${esc(poster)}" alt="${esc(title)}">`
        ).join('');

        container.innerHTML = data.films.map(film => `
            <a href="${esc(film.url)}" target="_blank" class="top4-card">
                <div class="top4-poster-wrapper">
                    <img class="top4-front-image top4-image" src="${esc(film.poster)}" alt="${esc(film.title)}">
                    <div class="top4-faders">${faders(film.poster, film.title)}</div>
                </div>
                <div class="title">${esc(film.title)}</div>
                <div class="year">${esc(film.year)}</div>
            </a>
        `).join('');
    } catch (err) {
        console.error('Error fetching top 4:', err);
    }
}

// =============================================================================
// SEARCH - have i heard it (Last.fm) / have i seen it (Letterboxd)
// =============================================================================

const SEARCH_DEBOUNCE_MS = 250;

// Letterboxd dates are YYYY-MM-DD: parse as a local date so they don't shift a
// day west of UTC. Last.fm dates are unix seconds.
function toDate(value) {
    if (typeof value === 'number') return new Date(value * 1000);
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d);
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function formatDate(value) {
    const d = toDate(value);
    return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function timeAgo(value) {
    const then = toDate(value);
    const now = new Date();
    const days = Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()) -
        new Date(then.getFullYear(), then.getMonth(), then.getDate())) / 86400000);
    const plural = (n, unit) => `${n} ${unit}${n === 1 ? '' : 's'} ago`;
    if (days <= 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 7) return plural(days, 'day');
    if (days < 30) return plural(Math.floor(days / 7), 'week');
    if (days < 365) return plural(Math.floor(days / 30), 'month');
    return plural(Math.floor(days / 365), 'year');
}

function times(n) {
    return n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`;
}

// Debounced input → fetch → render, ignoring responses that arrive after a newer query.
function wireSearch(inputId, resultsId, run) {
    const input = document.getElementById(inputId);
    const results = document.getElementById(resultsId);
    let timer = null;
    let seq = 0;

    input.addEventListener('input', () => {
        clearTimeout(timer);
        const q = input.value.trim();
        if (q.length < 2) {
            seq++;
            results.innerHTML = '';
            return;
        }
        timer = setTimeout(async () => {
            const mine = ++seq;
            const html = await run(q, results);
            if (mine === seq && html !== null) results.innerHTML = html;
        }, SEARCH_DEBOUNCE_MS);
    });

    input.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            input.value = '';
            seq++;
            results.innerHTML = '';
        }
    });
}

// SONGS

async function searchSongs(q) {
    try {
        const res = await fetch(`${API_BASE}/lastfm/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (data.indexing) return '<p class="muted-note">still indexing my library, try again in a minute</p>';
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        if (!data.songs.length) return '<p class="muted-note">not in my scrobbles</p>';

        return data.songs.map(song => `
            <div class="search-item song-item" role="button" tabindex="0" aria-expanded="false"
                data-artist="${esc(song.artist)}" data-track="${esc(song.track)}">
                <div class="search-item-head">
                    <div class="search-item-title">${esc(song.track)}</div>
                    <div class="search-item-count">${esc(song.plays)} play${song.plays === 1 ? '' : 's'}</div>
                </div>
                <div class="search-item-sub">${esc(song.artist)}</div>
            </div>
        `).join('');
    } catch (err) {
        console.error('Error searching songs:', err);
        return '<p class="muted-note">search unavailable</p>';
    }
}

async function openSong(item) {
    const container = document.getElementById('song-results');
    const wasOpen = item.classList.contains('open');
    container.querySelectorAll('.song-item.open').forEach(el => {
        el.classList.remove('open');
        el.setAttribute('aria-expanded', 'false');
        el.querySelector('.search-detail')?.remove();
    });
    if (wasOpen) return;

    item.classList.add('open');
    item.setAttribute('aria-expanded', 'true');
    const detail = document.createElement('div');
    detail.className = 'search-detail';
    detail.innerHTML = '<div class="search-facts"><span>loading…</span></div>';
    item.appendChild(detail);

    try {
        const params = new URLSearchParams({ artist: item.dataset.artist, track: item.dataset.track });
        const song = await getJSON(`/lastfm/track?${params}`);
        if (!item.contains(detail)) return; // closed while loading

        const facts = [`played ${times(song.plays)}`];
        if (song.last_played) {
            facts.push(`last played ${formatDate(song.last_played)} <span>· ${timeAgo(song.last_played)}</span>`);
        }
        if (song.first_played && song.first_played !== song.last_played) {
            facts.push(`first played ${formatDate(song.first_played)} <span>· ${timeAgo(song.first_played)}</span>`);
        }
        detail.innerHTML = `
            ${song.album_image ? `<img src="${esc(song.album_image)}" alt="${esc(song.track)} album art">` : ''}
            <div class="search-facts">${facts.map(f => `<div>${f}</div>`).join('')}</div>
        `;
    } catch (err) {
        console.error('Error loading song:', err);
        if (item.contains(detail)) detail.innerHTML = '<div class="search-facts"><span>dates unavailable</span></div>';
    }
}

// FILMS

async function searchFilms(q) {
    try {
        const data = await getJSON(`/letterboxd/search?q=${encodeURIComponent(q)}`);
        if (!data.films.length) return '<p class="muted-note">not in my diary</p>';

        return data.films.map(film => {
            const facts = [];
            if (film.last_watched) {
                // A first logged watch marked "rewatch" means the original viewing
                // was never logged, so it counts on top of the logged ones.
                const watched = Math.max(film.times_watched, film.rewatches + 1);
                const rewatches = film.rewatches ? ` <span>· ${film.rewatches} rewatch${film.rewatches === 1 ? '' : 'es'}</span>` : '';
                facts.push(`watched ${times(watched)}${rewatches}`);
                facts.push(`last watched ${formatDate(film.last_watched)} <span>· ${timeAgo(film.last_watched)}</span>`);
                if (film.first_watched !== film.last_watched) {
                    facts.push(`first watched ${formatDate(film.first_watched)} <span>· ${timeAgo(film.first_watched)}</span>`);
                }
            } else {
                facts.push('watched <span>· no date logged</span>');
            }
            const tags = film.tags.length
                ? `<div class="search-tags">${film.tags.map(t => `<span>${esc(t)}</span>`).join('')}</div>`
                : '';
            return `
                <a class="search-item card-link" href="${esc(film.url)}" target="_blank">
                    <div class="search-item-head">
                        <div class="search-item-title">${esc(film.title)}${film.year ? ` <span class="search-item-sub">${esc(film.year)}</span>` : ''}</div>
                        ${film.rating ? `<div class="search-item-rating">${ratingToStars(film.rating)}</div>` : ''}
                    </div>
                    <div class="search-facts">${facts.map(f => `<div>${f}</div>`).join('')}</div>
                    ${tags}
                </a>
            `;
        }).join('');
    } catch (err) {
        console.error('Error searching films:', err);
        return '<p class="muted-note">search unavailable</p>';
    }
}

function initSearch() {
    wireSearch('song-search', 'song-results', searchSongs);
    wireSearch('film-search', 'film-results', searchFilms);
    const songResults = document.getElementById('song-results');
    songResults.addEventListener('click', e => {
        const item = e.target.closest('.song-item');
        if (item) openSong(item);
    });
    songResults.addEventListener('keydown', e => {
        const item = e.target.closest('.song-item');
        if (item && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            openSong(item);
        }
    });
}

// INITIALIZE

document.addEventListener('DOMContentLoaded', () => {
    fetchTopArtists();
    fetchRecentFilms();
    fetchTop4();
    startPolling();
    initSearch();
});
