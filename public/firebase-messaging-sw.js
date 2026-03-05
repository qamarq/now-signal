// Firebase Cloud Messaging Service Worker
importScripts(
  'https://www.gstatic.com/firebasejs/10.11.1/firebase-app-compat.js',
);
importScripts(
  'https://www.gstatic.com/firebasejs/10.11.1/firebase-messaging-compat.js',
);

// Firebase configuration - HARDCODED (replace with your values)
const firebaseConfig = {
  apiKey: 'AIzaSyBmV0elE44dKEq3RGPI4A-BmsczdoAxoO0',
  authDomain: 'nowsignal-25258.firebaseapp.com',
  projectId: 'nowsignal-25258',
  storageBucket: 'nowsignal-25258.firebasestorage.app',
  messagingSenderId: '555593751886',
  appId: '1:555593751886:web:9bdcff84233ccdd7ad921f',
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log(
    '[firebase-messaging-sw.js] Received background message:',
    payload,
  );

  const notificationTitle = payload.notification?.title || 'World Pulse Alert';
  const notificationOptions = {
    body: payload.notification?.body || 'New event detected',
    icon: payload.notification?.icon || '/icon-192x192.png',
    badge: '/badge-72x72.png',
    data: { url: payload.fcmOptions?.link || '/' },
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification clicked:', event);
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients
      .matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(targetUrl) && 'focus' in client) {
            return client.focus();
          }
        }
        return clients.openWindow(targetUrl);
      }),
  );
});
