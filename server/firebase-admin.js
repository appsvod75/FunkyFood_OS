import admin from 'firebase-admin';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Cargamos el JSON
const serviceAccount = require('./serviceAccountKey.json');

/**
 * Procesamiento de la llave privada.
 * La forma más segura y estándar es solo reemplazar los saltos de línea escapados.
 */
if (serviceAccount.private_key && typeof serviceAccount.private_key === 'string') {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
}

// Inicialización segura
const initializeFirebase = () => {
    try {
        if (admin.apps.length === 0) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
            console.log('[PUSH-INIT] Firebase Admin inicializado correctamente ✅');
        }
    } catch (e) {
        console.error('[PUSH-INIT] Error fatal al inicializar:', e.message);
    }
};

// Inicializamos al cargar el módulo
initializeFirebase();

export const sendPushNotification = async (tokens, title, body, data = {}, actions = [], dbPool = null) => {
    if (!tokens || (Array.isArray(tokens) && tokens.length === 0)) return;

    // Aseguramos que Firebase esté listo antes de usar messaging()
    if (admin.apps.length === 0) initializeFirebase();

    const message = {
        notification: { title, body },
        data: {
            ...data,
            url: data.url || '/',
            actions: JSON.stringify(actions)
        },
        android: {
            priority: 'high',
            notification: {
                priority: 'max',
                channel_id: 'restaurante_notifs'
            }
        },
        webpush: {
            headers: {
                Urgency: 'high'
            },
            notification: {
                title,
                body,
                icon: '/icon.png',
                badge: '/icon.png',
                tag: data.orderId || 'new-order',
                renotify: true,
                requireInteraction: true,
                actions: actions.length > 0 ? actions : undefined
            },
            fcm_options: {
                link: data.url || '/'
            }
        }
    };

    try {
        const messaging = admin.messaging();
        if (Array.isArray(tokens)) {
            const uniqueTokens = [...new Set(tokens)].filter(t => typeof t === 'string' && t.length > 10);
            if (uniqueTokens.length === 0) return;

            const response = await messaging.sendEachForMulticast({
                tokens: uniqueTokens,
                ...message
            });

            if (response.failureCount > 0) {
                const invalidTokens = [];
                response.responses.forEach((resp, idx) => {
                    if (!resp.success && resp.error.code === 'messaging/registration-token-not-registered') {
                        invalidTokens.push(uniqueTokens[idx]);
                    }
                });

                if (invalidTokens.length > 0) {
                    console.log(`[PUSH] Cleaning ${invalidTokens.length} invalid token(s) from DB...`);
                    // Remove each invalid token from all users that have it
                    for (const tok of invalidTokens) {
                        try {
                            const [users] = await dbPool.execute(
                                "SELECT id, fcm_tokens FROM users WHERE JSON_CONTAINS(fcm_tokens, ?)",
                                [JSON.stringify(tok)]
                            );
                            for (const user of users) {
                                let tokensList = user.fcm_tokens;
                                if (typeof tokensList === 'string') tokensList = JSON.parse(tokensList);
                                if (Array.isArray(tokensList)) {
                                    const filtered = tokensList.filter(t => t !== tok);
                                    if (filtered.length === 0) {
                                        await dbPool.execute("UPDATE users SET fcm_tokens = NULL WHERE id = ?", [user.id]);
                                    } else {
                                        await dbPool.execute("UPDATE users SET fcm_tokens = ? WHERE id = ?", [JSON.stringify(filtered), user.id]);
                                    }
                                }
                            }
                        } catch (e) {
                            // Silently ignore cleanup errors
                        }
                    }
                }
            }
            return response;
        } else {
            const response = await messaging.send({
                token: tokens,
                ...message
            });
            return response;
        }
    } catch (error) {
        if (error.code !== 'messaging/registration-token-not-registered') {
            console.error('[PUSH] Error sending notification:', error);
        }
    }
};

export default admin;
