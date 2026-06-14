const CACHE = 'eng-v30';
const ASSETS = [
  './',
  'index.html',
  'style.css',
  'app.js',
  'ui.js',
  'auth.js',
  'dexie.min.js',
  'db.js',
  'coca_words.json',
  'initial_progress.json',
  'manifest.json',
  'icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE).map(k => caches.delete(k))
    ))
  );
});

self.addEventListener('fetch', e => {
  // Ignoruj wirtualne żądania API
  if (e.request.url.includes('/api/')) return;
  
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
