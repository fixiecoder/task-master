/// <reference lib="webworker" />
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { clientsClaim } from 'workbox-core';
import { initializeApp } from 'firebase/app';
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw';

declare let self: ServiceWorkerGlobalScope;

self.skipWaiting();
clientsClaim();
precacheAndRoute(self.__WB_MANIFEST);

// Lets a client-side route (e.g. /shopping, restored from a bookmark or the
// OS app switcher) resolve to the cached app shell when there's no network
// to reach the server for that path — reads/writes still go through
// IndexedDB/the API as usual once the SPA has booted. Excludes anything
// that looks like an API call or a real static asset, same as the default
// generateSW navigation fallback would.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('index.html'), {
    denylist: [/^\/(api|__)/, /\.[^/?]+$/],
  }),
);

const firebaseApp = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
});
const messaging = getMessaging(firebaseApp);

onBackgroundMessage(messaging, (payload) => {
  const title = payload.notification?.title ?? 'Task Master';
  const body = payload.notification?.body ?? '';
  const url = payload.fcmOptions?.link ?? payload.data?.url ?? '/';
  self.registration.showNotification(title, {
    body,
    icon: '/pwa-192x192.png',
    data: { url },
    tag: payload.data?.notificationId,
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      const existing = clientsArr.find((c) => 'focus' in c) as WindowClient | undefined;
      if (existing) {
        return existing.focus().then(() => existing.navigate(url));
      }
      return self.clients.openWindow(url);
    }),
  );
});
