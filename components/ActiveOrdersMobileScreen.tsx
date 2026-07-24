import React, { useState, useRef } from 'react';
import { Toast } from './ui_alerts';
import PinVerificationModal from './PinVerificationModal';
import { Order, UserRole } from '../types';
import { TrashIcon } from './icons';
import { api } from '../api';
import { useDragScroll } from '../hooks/useDragScroll';
import { toast } from 'react-hot-toast';

interface ActiveOrdersMobileScreenProps {
    orders: Order[];
    onBack: () => void;
    onSelectOrder: (orderId: string) => void;
    currentUserRole: UserRole;
    currentUserId?: number;
}

const ActiveOrdersMobileScreen: React.FC<ActiveOrdersMobileScreenProps> = ({ orders, onBack, onSelectOrder, currentUserRole, currentUserId }) => {
    const isAdmin = currentUserRole === UserRole.Admin || currentUserRole === UserRole.SuperAdmin;
    const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);
    const [toastMessage, setToastMessage] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'TODOS' | string>('TODOS');

    // --- DRAG TO SCROLL ---
    const dragScroll = useDragScroll();

    // --- TABS DRAG SCROLL LOGIC ---
    const tabsScrollRef = useRef<HTMLDivElement>(null);
    const [isTabsDragging, setIsTabsDragging] = useState(false);
    const [tabsStartX, setTabsStartX] = useState(0);
    const [tabsScrollLeft, setTabsScrollLeft] = useState(0);

    const handleTabsMouseDown = (e: React.MouseEvent) => {
        if (!tabsScrollRef.current) return;
        setIsTabsDragging(true);
        setTabsStartX(e.pageX - tabsScrollRef.current.offsetLeft);
        setTabsScrollLeft(tabsScrollRef.current.scrollLeft);
    };

    const handleTabsMouseLeave = () => {
        setIsTabsDragging(false);
    };

    const handleTabsMouseMove = (e: React.MouseEvent) => {
        if (!isTabsDragging || !tabsScrollRef.current) return;
        e.preventDefault();
        const x = e.pageX - tabsScrollRef.current.offsetLeft;
        const walk = (x - tabsStartX) * 2; // Scroll-fast
        tabsScrollRef.current.scrollLeft = tabsScrollLeft - walk;
    };

    // --- PULL TO REFRESH LOGIC ---
    const [startY, setStartY] = useState(0);
    const [pullOffset, setPullOffset] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const PULL_THRESHOLD = 80;

    const handleTouchStart = (e: React.TouchEvent) => {
        if (dragScroll.ref.current && dragScroll.ref.current.scrollTop === 0) {
            setStartY(e.touches[0].pageY);
        }
        dragScroll.onTouchStart(e);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (startY > 0 && !isRefreshing) {
            const currentY = e.touches[0].pageY;
            const diff = currentY - startY;
            if (diff > 0) {
                setPullOffset(Math.min(diff * 0.5, PULL_THRESHOLD + 20));
                // If pulling down, don't trigger drag scroll to avoid double movement
                return;
            }
        }
        dragScroll.onTouchMove(e);
    };

    const handleTouchEnd = async () => {
        if (pullOffset >= PULL_THRESHOLD) {
            setIsRefreshing(true);
            setPullOffset(PULL_THRESHOLD);

            try {
                toast('Actualizando aplicación...', { icon: '🔄' });
                if ('caches' in window) {
                    const cacheNames = await caches.keys();
                    await Promise.all(cacheNames.map(name => caches.delete(name)));
                }
                if (navigator.serviceWorker) {
                    const regs = await navigator.serviceWorker.getRegistrations();
                    for (let reg of regs) { await reg.unregister(); }
                }
                setTimeout(() => window.location.reload(), 800);
            } catch (err) {
                console.error("Refresh failed", err);
                setIsRefreshing(false);
                setPullOffset(0);
            }
        } else {
            setPullOffset(0);
        }
        setStartY(0);
        dragScroll.onTouchEnd();
    };

    const handleDeleteClick = (orderId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setDeletingOrderId(orderId); // Use this to track which order is being verified
    };

    const handlePinSuccess = async (adminUser: any) => {
        if (!deletingOrderId) return;

        const orderIdToDelete = deletingOrderId;

        try {
            await api.deleteOrder(
                orderIdToDelete,
                adminUser.id,
                `Eliminado manualmente por Admin: ${adminUser.name}`
            );
            toast.success('PEDIDO ELIMINADO CORRECTAMENTE');
        } catch (error: any) {
            console.error('Failed to delete order:', error);
            if (error.message && (error.message.includes('404') || error.message.includes('Not Found'))) {
                toast.success('PEDIDO FANTASMA DETECTADO. LIMPIANDO...');
                setTimeout(() => window.location.reload(), 1500);
            } else {
                toast.error('ERROR AL ELIMINAR PEDIDO');
            }
        } finally {
            setDeletingOrderId(null);
        }
    };

    const filterTabs = ['TODOS', 'RESTAURANTE', 'P. LLEVAR', 'DELIVERY', 'C. RETIRA'];

    const filteredOrders = orders
        .filter(order => {
            if (!order || !order.id) return false;

            // Date Filter (Security Check: Only Today)
            const orderDate = new Date(order.createdAt);
            const today = new Date();
            const isSameDay = orderDate.getDate() === today.getDate() &&
                orderDate.getMonth() === today.getMonth() &&
                orderDate.getFullYear() === today.getFullYear();

            if (!isSameDay) return false;

            // Type Filter
            if (activeTab !== 'TODOS') {
                let requiredType = activeTab;
                if (activeTab === 'RESTAURANTE') requiredType = 'Restaurante';
                if (activeTab === 'P. LLEVAR') requiredType = 'Para Llevar';
                if (activeTab === 'C. RETIRA') requiredType = 'Cliente Retira';
                if (activeTab === 'DELIVERY') requiredType = 'Delivery';

                if (order.type !== requiredType) return false;
            }

            // Search Filter
            if (!searchTerm) return true;
            const term = searchTerm.toLowerCase();
            const dailyId = String(order.dailyOrderNumber).padStart(3, '0');
            const customer = (order.customer?.name || 'CLIENTES VARIOS').toLowerCase();
            const table = (order.table?.name || '').toLowerCase();
            const waiter = (order.waiter?.name || '').toLowerCase();

            return dailyId.includes(term) || customer.includes(term) || table.includes(term) || waiter.includes(term);
        })
        .sort((a, b) => (b.dailyOrderNumber || 0) - (a.dailyOrderNumber || 0));

    return (
        <div
            ref={dragScroll.ref}
            className="h-screen overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto pb-32 relative select-none"
            onMouseDown={dragScroll.onMouseDown}
            onMouseMove={dragScroll.onMouseMove}
            onMouseUp={dragScroll.onMouseUp}
            onMouseLeave={dragScroll.onMouseLeave}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {/* Indicador de Pull-to-refresh */}
            <div
                className="absolute top-2 left-0 right-0 flex justify-center pointer-events-none transition-transform z-50"
                style={{ transform: `translateY(${pullOffset - 40}px)`, opacity: pullOffset / PULL_THRESHOLD }}
            >
                <div className={`bg-amber-500 p-2 rounded-full shadow-lg ${isRefreshing ? 'animate-spin' : ''}`}>
                    <svg viewBox="0 0 24 24" className="w-5 h-5 text-gray-900" fill="none" stroke="currentColor" strokeWidth="3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                    </svg>
                </div>
            </div>

            <header className="flex flex-col gap-4 mb-6">
                <div className="flex justify-between items-center">
                    <h1 className="text-2xl font-black text-white italic uppercase tracking-tighter">
                        PEDIDOS <span className="text-amber-500">ACTIVOS</span>
                    </h1>
                    <button
                        onClick={onBack}
                        className="bg-gray-800 text-gray-400 font-black text-[10px] uppercase tracking-widest py-2 px-4 rounded-xl border border-gray-700 active:scale-95 transition-transform"
                    >
                        &larr; VOLVER
                    </button>
                </div>

                {/* Search Bar */}
                <div className="relative">
                    <input
                        type="text"
                        placeholder="Buscar por #, Cliente, Mesa..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 text-white px-4 py-3 rounded-2xl focus:border-amber-500 focus:outline-none text-sm font-bold uppercase placeholder:normal-case placeholder:font-normal pl-11 shadow-inner"
                    />
                    <svg className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm('')}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>

                {/* Filter Tabs - Drag to Scroll Implemented */}
                <div
                    ref={tabsScrollRef}
                    onMouseDown={handleTabsMouseDown}
                    onMouseLeave={handleTabsMouseLeave}
                    onMouseUp={handleTabsMouseLeave}
                    onMouseMove={handleTabsMouseMove}
                    className={`flex gap-2 overflow-x-auto pb-2 scrollbar-hide px-1 cursor-grab active:cursor-grabbing select-none`}
                >
                    {['TODOS', 'RESTAURANTE', 'P. LLEVAR', 'DELIVERY', 'C. RETIRA'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => !isTabsDragging && setActiveTab(tab)}
                            className={`px-4 py-2 rounded-2xl font-black text-xs whitespace-nowrap transition-all flex-shrink-0 uppercase tracking-widest border-2 ${activeTab === tab
                                ? 'bg-amber-500 text-black shadow-lg border-transparent'
                                : 'bg-amber-500/10 text-white border-amber-500/30 hover:border-amber-500 hover:text-amber-500 hover:bg-amber-500/20'
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </header>

            {filteredOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 opacity-30 italic">
                    <p className="text-xl font-black uppercase tracking-tighter">
                        {searchTerm || activeTab !== 'TODOS' ? 'No se encontraron pedidos' : 'No hay pedidos activos'}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                    {filteredOrders.map(order => {
                        const total = Number(order.total);
                        const createdAt = order.createdAt instanceof Date ? order.createdAt : new Date(order.createdAt);
                        const isDeleting = deletingOrderId === order.id;

                        return (
                            <button
                                key={order.id}
                                onClick={() => onSelectOrder(order.id)}
                                disabled={isDeleting}
                                className={`p-2 bg-gray-800 border border-gray-700 rounded-2xl shadow-xl hover:bg-gray-750 active:scale-[0.98] transition-all text-left flex flex-col gap-0.5 group relative overflow-hidden ${isDeleting ? 'opacity-50 pointer-events-none' : ''}`}
                            >
                                {/* Delete Button for Admin */}
                                {isAdmin && (
                                    <div
                                        onClick={(e) => handleDeleteClick(order.id, e)}
                                        className="absolute top-1 right-1 bg-red-500/10 hover:bg-red-500 p-1 rounded-lg text-red-500 hover:text-white transition-colors z-10 opacity-0 group-hover:opacity-100"
                                        title="Eliminar Pedido"
                                    >
                                        <TrashIcon className="w-3.5 h-3.5" />
                                    </div>
                                )}

                                {/* Header Row: #Number + Chips */}
                                <div className="flex justify-between items-start w-full">
                                    <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0 pr-2">
                                        <span className="font-black text-cyan-400 text-[17px] tracking-tighter shrink-0">
                                            #{String(order.dailyOrderNumber).padStart(3, '0')}
                                        </span>

                                        {/* Chips Area */}
                                        <div className="flex flex-wrap items-center gap-1">
                                            <span className="px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/30 rounded text-[11px] font-black text-amber-500 uppercase italic">
                                                {order.type}
                                            </span>
                                            {order.table && (
                                                <span className="px-1.5 py-0.5 bg-blue-500/10 border border-blue-500/30 rounded text-[11px] font-black text-blue-400 uppercase">
                                                    {order.table.name}
                                                </span>
                                            )}
                                            {order.waiter && (
                                                <span className="px-1.5 py-0.5 bg-purple-500/10 border border-purple-500/30 rounded text-[11px] font-black text-purple-400 uppercase truncate max-w-[80px]">
                                                    {order.waiter.name.split(' ')[0]}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Total Price - Top Right Aligned */}
                                    <span className="text-white font-black text-xl tabular-nums tracking-tight shrink-0">
                                        ${total.toFixed(2)}
                                    </span>
                                </div>

                                {/* Secondary Row: Customer + Time */}
                                <div className="flex items-center justify-between gap-2 w-full pt-1">
                                    <span className="text-white font-bold text-base truncate uppercase leading-none">
                                        {order.customer?.name || 'CLIENTES VARIOS'}
                                    </span>

                                    <div className="flex items-center gap-1 shrink-0 bg-gray-900/40 px-1.5 py-0.5 rounded border border-gray-700/30">
                                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                                            {createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_5px_rgba(34,197,94,0.5)]"></div>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Reemplazamos ConfirmationModal con PinVerificationModal */}
            <PinVerificationModal
                isOpen={!!deletingOrderId}
                onClose={() => setDeletingOrderId(null)}
                onSuccess={handlePinSuccess}
                title="ELIMINAR PEDIDO"
                message="INGRESA PIN DE ADMINISTRADOR PARA CONFIRMAR ELIMINACIÓN"
                requiredRole={UserRole.Admin}
            />

            {toastMessage && (
                <Toast
                    message={toastMessage.msg}
                    type={toastMessage.type}
                    onClose={() => setToastMessage(null)}
                />
            )}
        </div>
    );
};

export default ActiveOrdersMobileScreen;

