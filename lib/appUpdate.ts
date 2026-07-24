export const UPDATED_TOAST_KEY = 'ff_app_updated';

export function getBundledVersion(): string {
    return typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';
}

export async function fetchServerVersion(): Promise<string | null> {
    try {
        const response = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok) return null;
        const data = await response.json();
        return data?.version != null ? String(data.version) : null;
    } catch {
        return null;
    }
}

export function isNewVersionAvailable(serverVersion: string): boolean {
    return serverVersion !== getBundledVersion();
}

export async function clearAppCaches(): Promise<void> {
    if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
    }
}

async function unregisterServiceWorkers(): Promise<void> {
    if (!('serviceWorker' in navigator)) return;
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((reg) => reg.unregister()));
}

function shouldSkipVersionCheck(): boolean {
    return !!sessionStorage.getItem(UPDATED_TOAST_KEY);
}

export async function applyAppUpdate(): Promise<void> {
    const bust = String(Date.now());
    sessionStorage.setItem(UPDATED_TOAST_KEY, '1');

    document.body.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#111827;font-family:sans-serif;">
        <div style="text-align:center;">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation:ros-spin .8s linear infinite;margin:0 auto 12px;display:block">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
            <p style="color:#f59e0b;font-size:16px;font-weight:800;letter-spacing:0.06em;margin:0;text-transform:uppercase">Actualizaci&oacute;n en curso</p>
            <p style="color:#71717a;font-size:12px;font-weight:600;letter-spacing:0.04em;margin:8px 0 0">Espere un momento...</p>
        </div>
        <style>@keyframes ros-spin{to{transform:rotate(360deg)}}</style>
    </div>`;

    await clearAppCaches();
    await unregisterServiceWorkers();

    const target = `${window.location.origin}/?_ffv=${bust}`;
    setTimeout(() => { window.location.href = target; }, 1500);
}

export function clearAppUpdateQueryParam(): void {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('_ffv')) return;
    url.searchParams.delete('_ffv');
    const clean = url.pathname + (url.search || '') + url.hash;
    window.history.replaceState({}, '', clean || '/');
}

let updateInProgress = false;

export async function checkAndApplyUpdate(
    showToast?: (msg: string, durationMs?: number) => void,
    options: { silent?: boolean; delayMs?: number; serverVersion?: string } = {}
): Promise<boolean> {
    if (updateInProgress || shouldSkipVersionCheck()) return false;

    const serverVersion = options.serverVersion ?? (await fetchServerVersion());
    if (!serverVersion || !isNewVersionAvailable(serverVersion)) {
        return false;
    }

    updateInProgress = true;

    if (!options.silent && showToast) {
        showToast('🔄 Nueva versi\u00f3n detectada. Actualizando...', 2000);
    }

    const delay = options.delayMs ?? (options.silent ? 0 : 1200);
    if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
    }

    await applyAppUpdate();
    return true;
}

export function showUpdatedToastIfNeeded(showToast: (msg: string, durationMs?: number) => void): void {
    if (!sessionStorage.getItem(UPDATED_TOAST_KEY)) return;
    sessionStorage.removeItem(UPDATED_TOAST_KEY);
    showToast('✅ Aplicaci\u00f3n actualizada a la \u00faltima versi\u00f3n', 4000);
}

const MIN_CHECK_GAP_MS = 30_000;

type SocketLike = {
    on: (event: string, handler: (...args: any[]) => void) => void;
    off: (event: string, handler: (...args: any[]) => void) => void;
    connected?: boolean;
    emit?: (event: string, ...args: any[]) => void;
};

export function initAppVersionSync(
    showToast: (msg: string, durationMs?: number) => void,
    socket: SocketLike,
    options: { enabled?: () => boolean } = {}
): () => void {
    clearAppUpdateQueryParam();
    showUpdatedToastIfNeeded(showToast);

    let lastCheckAt = 0;

    const runCheck = (serverVersion?: string) => {
        if (options.enabled && !options.enabled()) return;
        if (shouldSkipVersionCheck()) return;

        const now = Date.now();
        if (!serverVersion && now - lastCheckAt < MIN_CHECK_GAP_MS) return;
        lastCheckAt = now;

        checkAndApplyUpdate(showToast, serverVersion ? { serverVersion } : {});
    };

    const onVersionEvent = (payload: { version?: string }) => {
        if (!payload?.version) return;
        runCheck(String(payload.version));
    };

    const requestVersion = () => {
        if (shouldSkipVersionCheck()) return;
        socket.emit?.('request_app_version');
    };

    socket.on('app_version', onVersionEvent);
    socket.on('app_version_update', onVersionEvent);
    socket.on('connect', requestVersion);
    if (socket.connected) requestVersion();

    const onVisibilityChange = () => {
        if (document.visibilityState === 'visible') runCheck();
    };
    const onFocus = () => runCheck();

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onFocus);

    return () => {
        socket.off('app_version', onVersionEvent);
        socket.off('app_version_update', onVersionEvent);
        socket.off('connect', requestVersion);
        document.removeEventListener('visibilitychange', onVisibilityChange);
        window.removeEventListener('focus', onFocus);
    };
}
