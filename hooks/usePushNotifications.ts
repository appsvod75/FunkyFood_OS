import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { firebaseConfig } from "../firebase-config";

const API_URL = (import.meta as any).env.VITE_API_URL || '/api';

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

export const usePushNotifications = () => {
    const requestPermission = async (userId: number) => {
        try {
            console.log('[PUSH] Iniciando solicitud de permisos para usuario:', userId);

            if (!('Notification' in window)) {
                console.warn('[PUSH] Notificaciones no soportadas en este navegador.');
                return;
            }

            const permission = await Notification.requestPermission();
            console.log('[PUSH] Estado del permiso:', permission);

            if (permission === 'granted') {
                console.log('[PUSH] Permiso concedido, obteniendo registro de Service Worker...');

                // Intentamos obtener el registro actual
                let registration = await navigator.serviceWorker.getRegistration('/firebase-cloud-messaging-push-scope');

                if (!registration) {
                    console.log('[PUSH] Registrando Service Worker de Firebase manualmente...');
                    registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
                        scope: '/firebase-cloud-messaging-push-scope'
                    });
                }

                console.log('[PUSH] Service Worker listo:', registration.scope);

                const token = await getToken(messaging, {
                    vapidKey: firebaseConfig.vapidKey,
                    serviceWorkerRegistration: registration
                });

                if (token) {
                    console.log('[PUSH] Token obtenido con éxito ✅');
                    const subscribeUrl = `${API_URL}/push/subscribe`;
                    console.log('[PUSH] Enviando token a:', subscribeUrl);

                    // Enviar al backend
                    const response = await fetch(subscribeUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId, token })
                    });

                    if (response.ok) {
                        console.log('[PUSH] Suscripción guardada en el servidor ✅');
                    } else {
                        const errorText = await response.text();
                        console.error('[PUSH] Error al guardar suscripción:', errorText);
                    }
                    return token;
                } else {
                    console.warn('[PUSH] No se pudo obtener el token de FCM.');
                }
            } else {
                console.warn('[PUSH] Permiso denegado por el usuario.');
            }
        } catch (error: any) {
            console.error('[PUSH] Error crítico en setup de notificaciones:', error);
        }
    };

    const unsubscribe = async (userId: number) => {
        try {
            const token = await getToken(messaging);
            if (token) {
                await fetch(`${API_URL}/push/unsubscribe`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId, token })
                });
            }
        } catch (error) {
            console.error('[PUSH] Error al desuscribir:', error);
        }
    };

    return { requestPermission, unsubscribe };
};
