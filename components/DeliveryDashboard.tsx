import React, { useState, useEffect, useRef, useMemo } from 'react';
import { api, socket } from '../api';
import { Order, OrderType } from '../types';
import DeliveryLayout from './DeliveryLayout';
import { toast } from 'react-hot-toast';
import { getElSalvadorDateString } from '../utils/dates';
import { formatCurrency } from '../utils/formatCurrency';
import { useDragScroll } from '../hooks/useDragScroll';

// Sub-components
import DeliveryCard from './DeliveryCard';

interface DeliveryDashboardProps {
    currentUser?: { id: number; username: string };
    currentBranchId?: number | null;
    userRole?: string;
    onLogout?: () => void;
    companyName?: string;
    staff?: { id: number; name: string }[];
}

import NotificationToast from './NotificationToast';

const DeliveryDashboard: React.FC<DeliveryDashboardProps> = ({ currentUser, currentBranchId, userRole, onLogout, companyName, staff = [] }) => {
    const { ref: scrollRef, ...dragHandlers } = useDragScroll();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const notificationAudioRef = useRef<HTMLAudioElement | null>(null);
    const [tab, setTab] = useState<'pending' | 'mine' | 'history'>('pending');

    const isAdmin = userRole === 'Administrador' || userRole === 'SuperAdmin';

    const fetchOrders = async () => {
        try {
            setLoading(true);

            // 1. Fetch Active Orders
            const activeData = await api.getOrders(currentBranchId || undefined, 'active');
            const activeDelivery = activeData.filter((o: Order) => o.type === OrderType.Delivery);

            // 2. Fetch History Orders (Today's Completed/Delivered)
            const today = getElSalvadorDateString();
            const historyData = await api.getDeliveryHistory({
                startDate: today,
                endDate: today,
                branchId: currentBranchId || undefined
            });

            // 3. Merge and Deduplicate (Active takes precedence)
            const allOrders = [...activeDelivery];
            historyData.forEach((hOrder: Order) => {
                if (!allOrders.find(a => a.id === hOrder.id)) {
                    allOrders.push(hOrder);
                }
            });

            setOrders(allOrders);
        } catch (error) {
            console.error(error);
            toast.error('Error cargando pedidos');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOrders();
        // Socket listeners remain the same... (Assuming new_order/update_order handles active mainly)

        const handleNewOrder = (order: Order) => {
            if (order.type === OrderType.Delivery) {
                setOrders(prev => {
                    if (prev.find(o => o.id === order.id)) return prev;
                    return [order, ...prev];
                });
            }
        };

        const handleUpdateOrder = (order: Order) => {
            if (order.type === OrderType.Delivery) {
                setOrders(prev => prev.map(o => o.id === order.id ? { ...o, ...order } : o));
            }
        };

        const handleDeleteOrder = ({ id }: { id: string }) => setOrders(prev => prev.filter(o => o.id !== id));

        socket.on('new_order', handleNewOrder);
        socket.on('order_updated', handleUpdateOrder);
        socket.on('order_deleted', handleDeleteOrder);

        return () => {
            socket.off('new_order', handleNewOrder);
            socket.off('order_updated', handleUpdateOrder);
            socket.off('order_deleted', handleDeleteOrder);
        };
    }, []);

    // Filter Logic
    const filteredOrders = useMemo(() => {
        return orders.filter(o => {
            if (tab === 'pending') return !o.deliveryDriverId; // Unassigned

            const isMine = currentUser ? Number(o.deliveryDriverId) === Number(currentUser.id) : !!o.deliveryDriverId;
            const canSee = isAdmin || isMine;

            if (tab === 'mine') {
                return canSee && o.deliveryStatus !== 'delivered';
            }
            if (tab === 'history') {
                return canSee && o.deliveryStatus === 'delivered';
            }
            return false;
        });
    }, [orders, tab, currentUser, isAdmin]);

    // Helper to get Driver Name
    const getDriverName = (id?: number) => {
        if (!id) return undefined;
        const user = staff.find(u => Number(u.id) === Number(id));
        return user?.name || `ID: ${id}`;
    };

    // Actions
    const handleTakeOrder = async (orderId: string) => {
        if (!currentUser) return toast.error('Error: Usuario no identificado');

        try {
            await api.updateOrder(orderId, {
                deliveryDriverId: currentUser.id,
                deliveryStatus: 'assigned'
            });

            // Optimistic Update
            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, deliveryDriverId: currentUser.id, deliveryStatus: 'assigned' } : o));
            toast.success('¡Pedido Tomado!');
        } catch (e) {
            console.error(e);
            toast.error('Error al tomar pedido');
        }
    };

    // ... handleDelivered remains similar ...


    const handleDelivered = async (orderId: string) => {
        const order = orders.find(o => o.id === orderId);

        // 1. Try GPS Capture (Best Effort)
        if (order?.customer?.id) {
            if (navigator.geolocation) {
                const toastId = toast.loading('Obteniendo ubicación GPS...');

                // Wrap in promise to use await
                const getPosition = () => new Promise<GeolocationPosition>((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, {
                        enableHighAccuracy: true,
                        timeout: 5000,
                        maximumAge: 0
                    });
                });

                try {
                    const pos = await getPosition();
                    const { latitude, longitude } = pos.coords;
                    await api.saveGPSAddress(Number(order.customer.id), latitude, longitude, order.deliveryAddressId);
                    toast.success('📍 Ubicación guardada', { id: toastId });
                } catch (geoErr: any) {
                    console.warn("GPS Fail:", geoErr);
                    let msg = 'No se capturó ubicación';
                    if (geoErr.code === 1) msg = 'GPS denegado por usuario';
                    else if (geoErr.code === 2) msg = 'GPS no disponible';
                    else if (geoErr.code === 3) msg = 'GPS Lento (Timeout)';

                    toast(msg, { icon: '⚠️', id: toastId });
                }
            } else {
                // Browser doesn't support or HTTP context
                toast.error('GPS no soportado (o falta HTTPS)');
            }
        }

        try {
            await api.updateOrder(orderId, {
                // status: 'completed', // DO NOT COMPLETE YET. Wait for cashier.
                deliveryStatus: 'delivered',
                // completedAt: new Date(), // Keep strictly for when money is collected
            });

            // Optimistic Update: Move to History Tab immediately
            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, deliveryStatus: 'delivered' } : o));

            toast.success('¡Marcado como Entregado! Pendiente de cobro en caja.');
        } catch (e) {
            toast.error('Error al finalizar');
        }
    };

    const enableAudio = () => {
        const audio = new Audio('/sounds/bell.mp3');
        audio.play().catch(() => { });
        toast.success('🔊 Audio Activado');
    };

    return (
        <DeliveryLayout onLogout={onLogout}>
            {/* Audio Enabler (Mobile users often need this) */}
            <div className="flex justify-end mb-2">
                <button onClick={enableAudio} className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded opacity-70 hover:opacity-100">
                    🔊 Probar/Activar Audio
                </button>
            </div>

            {/* Tabs */}
            <div className="flex space-x-2 mb-4 bg-slate-800 p-1 rounded-lg">
                <button
                    onClick={() => setTab('pending')}
                    className={`flex-1 py-2 text-center rounded-md font-medium transition-colors ${tab === 'pending' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                    Pendientes ({orders.filter(o => !o.deliveryDriverId).length})
                </button>
                <button
                    onClick={() => setTab('mine')}
                    className={`flex-1 py-2 text-center rounded-md font-medium transition-colors ${tab === 'mine' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                    En Ruta ({orders.filter(o => {
                        const isMine = currentUser ? Number(o.deliveryDriverId) === Number(currentUser.id) : !!o.deliveryDriverId;
                        return isMine && o.deliveryStatus !== 'delivered';
                    }).length})
                </button>
                <button
                    onClick={() => setTab('history')}
                    className={`flex-1 py-2 text-center rounded-md font-medium transition-colors ${tab === 'history' ? 'bg-green-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                    Entregados ({orders.filter(o => {
                        const isMine = currentUser ? Number(o.deliveryDriverId) === Number(currentUser.id) : !!o.deliveryDriverId;
                        return isMine && (o.deliveryStatus === 'delivered' || o.status === 'completed');
                    }).length})
                </button>
            </div>

            {/* List Container with Drag-to-Scroll */}
            <div
                ref={scrollRef}
                {...dragHandlers}
                className="flex-1 overflow-y-auto space-y-4 pr-1 select-none active:cursor-grabbing touch-pan-y"
                style={{ maxHeight: 'calc(100vh - 200px)' }}
            >
                {filteredOrders.length === 0 && (
                    <div className="text-center py-12 text-slate-500">
                        <p>{loading ? 'Cargando...' : 'No hay pedidos en esta sección'}</p>
                    </div>
                )}
                {filteredOrders.map(order => (
                    <DeliveryCard
                        key={order.id}
                        order={order}
                        onTake={() => handleTakeOrder(order.id)}
                        onDeliver={() => handleDelivered(order.id)}
                        isAssigned={!!order.deliveryDriverId}
                        companyName={companyName}
                        isDelivered={order.deliveryStatus === 'delivered'}
                        driverName={getDriverName(order.deliveryDriverId)}
                    />
                ))}
            </div>
        </DeliveryLayout>
    );
};

export default DeliveryDashboard;
