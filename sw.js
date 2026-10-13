// Weather Now service worker
//  • App shell: precached on install, served cache-first (stale-while-revalidate).
//  • Weather & geocoding APIs: network-first with a timeout, falling back to the
//    last cached response so previously viewed places work offline.
// Bump VERSION whenever app files change so clients pick up the new shell.
const VERSION = 'v1.0.0';
const SHELL_CACHE = `wn-shell-${VERSION}`;
const DATA_CACHE = 'wn-data-v1';
const NETWORK_TIMEOUT_MS = 6000;

const SHELL = [
  './',
  './assets/fonts/Bricolage_Grotesque/static/BricolageGrotesque-Bold.ttf',
  './assets/fonts/DM_Sans/DMSans-Italic-VariableFont_opsz,wght.ttf',
  './assets/fonts/DM_Sans/DMSans-VariableFont_opsz,wght.ttf',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-close.svg',
  './assets/icons/icon-download.svg',
  './assets/icons/icon-locate.svg',
  './assets/icons/icon-mic.svg',
  './assets/icons/icon-plus.svg',
  './assets/icons/icon-star.svg',
  './assets/icons/icon-sunrise.svg',
  './assets/icons/icon-sunset.svg',
  './assets/icons/icon-theme.svg',
  './assets/images/bg-today-large.svg',
  './assets/images/bg-today-small.svg',
  './assets/images/favicon-32x32.png',
  './assets/images/icon-checkmark.svg',
  './assets/images/icon-drizzle.webp',
  './assets/images/icon-dropdown.svg',
  './assets/images/icon-error.svg',
  './assets/images/icon-fog.webp',
  './assets/images/icon-loading.svg',
  './assets/images/icon-overcast.webp',
  './assets/images/icon-partly-cloudy.webp',
  './assets/images/icon-rain.webp',
  './assets/images/icon-retry.svg',
  './assets/images/icon-search.svg',
  './assets/images/icon-snow.webp',
  './assets/images/icon-storm.webp',
  './assets/images/icon-sunny.webp',
  './assets/images/icon-units.svg',
  './assets/images/logo-light.svg',
  './assets/images/logo.svg',
  './css/styles.css',
  './index.html',
  './js/api.js',
  './js/background.js',
  './js/compare.js',
  './js/favorites.js',
  './js/main.js',
  './js/menus.js',
  './js/pwa.js',
  './js/render.js',
  './js/search.js',
  './js/storage.js',
  './js/theme.js',
  './js/time.js',
  './js/ui.js',
  './js/units.js',
  './js/weather-codes.js',
  './manifest.webmanifest'
];

const API_HOSTS = ['api.open-meteo.com', 'geocoding-api.open-meteo.com', 'api.bigdatacloud.net'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((k) => k.startsWith('wn-shell-') && k !== SHELL_CACHE)
        .map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(request) {
  const cache = await caches.open(DATA_CACHE);
  try {
    const response = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), NETWORK_TIMEOUT_MS)),
    ]);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw err;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request, { ignoreSearch: request.mode === 'navigate' });
  const network = fetch(request)
    .then((response) => {
      if (response.ok && response.type === 'basic') cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  if (cached) return cached;
  const response = await network;
  if (response) return response;
  if (request.mode === 'navigate') return cache.match('./index.html');
  return Response.error();
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (API_HOSTS.includes(url.hostname)) {
    event.respondWith(networkFirst(request));
  } else if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
