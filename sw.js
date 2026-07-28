const CACHE = 'eng-2026-07-28-v11';
const ASSETS = [
  './',
  'index.html',
  'style.css',
  'ui.js',
  'db.js',
  'auth.js',
  'app.js',
  'manifest.json',
  'icon.png',
  'dexie.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(resp => {
        if (resp.status === 200 && e.request.url.startsWith('http')) {
          const cln = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, cln));
        }
        return resp;
      });
    }).catch(() => caches.match('index.html'))
  );
});
