const CACHE = 'eng-2026-06-22-14:15';
const ASSETS = [
  './',
  'index.html',
  'app.js',
  'ui.js',
  'auth.js',
  'dexie.min.js',
  'db.js',
  'coca_words.json',
  'initial_progress.json',
  'manifest.json',
  'icon.png',
  'css/base.css',
  'css/home.css',
  'css/classify.css',
  'css/exercise-quick.css',
  'css/exercise-builder.css',
  'css/exercise-fact.css',
  'css/exercise-rpg.css',
  'css/exercise-dialogue.css',
  'js/exercise-core.js',
  'js/exercise-basic.js',
  'js/exercise-supquiz.js',
  'js/exercise-srs.js',
  'js/exercise-builder.js',
  'js/exercise-fact.js',
  'js/exercise-dialogue.js',
  'js/exercise-handsfree.js',
  'js/exercise-rpg.js',
  'js/home.js'
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
