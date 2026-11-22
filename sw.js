// sw.js — versi offline-first
const CACHE = 'skp-harian-v3';
const CACHE_DYNAMIC = 'skp-dynamic-v3';
const SHELL = [
  './', './index.html', './manifest.webmanifest',
  './icon-192.png', './icon-512.png',
  './apple-touch-icon.png'
];

// Install: cache shell
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

// Activate: bersihkan cache lama
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE && k !== CACHE_DYNAMIC).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch: offline-first untuk shell, network-first untuk API
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // API Google Apps Script → network only, fallback ke cache
  if (url.hostname === 'script.google.com' || url.hostname === 'script.googleusercontent.com') {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_DYNAMIC).then(c => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then(r => r || new Response(
          JSON.stringify({ ok: false, error: 'Offline — data akan disinkronkan nanti' }),
          { headers: { 'Content-Type': 'application/json' } }
        )))
    );
    return;
  }

  // Same-origin → cache-first
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match('./index.html')))
    );
    return;
  }

  // Third-party (font) → cache-first
  e.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE_DYNAMIC).then(c => c.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => cached))
  );
});

// Background Sync (jika didukung)
self.addEventListener('sync', e => {
  if (e.tag === 'sync-skp') {
    e.waitUntil(notifyClients({ type: 'SYNC_REQUESTED' }));
  }
});

function notifyClients(msg) {
  return self.clients.matchAll().then(clients => {
    clients.forEach(c => c.postMessage(msg));
  });
}
