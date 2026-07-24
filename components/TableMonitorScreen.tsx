import React, { useState, useEffect } from 'react';
import { Order, Table, TableArea, OrderType } from '../types';
import { TableIcon, ClockIcon, UserIcon, ReceiptIcon, PlusIcon } from './icons';

interface TableMonitorScreenProps {
    activeOrders: Order[];
    tables: Table[];
    tableAreas: TableArea[];
    onNavigate: (view: any) => void;
    onSelectOrder: (orderId: string) => void;
    onNewOrder: () => void;
}

const TableMonitorScreen: React.FC<TableMonitorScreenProps> = ({ activeOrders, tables, tableAreas, onNavigate, onSelectOrder, onNewOrder }) => {
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 10000); // Update every 10s is enough for the timer
        return () => clearInterval(timer);
    }, []);

    const getElapsedTime = (createdAt: Date) => {
        const diff = currentTime.getTime() - new Date(createdAt).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 60) return `${mins}m`;
        const hours = Math.floor(mins / 60);
        return `${hours}h ${mins % 60}m`;
    };

    return (
        <div className="h-full overflow-y-auto scrollbar-hide select-none bg-[#0a0a0b]" style={{ WebkitFontSmoothing: 'antialiased' }}>
            <div className="w-full max-w-[1920px] mx-auto pb-32 px-4 lg:px-8 pt-4 sm:pt-6">
                <header className="flex flex-col gap-1 mb-6">
                    <h1 className="text-2xl font-black text-white italic uppercase tracking-tighter">
                        MONITOR DE <span className="text-blue-500">MESAS</span>
                    </h1>
                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.4em] italic opacity-60">ESTADO EN TIEMPO REAL</p>
                </header>

                <div className="space-y-6 sm:space-y-8">
                    {tableAreas.map(area => {
                        const areaTables = tables.filter(t => t.areaId === area.id);
                        if (areaTables.length === 0) return null;

                        return (
                            <section key={area.id} className="space-y-3">
                                <div className="flex items-center gap-4">
                                    <h2 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em] italic whitespace-nowrap">
                                        {area.name}
                                    </h2>
                                    <div className="h-px w-full bg-gray-800/50"></div>
                                </div>

                                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 2xl:grid-cols-14 gap-2 sm:gap-3">
                                    {areaTables.map(t => {
                                        const activeOrder = activeOrders.find(o =>
                                            o.type === OrderType.Restaurant &&
                                            o.table &&
                                            Number(o.table.id) === Number(t.id) &&
                                            o.status === 'active'
                                        );

                                        const isOccupied = !!activeOrder;

                                        return (
                                            <div
                                                key={t.id}
                                                onClick={() => isOccupied && onSelectOrder(activeOrder.id)}
                                                className={`group relative overflow-hidden rounded-[16px] p-2 sm:p-2.5 border-2 transition-all duration-300 flex flex-col items-center justify-center gap-1 cursor-pointer min-h-[90px]
                                                ${isOccupied
                                                        ? 'bg-[#3b270a] border-amber-600/50'
                                                        : 'bg-[#0f3d2b] border-emerald-600/50 hover:border-emerald-500'
                                                    }`}
                                                style={{ transform: 'translateZ(0)' }}
                                            >
                                                <div className="absolute top-0 right-0">
                                                    <div className={`${isOccupied ? 'bg-amber-500' : 'bg-emerald-500'} text-black px-1.5 pt-[3px] pb-[1px] rounded-bl-lg font-black text-[6.5px] uppercase tracking-tighter shadow-sm`}>
                                                        {isOccupied ? 'BUSY' : 'FREE'}
                                                    </div>
                                                </div>

                                                <div className={`p-1.5 rounded-lg transition-all duration-500 ${isOccupied ? 'bg-amber-500 text-black scale-90 shadow-[0_0_12px_rgba(245,158,11,0.3)]' : 'bg-gray-800 text-gray-500 group-hover:bg-emerald-500 group-hover:text-black'}`}>
                                                    <TableIcon className="w-3.5 h-3.5" />
                                                </div>

                                                <div className="text-center">
                                                    <span className={`text-[11px] font-black uppercase italic tracking-tighter block leading-none ${isOccupied ? 'text-white' : 'text-emerald-500/80'}`}>
                                                        {t.name}
                                                    </span>
                                                </div>

                                                {isOccupied && (
                                                    <div className="flex flex-col items-center gap-0.5 w-full">
                                                        <div className="flex items-center gap-1 px-1 py-0.5 bg-black/40 rounded border border-white/5 w-full justify-center">
                                                            <span className="text-[7.5px] font-black text-amber-500 uppercase truncate">
                                                                {activeOrder.waiter ? activeOrder.waiter.name.split(' ')[0] : 'S/M'}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <ClockIcon className="w-2 h-2 text-gray-500" />
                                                            <span className="text-[8px] font-black text-white tabular-nums">
                                                                {getElapsedTime(activeOrder.createdAt)}
                                                            </span>
                                                        </div>
                                                        <div className="text-[6.5px] font-black text-amber-500/60 tracking-tighter">
                                                            #{String(activeOrder.dailyOrderNumber).padStart(3, '0')}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>
                        );
                    })}
                </div>
            </div>

            {/* BOTÓN FLOTANTE NUEVA ORDEN - ESTILO ESTÁNDAR CYAN */}
            <button
                onClick={onNewOrder}
                className="fixed bottom-6 right-6 w-16 h-16 bg-[#0DB6E0] rounded-full shadow-[0_10px_40px_rgba(13,182,224,0.4)] flex items-center justify-center text-gray-950 active:scale-90 transition-all z-50 group border-4 border-gray-950"
            >
                <PlusIcon className="w-8 h-8 transition-transform group-hover:scale-110" />
            </button>
        </div>
    );
};

export default TableMonitorScreen;
