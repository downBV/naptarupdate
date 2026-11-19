const CACHE_NAME = 'muszaknaptar_V3.3.0';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/minimal.css',
  '/script.js',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-192.png',
  '/icon-maskable-512.png',
  '/apple-touch-icon.png',
  '/favicon.ico',
  '/favicon-32.png',
  '/favicon-16.png',
  '/ber.png',
  '/settings.png',
  '/calendar.png',
  '/info.png',
  '/left.png',
  '/right.png',
  '/manifest.json'
];

async function cacheFiles(cache) {
  const promises = urlsToCache.map(async (url) => {
    try {
      const request = new Request(url, { 
        credentials: url.startsWith('http') ? 'omit' : 'same-origin',
        cache: 'no-cache'
      });
      
      const response = await fetch(request);
      if (response.ok) {
        await cache.put(request, response);
      }
    } catch (error) {
      // Csendben kezeljük a hibákat
    }
  });
  
  await Promise.allSettled(promises);
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cacheFiles(cache))
      .catch(() => {})
  );
  // skipWaiting() szándékosan NEM fut le automatikusan.
  // Az overlay-en keresztül, SKIP_WAITING üzenettel triggereljük.
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
      // Új service worker azonnal átveszi a kontrollt
      clients.claim()
    ])
  );
});

self.addEventListener('fetch', event => {
  // Csak GET kéréseket kezeljük
  if (event.request.method !== 'GET') {
    return;
  }
  
  // Google Fonts külön kezelése
  if (event.request.url.includes('fonts.googleapis.com') || 
      event.request.url.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request, { 
          mode: 'cors',
          credentials: 'omit'
        }).then(response => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        }).catch(() => {
          return new Response('/* Fallback: system fonts */', {
            headers: { 'Content-Type': 'text/css' }
          });
        });
      })
    );
    return;
  }
  
  // Csak a saját domain kéréseit kezeljük (pl. chrome-extension:// ne kerüljön a cache-be)
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // NETWORK-FIRST: online mindig a friss fájlokat kapja a felhasználó, így az index.html,
  // a script.js és a style.css mindig EGYÜTT, ugyanabból a verzióból jön (nincs verzió-keveredés).
  // Offline (vagy ha a hálózat 4 mp-nél lassabb) a gyorsítótárból szolgál ki.
  event.respondWith(networkFirst(event.request));
});

const NETWORK_TIMEOUT_MS = 4000;

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const networkPromise = fetch(request, { cache: 'no-cache' });
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), NETWORK_TIMEOUT_MS)
    );
    const response = await Promise.race([networkPromise, timeoutPromise]);

    // Csak teljes, sikeres (200) válasz kerül a cache-be (a 206 részleges válasz hibát dobna)
    if (response && response.status === 200) {
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;

    // Oldalnavigáció offline: az index.html-t adjuk vissza
    if (request.mode === 'navigate' || request.destination === 'document') {
      const fallback = (await cache.match('/index.html')) || (await cache.match('/'));
      if (fallback) return fallback;
    }
    throw error;
  }
}

// Verzió ellenőrzés üzenet kezelése
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({
      version: CACHE_NAME,
      timestamp: new Date().toISOString()
    });
  }
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('error', event => {
  // Csendben kezeljük a hibákat
});

self.addEventListener('unhandledrejection', event => {
  event.preventDefault();
});