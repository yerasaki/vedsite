const CACHE_NAME = 'vedsite-v4';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/about.html',
  '/experience.html',
  '/misc.html',
  '/projects.html',
  '/projects/ssh.html',
  '/projects/squashhub.html',
  '/projects/pl.html',
  '/projects/sanguine.html',
  '/projects/lightemall.html',
  '/projects/carbon_neutrality.html',
  '/frontend/shared.css',
  '/frontend/home/home.css',
  '/frontend/home/home.js',
  '/frontend/subpage/subpage.css',
  '/frontend/subpage/subpage.js',
  '/frontend/about/about.css',
  '/frontend/about/about.js',
  '/frontend/experience.css',
  '/frontend/misc.css',
  '/frontend/subproject/subprojects.css',
  '/frontend/subproject/subprojects.js',
  '/frontend/sanguine/sanguine.css',
  '/frontend/sanguine/sanguine.js',
  '/frontend/lightemall/lightemall.css',
  '/frontend/lightemall/lightemall.js',
  '/manifest.json',
  '/icons/favicon/favicon-96x96.png',
  '/icons/favicon/favicon.svg',
  '/icons/favicon/favicon.ico',
  '/icons/favicon/apple-touch-icon.png',
  '/icons/favicon/web-app-manifest-192x192.png',
  '/icons/favicon/web-app-manifest-512x512.png',
  '/icons/github.svg',
  '/icons/linkedin.svg',
  '/icons/spotify.svg',
  '/icons/letterboxd.svg',
  '/icons/lastfm.svg',
  '/icons/strava.svg',
  '/icons/serializd.svg',
  '/icons/email.svg',
  '/icons/web.svg',
  '/font/SF-Pro-Display-Medium.otf'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Network-first for API
  if (url.hostname === 'api.vedsite.com') {
    event.respondWith(
      fetch(event.request)
        .catch(() => new Response(JSON.stringify({ error: 'offline' }), {
          headers: { 'Content-Type': 'application/json' }
        }))
    );
    return;
  }

  // For HTML navigation requests, always go network-first
  // This prevents the redirect error on subpages
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Only cache non-redirected responses
          if (response.redirected) {
            return response;
          }
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first for static assets (CSS, JS, fonts, images)
  event.respondWith(
    caches.match(event.request)
      .then(cached => cached || fetch(event.request).then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      }))
  );
});