
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Order, OrderItem, OrderDetails, Waiter, Table, TableArea, Meat, Category, ProductExtra, Product, Customer, UserRole, Payment, PaymentMethod, PromotionType, CashClosingReport, KitchenStatus, OrderType, CompanySettings, Branch, User, PromotionRule } from './types';
import { INITIAL_COMPANY_SETTINGS, INITIAL_BRANCHES } from './constants';
import { api, socket } from './api';
import { calculatePromotions } from './utils/promotionEngine';
import { getElSalvadorDateString, formatToElSalvadorDate } from './utils/dates';
import { Toaster, toast } from 'react-hot-toast';
import { checkAndApplyUpdate, initAppVersionSync, showUpdatedToastIfNeeded } from './lib/appUpdate';
import StartScreen from './components/StartScreen';
import OrderScreen from './components/OrderScreen';
import CompletedOrdersScreen from './components/CompletedOrdersScreen';
import ActiveOrdersMobileScreen from './components/ActiveOrdersMobileScreen';
import LoginScreen from './components/LoginScreen';
import AdminPanel from './components/AdminPanel';
import Header from './components/Header';
import KdsScreen from './components/KdsScreen';
import MasterSettingsScreen from './components/MasterSettingsScreen';
import DeliveryDashboard from './components/DeliveryDashboard';
import ManageCustomersScreen from './components/ManageCustomersScreen';
import { FeedbackScreen } from './components/FeedbackScreen';
import BranchSelectionScreen from './components/BranchSelectionScreen';
import NotificationToast, { ToastType } from './components/NotificationToast';
import CustomerPortal from './components/CustomerPortal';
import RedigitationScreen from './components/RedigitationScreen';
import ExitConfirmationModal from './components/ExitConfirmationModal';
import TableMonitorScreen from './components/TableMonitorScreen';
import CashOpeningModal from './components/CashOpeningModal';
import { usePushNotifications } from './hooks/usePushNotifications';

interface LoggedInUserState {
    id: number;
    username: string;
    currentRole: UserRole;
    allRoles: UserRole[];
}

// --- TYPES ---
type CurrentView = 'select_branch' | 'start' | 'order' | 'completed' | 'admin' | 'kds' | 'delivery' | 'manage_customers' | 'manage_inventory' | 'master_settings' | 'menu' | 'feedback' | 'active_orders_mobile' | 'daily_summary' | 'pending_balances' | 'delivery_dashboard' | 'feedback_dashboard' | 'sales_projections' | 'global_history' | 'tables' | 'redigitate';

// usePersistentState removed in favor of API

const App: React.FC = () => {
    const [loggedInUser, setLoggedInUser] = useState<LoggedInUserState | null>(null);
    const [loginName, setLoginName] = useState<string | null>(null);
    const [loginErrorCount, setLoginErrorCount] = useState(0);
    const [currentView, setCurrentView] = useState<CurrentView>(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('view') === 'feedback') return 'feedback';
        if (params.get('view') === 'menu') return 'menu';

        // 1. Fallback to URL (Legacy/Deep Link) - Priority Highest
        const fullPath = window.location.pathname;
        if (fullPath.endsWith('/delivery')) return 'delivery';
        if (fullPath.endsWith('/admin')) return 'admin';
        if (fullPath.endsWith('/kds')) return 'kds';
        if (fullPath.endsWith('/active_orders_mobile')) return 'active_orders_mobile';
        if (fullPath.endsWith('/completed')) return 'completed';
        if (fullPath.endsWith('/feedback')) return 'feedback';
        if (fullPath.endsWith('/portal') || fullPath.endsWith('/menu')) return 'menu';

        // 2. Check LocalStorage (Persistence)
        const savedView = localStorage.getItem('currentView');
        if (savedView && savedView !== 'start') {
            // Validate it is a valid view string roughly? Or just trust it.
            return savedView as CurrentView;
        }

        return 'start';
    });

    const [startScreenKey, setStartScreenKey] = useState(0);
    const [notificationMessage, setNotificationMessage] = useState<string | null>(null);
    const [notificationTitle, setNotificationTitle] = useState<string | null>(null);
    const [notificationType, setNotificationType] = useState<ToastType | undefined>('success');
    const [notificationPosition, setNotificationPosition] = useState<'top' | 'bottom' | 'center'>('bottom');
    const [notificationPersistent, setNotificationPersistent] = useState(false);

    // Business States
    const [orders, setOrders] = useState<Order[]>([]);
    const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
    const [orderToEditId, setOrderToEditId] = useState<string | null>(null);
    const [showNewOrderWizard, setShowNewOrderWizard] = useState(false);

    const [waiters, setWaiters] = useState<Waiter[]>([]);
    const [tables, setTables] = useState<Table[]>([]);
    const [tableAreas, setTableAreas] = useState<TableArea[]>([]);
    const [meats, setMeats] = useState<Meat[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [productExtras, setProductExtras] = useState<ProductExtra[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [cashClosingReports, setCashClosingReports] = useState<CashClosingReport[]>([]);
    const [companySettings, setCompanySettings] = useState<CompanySettings>(() => {
        const cached = localStorage.getItem('company_settings');
        if (cached) {
            try {
                return JSON.parse(cached);
            } catch (e) {
                console.error("Failed to parse cached settings", e);
            }
        }
        return INITIAL_COMPANY_SETTINGS;
    });
    const [branches, setBranches] = useState<Branch[]>(INITIAL_BRANCHES);
    const [selectedBranchId, setSelectedBranchId] = useState<number | null>(() => {
        const saved = localStorage.getItem('selectedBranchId');
        return saved ? Number(saved) : null;
    });
    const [promotions, setPromotions] = useState<PromotionRule[]>([]);
    const [productPopularity, setProductPopularity] = useState<Record<number, number>>({});
    const [productAvailability, setProductAvailability] = useState<Record<number, number>>({});
    const [observationTags, setObservationTags] = useState<{ id: number; name: string; isActive: boolean }[]>([]);

    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [showInstallInstructions, setShowInstallInstructions] = useState(false);
    const [showCashOpeningModal, setShowCashOpeningModal] = useState(false);
    const [redigitationMode, setRedigitationMode] = useState<{ cashReportId: number; date: string; branchId: number } | null>(null);
    const [redigitatedSessionIds, setRedigitatedSessionIds] = useState<Set<number>>(() => {
        try {
            const stored = localStorage.getItem('redigitatedSessions');
            return stored ? new Set(JSON.parse(stored)) : new Set();
        } catch { return new Set(); }
    });
    const [showRedigitatedOrders, setShowRedigitatedOrders] = useState(false);
    const [lastCashReminderTime, setLastCashReminderTime] = useState<number>(0);
    const [isCashOpeningSilenced, setIsCashOpeningSilenced] = useState(false);

    // --- NETWORK RESILIENCE STATES ---
    const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSyncError, setLastSyncError] = useState<string | null>(null);
    const [isOffline, setIsOffline] = useState(!navigator.onLine);

    useEffect(() => {
        const handleOnline = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const hydrateOrder = useCallback((order: Order): Order => {
        const waiterId = (order as any).waiterId || (order as any).waiter_id || order.waiter?.id;
        const tableId = (order as any).tableId || (order as any).table_id || order.table?.id;
        const customerId = (order as any).customerId || (order as any).customer_id || order.customer?.id;

        const waiter = waiterId ? waiters.find(w => Number(w.id) === Number(waiterId)) : order.waiter;
        const table = tableId ? tables.find(t => Number(t.id) === Number(tableId)) : order.table;
        const customer = customerId ? customers.find(c => Number(c.id) === Number(customerId)) : order.customer;

        return {
            ...order,
            id: String(order.id),
            waiter,
            table,
            customer,
            createdAt: order.createdAt ? new Date(order.createdAt) : new Date(),
            completedAt: order.completedAt ? new Date(order.completedAt) : undefined,
            readyAt: order.readyAt ? new Date(order.readyAt) : undefined
        };
    }, [waiters, tables, customers]);
    const [showExitConfirm, setShowExitConfirm] = useState(false);
    const { requestPermission, unsubscribe } = usePushNotifications();
    const pendingOrderRef = useRef<string | null>(null); // Ref for Race Condition Safety

    // --- AVAILABILITY SYNC ---
    const fetchAvailability = useCallback(async () => {
        const branchId = selectedBranchId || loggedInUser?.branchId || 1;
        // Pass activeOrderId to exclude it from reserved count (prevents double counting)
        try {
            const map = await api.getInventoryAvailability(branchId, activeOrderId || undefined);
            setProductAvailability(map);
        } catch (e) { console.error("Failed to fetch availability", e); }
    }, [selectedBranchId, loggedInUser, activeOrderId]);

    useEffect(() => {
        if (loggedInUser) {
            fetchAvailability();

            // Listen for stock-affecting events
            socket.on('new_order', fetchAvailability);
            socket.on('order_updated', fetchAvailability);
            socket.on('order_deleted', fetchAvailability);
            socket.on('catalog_updated', fetchAvailability); // If manual adjustment happens

            return () => {
                socket.off('new_order', fetchAvailability);
                socket.off('order_updated', fetchAvailability);
                socket.off('order_deleted', fetchAvailability);
                socket.off('catalog_updated', fetchAvailability);
            };
        }
    }, [loggedInUser, fetchAvailability]);

    useEffect(() => {
        const handler = (e: any) => {
            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
            if (isMobile) {
                e.preventDefault();
                setDeferredPrompt(e);
            }
        };
        window.addEventListener('beforeinstallprompt', handler);

        // --- GLOBAL VERSION CHECK (On Mount) ---
        checkVersion();

        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    // --- REUSABLE VERSION CHECK ---
    const checkVersion = async () => {
        try {
            console.log('🔍 Checking for app updates...');
            const response = await fetch('/version.json?t=' + Date.now());
            if (response.ok) {
                const data = await response.json();
                const serverVersion = data.version;
                const localVersion = localStorage.getItem('app_version');

                if (localVersion && serverVersion && String(serverVersion) !== String(localVersion)) {
                    console.log('🚀 New version detected! Clearing cache and updating...');
                    localStorage.setItem('app_version', String(serverVersion));
                    toast.success('Nueva versión disponible. Actualizando...', { duration: 4000, icon: '🚀' });

                    if ('caches' in window) {
                        const cacheNames = await caches.keys();
                        await Promise.all(cacheNames.map(name => caches.delete(name)));
                    }
                    if (navigator.serviceWorker) {
                        const regs = await navigator.serviceWorker.getRegistrations();
                        for (let reg of regs) { await reg.unregister(); }
                    }
                    setTimeout(() => window.location.reload(), 1500);
                } else if (!localVersion && serverVersion) {
                    localStorage.setItem('app_version', String(serverVersion));
                }
            }
        } catch (vErr) {
            console.error('PWA Version check failed (silent)', vErr);
        }
    };

    // --- VISIBILITY CHANGE LISTENER (RESUME) ---
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                console.log('📺 App resumed (visible). Triggering silent sync...');
                // Wait 1s for browser to restore network connections
                setTimeout(() => {
                    checkVersion();
                    if (loggedInUser) {
                        fetchAllData(true);
                    }
                }, 1000);
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [loggedInUser]);

    // Persist currentView changes
    useEffect(() => {
        if (currentView) {
            localStorage.setItem('currentView', currentView);
            // FIX: Use currentView in state to allow backward navigation restoration
            window.history.replaceState({ view: currentView, orderId: activeOrderId }, '', `/${currentView === 'start' ? '' : currentView}`);
        }
    }, [currentView, activeOrderId]);

    // Fix for refresh issue: automatically redirect to start if in order view but no activeOrderId
    useEffect(() => {
        if (currentView === 'order' && !activeOrderId) {
            const timer = setTimeout(() => {
                if (currentView === 'order' && !activeOrderId) {
                    console.log('🔄 State mismatch detected after refresh. Redirecting to start...');
                    setCurrentView('start');
                }
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [currentView, activeOrderId]);

    const handleInstallApp = async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') setDeferredPrompt(null);
        } else {
            // No automatic prompt (Firefox, iOS, or already rejected)
            setShowInstallInstructions(true);
        }
    };

    const fetchAllData = async (silent = false, retryCount = 0, userOverride?: LoggedInUserState, branchOverride?: number) => {
        try {
            if (isSyncing && silent) return;
            setIsSyncing(true);
            setLastSyncError(null);

            console.log('[AppData] Fetching Data (Buster: ' + Date.now() + ')...');
            const currentUser = userOverride || loggedInUser;
            const currentBranch = branchOverride || selectedBranchId || currentUser?.branchId;
            const isSuper = currentUser?.allRoles.includes(UserRole.SuperAdmin) || false;

            // @ts-ignore
            const data = await api.getInitialData(Date.now(), currentBranch, isSuper);
            if (!data) throw new Error('Servidor no devolvió datos válidos');

            if (data.waiters) setWaiters(data.waiters);
            if (data.branches) setBranches(data.branches);
            if (data.tables) setTables(data.tables);
            if (data.tableAreas) setTableAreas(data.tableAreas);
            if (data.categories) setCategories(data.categories);
            if (data.meats) setMeats(data.meats);
            if (data.productExtras) setProductExtras(data.productExtras);
            if (data.products) setProducts(data.products);
            if (data.customers) setCustomers(data.customers);
            if (data.promotions) setPromotions(data.promotions);
            if (data.observationTags) setObservationTags(data.observationTags);

            if (data.cashClosingReports) {
                const hydratedReports = data.cashClosingReports.map((r: any) => ({
                    ...r,
                    branchId: r.branch_id || r.branchId,
                    createdAt: new Date(r.created_at || r.createdAt)
                }));
                setCashClosingReports(hydratedReports);
            }

            if (data.globalSettings) {
                setCompanySettings(prev => {
                    const newSettings = {
                        ...prev,
                        name: data.globalSettings.global_store_name || prev.name,
                        logoUrl: data.globalSettings.global_logo_url || prev.logoUrl,
                        gasWebhookUrl: data.globalSettings.gas_webhook_url || prev.gasWebhookUrl,
                        geminiApiKey: data.globalSettings.gemini_api_key || prev.geminiApiKey,
                        enableCommission: data.globalSettings.enable_commission === '1' || data.globalSettings.enable_commission === true,
                        commissionPercentage: parseFloat(data.globalSettings.commission_percentage || '0'),
                        enableServiceCharge: data.globalSettings.enable_service_charge === '1' || data.globalSettings.enable_service_charge === true,
                        serviceChargePercentage: parseFloat(data.globalSettings.service_charge_percentage || '0'),
                        paymentDueDate: data.globalSettings.payment_due_date || prev.paymentDueDate || '',
                        paymentGraceDays: parseInt(data.globalSettings.payment_grace_days) ?? prev.paymentGraceDays ?? 3,
                        paymentPending: data.globalSettings.payment_pending === '1' || data.globalSettings.payment_pending === true,
                    };
                    localStorage.setItem('company_settings', JSON.stringify(newSettings));
                    return newSettings;
                });
            }

            // Fetch Orders (Active + Recent Completed)
            const [activeOrdersRaw, completedOrdersRaw] = await Promise.all([
                api.getOrders(undefined, 'active'),
                api.getOrders(undefined, 'completed')
            ]);

            const allRawOrders = [...(activeOrdersRaw || []), ...(completedOrdersRaw || [])];

            const hydratedOrders = allRawOrders.map((o: any) => {
                const waiter = (data.waiters || []).find((u: any) => String(u.id) === String(o.waiter_id || o.waiterId));
                const table = (data.tables || []).find((t: any) => String(t.id) === String(o.table_id || o.tableId));

                return {
                    ...o,
                    id: String(o.id),
                    branchId: o.branch_id || o.branchId || 1,
                    dailyOrderNumber: o.daily_order_number || o.dailyOrderNumber,
                    createdByUserId: o.created_by_user_id || o.createdByUserId,
                    createdAt: new Date(o.created_at || o.createdAt),
                    completedAt: (o.completed_at || o.completedAt) ? new Date(o.completed_at || o.completedAt) : undefined,
                    readyAt: (o.ready_at || o.readyAt) ? new Date(o.ready_at || o.readyAt) : undefined,
                    status: o.status,
                    type: o.type,
                    cashReportId: o.cash_report_id || o.cashReportId,
                    waiter: waiter || o.waiter,
                    table: table || o.table,
                    items: Array.isArray(o.items) ? o.items.map((i: any) => {
                        const product = (data.products || []).find((p: any) => p.id === (i.product_id || i.productId));
                        const meat = (i.meat_id || i.meatId) ? (data.meats || []).find((m: any) => m.id === (i.meat_id || i.meatId)) : undefined;
                        const masa = (i.masa_id || i.masaId) ? (data.meats || []).find((m: any) => m.id === (i.masa_id || i.masaId)) : undefined;
                        const extras = Array.isArray(i.extras) ? i.extras.map((e: any) => (data.productExtras || []).find((pe: any) => pe.id === e.id)).filter(Boolean) : [];

                        return {
                            ...i,
                            productId: i.product_id || i.productId,
                            product: product || { id: i.product_id || i.productId, name: 'Unknown Product', price: 0 },
                            meat,
                            masa,
                            meatId: i.meat_id || i.meatId,
                            masaId: i.masa_id || i.masaId,
                            extras
                        };
                    }) : []
                };
            });

            setOrders(prev => {
                const serverOrdersMap = new Map(hydratedOrders.map((o: any) => [String(o.id), o]));
                const mergedOrders = [...hydratedOrders];
                const pendingId = pendingOrderRef.current;
                const idToCheck = pendingId || activeOrderId;

                if (idToCheck) {
                    const currentOptimistic = prev.find(o => String(o.id) === String(idToCheck));
                    if (currentOptimistic && !serverOrdersMap.has(String(idToCheck))) {
                        mergedOrders.unshift(currentOptimistic);
                    }
                }
                const uniqueOrders = Array.from(new Map(mergedOrders.map((o: any) => [String(o.id), o])).values());
                return uniqueOrders as Order[];
            });

            setIsInitialLoadComplete(true);
            setIsSyncing(false);

        } catch (error: any) {
            console.error("Data sync error:", error);
            setIsSyncing(false);

            if (retryCount < 3) {
                const delay = (retryCount + 1) * 3000;
                setLastSyncError(`Problema de conexión. Reintentando en ${delay / 1000}s...`);
                setTimeout(() => fetchAllData(silent, retryCount + 1, userOverride, branchOverride), delay);
                return;
            }

            setLastSyncError("Error de conexión persistente. Verifica tu internet.");

            const errorMsg = String(error.message || '');
            const isAssetError = errorMsg.includes('Failed to fetch dynamically imported module') ||
                errorMsg.includes('Load chunk failed') ||
                errorMsg.includes('Unexpected token') ||
                errorMsg.includes('is not a JSON');

            if (isAssetError) {
                window.location.reload();
                return;
            }

            if (!silent) {
                toast.error(`ERROR DE CONEXIÓN: Verifica tu internet o espera unos segundos...`, { duration: 5000, icon: '🔌' });
            }
        }
    };

    // HEARTBEAT: Periodic background refresh to ensure sync if socket fails
    useEffect(() => {
        const heartbeat = setInterval(() => {
            const isPublicView = currentView === 'menu' || currentView === 'feedback';
            if ((loggedInUser || isPublicView) && (currentView === 'kds' || currentView === 'delivery' || currentView === 'admin' || currentView === 'start' || currentView === 'menu')) {
                console.log(`💓 Heartbeat [${currentView}]: Syncing data...`);
                fetchAllData(true);
            }
        }, 60000);

        return () => clearInterval(heartbeat);
    }, [currentView, loggedInUser]);

    const userRef = useRef<LoggedInUserState | null>(null);
    const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Debounce ref for order saves

    useEffect(() => {
        userRef.current = loggedInUser;
        if (loggedInUser?.id) {
            console.log('[PUSH] Usuario detectado, verificando notificaciones...');
            requestPermission(loggedInUser.id);
        }
    }, [loggedInUser]);

    // Initial Data Fetch & session restore consolidated
    useEffect(() => {
        const init = async () => {
            const params = new URLSearchParams(window.location.search);
            const viewParam = params.get('view');

            // 1. Restore Session FIRST to establish permissions
            const savedUser = localStorage.getItem('restauranteos_user');
            const savedBranchId = localStorage.getItem('selectedBranchId');

            let userObj = null;
            let branchId = null;

            if (savedUser) {
                try {
                    userObj = JSON.parse(savedUser);
                    setLoggedInUser(userObj);
                    userRef.current = userObj;

                    if (savedBranchId && userObj.currentRole !== UserRole.SuperAdmin) {
                        branchId = parseInt(savedBranchId);
                        setSelectedBranchId(branchId);

                        // Only auto-navigate if not on a forced public view
                        if (viewParam !== 'feedback' && viewParam !== 'menu') {
                            const savedView = localStorage.getItem('currentView');
                            if (savedView) {
                                setCurrentView(savedView as CurrentView);
                            } else {
                                navigateToRoleDefault(userObj.currentRole);
                            }
                        }
                    } else if (userObj.currentRole === UserRole.SuperAdmin && viewParam !== 'feedback' && viewParam !== 'menu') {
                        // Si ya tenemos una sucursal guardada, la respetamos
                        if (savedBranchId) {
                            setSelectedBranchId(Number(savedBranchId));
                            setCurrentView('admin');
                        } else {
                            // Si no, forzamos selección
                            setSelectedBranchId(null);
                            localStorage.removeItem('selectedBranchId');
                            setCurrentView('select_branch');
                        }
                    }
                } catch (e) {
                    console.error("Failed to restore session", e);
                }
            }

            // 2. Initial Data Fetch (Always if menu/feedback or logged in, with context!)
            await fetchAllData(true, 0, userObj || undefined, branchId || undefined);

            // 3. Handle specific view switches from URL last
            if (viewParam === 'feedback') setCurrentView('feedback');
            else if (viewParam === 'menu') setCurrentView('menu');
            else {
                // Fallback to path-based check if no query param
                const fullPath = window.location.pathname;
                if (fullPath.endsWith('/feedback')) setCurrentView('feedback');
                else if (fullPath.endsWith('/portal') || fullPath.endsWith('/menu')) setCurrentView('menu');
            }
        };

        init();

        // Auto-update: check on mount
        showUpdatedToastIfNeeded((msg, duration) => toast(msg, { duration }));
        checkAndApplyUpdate((msg, duration) => toast(msg, { duration }));

        // Socket Listeners (Static)
        socket.on('connect', () => console.log('SOCKET CONNECTED:', socket.id));
        socket.on('orders_updated', () => fetchAllData(true));
        socket.on('customers_updated', () => fetchAllData(true));
        socket.on('catalog_updated', () => fetchAllData(true));
        socket.on('force_logout', handleLogout);
        socket.on('force_reload', () => {
            console.log('force_reload received. Checking for new version...');
            checkAndApplyUpdate(
                (msg, duration) => toast(msg, { duration }),
                { delayMs: 500 }
            );
        });

        // Periodic silent check every 5 minutes
        const updateInterval = setInterval(() => {
            checkAndApplyUpdate(
                (msg, duration) => toast(msg, { duration }),
                { silent: true }
            );
        }, 5 * 60 * 1000);

        return () => {
            socket.off('connect');
            socket.off('orders_updated');
            socket.off('customers_updated');
            socket.off('catalog_updated');
            socket.off('force_logout');
            socket.off('force_reload');
            clearInterval(updateInterval);
        };
    }, []);

    // Active order dynamic sync (moved out of init for clarity)
    useEffect(() => {
        const handleNewOrder = (order: Order) => {
            setOrders(prev => {
                if (prev.find(o => String(o.id) === String(order.id))) return prev;
                return [hydrateOrder(order), ...prev];
            });
        };

        const handleOrderUpdated = (updatedOrder: Order) => {
            setOrders(prev => {
                const prevOrder = prev.find(o => String(o.id) === String(updatedOrder.id));
                if (!prevOrder) return prev; // No existe la orden, ignorar update parcial

                // IMPORTANTE: El evento de socket suele ser un update PARCIAL.
                // Fusionamos PRIMERO con el objeto previo para no perder el "createdAt" original
                // que es lo que rompe el contador de minutos del KDS.
                const fullOrderData = { ...prevOrder, ...updatedOrder } as Order;

                // Hidratamos los datos fusionados (esto asegura que createdAt sea un Date válido)
                const hydrated = hydrateOrder(fullOrderData);

                // Lógica de Notificación para Meseros (App Activa)
                const justBecomeReady = prevOrder.kitchenStatus !== 'ready' &&
                    hydrated.kitchenStatus === 'ready';

                // Notificar solo al creador de la orden o al mesero asignado
                const isMyOrder = loggedInUser && (
                    Number(hydrated.createdByUserId) === Number(loggedInUser.id) ||
                    Number(hydrated.waiterId) === Number(loggedInUser.id)
                );

                if (justBecomeReady && isMyOrder) {
                    const mesaInfo = hydrated.table ? `Mesa ${hydrated.table.name}` : hydrated.type;
                    const orderNum = hydrated.dailyOrderNumber ? `#${String(hydrated.dailyOrderNumber).padStart(3, '0')}` : '';

                    setNotificationTitle('🍳 PEDIDO LISTO');
                    setNotificationMessage(`Orden ${orderNum} de ${mesaInfo} está lista para servir.`);
                    setNotificationType('warning'); // Naranja
                    setNotificationPosition('center');
                    setNotificationPersistent(true);

                    // Feedback háptico opcional si es soportado (Patrón pulsado)
                    if (navigator.vibrate) navigator.vibrate([300, 100, 300, 100, 300]);
                }

                return prev.map(o => String(o.id) === String(updatedOrder.id) ? hydrated : o);
            });
        };

        const handleOrderDeleted = ({ id }: { id: string }) => {
            setOrders(prev => prev.filter(o => o.id !== id));
            if (activeOrderId === id) {
                setActiveOrderId(null);
                setCurrentView('start');
            }
        };

        const handleAutoCloseWarning = (data: { branchId: number; branchName: string; minutesLeft: number; pendingOrders: number }) => {
            // Only notify if user is in the affected branch
            const myBranchId = selectedBranchId || userRef.current?.branchId || 1;
            if (Number(data.branchId) !== Number(myBranchId)) return;

            setNotificationTitle('⚠️ CIERRE AUTOMÁTICO PRÓXIMO');
            setNotificationMessage(`La caja se cerrará automáticamente en ${data.minutesLeft} minutos. Tienes ${data.pendingOrders} pedidos pendientes.`);
            setNotificationType('error'); // Rojo/Fuerte
            setNotificationPosition('center');
            setNotificationPersistent(true);

            // Haptic feedback
            if (navigator.vibrate) navigator.vibrate([500, 200, 500]);
        };

        socket.on('new_order', handleNewOrder);
        socket.on('order_updated', handleOrderUpdated);
        socket.on('order_deleted', handleOrderDeleted);
        socket.on('auto_close_warning', handleAutoCloseWarning);

        return () => {
            socket.off('new_order', handleNewOrder);
            socket.off('order_updated', handleOrderUpdated);
            socket.off('order_deleted', handleOrderDeleted);
            socket.off('auto_close_warning', handleAutoCloseWarning);
        };
    }, [hydrateOrder, activeOrderId, loggedInUser]);

    // Handle browser back button (Android native back)
    useEffect(() => {
        // Push current view and STATE to history when it changes
        const currentPath = `/${currentView}`;
        const state = { view: currentView, orderId: activeOrderId };

        // Avoid pushing duplicate states if we just popped
        if (JSON.stringify(window.history.state) !== JSON.stringify(state)) {
            // If we are going back to start from order, maybe we should replaceState to keep stack clean?
            // For now, let's just push to ensure history works as expected
            window.history.pushState(state, '', currentPath);
        }

        // Listen for back button
        const handlePopState = (event: PopStateEvent) => {
            // CRITICAL: If we are currently on START, DELIVERY, or KDS, any back action should trigger Exit Confirm
            if (['start', 'delivery', 'kds', 'admin'].includes(currentView)) {
                window.history.pushState({ view: currentView }, '', `/${currentView}`);
                setShowExitConfirm(true);
                return;
            }

            if (event.state) {
                if (event.state.view) {
                    // PRO EXIT FLOW: If user is in MENU and goes back, ask to exit
                    if (currentView === 'menu') {
                        if (loggedInUser) {
                            setCurrentView('start');
                            window.history.replaceState({ view: 'start' }, '', '/start');
                        } else {
                            // Push state back to prevent immediate exit from browser history
                            window.history.pushState({ view: 'menu' }, '', '/menu');
                            setShowExitConfirm(true);
                        }
                        return;
                    }

                    if (event.state.view === 'order' && !event.state.orderId) {
                        // Corrupted state -> Start
                        setCurrentView('start');
                        window.history.replaceState({ view: 'start' }, '', '/start');
                    } else {
                        setCurrentView(event.state.view);
                        if (event.state.orderId) setActiveOrderId(event.state.orderId);
                    }
                } else {
                    setCurrentView('start');
                }
            } else {
                // No state (root) -> Start + Exit Confirm if likely at root
                setCurrentView('start');
                setShowExitConfirm(true);
            }
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [currentView, activeOrderId, loggedInUser]);

    // --- CASH OPENING AUTOMATION ---
    useEffect(() => {
        const checkCashOpening = () => {
            if (!loggedInUser || !isInitialLoadComplete || currentView === 'select_branch') return;
            const isAdmin = loggedInUser.currentRole === UserRole.Admin || loggedInUser.currentRole === UserRole.SuperAdmin;
            if (!isAdmin) return;

            const isSuperAdmin = loggedInUser.allRoles.includes(UserRole.SuperAdmin);

            // For SuperAdmins, we ONLY check if they have EXPLICITLY selected a branch
            // For normal Admins, we can fallback to their assigned branchId
            const branchId = selectedBranchId || (!isSuperAdmin ? loggedInUser.branchId : null);

            if (!branchId) return; // SuperAdmin MUST select a branch first

            // Buscamos si hay alguna apertura OPEN (de cualquier fecha, porque un turno puede cruzar medianoche)
            const openForBranch = cashClosingReports.filter(r => 
                Number(r.branchId) === Number(branchId) && r.status === 'OPEN'
            );

            const openingExists = openForBranch.length > 0;

            // console.log(`[Caja Check] Branch: ${branchId}, Found: ${branchReports.length}, Latest Status: ${latestForBranch?.status}, OpeningExists: ${openingExists}`);

            if (!openingExists && !isCashOpeningSilenced) {
                const now = Date.now();
                // Every 5 minutes (300,000ms)
                if (now - lastCashReminderTime > 300000) {
                    setShowCashOpeningModal(true);
                    setLastCashReminderTime(now);
                }
            } else {
                // Si ya existe la apertura o está silenciado, cerramos el modal
                if (openingExists) {
                    setShowCashOpeningModal(false);
                }
            }
        };

        // Check on mount/login and then periodically
        checkCashOpening();
        const interval = setInterval(checkCashOpening, 60000); // Check every minute
        return () => clearInterval(interval);
    }, [loggedInUser, cashClosingReports, selectedBranchId, lastCashReminderTime, currentView]);

    const handleSaveCashOpening = async (amount: number, dateStr?: string, branchIdOverride?: number) => {
        const todayStr = dateStr || getElSalvadorDateString();
        const branchId = branchIdOverride || selectedBranchId || loggedInUser?.branchId;

        if (!branchId) {
            toast.error('Selecciona una sucursal primero');
            return;
        }

        const report: CashClosingReport = {
            date: todayStr,
            branchId,
            createdAt: new Date(),
            initialCash: amount,
            totalSales: 0,
            totalCashIn: 0,
            totalChangeOut: 0,
            expectedCash: amount,
            summary: [],
            totalOrders: 0
        };

        try {
            const saved = await api.saveCashClosing(report, false);
            setCashClosingReports(prev => {
                const exists = prev.some(r => r.date === saved.date && r.branchId === saved.branchId);
                if (exists) return prev.map(r => (r.date === saved.date && r.branchId === saved.branchId) ? saved : r);
                return [...prev, saved];
            });
            toast.success('Apertura de caja registrada');
            setShowCashOpeningModal(false);
        } catch (e) {
            toast.error('Error al registrar apertura');
            throw e;
        }
    };

    // Safety Guard: If we are in 'order' view but have no activeOrder, redirect to start
    // This catches cases where state update timing might be off or history is corrupted
    // Safety Guard: If directly landed on order without ID (not via popstate), prompt exit or redirect
    useEffect(() => {
        if (currentView === 'order' && !activeOrderId) {
            console.warn("Safety Redirect: Order view without ID -> Start + Confirm Exit");
            setCurrentView('start');
            window.history.replaceState({ view: 'start' }, '', '/start');
            // If this happens, it might be a weird state, let's offer exit just in case, but maybe just start is enough?
            // User requested: "if user in that screen [Start] presses back... show alert"
            // This guard handles the "Error" screen appearance.
            // Let's just go safely to Start. The back button logic above handles the "Press Back" action.
        }
    }, [currentView, activeOrderId]);

    const safeOrders = Array.isArray(orders) ? orders : [];
    const safeWaiters = Array.isArray(waiters) ? waiters : [];
    const safeTables = Array.isArray(tables) ? tables : [];
    const safeBranches = Array.isArray(branches) ? branches : [];

    const currentBranch = useMemo(() => safeBranches.find(b => b.id === selectedBranchId) || null, [safeBranches, selectedBranchId]);

    const activeSession = useMemo(() => {
        if (!selectedBranchId) return null;
        // Buscamos el reporte más reciente que esté como OPEN para esta sucursal
        return [...cashClosingReports]
            .sort((a, b) => (b.id || 0) - (a.id || 0))
            .find(r => r.branchId === selectedBranchId && r.status === 'OPEN');
    }, [cashClosingReports, selectedBranchId]);

    const isCurrentUserAdmin = loggedInUser?.allRoles.includes(UserRole.Admin) || loggedInUser?.allRoles.includes(UserRole.SuperAdmin) || false;

    const redigitatedActiveOrdersCount = useMemo(() => {
        if (!isCurrentUserAdmin) return 0;
        return safeOrders.filter(o =>
            o.status === 'active' &&
            o.cashReportId != null &&
            redigitatedSessionIds.has(o.cashReportId) &&
            (o.branchId || 1) === selectedBranchId
        ).length;
    }, [safeOrders, redigitatedSessionIds, selectedBranchId, isCurrentUserAdmin]);

    const filteredOrders = useMemo(() => {
        if (!selectedBranchId) return [];
        
        const isAdmin = isCurrentUserAdmin;
        const todaySessionFilter = [...cashClosingReports]
            .sort((a, b) => (b.id || 0) - (a.id || 0))
            .find(r => r.branchId === selectedBranchId && r.status === 'OPEN');

        // --- LOCAL DATE HELPER ---
        const todayStrForCompare = getElSalvadorDateString();

        return safeOrders.filter(o => {
            const isMyBranch = (o.branchId || 1) == selectedBranchId;

            // --- LÓGICA DE TURNOS (SESIONES) ---
            const redigitationSession = redigitationMode ? { id: redigitationMode.cashReportId, date: redigitationMode.date } as any : null;
            const sessionToUse = redigitationMode ? redigitationSession : (isAdmin && !showRedigitatedOrders ? todaySessionFilter : activeSession);
            const isFromActiveSession = sessionToUse && o.cashReportId === sessionToUse.id;
            const isActive = o.status === 'active';
            const isSameDateAsActiveSession = sessionToUse && formatToElSalvadorDate(o.createdAt) === sessionToUse.date && (!o.cashReportId || o.cashReportId === sessionToUse.id);
            const isToday = formatToElSalvadorDate(o.createdAt) === todayStrForCompare;
            const belongsToOtherSession = o.cashReportId && (!sessionToUse || o.cashReportId !== sessionToUse.id);

            // --- Si no es admin, mostrar todo (comportamiento original, sin filtro de redigitadas) ---
            if (!isAdmin) {
                return isMyBranch && (isActive || isFromActiveSession || isSameDateAsActiveSession || (isToday && !belongsToOtherSession));
            }

            // --- Admin: lógica de redigitadas ---
            const isRedigitated = isActive && o.cashReportId != null && redigitatedSessionIds.has(o.cashReportId);

            if (redigitationMode) {
                return isMyBranch && (isActive || isFromActiveSession || isSameDateAsActiveSession || (isToday && !belongsToOtherSession));
            }

            if (showRedigitatedOrders) {
                return isMyBranch && isRedigitated;
            }

            return isMyBranch && (isActive || isFromActiveSession || isSameDateAsActiveSession || (isToday && !belongsToOtherSession)) && !isRedigitated;
        });
    }, [safeOrders, selectedBranchId, activeSession, showRedigitatedOrders, redigitationMode, redigitatedSessionIds, isCurrentUserAdmin, cashClosingReports]);

    const activeOrders = useMemo(() => filteredOrders.filter(o => o.status === 'active'), [filteredOrders]);
    const completedOrders = useMemo(() => filteredOrders.filter(o => o.status === 'completed'), [filteredOrders]);
    // Changed: activeOrder now searches in ALL filteredOrders (active + completed) allows viewing completed orders (e.g. for ticket modal)
    // Safety: Normalizing comparison to string to avoid blue screen crash
    const activeOrder = useMemo(() => {
        const found = filteredOrders.find(o => String(o.id) === String(activeOrderId));
        // Fallback: si no está en filteredOrders (ej. vista de redigitadas activa y la orden es normal), buscamos en safeOrders
        if (!found && activeOrderId) {
            return safeOrders.find(o => String(o.id) === String(activeOrderId)) || null;
        }
        return found || null;
    }, [filteredOrders, activeOrderId, safeOrders]);
    const orderToEdit = useMemo(() => filteredOrders.find(o => String(o.id) === String(orderToEditId)), [filteredOrders, orderToEditId]);
    const filteredTables = useMemo(() => safeTables.filter(t => (t.branchId || 1) === selectedBranchId), [safeTables, selectedBranchId]);
    const filteredTableAreas = useMemo(() => tableAreas.filter(a => (a.branch_id || 1) === selectedBranchId), [tableAreas, selectedBranchId]);

    // INITIAL DATA FETCH AND SESSION RESTORE HAS BEEN UNIFIED IN THE TOP-LEVEL useEffect

    // ... (rest of code) ...

    const handleLogin = async (pin: string) => {
        try {
            const user = await api.login(pin);
            if (user) {
                const roles = user.roles || [];
                const preferredRole = roles.includes(UserRole.SuperAdmin) ? UserRole.SuperAdmin :
                    roles.includes(UserRole.Admin) ? UserRole.Admin :
                        roles.includes(UserRole.Cook) ? UserRole.Cook :
                            roles.includes(UserRole.Delivery) ? UserRole.Delivery :
                                roles.includes(UserRole.Cashier) ? UserRole.Cashier :
                                    UserRole.Waiter;

                const userObj = { id: user.id || 0, username: user.name, currentRole: preferredRole, allRoles: roles };

                // --- WELCOME TRANSITION ---
                setLoginName(user.name);
                await new Promise(resolve => setTimeout(resolve, 1500));

                const isSuperAdmin = roles.includes(UserRole.SuperAdmin);

                // 1. DETERMINE TARGET VIEW BEFORE SETTING USER STATE
                let initialView: CurrentView = 'start';
                if (isSuperAdmin) {
                    initialView = 'select_branch';
                } else if (preferredRole === UserRole.Admin) {
                    initialView = 'admin';
                } else if (preferredRole === UserRole.Cook) {
                    initialView = 'kds';
                } else if (preferredRole === UserRole.Delivery) {
                    initialView = 'delivery';
                }

                // 2. SET VIEW AND USER STATE TOGETHER (Pre-emptively)
                setCurrentView(initialView);
                if (isSuperAdmin) {
                    setSelectedBranchId(null);
                    localStorage.removeItem('selectedBranchId');
                }

                setLoggedInUser(userObj);
                localStorage.setItem('restauranteos_user', JSON.stringify(userObj)); // SAVE SESSION
                setLoginName(null); // Reset for next time

                const finalBranchId = (!isSuperAdmin && user.branchId) || selectedBranchId;
                if (!isSuperAdmin && user.branchId) {
                    setSelectedBranchId(user.branchId);
                    localStorage.setItem('selectedBranchId', user.branchId.toString());
                }

                // REFRESH DATA
                await fetchAllData(true, 0, userObj, finalBranchId);

                // Auto-update: check after login
                checkAndApplyUpdate((msg, duration) => toast(msg, { duration }));
                initAppVersionSync(
                    (msg, duration) => toast(msg, { duration }),
                    socket
                );

                setLoginErrorCount(0);

                if (!isSuperAdmin && user.branchId) {
                    const assignedBranch = safeBranches.find(b => b.id === user.branchId && b.isActive);
                    if (assignedBranch) {
                        // Ensure history state reflects the final view
                        window.history.replaceState({ view: initialView }, '', `/${initialView}`);
                        navigateToRoleDefault(preferredRole);
                    }
                } else if (isSuperAdmin) {
                    window.history.replaceState({ view: 'select_branch' }, '', '/select_branch');
                } else {
                    navigateToRoleDefault(preferredRole);
                }
            } else {
                setLoginErrorCount(prev => prev + 1);
                toast.error('PIN INCORRECTO');
            }
        } catch (error: any) {
            console.error("Login Error:", error);
            // Treat server rejections (like 401 Invalid PIN) as a regular failed attempt
            setLoginErrorCount(prev => prev + 1);
            toast.error('PIN INCORRECTO');
        }
    };

    const navigateToRoleDefault = (role: UserRole) => {
        if ([UserRole.SuperAdmin, UserRole.Admin].includes(role)) setCurrentView('admin');
        else if (role === UserRole.Cook) setCurrentView('kds');
        else if (role === UserRole.Delivery) setCurrentView('delivery');
        else setCurrentView('start');
    };

    const handleBranchSelect = async (branchId: number) => {
        setSelectedBranchId(branchId);
        localStorage.setItem('selectedBranchId', String(branchId));

        // Fetch all data for this branch immediately
        await fetchAllData(false, 0, loggedInUser || undefined, branchId);

        // NAVEGACIÓN POST-SELECCIÓN:
        if (loggedInUser?.allRoles.includes(UserRole.SuperAdmin)) {
            setCurrentView('admin');
        } else {
            setCurrentView('start');
        }
    };

    const handleLogout = () => {
        setLoggedInUser(null);
        setLoginName(null);
        setLoginErrorCount(0);
        setSelectedBranchId(null);
        localStorage.removeItem('selectedBranchId');
        localStorage.removeItem('restauranteos_user'); // CLEAR SESSION
        localStorage.removeItem('currentView'); // CLEAR VIEW PERSISTENCE
        setCurrentView('start');
        window.location.reload();
    };

    const handleUpdateCustomerEmail = async (customerId: number, email: string) => {
        try {
            const cleanEmail = email.toLowerCase().trim();
            // @ts-ignore
            await api.updateCustomer(customerId, { email: cleanEmail });

            // Update local customers state
            setCustomers(prev => prev.map(c => c.id === customerId ? { ...c, email: cleanEmail } : c));

            // Update active orders for this customer
            setOrders(prev => prev.map(o => o.customer?.id === customerId ? { ...o, customer: { ...o.customer, email: cleanEmail } } : o));

            console.log(`[CUSTOMER] Email updated for ID ${customerId}: ${cleanEmail}`);
        } catch (e) {
            console.error("Failed to update customer email", e);
            toast.error("Error al guardar el correo");
        }
    };

    const createNewOrder = async (details: OrderDetails) => {
        // Al crear una orden nueva, salir de la vista de redigitadas para que se vea en la lista
        setShowRedigitatedOrders(false);
        if (isCashOpeningMissing && !isCurrentUserAdmin) {
            toast.error('❌ CAJA CERRADA: SOLICITA LA APERTURA AL ADMINISTRADOR PARA CONTINUAR', { duration: 5000, icon: '⚠️' });
            return;
        }
        const branchId = selectedBranchId || loggedInUser?.branchId;
        if (!branchId) return;
        setShowNewOrderWizard(false);

        // Sanitize details to ensure no undefined values
        const sanitizedDetails = {
            ...details,
            waiterId: details.waiterId || null,
            tableId: details.tableId || null,
            customerId: details.customerId || null,
            deliveryDriverId: details.deliveryDriverId || null,
        };

        const newOrder: Order = {
            id: `ORD-${Date.now()}`,
            branchId: branchId,
            dailyOrderNumber: 0,
            ...sanitizedDetails,
            createdByUserId: loggedInUser!.id,
            items: details.initialItems || [],
            subtotal: 0,
            tax: 0,
            discount: 0,
            deliveryFee: details.type === OrderType.Delivery ? 1.00 : 0,
            total: details.type === OrderType.Delivery ? 1.00 : 0,
            createdAt: new Date(),
            status: 'active',
            kitchenStatus: undefined,
            payments: [],
            amountPaid: 0,
            changeGiven: 0,
            // Ensure other optional fields are null if not present
            chef: null,
            completedAt: null,
            readyAt: null,
            cashReportId: redigitationMode?.cashReportId || null
        };

        // Recalculate totals if items exist
        if (newOrder.items.length > 0) {
            const subtotal = newOrder.items.reduce((acc, item) => acc + item.total, 0);
            newOrder.subtotal = subtotal;
            newOrder.total = subtotal + (newOrder.deliveryFee || 0); // No tax/discount logic yet for initial items
        }

        // Update state optimistically (with 0 or temp number), but we should wait for response ideally for the number.
        // However, to keep UI snappy, we show it immediately. The number might be 0 momentarily.
        // Or we could trigger a loading state. 
        // Better: Wait for API response to set the final number in the UI, but navigate immediately.

        setOrders(prev => {
            const updated = [newOrder, ...prev]; // Add to TOP

            // Fix: Set Ref immediately for race condition safety
            pendingOrderRef.current = newOrder.id;

            // Fix: Navigate after state update to ensure order exists in context
            setTimeout(() => {
                setActiveOrderId(newOrder.id);
                setCurrentView('order');
            }, 0);
            return updated;
        });

        try {
            const response = await api.createOrder(newOrder);
            if (response && response.dailyOrderNumber) {
                // Finally, update the state with the potentially hydrated order
                // Use hydrateOrder to ensure consistency
                // Merge server response (dailyOrderNumber) with optimistic order
                // IMPORTANT: Server only returns { message, dailyOrderNumber }, NOT the full order!
                // We MUST preserve items, id, etc. from newOrder.
                const updatedOrder = {
                    ...newOrder,
                    dailyOrderNumber: response.dailyOrderNumber
                };

                const hydrated = hydrateOrder(updatedOrder);
                setOrders(prev => prev.map(o => String(o.id) === String(newOrder.id) ? hydrated : o));

                // Do NOT update activeOrderId here, because ID is persistent (ORD-...)
                // Just update the visible number via state update above.
                console.log(`[SYNC] Confirmed dailyOrderNumber: ${response.dailyOrderNumber} for Order ${newOrder.id}`);
            }
        } catch (error) {
            console.error("Failed to create order:", error);
            toast.error("Error al crear la orden. Intente de nuevo.");
            // Rollback optimistic update on failure? Or let user retry?
            // Ideally we should remove it from the list if it failed to persist.
            setOrders(prev => prev.filter(o => o.id !== newOrder.id));
        }
    };

    const handleUpdateDeliveryFee = useCallback((orderId: string, fee: number) => {
        setOrders(prev => prev.map(o => {
            if (o.id === orderId) {
                const subtotal = o.items.reduce((s, i) => s + i.total, 0);
                const newTotal = subtotal + fee - (o.discount || 0);

                // Persist to backend immediately
                api.updateOrder(orderId, { deliveryFee: fee, total: newTotal }).catch(console.error);

                return { ...o, deliveryFee: fee, total: newTotal };
            }
            return o;
        }));
    }, []);

    const handleForceCloseAll = async (ordersToClose: Order[]) => {
        if (!ordersToClose.length) return;

        try {
            await Promise.all(ordersToClose.map(o => {
                // FORCE CLOSE LOGIC:
                // 1. Calculate full amount
                // 2. Add payment record (Cash) so it counts in report
                const fullAmount = o.total || 0;
                const cashPayment: Payment = {
                    method: 'Efectivo' as PaymentMethod, // Explicit cast to avoid import runtime issues
                    amount: fullAmount
                };

                return api.updateOrder(o.id, {
                    status: 'completed',
                    completedAt: new Date(),
                    payments: [cashPayment], // Overwrite/Set payments
                    amountPaid: fullAmount,
                    changeGiven: 0
                });
            }));

            await fetchAllData(); // Refresh data from server
            toast.success('PEDIDOS CERRADOS Y COBRADOS EN EFECTIVO');
        } catch (error) {
            console.error("Error force closing orders:", error);
            toast.error('ERROR AL CERRAR PEDIDOS');
        }
    };

    const handleUpdateKitchenStatus = async (orderId: string, status: KitchenStatus, chef?: string) => {
        const order = orders.find(o => o.id === orderId);
        if (!order) return;

        const updatedOrder = { ...order, kitchenStatus: status, chef: chef || order.chef };

        // Optimistic update
        setOrders(prev => prev.map(o => o.id === orderId ? updatedOrder : o));

        try {
            await api.updateOrder(orderId, { kitchenStatus: status, chef: chef || order.chef });
        } catch (e) {
            console.error(e);
        }
    };

    const handleDeleteOrder = async (orderId: string, adminUserId: number, reason: string) => {
        // Optimistic update
        setOrders(prev => prev.filter(o => String(o.id) !== String(orderId)));

        try {
            await api.deleteOrder(orderId, adminUserId, reason);
            toast.success('PEDIDO ELIMINADO CORRECTAMENTE');
        } catch (error) {
            console.error("Failed to delete order:", error);
            toast.error('ERROR AL ELIMINAR PEDIDO');
            fetchAllData(); // Restore if failed
        }
    };

    const handleToggleItemCompletion = async (orderId: string, itemId: string) => {
        const order = orders.find(o => o.id === orderId);
        if (!order) return;

        const updatedItems = order.items.map(i => i.id === itemId ? { ...i, completed: !i.completed } : i);
        const updatedOrder = { ...order, items: updatedItems };

        setOrders(prev => prev.map(o => o.id === orderId ? updatedOrder : o));

        try {
            await api.updateOrder(orderId, { items: updatedItems });
        } catch (e) { console.error(e); }
    };

    const handleCreateCustomer = async (customer: Customer): Promise<Customer> => {
        try {
            const result = await api.createCustomer(customer);
            return result;
        } catch (e) {
            console.error("Failed to create customer", e);
            throw e;
        }
    };

    const isCashOpeningMissing = useMemo(() => {
        if (!loggedInUser) return false;

        // Si aún no hemos terminado la carga inicial de datos, no bloqueamos
        // Esto previene falsos positivos de "caja cerrada" por falta de internet
        if (!isInitialLoadComplete && cashClosingReports.length === 0) return false;

        const branchId = selectedBranchId || loggedInUser.branchId;
        if (!branchId) return false;

        const openForBranch = [...cashClosingReports]
            .filter(r => Number(r.branchId) === Number(branchId) && r.status === 'OPEN');

        return openForBranch.length === 0;
    }, [loggedInUser, cashClosingReports, selectedBranchId, isInitialLoadComplete]);

    const handleStartNewOrder = () => {
        if (isCashOpeningMissing && !isCurrentUserAdmin) {
            toast.error('❌ CAJA CERRADA: SOLICITA LA APERTURA AL ADMINISTRADOR PARA CONTINUAR', {
                duration: 5000,
                icon: '⚠️',
            });
            return;
        }
        setShowNewOrderWizard(true);
        setCurrentView('start');
    };

    const handleToggleRedigitatedOrders = useCallback(() => {
        setShowRedigitatedOrders(prev => !prev);
    }, []);

    const handleStartRedigitation = (session: { cashReportId: number; date: string; branchId: number }) => {
        setRedigitationMode(session);
        setRedigitatedSessionIds(prev => {
            const next = new Set(prev).add(session.cashReportId);
            localStorage.setItem('redigitatedSessions', JSON.stringify([...next]));
            return next;
        });
        setShowRedigitatedOrders(false);
        setCurrentView('start');
        toast.success(`🔴 MODO REDIGITACIÓN ACTIVADO - Fecha: ${session.date}`, { duration: 4000 });
    };

    const handleExitRedigitation = () => {
        setRedigitationMode(null);
        setShowRedigitatedOrders(false);
        toast('✅ MODO REDIGITACIÓN DESACTIVADO', { duration: 2000 });
    };

    const renderContent = () => {

        switch (currentView) {
            case 'start': return <StartScreen
                key={startScreenKey}
                onStartOrder={createNewOrder}
                activeOrders={activeOrders}
                onSelectOrder={id => { setShowNewOrderWizard(false); setActiveOrderId(String(id)); setCurrentView('order'); }}
                onShowCompleted={() => { setShowNewOrderWizard(false); setCurrentView('completed'); }}
                onShowActive={() => { setShowNewOrderWizard(false); setCurrentView('active_orders_mobile'); }}
                onManageCustomers={() => { setShowNewOrderWizard(false); setCurrentView('manage_customers'); }}
                waiters={safeWaiters}
                tables={filteredTables}
                tableAreas={tableAreas}
                customers={customers}
                setCustomers={setCustomers}
                orderToEdit={orderToEdit}
                onUpdateOrder={d => {
                    const wasDelivery = orderToEdit?.type === OrderType.Delivery;
                    const isNowDelivery = d.type === OrderType.Delivery;

                    let deliveryFee = 0;
                    if (isNowDelivery) {
                        deliveryFee = wasDelivery ? (orderToEdit?.deliveryFee ?? 1.00) : 1.00;
                    }

                    const subtotal = orderToEdit?.items.reduce((acc, item) => acc + item.total, 0) || 0;
                    const total = Math.max(0, subtotal + deliveryFee - (orderToEdit?.discount || 0) - (orderToEdit?.manualDiscount || 0));

                    const updatedOrder = { ...orderToEdit!, ...d, deliveryFee, total };
                    const hydrated = hydrateOrder(updatedOrder);
                    setOrders(prev => prev.map(o => o.id === orderToEditId ? hydrated : o));

                    // Persist header changes to Backend immediately
                    api.updateOrder(orderToEditId!, {
                        ...d,
                        waiterId: d.waiter?.id,
                        tableId: d.table?.id,
                        customerId: d.customer?.id,
                        deliveryFee,
                        total
                    }).catch(console.error);

                    setActiveOrderId(orderToEditId);
                    setOrderToEditId(null);
                    setCurrentView('order');
                }}
                onCancelEdit={() => { setActiveOrderId(orderToEditId); setOrderToEditId(null); setCurrentView('order'); }}
                onDeleteOrder={handleDeleteOrder}
                onCreateCustomer={handleCreateCustomer}
                products={products}
                meats={meats}
                productExtras={productExtras}
                branches={safeBranches}
                currentBranchId={selectedBranchId}
                initialIsCreating={showNewOrderWizard}
                companySettings={companySettings}
                onUpdateCustomerEmail={handleUpdateCustomerEmail}
                isCashOpeningMissing={isCashOpeningMissing}
                isAdmin={isCurrentUserAdmin}
                redigitationMode={redigitationMode}
                onExitRedigitation={handleExitRedigitation}
                showRedigitatedOrders={showRedigitatedOrders}
                onToggleRedigitatedOrders={handleToggleRedigitatedOrders}
                redigitatedActiveOrdersCount={redigitatedActiveOrdersCount}
            />;
            case 'order': return activeOrder ? <OrderScreen
                order={activeOrder}
                currentUser={loggedInUser}
                productAvailability={productAvailability}
                updateOrder={(id, items) => {
                    let newKitchenStatus = activeOrder.kitchenStatus;

                    // KDS RE-OPENING LOGIC: If KDS items changed and it was ready/served, reopen it
                    const kdsItemsIncreased = items.some(newItem => {
                        if (newItem.product.showInKds === false) return false;
                        const oldItem = activeOrder.items.find(i => i.id === newItem.id);
                        if (!oldItem) return true; // New KDS item
                        return newItem.quantity > oldItem.quantity; // KDS item quantity increased
                    });

                    if (kdsItemsIncreased && (activeOrder.kitchenStatus === 'ready' || activeOrder.kitchenStatus === 'served' || !activeOrder.kitchenStatus)) {
                        console.log('🔄 Re-opening KDS ticket due to new/increased KDS items');
                        newKitchenStatus = 'pending';
                    }

                    // Calculate Promotions
                    const discounts = calculatePromotions(items, promotions);
                    const discountTotal = discounts.reduce((s, d) => s + d.amount, 0);

                    const updatedOrder = {
                        ...activeOrder,
                        items,
                        kitchenStatus: newKitchenStatus as KitchenStatus,
                        discount: discountTotal, // Add this so it saves to DB
                        manualDiscount: activeOrder.manualDiscount || 0,
                        total: Math.max(0, items.reduce((s, i) => s + i.total, 0) + (activeOrder.deliveryFee || 0) - discountTotal - (activeOrder.manualDiscount || 0))
                    };

                    setOrders(prev => prev.map(o => String(o.id) === String(id) ? updatedOrder : o));

                    // Debounced Save to Backend
                    if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
                    updateTimeoutRef.current = setTimeout(() => {
                        // Inject User ID for tracking
                        const payload = { ...updatedOrder, userId: loggedInUser?.id };
                        api.updateOrder(id, payload).catch(e => {
                            console.error("Auto-save failed", e);
                            toast.error(`ERROR AL GUARDAR: ${e.message}`, { duration: 4000 });
                        });
                    }, 1000);

                }} onCompleteOrder={async (id, payments, change, manualDiscount, serviceCharge, cardCommission) => {
                    const finalDiscounts = calculatePromotions(activeOrder!.items, promotions);
                    const finalDiscountTotal = finalDiscounts.reduce((s, d) => s + d.amount, 0);
                    const finalTotal = Math.max(0, activeOrder!.items.reduce((s, i) => s + i.total, 0) + (activeOrder!.deliveryFee || 0) - finalDiscountTotal);

                    const updatedOrder = {
                        ...activeOrder!,
                        status: 'completed' as const,
                        completedAt: new Date(),
                        payments,
                        amountPaid: payments.reduce((s, p) => s + p.amount, 0),
                        changeGiven: change,
                        total: finalTotal,
                        discount: finalDiscountTotal,
                        manualDiscount: manualDiscount || activeOrder?.manualDiscount || 0,
                        serviceCharge: serviceCharge || activeOrder?.serviceCharge || 0,
                        cardCommission: cardCommission || activeOrder?.cardCommission || 0,
                        cashReportId: activeOrder?.cashReportId || activeSession?.id,
                        // SECURITY: Mark all current items as completed (paid)
                        items: activeOrder!.items.map(item => ({ ...item, completed: true }))
                    };
                    setOrders(prev => prev.map(o => String(o.id) === String(id) ? updatedOrder : o));
                    setActiveOrderId(null);
                    setCurrentView('start');

                    try {
                        const payload = { ...updatedOrder, userId: loggedInUser?.id };
                        await api.updateOrder(id, payload);
                    } catch (e) { console.error("Failed to complete order", e); }
                    // @ts-ignore
                }} onBackToStart={() => { setShowNewOrderWizard(false); setCurrentView('start'); }} onStartNewOrder={() => { setActiveOrderId(null); setShowNewOrderWizard(true); setCurrentView('start'); }} onEditOrderHeader={id => { setOrderToEditId(id); setCurrentView('start'); }} categories={categories} products={products} meats={meats} productExtras={productExtras} updateDeliveryFee={handleUpdateDeliveryFee} productPopularity={productPopularity} companySettings={companySettings} onUpdateCustomerEmail={handleUpdateCustomerEmail} branches={safeBranches} promotions={promotions} waiters={safeWaiters} redigitationMode={redigitationMode} onExitRedigitation={handleExitRedigitation} />
                : <div className="flex flex-col items-center justify-center h-screen bg-gray-950 px-6 text-center">
                    <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-6"></div>
                    <h2 className="text-xl font-black text-white italic uppercase tracking-tighter mb-2">
                        CARGANDO <span className="text-amber-500">ORDEN...</span>
                    </h2>
                    <button
                        onClick={() => { setCurrentView('start'); }}
                        className="mt-8 text-xs font-bold text-gray-500 hover:text-white uppercase tracking-widest transition-colors"
                    >
                        CANCELAR Y VOLVER
                    </button>
                </div>;
            case 'admin': return <AdminPanel waiters={safeWaiters} setWaiters={setWaiters} tables={safeTables} setTables={setTables} meats={meats} setMeats={setMeats} categories={categories} setCategories={setCategories} productExtras={productExtras} setProductExtras={setProductExtras} products={products} setProducts={setProducts} orders={filteredOrders} cashClosingReports={cashClosingReports} setCashClosingReports={setCashClosingReports} onOpenMasterSettings={() => setCurrentView('master_settings')} isSuperAdmin={loggedInUser?.allRoles.includes(UserRole.SuperAdmin) || false} branches={safeBranches} setBranches={setBranches} currentBranchId={selectedBranchId} customers={customers} setCustomers={setCustomers} currentAdminName={loggedInUser?.username || ''} onForceClose={handleForceCloseAll} promotions={promotions} setPromotions={setPromotions} observationTags={observationTags} setObservationTags={setObservationTags} tableAreas={tableAreas} setTableAreas={setTableAreas} currentUser={loggedInUser} companySettings={companySettings} setCompanySettings={setCompanySettings} isCashOpeningMissing={isCashOpeningMissing} onOpenCashOpening={() => setShowCashOpeningModal(true)} onOpenRedigitation={() => setCurrentView('redigitate')} redigitationMode={redigitationMode} onExitRedigitation={handleExitRedigitation} />;
            case 'completed': return <CompletedOrdersScreen orders={completedOrders} onBack={() => setCurrentView('start')} onNewOrder={() => { setActiveOrderId(null); setCurrentView('start'); }} companySettings={companySettings} onUpdateCustomerEmail={handleUpdateCustomerEmail} branches={safeBranches} />;
            case 'active_orders_mobile': return <ActiveOrdersMobileScreen orders={activeOrders} onBack={() => setCurrentView('start')} onSelectOrder={id => { setActiveOrderId(id); setCurrentView('order'); }} currentUserRole={loggedInUser?.currentRole || UserRole.Waiter} currentUserId={loggedInUser?.id} />;
            case 'kds': return <KdsScreen activeOrders={activeOrders.map(o => ({ ...o, items: o.items.filter(i => i.product?.showInKds !== false) }))} completedOrders={completedOrders.map(o => ({ ...o, items: o.items.filter(i => i.product?.showInKds !== false) }))} updateOrderKitchenStatus={handleUpdateKitchenStatus} toggleOrderItemCompletion={handleToggleItemCompletion} waiters={safeWaiters} />;
            case 'tables': return <TableMonitorScreen activeOrders={activeOrders} tables={filteredTables} tableAreas={filteredTableAreas} onNavigate={setCurrentView} onSelectOrder={(orderId) => { setActiveOrderId(orderId); setCurrentView('order'); }} onNewOrder={handleStartNewOrder} />;
            case 'master_settings':
                if (loggedInUser?.id !== 1) return <div className="flex-1 flex items-center justify-center bg-gray-900 text-white font-black uppercase italic">Acceso Restringido</div>;
                return <MasterSettingsScreen settings={companySettings} setSettings={setCompanySettings} onBack={() => setCurrentView('admin')} currentUser={loggedInUser} branches={safeBranches} onDataCleared={() => fetchAllData(true)} />;
            case 'redigitate': return (
                <RedigitationScreen
                    branchId={selectedBranchId || loggedInUser?.branchId || 1}
                    onSelectSession={handleStartRedigitation}
                    onBack={() => setCurrentView('admin')}
                />
            );
            case 'manage_customers': return <ManageCustomersScreen customers={customers} setCustomers={setCustomers} onBack={() => setCurrentView('start')} />;
            case 'feedback': return <FeedbackScreen companyName={companySettings.name} />;
            case 'delivery': return <DeliveryDashboard currentUser={loggedInUser ? { id: loggedInUser.id, username: loggedInUser.username } : undefined} currentBranchId={selectedBranchId} userRole={loggedInUser?.currentRole} onLogout={handleLogout} companyName={companySettings.name} staff={safeWaiters} />;
            case 'menu': return <CustomerPortal products={products} categories={categories} branches={branches} isLoggedIn={!!loggedInUser} onBack={() => setCurrentView('start')} />;
            case 'select_branch': return <BranchSelectionScreen branches={branches.filter(b => b.isActive)} onSelectBranch={handleBranchSelect} onLogout={handleLogout} />;
            default: return null;
        }
    };

    // --- RENDER LOGIC ---

    const GlobalToaster = (
        <Toaster
            position="top-center"
            reverseOrder={false}
            toastOptions={{
                style: {
                    background: 'rgba(17, 24, 39, 0.7)', // Gray-900 with transparency
                    backdropFilter: 'blur(4px)',
                    color: '#fff',
                    border: '1px solid rgba(52, 211, 153, 0.5)',
                    padding: '12px 24px',
                    borderRadius: '9999px',
                    boxShadow: '0 0 20px rgba(52, 211, 153, 0.2)',
                    fontWeight: '900',
                    textTransform: 'uppercase',
                    fontStyle: 'italic',
                    fontSize: '14px',
                    letterSpacing: '0.05em'
                },
                success: {
                    style: {
                        border: '1px solid rgba(52, 211, 153, 0.5)',
                        color: '#34d399',
                        boxShadow: '0 0 20px rgba(52, 211, 153, 0.3)'
                    },
                    iconTheme: { primary: '#34d399', secondary: '#064e3b' }
                },
                error: {
                    style: {
                        border: '1px solid rgba(244, 63, 94, 0.5)',
                        color: '#fb7185',
                        boxShadow: '0 0 20px rgba(244, 63, 94, 0.3)'
                    },
                    iconTheme: { primary: '#fb7185', secondary: '#4c0519' }
                },
                loading: {
                    style: {
                        border: '1px solid rgba(59, 130, 246, 0.5)',
                        color: '#60a5fa',
                        boxShadow: '0 0 20px rgba(59, 130, 246, 0.3)'
                    }
                }
            }}
        />
    );

    // FORCED ISOLATION: Public views ('menu' and 'feedback') SHOULD NEVER render the admin header
    // even if a user is logged in. This ensures a clean customer experience.
    if (currentView === 'feedback' || currentView === 'menu') return (
        <>
            {GlobalToaster}
            {currentView === 'feedback' ? (
                <FeedbackScreen companyName={companySettings.name} />
            ) : (
                <CustomerPortal products={products} categories={categories} branches={branches} isLoggedIn={!!loggedInUser} onBack={() => setCurrentView('start')} />
            )}
        </>
    );

    // --- MAIN ADMIN APP CONTAINER ---
    if (!loggedInUser) return (
        <>
            {GlobalToaster}
            <LoginScreen onLogin={handleLogin} loginErrorCount={loginErrorCount} companySettings={companySettings} successName={loginName || undefined} />
        </>
    );



    return (
        <div className="flex flex-col h-screen bg-gray-950 text-white overflow-hidden selection:bg-amber-500/30">
            {isOffline && (
                <div className="bg-red-600 text-white text-[10px] font-black uppercase tracking-widest py-1 text-center animate-pulse z-[60]">
                    ⚠️ SIN CONEXIÓN A INTERNET - MODO LECTURA ⚠️
                </div>
            )}
            <Header
                currentView={currentView}
                onNavigate={v => {
                    setShowNewOrderWizard(false);
                    if (v === 'start') {
                        setCurrentView('start');
                        setStartScreenKey(prev => prev + 1);
                        setOrderToEditId(null);
                    } else {
                        setCurrentView(v);
                    }
                }}
                onLogout={handleLogout}
                allUserRoles={loggedInUser.allRoles}
                branchName={branches.find(b => b.id === selectedBranchId)?.name}
                onInstallApp={window.matchMedia('(display-mode: standalone)').matches ? undefined : handleInstallApp}
                companySettings={companySettings}
                branches={branches.filter(b => b.isActive)}
                currentBranchId={selectedBranchId}
                onBranchChange={handleBranchSelect}
            />
            <main className="flex-1 pt-14 sm:pt-16 overflow-hidden flex flex-col">
                {renderContent()}
            </main>
            <NotificationToast
                title={notificationTitle || undefined}
                message={lastSyncError || notificationMessage}
                type={lastSyncError ? 'error' : notificationType}
                onClose={() => {
                    if (lastSyncError) setLastSyncError(null);
                    setNotificationMessage(null);
                    setNotificationPersistent(false);
                    setNotificationPosition('bottom');
                }}
                persistent={lastSyncError ? true : notificationPersistent}
                position={lastSyncError ? 'top' : notificationPosition}
            />

            <ExitConfirmationModal
                isOpen={showExitConfirm}
                onClose={() => setShowExitConfirm(false)}
                onConfirm={() => {
                    setShowExitConfirm(false);
                    if ((currentView === 'menu' || currentView === 'feedback') && !loggedInUser) {
                        // Redirect to Google for "Pro" exit flow (Only for guests)
                        window.location.href = 'https://google.com';
                    } else {
                        // Staff or nested views -> Logout or just go to start
                        if (currentView === 'menu' || currentView === 'feedback') {
                            setCurrentView('start');
                        } else {
                            handleLogout();
                        }
                    }
                }}
            />
            {GlobalToaster}

            {/* PWA INSTALLATION INSTRUCTIONS MODAL */}
            {showInstallInstructions && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center z-[110] p-4">
                    <div className="bg-gray-900 border border-amber-500/30 rounded-[40px] p-8 w-full max-w-sm shadow-2xl animate-in zoom-in duration-300 space-y-6">
                        <div className="text-center space-y-2">
                            <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">Instalar App</h3>
                            <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest italic">Guía de instalación manual</p>
                        </div>

                        <div className="space-y-4 py-2">
                            <div className="flex gap-4 items-start">
                                <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 font-black text-amber-500">1</div>
                                <p className="text-xs text-gray-300 leading-relaxed font-bold uppercase tracking-tight">
                                    Toca los <span className="text-white">tres puntos (⋮)</span> o el icono de <span className="text-white">Compartir (↑)</span> de tu navegador.
                                </p>
                            </div>
                            <div className="flex gap-4 items-start">
                                <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 font-black text-amber-500">2</div>
                                <p className="text-xs text-gray-300 leading-relaxed font-bold uppercase tracking-tight">
                                    Busca la opción <span className="text-white">"Instalar App"</span> o <span className="text-white">"Añadir a pantalla de inicio"</span>.
                                </p>
                            </div>
                            <div className="flex gap-4 items-start">
                                <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 font-black text-amber-500">3</div>
                                <p className="text-xs text-gray-300 leading-relaxed font-bold uppercase tracking-tight">
                                    Confirma y <span className="text-white">FunkyFood</span> aparecerá en tu menú de aplicaciones de inmediato.
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={() => setShowInstallInstructions(false)}
                            className="w-full py-4 bg-amber-600 text-white rounded-2xl font-black text-xs uppercase italic tracking-widest active:scale-95 shadow-lg shadow-amber-950/20 transition-all"
                        >
                            ENTENDIDO, GRACIAS
                        </button>
                    </div>
                </div>
            )}

            <CashOpeningModal
                isOpen={showCashOpeningModal}
                onClose={() => setShowCashOpeningModal(false)}
                onSave={handleSaveCashOpening}
                onSilence={() => {
                    setIsCashOpeningSilenced(true);
                    setShowCashOpeningModal(false);
                    toast('Recordatorios silenciados por hoy', { icon: '🔕' });
                }}
                branchName={currentBranch?.name}
                isAdmin={loggedInUser?.allRoles.includes(UserRole.Admin) || loggedInUser?.allRoles.includes(UserRole.SuperAdmin)}
                isSuperAdmin={loggedInUser?.allRoles.includes(UserRole.SuperAdmin)}
                branches={safeBranches}
                currentBranchId={selectedBranchId || undefined}
            />
        </div>
    );
};

export default App;
