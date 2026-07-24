
import React, { useState, useRef } from 'react';
import { Order } from '../types';
import TicketModal from './TicketModal';
import { PlusIcon } from './icons';

interface CompletedOrdersScreenProps {
    orders: Order[];
    onBack: () => void;
    onNewOrder: () => void;
    companySettings: any;
    onUpdateCustomerEmail: (customerId: number, email: string) => void;
    branches: any[];
}

const CompletedOrdersScreen: React.FC<CompletedOrdersScreenProps> = ({ orders, onBack, onNewOrder, companySettings, onUpdateCustomerEmail, branches }) => {
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'TODOS' | string>('TODOS');

    // Drag-to-Scroll Logic
    const scrollRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startY, setStartY] = useState(0);
    const [scrollTop, setScrollTop] = useState(0);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!scrollRef.current) return;
        setIsDragging(true);
        setStartY(e.pageY - scrollRef.current.offsetTop);
        setScrollTop(scrollRef.current.scrollTop);
    };

    const handleMouseLeave = () => setIsDragging(false);
    const handleMouseUp = () => setIsDragging(false);

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !scrollRef.current) return;
        e.preventDefault();
        const y = e.pageY - scrollRef.current.offsetTop;
        const walk = (y - startY) * 2;
        scrollRef.current.scrollTop = scrollTop - walk;
    };

    // --- TABS HORIZONTAL DRAG SCROLL LOGIC ---
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

    const filterTabs = ['TODOS', 'RESTAURANTE', 'P. LLEVAR', 'DELIVERY', 'C. RETIRA'];

    // Ordenar por Numero de Pedido (Mayor a Menor)
    const sortedOrders = [...orders]
        .sort((a, b) => (b.dailyOrderNumber || 0) - (a.dailyOrderNumber || 0))
        .filter(order => {
            // Type Filter
            if (activeTab !== 'TODOS') {
                let requiredType = activeTab;
                if (activeTab === 'RESTAURANTE') requiredType = 'Restaurante';
                if (activeTab === 'P. LLEVAR') requiredType = 'Para Llevar';
                if (activeTab === 'C. RETIRA') requiredType = 'Cliente Retira';
                if (activeTab === 'DELIVERY') requiredType = 'Delivery';

                if (order.type !== requiredType) return false;
            }

            if (!searchTerm) return true;
            const term = searchTerm.toLowerCase();
            const orderIdStr = String(order.id).toLowerCase();
            const dailyIdStr = order.dailyOrderNumber ? String(order.dailyOrderNumber) : '';
            const customerName = (order.customer?.name || '').toLowerCase();
            const tableName = (order.table?.name || '').toLowerCase();
            const waiterName = (order.waiter?.name || '').toLowerCase();
            const typeStr = (order.type || '').toLowerCase();

            return orderIdStr.includes(term) ||
                dailyIdStr.includes(term) ||
                customerName.includes(term) ||
                tableName.includes(term) ||
                waiterName.includes(term) ||
                typeStr.includes(term);
        });

    return (
        <div
            className={`flex flex-col h-full bg-gray-950 overflow-hidden select-none`}
        >
            <header className="shrink-0 p-4 sm:p-6 bg-gray-900 border-b border-gray-800 shadow-2xl z-20">
                <div className="max-w-[1920px] mx-auto flex flex-col gap-4">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-2xl font-black text-white italic uppercase tracking-tighter">
                                PEDIDOS <span className="text-amber-500">FINALIZADOS</span>
                            </h1>
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">Historial de ventas del día actual</p>
                        </div>
                    </div>
    
                    <div className="relative w-full">
                        <input
                            type="text"
                            placeholder="Buscar por #, Cliente, Mesa..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-gray-950 border-2 border-gray-800 text-white px-4 py-3 pl-11 rounded-2xl focus:border-amber-500 focus:outline-none text-sm font-black uppercase placeholder:normal-case placeholder:font-bold placeholder:text-gray-600 shadow-inner transition-all"
                        />
                        <svg className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>

                    <div
                        ref={tabsScrollRef}
                        onMouseDown={handleTabsMouseDown}
                        onMouseLeave={handleTabsMouseLeave}
                        onMouseUp={handleTabsMouseLeave}
                        onMouseMove={handleTabsMouseMove}
                        className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide px-1 cursor-grab active:cursor-grabbing select-none"
                    >
                        {filterTabs.map((tab) => (
                            <button
                                key={tab}
                                onClick={() => !isTabsDragging && setActiveTab(tab)}
                                className={`px-5 py-2.5 rounded-2xl font-black text-[11px] whitespace-nowrap transition-all flex-shrink-0 uppercase tracking-widest border-2 ${activeTab === tab
                                    ? 'bg-amber-500 text-black shadow-[0_0_20px_rgba(245,158,11,0.3)] border-transparent'
                                    : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-amber-500/50 hover:text-amber-500'
                                    }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            <div
                ref={scrollRef}
                onMouseDown={handleMouseDown}
                onMouseLeave={handleMouseLeave}
                onMouseUp={handleMouseUp}
                onMouseMove={handleMouseMove}
                className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 scrollbar-hide select-none"
            >
                <div className="max-w-[1920px] mx-auto pb-24">
                    {sortedOrders.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 opacity-30 italic">
                            <p className="text-xl font-black uppercase tracking-tighter">
                                {searchTerm ? 'No se encontraron pedidos' : 'No hay pedidos finalizados'}
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
                            {sortedOrders.map(order => {
                                const total = Number(order.total || 0);
                                const completedAt = new Date(order.completedAt || order.createdAt);

                                return (
                                    <button
                                        key={order.id}
                                        onClick={() => setSelectedOrder(order)}
                                        className="p-3 bg-gray-800 border border-gray-700 rounded-2xl shadow-xl hover:bg-gray-750 active:scale-[0.98] transition-all text-left flex flex-col gap-2 group relative overflow-hidden"
                                    >
                                        {/* Header Row: #Number + Chips + Price */}
                                        <div className="flex justify-between items-start w-full gap-2">
                                            <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
                                                <span className="font-black text-cyan-400 text-[17px] tracking-tighter shrink-0">
                                                    #{String(order.dailyOrderNumber).padStart(3, '0')}
                                                </span>

                                                {/* Chips area with wrapping */}
                                                {order.table && (
                                                    <span className="px-1.5 py-0.5 bg-blue-500/10 border border-blue-500/30 rounded text-[10px] font-black text-blue-400 uppercase">
                                                        {order.table.name}
                                                    </span>
                                                )}
                                                {order.waiter && (
                                                    <span className="px-1.5 py-0.5 bg-purple-500/10 border border-purple-500/30 rounded text-[10px] font-black text-purple-400 uppercase truncate max-w-[70px]">
                                                        {order.waiter.name.split(' ')[0]}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Top Right Price */}
                                            <span className="text-white font-black text-xl tabular-nums tracking-tighter shrink-0">
                                                ${total.toFixed(2)}
                                            </span>
                                        </div>

                                        {/* Customer Row */}
                                        <div className="flex flex-col gap-0.5">
                                            <p className="text-sm font-black text-white truncate uppercase italic opacity-90">
                                                {order.customer?.name || 'CLIENTES VARIOS'}
                                            </p>
                                        </div>

                                        {/* Footer: Status + Time */}
                                        <div className="flex justify-between items-center w-full mt-auto pt-1 border-t border-gray-700/50">
                                            <div className="flex items-center gap-2">
                                                <span className="px-2 py-0.5 bg-green-500/20 border border-green-500/30 rounded-lg text-[10px] font-black text-green-400 uppercase italic">
                                                    PAGADO
                                                </span>
                                                <span className="text-[9px] font-black text-amber-500/60 uppercase tracking-widest italic">
                                                    {order.type}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-2 shrink-0 opacity-60">
                                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">
                                                    {completedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                                <div className="w-1.5 h-1.5 bg-green-500 rounded-full shadow-[0_0_5px_rgba(34,197,94,0.5)]"></div>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {selectedOrder && (
                <TicketModal
                    order={selectedOrder}
                    onClose={() => setSelectedOrder(null)}
                    onNewOrder={onNewOrder}
                    isViewingCompleted={true}
                    companySettings={companySettings}
                    onUpdateCustomerEmail={onUpdateCustomerEmail}
                    branches={branches}
                />
            )}

            {/* Floating Add Button for quick access to New Order flow */}
            <button
                onClick={onNewOrder}
                className="fixed bottom-6 right-6 w-16 h-16 bg-[#0DB6E0] rounded-full shadow-[0_10px_40px_rgba(13,182,224,0.4)] flex items-center justify-center text-gray-950 active:scale-90 transition-all z-50 group border-4 border-gray-950"
                title="Nuevo Pedido"
            >
                <PlusIcon className="w-8 h-8 transition-transform group-hover:scale-110" />
            </button>
        </div>
    );
};

export default CompletedOrdersScreen;
