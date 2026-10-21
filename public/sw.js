// AutoCare PWA — private pages and API responses are never cached.
self.addEventListener('install', () => self.skipWaiting());
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
