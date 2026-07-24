
import React, { useMemo, useState, useEffect } from 'react';
import { Order, OrderType, CashClosingReport } from '../types';
import { api } from '../api';
import { RefreshIcon, CalendarIcon } from './icons';
import { getElSalvadorDateString } from '../utils/dates';

interface DailySummaryScreenProps {
    orders: Order[]; // These are current/today's orders from props
    onBack: () => void;
    branchId: number;
    cashClosingReports: CashClosingReport[];
}

const DailySummaryScreen: React.FC<DailySummaryScreenProps> = ({ orders: initialOrders, onBack, branchId, cashClosingReports }) => {
    const [selectedDate, setSelectedDate] = useState(() => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    });

    const [orders, setOrders] = useState<Order[]>(initialOrders);
    const [isLoading, setIsLoading] = useState(false);

    const isToday = useMemo(() => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return selectedDate === `${year}-${month}-${day}`;
    }, [selectedDate]);

    // Fetch history when date changes
    useEffect(() => {
        const fetchHistory = async () => {
            setIsLoading(true);
            try {
                // 1. & 2. FIND THE REPORT FOR THIS DATE AND BRANCH
                const reportsForDate = cashClosingReports.filter(r => r.date === selectedDate && r.branchId === branchId);
                
                // Capture the ID (prioritize the latest one if multiple exist)
                const targetReport = [...reportsForDate].sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0))[0];

                // 4. IF NO ID FOUND, SHOW NOTHING
                if (!targetReport) {
                    setOrders([]);
                    setIsLoading(false);
                    return;
                }

                // 3. WITH THE ID CAPTURED, FETCH ORDERS
                const filters: any = {
                    branchId: branchId,
                    cashReportId: targetReport.id,
                    limit: 1000 
                };

                const data = await api.getHistory(filters);

                if (Array.isArray(data)) {
                    setOrders(data.filter((o: any) => {
                        const isCompleted = o.status === 'completed' || o.delivery_status === 'delivered';
                        if (!isCompleted) return false;

                        const orderSessionId = o.cash_report_id || o.cashReportId;
                        
                        // If we are viewing a specific report, only show orders of that report
                        if (targetReport) {
                            return String(orderSessionId) === String(targetReport.id);
                        }

                        // If we are viewing a date range (no target report found/open yet),
                        // only show orders that DON'T have a session assigned yet.
                        // This prevents midnight orders from a previous shift from bleeding into today's view.
                        return !orderSessionId;
                    }));
                }
            } catch (e) {
                console.error("Error fetching historical summary", e);
            } finally {
                setIsLoading(false);
            }
        };

        fetchHistory();
    }, [selectedDate, isToday, branchId, cashClosingReports]);

    const summary = useMemo(() => {
        const summaryMap = new Map<OrderType, { count: number; total: number }>();
        for (const order of orders) {
            const existing = summaryMap.get(order.type) || { count: 0, total: 0 };
            summaryMap.set(order.type, {
                count: existing.count + 1,
                total: existing.total + Number(order.total || 0) + Number((order as any).card_commission || order.cardCommission || 0)
            });
        }
        return Array.from(summaryMap.entries()).map(([type, data]) => ({ type, ...data }));
    }, [orders]);

    const grandTotal = useMemo(() => summary.reduce((sum, item) => sum + item.total, 0), [summary]);

    return (
        <div className="h-full flex flex-col p-4 sm:p-6 max-w-7xl mx-auto overflow-hidden w-full animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="bg-gray-800 p-2.5 rounded-full hover:bg-gray-700 active:scale-90 transition-all shadow-lg border border-gray-700/50">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <div>
                        <h1 className="text-2xl md:text-4xl font-black text-white italic uppercase tracking-tighter leading-none">
                            RESUMEN <span className="text-amber-500">{isToday ? 'DEL DÍA' : 'HISTÓRICO'}</span>
                        </h1>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">ESTADÍSTICAS DE VENTA POR SERVICIO</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 bg-gray-900/50 p-2 rounded-2xl border border-gray-800 shadow-inner">
                    <CalendarIcon className="w-5 h-5 text-amber-500 ml-2" />
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        max={getElSalvadorDateString()}
                        className="bg-transparent text-white font-black uppercase text-sm outline-none w-36 px-2 py-1"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-hide space-y-6">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 opacity-50">
                        <RefreshIcon className="w-12 h-12 text-amber-500 animate-spin mb-4" />
                        <p className="font-black text-xs uppercase tracking-widest text-gray-500">Consultando historial...</p>
                    </div>
                ) : orders.length === 0 ? (
                    <div className="bg-gray-900/50 border border-gray-800 p-12 rounded-[40px] text-center text-gray-700 font-black uppercase italic tracking-widest text-xs">
                        No se encontraron ventas para este periodo.
                    </div>
                ) : (
                    <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-300">
                        <div className="bg-gray-900 border border-gray-800 rounded-[40px] overflow-x-auto scrollbar-hide shadow-2xl relative">
                            {/* Decorative blur */}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 blur-[60px] rounded-full -mr-16 -mt-16"></div>
                            
                            <table className="w-full text-left relative z-10">
                                <thead className="bg-gray-800/50">
                                    <tr>
                                        <th className="p-6 text-[10px] font-black text-gray-500 uppercase tracking-widest">Servicio</th>
                                        <th className="p-6 text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">Cant.</th>
                                        <th className="p-6 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800">
                                    {summary.map(item => (
                                        <tr key={item.type} className="hover:bg-gray-800/30 transition-colors">
                                            <td className="p-6 font-black text-white uppercase italic text-sm">{item.type}</td>
                                            <td className="p-6 text-center font-bold text-gray-400">{item.count}</td>
                                            <td className="p-6 text-right font-black text-amber-500 italic text-lg decoration-amber-500/30 underline-offset-4 ">${item.total.toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="bg-amber-500 p-8 rounded-[40px] flex justify-between items-center shadow-2xl shadow-amber-500/30 group">
                            <div>
                                <span className="text-[10px] font-black text-amber-950 uppercase tracking-[0.2em] block mb-1">VENTA TOTAL BRUTA</span>
                                <span className="text-4xl md:text-5xl font-black text-white italic tracking-tighter drop-shadow-sm group-hover:scale-110 transition-transform origin-left block">${grandTotal.toFixed(2)}</span>
                            </div>
                            <div className="bg-white/20 p-4 rounded-3xl backdrop-blur-md">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DailySummaryScreen;
