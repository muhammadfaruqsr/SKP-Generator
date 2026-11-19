/* sw.js — cache offline untuk SKP Harian */
const CACHE = 'skp-harian-v1';
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './db.js',
  './pdf.js',
  './style.css',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
      const clone = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, clone));
      return res;
    }).catch(() => cached))
  );
});
