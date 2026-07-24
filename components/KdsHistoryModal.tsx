
import React, { useState } from 'react';
import { Order, OrderType } from '../types';
import { XIcon, ClockIcon, UserIcon, SearchIcon } from './icons';

interface KdsHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    orders: Order[];
}

const KdsHistoryModal: React.FC<KdsHistoryModalProps> = ({ isOpen, onClose, orders }) => {
    const [searchTerm, setSearchTerm] = useState('');
    if (!isOpen) return null;

    const today = new Date();
    const todayOrders = orders.filter(o => {
        const finishedDate = o.readyAt ? new Date(o.readyAt) : (o.completedAt ? new Date(o.completedAt) : new Date(o.createdAt));
        return finishedDate.getDate() === today.getDate() &&
            finishedDate.getMonth() === today.getMonth() &&
            finishedDate.getFullYear() === today.getFullYear();
    }).sort((a, b) => {
        const timeA = a.readyAt ? new Date(a.readyAt).getTime() : new Date(a.createdAt).getTime();
        const timeB = b.readyAt ? new Date(b.readyAt).getTime() : new Date(b.createdAt).getTime();
        return timeB - timeA;
    });

    const filteredOrders = todayOrders.filter(o => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        const orderNum = String(o.dailyOrderNumber).padStart(3, '0');
        const tableName = o.table?.name.toLowerCase() || '';
        const customerName = o.customer?.name.toLowerCase() || '';
        return orderNum.includes(term) || tableName.includes(term) || customerName.includes(term);
    });

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-gray-950 border border-gray-800 w-full max-w-[95vw] h-[90vh] rounded-[2.5rem] flex flex-col shadow-2xl overflow-hidden border-white/5">
                {/* Header */}
                <div className="p-8 border-b border-gray-800 flex justify-between items-center bg-gray-900/40 backdrop-blur-xl gap-4">
                    <div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-3xl font-black text-white uppercase tracking-tighter italic">COMANDAS <span className="text-amber-500">FINALIZADAS</span></h2>
                            <span className="bg-amber-500/10 text-amber-500 text-[10px] font-black px-3 py-1 rounded-full border border-amber-500/20 tracking-widest uppercase">Hoy</span>
                        </div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-[0.2em] mt-2">Visión histórica de la jornada actual</p>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="relative group hidden md:block">
                            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-amber-500 transition-colors" />
                            <input
                                type="text"
                                placeholder="BUSCAR ORDEN O MESA..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="bg-black/40 border border-gray-800 text-white pl-12 pr-4 py-3 rounded-2xl w-80 font-bold focus:outline-none focus:border-amber-500/50 transition-all uppercase tracking-widest text-[10px] placeholder:text-gray-700"
                            />
                        </div>

                        <button
                            onClick={onClose}
                            className="p-4 hover:bg-white/5 rounded-full transition-all active:scale-95 group border border-transparent hover:border-white/10"
                        >
                            <XIcon className="w-8 h-8 text-gray-500 group-hover:text-white transition-colors" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8 bg-black/20">
                    {todayOrders.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-700">
                            <div className="w-24 h-24 mb-6 opacity-20">
                                <ClockIcon className="w-full h-full" />
                            </div>
                            <p className="text-xl font-black uppercase italic tracking-tighter">No hay órdenes finalizadas hoy</p>
                        </div>
                    ) : (
                        <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 xl:columns-5 2xl:columns-6 gap-4">
                            {filteredOrders.map(order => (
                                <HistoryTicket key={order.id} order={order} />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const HistoryTicket: React.FC<{ order: Order }> = ({ order }) => {
    const formatDuration = (start: Date, end: Date) => {
        const ms = end.getTime() - start.getTime();
        const mins = Math.floor(ms / 60000);
        const secs = Math.floor((ms % 60000) / 1000);
        return `${mins}m ${secs}s`;
    };

    const getOrderTypeBadgeColor = (type: OrderType) => {
        switch (type) {
            case OrderType.Restaurant: return 'bg-blue-600 border-blue-400';
            case OrderType.Delivery: return 'bg-orange-600 border-orange-400';
            case OrderType.Pickup: return 'bg-purple-600 border-purple-400';
            case OrderType.Takeaway: return 'bg-pink-600 border-pink-400';
            default: return 'bg-gray-600 border-gray-400';
        }
    };

    return (
        <div className="bg-gray-900/80 border border-gray-800 rounded-2xl flex flex-col shadow-lg mb-4 break-inside-avoid w-full overflow-hidden hover:border-gray-600 transition-colors">
            {/* Ticket Header */}
            <div className="p-3 bg-gray-800/50 border-b border-gray-700 flex justify-between items-start">
                <div className="overflow-hidden flex-1 min-w-0 pr-2">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-black text-lg text-white">#{String(order.dailyOrderNumber).padStart(3, '0')}</span>
                        <span className={`${getOrderTypeBadgeColor(order.type)} text-white text-[9px] px-2 py-0.5 rounded border shadow-sm font-black uppercase tracking-wider`}>
                            {order.type}
                        </span>
                        {order.chef && (
                            <span className="bg-amber-500/10 text-amber-500 text-[9px] font-black px-2 py-0.5 rounded border border-amber-500/20 uppercase tracking-tighter flex items-center gap-1">
                                <UserIcon className="w-3 h-3" />
                                {order.chef}
                            </span>
                        )}
                    </div>
                    <div className="text-[11px] truncate font-bold text-gray-400 uppercase tracking-tight">
                        {order.table ? order.table.name : order.customer?.name || 'Cliente'}
                    </div>
                </div>
                <div className="text-[10px] font-mono font-black text-gray-500 text-right">
                    {new Date(order.readyAt || order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
            </div>

            {/* Items List */}
            <div className="p-3 text-xs space-y-2 opacity-80">
                {order.items.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                        <div className="w-5 h-5 flex items-center justify-center rounded bg-gray-800 text-gray-400 text-[10px] font-black flex-shrink-0 mt-0.5 border border-gray-700">
                            {item.quantity}
                        </div>
                        <div className="leading-tight flex-1">
                            <span className="font-bold text-gray-300">{item.product.name}</span>
                            {item.meat && <span className="text-amber-500/80 font-black text-[9px] uppercase block mt-1">[{item.meat.name}]</span>}
                            {item.masa && <span className="text-fuchsia-400/80 font-black text-[9px] uppercase block mt-1">[{item.masa.name}]</span>}
                            {item.extras && item.extras.length > 0 && (
                                <div className="text-green-500/70 text-[9px] font-bold mt-1">
                                    {item.extras.map(e => `+ ${e.name}`).join(', ')}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Footer Stats */}
            <div className="mt-auto p-3 bg-gray-950/40 border-t border-gray-800/50 flex items-center justify-between gap-2">
                {order.chef && (
                    <div className="flex items-center gap-1.5 text-[9px] font-black text-amber-500/80 uppercase bg-amber-500/5 px-2 py-1 rounded-lg border border-amber-500/10">
                        <UserIcon className="w-3 h-3" />
                        {order.chef}
                    </div>
                )}
                {order.readyAt && (
                    <div className="flex items-center gap-1.5 text-[9px] font-black text-green-500 uppercase bg-green-500/5 px-2 py-1 rounded-lg border border-green-500/10 ml-auto">
                        <ClockIcon className="w-3 h-3" />
                        {formatDuration(new Date(order.createdAt), new Date(order.readyAt))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default KdsHistoryModal;
