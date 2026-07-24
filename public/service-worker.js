const CACHE_NAME = 'chemistry-lms-v1';
const ASSETS = [
    '/',
    '/login',
    '/register',
    '/manifest.json',
    '/offline.html'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    );
});

self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then(response => {
            return response || fetch(e.request).then(fetchResponse => {
                return caches.open(CACHE_NAME).then(cache => {
                    cache.put(e.request, fetchResponse.clone());
                    return fetchResponse;
                });
            });
        }).catch(() => {
            if(e.request.mode === 'navigate') {
                return caches.match('/offline.html');
            }
        })
    );
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            );
        })
    );
});
