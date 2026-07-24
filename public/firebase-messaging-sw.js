// Give the service worker access to Firebase Messaging.
// Note that you can only use Firebase Messaging here. Other Firebase libraries
// are not available in the service worker.

importScripts('https://www.gstatic.com/firebasejs/9.2.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.2.0/firebase-messaging-compat.js');

// Initialize the Firebase app
firebase.initializeApp({
    apiKey: "AIzaSyCc6C6H8nWTlE9FSHN2YXPoxdy98AXE2cI",
    authDomain: "restauranteos-push.firebaseapp.com",
    projectId: "restauranteos-push",
    storageBucket: "restauranteos-push.firebasestorage.app",
    messagingSenderId: "778715936527",
    appId: "1:778715936527:web:9e2c722c29790d9b49f07a"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] V2.1 - Mensaje recibido', payload);

    const notificationTitle = payload.notification?.title || payload.data?.title || '🛵 ¡NUEVO ENVÍO!';
    const notificationOptions = {
        body: payload.notification?.body || payload.data?.body || 'Tienes un nuevo pedido listo para entrega.',
        icon: '/icon.png',
        badge: '/icon.png',
        tag: payload.data?.orderId || 'new-order',
        renotify: true,
        requireInteraction: true,
        vibrate: [200, 100, 200, 100, 200],
        data: {
            url: payload.data?.url || '/'
        }
    };

    // FIX: Parsear acciones manuales si vienen en data
    if (payload.data?.actions) {
        try {
            const parsedActions = JSON.parse(payload.data.actions);
            if (Array.isArray(parsedActions)) {
                notificationOptions.actions = parsedActions;
            }
        } catch (e) {
            console.error('Error parsing actions:', e);
        }
    }

    return self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    // 1. Manejo de Acciones (Botones)
    if (event.action === 'open_app') {
        const urlToOpen = event.notification.data?.url || '/delivery';
        return event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            for (var i = 0; i < windowClients.length; i++) {
                var client = windowClients[i];
                if (client.url === urlToOpen && 'focus' in client) return client.focus();
            }
            if (clients.openWindow) return clients.openWindow(urlToOpen);
        }));
    }

    // 2. Clic normal en la notificación (misma lógica)
    const urlToOpen = event.notification.data?.url || '/';
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            for (var i = 0; i < windowClients.length; i++) {
                var client = windowClients[i];
                if (client.url === urlToOpen && 'focus' in client) return client.focus();
            }
            if (clients.openWindow) return clients.openWindow(urlToOpen);
        })
    );
});

// --- PWA INSTALLABILITY FIX (Event 'fetch' required by Firefox/Chrome) ---
self.addEventListener('fetch', (event) => {
    // Basic passthrough fetch handler. 
    // This satisfies the requirement for PWA installability without changing network behavior.
    event.respondWith(fetch(event.request));
});
