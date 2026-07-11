/* Service worker for the Building Support Tickets PWA.
 *
 * Strategy — deliberately simple so it can never wedge the app:
 *  - App shell (navigations): network-first, fall back to the cached shell so
 *    the app opens with no reception.
 *  - Hashed build assets + /support images + fonts: cache-first (immutable).
 *  - Everything else (Supabase API, functions): network only — the app's own
 *    IndexedDB outbox handles offline writes; the SW must not interfere.
 */
const VERSION = 'support-v1';
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;
const SHELL_URL = '/Support';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll([SHELL_URL, '/manifest.json']))
      .catch(() => {}) // never fail install because one request 404'd
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

function isAssetRequest(url) {
  return (
    url.origin === self.location.origin &&
    (url.pathname.startsWith('/assets/') ||
      url.pathname.startsWith('/support/') ||
      /\.(js|css|png|jpg|jpeg|svg|webp|woff2?)$/.test(url.pathname))
  ) || url.hostname === 'fonts.gstatic.com' || url.hostname === 'fonts.googleapis.com';
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // writes go straight to the network
  const url = new URL(req.url);

  // Never intercept Supabase (or any other API) traffic.
  if (url.hostname.endsWith('.supabase.co')) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put(SHELL_URL, copy)).catch(() => {});
          return res;
        })
        .catch(() =>
          caches.match(req).then((hit) => hit || caches.match(SHELL_URL))
        )
    );
    return;
  }

  if (isAssetRequest(url)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(ASSET_CACHE).then((c) => c.put(req, copy)).catch(() => {});
            }
            return res;
          })
      )
    );
  }
});
