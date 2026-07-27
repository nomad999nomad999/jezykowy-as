const CACHE = 'eng-v33';

// Network-first: zawsze pobierz z sieci, cache tylko awaryjnie
self.addEventListener('install', e => {
  // Natychmiastowa aktywacja — nie czekaj na zamknięcie starych kart
  e.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', e => {
  // Przejął kontrolę natychmiast + usuń stary cache
  e.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
    ])
  );
});

self.addEventListener('fetch', e => {
  // Zawsze pobieraj z sieci — bez cache dla JS/CSS
  // Cache tylko dla /api/ jest wyłączone (passthrough)
  if (e.request.url.includes('/api/')) return;
  
  // Network first, bez fallback do cache — zawsze świeże pliki
  e.respondWith(fetch(e.request));
});
