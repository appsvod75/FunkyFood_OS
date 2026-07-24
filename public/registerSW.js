// Registro manual del Service Worker de Firebase
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker
            .register('/firebase-messaging-sw.js?v=' + new Date().getTime())
            .then((registration) => {
                console.log('[SW] Firebase Service Worker registrado:', registration.scope);
            })
            .catch((error) => {
                console.error('[SW] Error al registrar Firebase Service Worker:', error);
            });
    });
}
