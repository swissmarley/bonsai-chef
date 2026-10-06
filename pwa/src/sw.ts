/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: (string | { url: string; revision: string | null })[] };

// App shell: every built file is precached, so the app opens instantly and offline.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/api\//, /^\/\.netlify\//] }));

const sameOrigin = (url: URL) => url.origin === self.location.origin;

// Photos never change (new id on every upload): cache first.
registerRoute(
  ({ url, request }) => sameOrigin(url) && request.method === 'GET' && /^\/api\/photos\/[\w-]+$/.test(url.pathname),
  new CacheFirst({
    cacheName: 'bc-photos',
    plugins: [new ExpirationPlugin({ maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 90 })],
  }),
);

// Data: always the network; the last copy is used only when the network fails (offline).
registerRoute(
  ({ url, request }) =>
    sameOrigin(url) &&
    request.method === 'GET' &&
    /^\/api\/(bonsai|bonsai\/[\w-]+\/events|tools|reminders|groups|events\/suggestions|announcements|auth\/me)$/.test(url.pathname),
  new NetworkFirst({ cacheName: 'bc-data' }),
);

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting();
});

interface PushPayload {
  title?: string;
  body?: string;
  url?: string;
  tag?: string;
}

self.addEventListener('push', (event) => {
  let data: PushPayload = {};
  try {
    data = event.data?.json() ?? {};
  } catch {
    data = { body: event.data?.text() };
  }
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Promemoria Bonsai Chef', {
      body: data.body ?? '',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-96.png',
      tag: data.tag,
      lang: 'it',
      data: { url: data.url ?? '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data as { url?: string })?.url ?? '/', self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin) {
          await client.focus();
          return client.navigate(url);
        }
      }
      return self.clients.openWindow(url);
    })(),
  );
});
