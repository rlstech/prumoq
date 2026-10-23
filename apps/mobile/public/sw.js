/*
 * Service worker do PWA PrumoQ: guarda o próprio app no aparelho para ele abrir sem internet.
 *
 * O build (scripts/build-sw.mjs) acrescenta no topo deste arquivo a lista de arquivos do `expo export`
 * (self.__PRUMOQ_PRECACHE) e uma versão calculada do conteúdo (self.__PRUMOQ_VERSION). Sem essa lista
 * (servidor de desenvolvimento do Expo) o service worker não intercepta nada.
 *
 * - Instalação: baixa todos os arquivos da versão para um cache próprio. Só ativa se todos chegarem.
 * - Abertura de página (navegação): responde com o index.html guardado (como `/`), na hora, com ou sem internet.
 *   O app é de página única: qualquer rota usa o mesmo index.html.
 * - Demais arquivos do próprio site: cache primeiro; o que não estava na lista é guardado no primeiro uso.
 * - Nunca intercepta outros domínios (Clerk, Neon, PowerSync, R2) nem a rota /api/: dados e sessão
 *   não podem vir de cache.
 * - Nova versão publicada: o navegador baixa este arquivo de novo, a versão nova se instala em segundo
 *   plano e passa a valer na próxima vez que o app for aberto (a página aberta continua como está).
 */
const PRECACHE = self.__PRUMOQ_PRECACHE || null;
const VERSION = self.__PRUMOQ_VERSION || 'dev';
const CACHE = `prumoq-app-${VERSION}`;
const SHELL = '/';

self.addEventListener('install', (event) => {
  if (!PRECACHE) {
    self.skipWaiting();
    return;
  }
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // `reload` ignora o cache HTTP do navegador: a versão guardada é a do servidor, não uma cópia antiga.
    await cache.addAll(PRECACHE.map((path) => new Request(path, { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    // Remove versões anteriores (e o cache do service worker antigo, `prumoq-v3`).
    await Promise.all(keys
      .filter((key) => key.startsWith('prumoq-') && key !== CACHE)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  if (!PRECACHE) return;
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // /api/: dados; /sw.js: o próprio service worker, que precisa sempre vir do servidor;
  // /admin: painel admin, outro app servido por outro Worker no mesmo domínio.
  if (url.pathname.startsWith('/api/') || url.pathname === '/sw.js') return;
  if (url.pathname === '/admin' || url.pathname.startsWith('/admin/')) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cached = await caches.match(SHELL, { cacheName: CACHE });
      if (cached) return cached;
      return fetch(request);
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request, { ignoreSearch: url.pathname.startsWith('/powersync/') });
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok && response.type === 'basic') {
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  })());
});
