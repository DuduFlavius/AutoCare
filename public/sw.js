// AutoCare PWA — private pages and API responses are never cached.
const OFFLINE_CACHE = 'autocare-public-offline-v1';
self.addEventListener('install', event => {
  event.waitUntil(caches.open(OFFLINE_CACHE).then(cache => cache.add('/offline.html')).then(() => self.skipWaiting()));
});
// Cache only this static, anonymous offline screen. Never cache authenticated HTML or API data.
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || event.request.mode !== 'navigate') return;
  event.respondWith(fetch(event.request).catch(async () => (await caches.match('/offline.html')) || new Response('AutoCare: reconnect to the internet.', { status: 503, headers: { 'Content-Type': 'text/plain' } })));
});
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch {}
  const isSupport = String(payload.id || '').startsWith('support-');
  const target = isSupport ? '/cont?tab=Centru%20de%20suport' : '/cont?tab=Notific%C4%83ri';
  event.waitUntil(self.registration.showNotification(payload.title || 'AutoCare', {
    body: payload.body || 'Ai o notificare nouă în AutoCare.',
    tag: payload.id || 'autocare-reminder',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    renotify: false,
    data: { url: target },
  }));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const path = event.notification.data?.url || '/cont?tab=Notific%C4%83ri';
  const target = new URL(path, self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin === self.location.origin) {
        await client.navigate(target);
        return client.focus();
      }
    }
    return self.clients.openWindow(target);
  })());
});
