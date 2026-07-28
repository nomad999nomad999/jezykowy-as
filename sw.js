const CACHE = 'eng-2026-07-28-v16';
const ASSETS = [
  './',
  'index.html',
  'style.css',
  'css/base.css',
  'css/home.css',
  'css/classify.css',
  'css/exercise-builder.css',
  'css/exercise-dialogue.css',
  'css/exercise-fact.css',
  'css/exercise-quick.css',
  'css/exercise-rpg.css',
  'ui.js',
  'db.js',
  'auth.js',
  'app.js',
  'manifest.json',
  'icon.png',
  'dexie.min.js'
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
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
  const url = e.request.url;

  // Network First for HTML and CSS to guarantee fresh styles immediately
  if (url.includes('index.html') || url.endsWith('/') || url.includes('.css')) {
    e.respondWith(
      fetch(e.request).then(resp => {
        if (resp.status === 200) {
          const cln = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, cln));
        }
        return resp;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache First for static JS/fonts/images
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(resp => {
        if (resp.status === 200 && url.startsWith('http')) {
          const cln = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, cln));
        }
        return resp;
      });
    }).catch(() => caches.match('index.html'))
  );
});
