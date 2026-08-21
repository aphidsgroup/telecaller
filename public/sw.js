/* Buildogram Telecalling service worker — v4
 *
 * Caching policy:
 *  - App shell (HTML navigations): Network-first, fallback to /offline.html
 *  - Static assets (_next/static, icons, fonts): Cache-first (immutable hashes)
 *  - API calls: Never cached (fresh data always required)
 *
 * Cache-busting: bumping VERSION evicts all old caches on activate.
 */

const VERSION = 'v4';
const SHELL_CACHE = `bt-shell-${VERSION}`;
const ASSET_CACHE = `bt-assets-${VERSION}`;

// Pre-cache critical shell resources at install time for instant offline access
const SHELL_URLS = [
  '/offline.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icon.png',
];

// ─── Install: pre-cache shell ──────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting()) // activate immediately without waiting for old tabs to close
  );
});

// ─── Activate: clean up old caches ─────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => ![SHELL_CACHE, ASSET_CACHE].includes(k))
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim()) // take control of all open tabs immediately
  );
});

// ─── Helpers ────────────────────────────────────────────────────────────────
function isStaticAsset(url) {
  // Next.js immutable static files have content hashes — safe to cache forever
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    /\.(css|js|png|jpg|jpeg|svg|webp|ico|woff2?)$/.test(url.pathname)
  );
}

// ─── Fetch: routing logic ───────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only intercept same-origin GETs
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // API calls: always go to network. Never serve stale leads.
  if (url.pathname.startsWith('/api/')) return;

  // Static assets: Cache-first (they are content-hashed so safe to cache indefinitely)
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(ASSET_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached; // instant cache hit — no network needed
        const response = await fetch(request);
        if (response && response.status === 200) {
          cache.put(request, response.clone()); // store for next time
        }
        return response;
      })
    );
    return;
  }

  // HTML navigations: Network-first, fall back to offline page
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match(request);
        return cached || caches.match('/offline.html');
      })
    );
    return;
  }
});

// ─── Push notifications ─────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let data = {};
  try { data = event.data.json(); } catch { data = { title: 'Buildogram', body: event.data.text() }; }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Buildogram', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: data.tag || 'bt-notification',
      data: data.url ? { url: data.url } : {},
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/caller';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((windowClients) => {
      const existing = windowClients.find((c) => c.url.includes(url) && 'focus' in c);
      if (existing) return existing.focus();
      return clients.openWindow(url);
    })
  );
});
