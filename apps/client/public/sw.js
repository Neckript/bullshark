self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }
  event.waitUntil(
    self.registration.showNotification(payload.title || 'Bullshark', {
      body: payload.body || '',
      tag: payload.tag,
      icon: '/icon-192.png',
      data: { url: payload.url || '/' }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => 'focus' in c);
      if (existing) {
        existing.navigate(url);
        return existing.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      const oldSub = event.oldSubscription;
      const newSub = await self.registration.pushManager.subscribe(
        oldSub ? { userVisibleOnly: true, applicationServerKey: oldSub.options.applicationServerKey } : { userVisibleOnly: true }
      );
      // Best effort: the app re-syncs the subscription on next open;
      // we cannot call tRPC from the SW without auth context.
      void newSub;
    })()
  );
});
