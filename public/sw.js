/* Buildogram Telecalling service worker.
 * Deliberately hand-written and small: mid-range Android handsets on patchy
 * 4G are the target, and the offline story has to be predictable.
 *
 * Caching policy
 *  - navigations: network first, fall back to /offline.html
 *  - static assets: stale-while-revalidate
 *  - API calls: never cached (a stale lead is worse than no lead)
 */

const VERSION = 'v1';
const SHELL_CACHE = `bt-shell-${VERSION}`;
const ASSET_CACHE = `bt-assets-${VERSION}`;
const SHELL_URLS = ['/offline.html', '/manifest.webmanifest', '/icons/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => ![SHELL_CACHE, ASSET_CACHE].includes(k)).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

function isAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    /\.(css|js|png|jpg|jpeg|svg|webp|woff2?)$/.test(url.pathname)
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // API responses are always live. Offline handling is the app's job, not the
  // cache's - it queues writes in IndexedDB instead of replaying stale reads.
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match(request);
        return cached || caches.match('/offline.html');
      })
    );
    return;
  }

  if (isAsset(url)) {
    event.respondWith(
      caches.open(ASSET_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((res) => {
            if (res && res.status === 200) cache.put(request, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
  }
});

// Background Sync: when the OS says the connection is back, tell every open tab
// to flush its outbox. Chrome on Android supports this; elsewhere the app's own
// `online` listener does the same job.
self.addEventListener('sync', (event) => {
  if (event.tag !== 'sync-dispositions') return;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      clients.forEach((client) => client.postMessage({ type: 'FLUSH_OUTBOX' }));
    })
  );
});

self.addEventListener('push', (event) => {
  let payload = { title: 'Buildogram', body: 'You have an update.', url: '/' };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    if (event.data) payload.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: payload.type || 'buildogram',
      renotify: true,
      vibrate: [80, 40, 80],
      data: { url: payload.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(target));
      if (existing) return existing.focus();
      return self.clients.openWindow(target);
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
