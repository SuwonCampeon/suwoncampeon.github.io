const CACHE_NAME = 'calendar-cache-v3';
const urlsToCache = [
  './',
  './index.html',
  './css/variables.css',
  './css/layout.css',
  './css/calendar.css',
  './js/data.js',
  './js/googleAuth.js',
  './js/googleCalendarAPI.js',
  './js/calendar.js',
  './js/app.js',
  './manifest.json',
  './images/icon.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))
      );
    })
  );
});

self.addEventListener('fetch', event => {
  // Google API 및 인증 관련 요청은 캐시하지 않고 항상 네트워크를 통하도록 함
  if (event.request.url.includes('googleapis.com') || event.request.url.includes('accounts.google.com')) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // 캐시에 있으면 반환, 없으면 네트워크 요청
        return response || fetch(event.request);
      })
  );
});
