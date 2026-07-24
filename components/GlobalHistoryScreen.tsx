
import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { Order, OrderItem, Product, ProductExtra, Meat, User, Branch, OrderType, UserRole, Table } from '../types';
import TicketModal from './TicketModal';
import NotificationToast from './NotificationToast';
import { PlusIcon, UserGroupIcon, CalendarIcon, SearchIcon, RefreshIcon, CheckCircleIcon, ExclamationIcon } from './icons';
import { useDragScroll } from '../hooks/useDragScroll';

interface GlobalHistoryScreenProps {
    onBack: () => void;
    products: Product[];
    productExtras: ProductExtra[];
    meats: Meat[];
    users: User[];
    currentBranchId: number | null;
    branches: Branch[];
    tables: Table[];
    isSuperAdmin?: boolean;
}

const GlobalHistoryScreen: React.FC<GlobalHistoryScreenProps> = (props) => {
    // State
    const [orders, setOrders] = useState<Order[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showFilters, setShowFilters] = useState(window.innerWidth > 768); // Show by default on desktop
    const [toast, setToast] = useState<{ message: string | null; title?: string; type: 'success' | 'error' | 'info' }>({ message: null, type: 'info' });

    // Filters
    const now = new Date();
    // Fix: Use local time construction to avoid UTC shifts
    const toLocalISO = (d: Date) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const firstDay = toLocalISO(new Date(now.getFullYear(), now.getMonth(), 1));
    const today = toLocalISO(now);

    const [startDate, setStartDate] = useState(firstDay);
    const [endDate, setEndDate] = useState(today);
    const [search, setSearch] = useState('');
    const [offset, setOffset] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const LIMIT = 100;

    // Drag Scroll
    const dragScroll = useDragScroll();

    // Selection
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null); // For viewing ticket
    const [orderToClone, setOrderToClone] = useState<Order | null>(null); // For cloning flow
    const [cloneWaiterId, setCloneWaiterId] = useState<number | null>(null);
    const [cloneOrderType, setCloneOrderType] = useState<OrderType>(OrderType.Restaurant);
    const [cloneTableId, setCloneTableId] = useState<number | null>(null);

    useEffect(() => {
        if (orderToClone) {
            setCloneOrderType(orderToClone.type);
            setCloneTableId(null);
        }
    }, [orderToClone]);

    // Fetch History
    const fetchHistory = async (isLoadMore = false) => {
        if (!isLoadMore) {
            setIsLoading(true);
            setOffset(0);
        }

        try {
            const currentOffset = isLoadMore ? offset : 0;
            const data = await api.getHistory({
                startDate,
                endDate: endDate + ' 23:59:59', // Include full end day
                search,
                limit: LIMIT,
                offset: currentOffset,
                branchId: props.currentBranchId || undefined,
                isSuperAdmin: props.isSuperAdmin
            });

            // If we have proper data, check length
            if (data && Array.isArray(data)) {
                if (data.length < LIMIT) setHasMore(false);
                else setHasMore(true);

                if (isLoadMore) {
                    setOrders(prev => [...prev, ...data]);
                    setOffset(prev => prev + LIMIT);
                } else {
                    setOrders(data);
                    setOffset(LIMIT);
                }
            } else {
                setHasMore(false);
            }

        } catch (e: any) {
            console.error(e);
            setToast({ message: 'Error cargando historial: ' + (e.message || 'Error desconocido'), title: 'ERROR DE CARGA', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleLoadMore = () => {
        fetchHistory(true);
    };

    // Initial Load & Debounce
    useEffect(() => {
        setOffset(0);
        setHasMore(true);
        const timeout = setTimeout(() => fetchHistory(false), 500);
        return () => clearTimeout(timeout);
    }, [startDate, endDate, search, props.currentBranchId]);

    // Helpers
    const formatCurrency = (amount: number) => '$' + Number(amount || 0).toFixed(2);
    const formatDate = (dateStr: string) => new Date(dateStr).toLocaleString('es-ES', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    // Cloning Logic
    const handleCloneOrder = async () => {
        if (!orderToClone || !cloneWaiterId) return;

        try {
            const originalOrder = orderToClone;

            // Map Items with CURRENT prices
            const newItems: OrderItem[] = [];

            originalOrder.items.forEach(oldItem => {
                const currentProduct = props.products.find(p => p.id === oldItem.productId);
                if (!currentProduct) return; // Skip if product deleted

                // Map Extras
                const currentExtras: ProductExtra[] = [];
                if (oldItem.extras) {
                    oldItem.extras.forEach(e => {
                        const currentExtra = props.productExtras.find(pe => pe.id === e.id);
                        if (currentExtra) currentExtras.push(currentExtra);
                    });
                }

                // Map Meat
                let currentMeat: Meat | undefined;
                if (oldItem.meat) {
                    currentMeat = props.meats.find(m => m.id === oldItem.meat!.id);
                }

                // Calc New Total
                const extrasPrice = currentExtras.reduce((sum, e) => sum + e.price, 0);
                const unitPrice = currentProduct.price + extrasPrice;
                const total = unitPrice * oldItem.quantity;

                newItems.push({
                    id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                    product: currentProduct,
                    quantity: oldItem.quantity,
                    meat: currentMeat,
                    extras: currentExtras,
                    total: total,
                    observations: oldItem.observations, // Preserve notes
                    completed: false // Reset kitchen status
                });
            });

            if (newItems.length === 0) {
                setToast({ message: 'No se pudieron recuperar los productos (quizás fueron eliminados).', title: 'IMPOSIBLE CLONAR', type: 'error' });
                return;
            }

            const total = newItems.reduce((sum, i) => sum + i.total, 0);

            // Create Order Object
            const newOrder: Order = {
                id: `ORD-${Date.now()}`, // Temp ID
                dailyOrderNumber: 0, // Server assigns
                branchId: props.currentBranchId || 1,
                customer: originalOrder.customer,
                waiter: props.users.find(u => u.id === cloneWaiterId) as any,
                table: cloneOrderType === OrderType.Restaurant && cloneTableId ? props.tables.find(t => t.id === cloneTableId) : undefined,
                status: 'active',
                type: cloneOrderType,
                items: newItems,
                total: total,
                subtotal: total,
                tax: 0,
                discount: 0,
                deliveryFee: 0,
                createdAt: new Date(),
                payments: [],
                kitchenStatus: 'pending',
                amountPaid: 0,
                changeGiven: 0
            };

            await api.createOrder(newOrder);
            setToast({
                message: `Asignado a: ${props.users.find(u => u.id === cloneWaiterId)?.name}`,
                title: '¡PEDIDO CLONADO!',
                type: 'success'
            });
            setOrderToClone(null);
            setCloneWaiterId(null);
            fetchHistory(); // Refresh to see new order? (It will be Active/Today)

        } catch (e) {
            console.error(e);
            setToast({ message: 'No se pudo clonar el pedido. Intenta de nuevo.', title: 'ERROR', type: 'error' });
        }
    };

    return (
        <div className="flex flex-col h-full bg-gray-900 overflow-hidden animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex justify-between items-center p-6 border-b border-gray-800 shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={props.onBack} className="p-3 bg-gray-800 rounded-full hover:bg-gray-700 active:scale-90 transition-all border border-gray-700">
                        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <div>
                        <h1 className="text-3xl font-black text-white italic uppercase tracking-tighter">HISTORIAL <span className="text-amber-500">GLOBAL</span></h1>
                        <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">CONSULTA Y RECUPERACIÓN DE PEDIDOS</p>
                    </div>
                </div>
                <button 
                    onClick={() => setShowFilters(!showFilters)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all active:scale-95 font-black uppercase text-[10px] tracking-widest shadow-lg ${showFilters ? 'bg-amber-600 text-white border-amber-500' : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-amber-500/50'}`}
                >
                    <SearchIcon className="w-4 h-4" />
                    <span>{showFilters ? 'OCULTAR FILTROS' : 'MOSTRAR FILTROS'}</span>
                </button>
            </div>

            {/* Filters */}
            <div className={`overflow-hidden transition-all duration-300 ease-in-out ${showFilters ? 'max-h-[500px] opacity-100 p-4 border-b border-gray-800' : 'max-h-0 opacity-0 p-0 overflow-hidden'}`}>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-gray-900/50">
                <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest ml-1">DESDE</label>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white font-bold outline-none focus:border-amber-500" />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest ml-1">HASTA</label>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white font-bold outline-none focus:border-amber-500" />
                </div>
                <div className="space-y-1 md:col-span-2">
                    <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest ml-1">BUSCAR (CLIENTE / ID / TEL)</label>
                    <div className="relative">
                        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Ej: Juan Perez, 7777-8888, P-123..."
                            className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-12 pr-4 py-3 text-white font-bold outline-none focus:border-amber-500 placeholder-gray-600 uppercase"
                        />
                    </div>
                </div>
            </div>
        </div>

            {/* Table */}
            <div
                {...dragScroll}
                className={`flex-1 overflow-auto p-4 scrollbar-hide ${dragScroll.isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
            >
                {isLoading && orders.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                        <RefreshIcon className="w-10 h-10 text-amber-500 animate-spin" />
                    </div>
                ) : (
                    <>
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="text-left text-[10px] text-gray-500 uppercase tracking-widest border-b border-gray-800">
                                    <th className="pb-3 pl-4">ID</th>
                                    <th className="pb-3">FECHA</th>
                                    <th className="pb-3">CLIENTE</th>
                                    <th className="pb-3">MESERO</th>
                                    <th className="pb-3 text-right">TOTAL</th>
                                    <th className="pb-3 text-right pr-4">ACCIONES</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800/50">
                                {orders.map(order => (
                                    <tr key={order.id} className="group hover:bg-gray-800/30 transition-colors">
                                        <td className="py-4 pl-4 font-mono text-amber-500 font-bold text-sm">
                                            {order.dailyOrderNumber ? `P-${String(order.dailyOrderNumber).padStart(3, '0')}` : '---'}
                                            <div className="text-[9px] text-gray-600">{order.id}</div>
                                        </td>
                                        <td className="py-4 text-xs font-bold text-gray-300">
                                            {formatDate(order.createdAt)}
                                        </td>
                                        <td className="py-4">
                                            <div className="uppercase font-black text-xs text-white tracking-tight">{order.customer_name || order.customer?.name || 'MOSTRADOR'}</div>
                                            {(order.customer_phone || order.customer?.phone) && <div className="text-[10px] text-gray-500 font-mono tracking-widest">{order.customer_phone || order.customer?.phone}</div>}
                                        </td>
                                        <td className="py-4 text-xs font-bold text-gray-400 uppercase">
                                            {order.waiter_name || order.waiter?.name || 'ADMIN'}
                                        </td>
                                        <td className="py-4 text-right">
                                            <div className="font-black text-white text-sm tracking-tighter">{formatCurrency(order.total)}</div>
                                            <div className={`text-[9px] font-black uppercase tracking-widest ${order.status === 'completed' ? 'text-green-500' : 'text-gray-500'}`}>{order.status}</div>
                                        </td>
                                        <td className="py-4 text-right pr-4">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => !dragScroll.isDragging && setSelectedOrder(order)}
                                                    className="bg-gray-800 hover:bg-gray-700 text-white p-2 rounded-lg border border-gray-700 active:scale-90 transition-all shadow-lg"
                                                    title="Ver Ticket"
                                                >
                                                    <div className="w-4 h-4 flex items-center justify-center font-serif font-black text-xs">T</div>
                                                </button>
                                                <button
                                                    onClick={() => !dragScroll.isDragging && setOrderToClone(order)}
                                                    className="bg-gray-800 hover:bg-amber-600 hover:text-white text-amber-500 p-2 rounded-lg border border-gray-700 hover:border-amber-500 active:scale-90 transition-all shadow-lg"
                                                    title="CLONAR PEDIDO"
                                                >
                                                    <RefreshIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {orders.length === 0 && !isLoading && (
                                    <tr>
                                        <td colSpan={6} className="py-20 text-center opacity-30">
                                            <SearchIcon className="w-16 h-16 mx-auto mb-4 text-gray-500" />
                                            <p className="font-black uppercase italic text-xs tracking-widest">NO SE ENCONTRARON PEDIDOS</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>

                        {/* LOAD MORE */}
                        {hasMore && (
                            <div className="py-8 text-center">
                                <button
                                    onClick={handleLoadMore}
                                    disabled={isLoading}
                                    className="px-6 py-3 bg-gray-800 text-gray-400 font-black uppercase text-[10px] tracking-widest rounded-full hover:bg-gray-700 hover:text-white transition-all active:scale-95 disabled:opacity-50"
                                >
                                    {isLoading ? 'CARGANDO...' : 'VER MÁS PEDIDOS ANTIUQOS'}
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Ticket Modal */}
            {selectedOrder && (
                <TicketModal
                    order={selectedOrder}
                    onClose={() => setSelectedOrder(null)}
                    companySettings={props.companySettings}
                    branches={props.branches}
                    onNewOrder={() => setSelectedOrder(null)} // In history, maybe just close?
                    onUpdateCustomerEmail={() => { }} // No-op for now unless we want to allow updating email from history
                />
            )}

            {/* Clone Modal */}
            {orderToClone && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[200] p-4">
                    <div className="bg-gray-900 w-full max-w-md rounded-[32px] p-8 border border-gray-800 shadow-2xl animate-in zoom-in duration-300">
                        <div className="text-center mb-8">
                            <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-4 ring-1 ring-amber-500/20">
                                <RefreshIcon className="w-8 h-8 text-amber-500" />
                            </div>
                            <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter mb-2">CLONAR PEDIDO</h3>
                            <p className="text-sm text-gray-400 font-bold uppercase tracking-widest">
                                {orderToClone.customer?.name || 'MOSTRADOR'} • {formatCurrency(orderToClone.total)}
                            </p>
                        </div>

                        <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl mb-6">
                            <div className="flex gap-3">
                                <ExclamationIcon className="w-5 h-5 text-amber-500 shrink-0" />
                                <p className="text-[11px] text-amber-200/80 font-bold leading-tight uppercase tracking-wide">
                                    Se creará un NUEVO pedido con los precios ACTUALES. Selecciona quién atenderá este pedido.
                                </p>
                            </div>
                        </div>

                        <div className="space-y-2 mb-8">
                            <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest ml-1">ASIGNAR A MESERO/CAJERO</label>
                            <select
                                value={cloneWaiterId || ''}
                                onChange={e => setCloneWaiterId(Number(e.target.value))}
                                className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl px-4 py-4 text-white font-black uppercase outline-none focus:border-amber-500 appearance-none text-sm tracking-wide"
                            >
                                <option value="">--- SELECCIONAR PERSONAL ---</option>
                                {props.users.filter(u => u.roles.includes(UserRole.Waiter) || u.roles.includes(UserRole.Cashier) || u.roles.includes(UserRole.Admin)).map(u => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Service Type Selection */}
                        <div className="space-y-2">
                            <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest ml-1">TIPO DE SERVICIO</label>
                            <select
                                value={cloneOrderType}
                                onChange={e => setCloneOrderType(e.target.value as OrderType)}
                                className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl px-4 py-4 text-white font-black uppercase outline-none focus:border-amber-500 appearance-none text-sm tracking-wide"
                            >
                                <option value={OrderType.Restaurant}>PARA COMER AQUÍ</option>
                                <option value={OrderType.Takeaway}>PARA LLEVAR</option>
                                <option value={OrderType.Pickup}>CLIENTE RETIRA</option>
                                <option value={OrderType.Delivery}>DOMICILIO</option>
                            </select>
                        </div>

                        {/* Table Selection */}
                        {cloneOrderType === OrderType.Restaurant && (
                            <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest ml-1">SELECCIONAR MESA</label>
                                <select
                                    value={cloneTableId || ''}
                                    onChange={e => setCloneTableId(Number(e.target.value))}
                                    className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl px-4 py-4 text-white font-black uppercase outline-none focus:border-amber-500 appearance-none text-sm tracking-wide"
                                >
                                    <option value="">-- SELECCIONAR MESA --</option>
                                    {props.tables.filter(t => t.branchId === props.currentBranchId).map(t => (
                                        <option key={t.id} value={t.id}>{t.name} ({t.seats} asientes)</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4 mt-8">
                            <button onClick={() => { setOrderToClone(null); setCloneWaiterId(null); }} className="p-4 bg-gray-800 text-gray-400 font-black rounded-[20px] uppercase text-[10px] tracking-widest active:scale-95 transition-all">
                                CANCELAR
                            </button>
                            <button
                                onClick={handleCloneOrder}
                                disabled={!cloneWaiterId || (cloneOrderType === OrderType.Restaurant && !cloneTableId)}
                                className="p-4 bg-green-600 disabled:bg-gray-800 disabled:text-gray-600 text-white font-black rounded-[20px] uppercase text-[10px] tracking-widest active:scale-95 transition-all shadow-lg shadow-green-900/20 disabled:shadow-none disabled:cursor-not-allowed"
                            >
                                GENERAR PEDIDO
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <NotificationToast
                message={toast.message}
                title={toast.title}
                type={toast.type}
                onClose={() => setToast({ ...toast, message: null })}
                persistent={toast.type === 'error'} // Errors stick around
            />
        </div>
    );
};

export default GlobalHistoryScreen;
