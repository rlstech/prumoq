const CACHE_NAME = 'prumoq-v1';
const IS_DEV = self.location.hostname === 'localhost' ||
               self.location.hostname === '127.0.0.1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Em desenvolvimento, sempre vai à rede — sem cache
  if (IS_DEV) {
    event.respondWith(fetch(event.request));
    return;
  }

  const url = new URL(event.request.url);

  // Network-first para Supabase e R2
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('r2.dev') ||
    url.hostname.includes('prumoq.com.br')
  ) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Cache-first para assets estáticos (só em produção)
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
