const CACHE_NAME = 'muszakrend-cache-v2';
const urlsToCache = [
  '/naptarupdate/',
  '/naptarupdate/index.html',
  '/naptarupdate/icon.png',
  '/naptarupdate/ber.png',
  '/naptarupdate/settings.png',
  '/naptarupdate/calendar.png',
  '/naptarupdate/info.png',
  '/naptarupdate/left.png',
  '/naptarupdate/right.png',
  '/naptarupdate/script.js',
  '/naptarupdate/style.css',
  '/naptarupdate/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache.map(url => new Request(url, { credentials: 'same-origin' })));
      })
      .catch(error => {
        console.error('Caching failed:', error);
      })
  );
  // Azonnal aktiválja az új service worker-t
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      // Régi cache-ek törlése
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Azonnal átveszi az irányítást minden kliens felett
      clients.claim()
    ])
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Csak a sikeres válaszokat cache-eljük
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});

