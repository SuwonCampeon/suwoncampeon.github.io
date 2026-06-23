const CACHE_NAME = 'calendar-cache-v4';
const urlsToCache = [
  './',
  './index.html',
  './css/variables.css',
  './css/layout.css',
  './css/calendar.css',
  './css/diary.css',
  './css/todo.css',
  './js/data.js',
  './js/googleAuth.js',
  './js/googleCalendarAPI.js',
  './js/calendar.js',
  './js/eventModal.js',
  './js/tabController.js',
  './js/diary.js',
  './js/todo.js',
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
    fetch(event.request)
      .then(response => {
        // 네트워크 성공 시 항상 캐시를 최신 상태로 업데이트
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseClone);
        });
        return response;
      })
      .catch(() => {
        // 오프라인이거나 네트워크 에러 시 캐시에서 반환
        return caches.match(event.request);
      })
  );
});
