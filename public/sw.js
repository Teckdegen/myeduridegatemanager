// MyEduRide Service Worker - Push Notifications + Offline

self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();

  const options = {
    body: data.message || 'New notification',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    vibrate: [200, 100, 200],
    tag: data.tag || 'myeduride-notification',
    data: {
      url: data.url || '/',
      student_id: data.student_id,
      type: data.type,
    },
    actions: [
      { action: 'open', title: 'View' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  // Customize notification based on type
  if (data.type === 'arrival') {
    options.icon = '/icons/arrival.png';
  } else if (data.type === 'departure') {
    options.icon = '/icons/departure.png';
  } else if (data.type === 'late') {
    options.icon = '/icons/late.png';
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'MyEduRide', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const url = event.notification.data?.url || '/dashboard/parent';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Open new window
      return clients.openWindow(url);
    })
  );
});

// Offline caching strategy
const CACHE_NAME = 'myeduride-v1';
const OFFLINE_URLS = [
  '/',
  '/dashboard/gate',
  '/offline',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_URLS))
  );
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
  // Only cache GET requests
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Serve from cache when offline
        return caches.match(event.request).then((cached) => {
          return cached || caches.match('/offline');
        });
      })
  );
});
