import React, { useMemo } from 'react';
import { Order, CashClosingReport, PaymentMethod, UserRole } from '../types';
import { CashRegisterIcon, ArrowLeftIcon, ChartBarIcon, ClockIcon, CreditCardIcon, BankIcon, BitcoinIcon, ReceiptIcon } from './icons';
import { getElSalvadorDateString, formatToElSalvadorDate } from '../utils/dates';
import { ViewHeader } from './AdminShared';

interface CashAuditScreenProps {
    orders: Order[];
    cashClosingReports: CashClosingReport[];
    currentBranchId: number | null;
    onBack: () => void;
}

const CashAuditScreen: React.FC<CashAuditScreenProps> = ({ orders, cashClosingReports, currentBranchId, onBack }) => {
    
    const todayStr = useMemo(() => getElSalvadorDateString(), []);

    const auditData = useMemo(() => {
        const branchId = currentBranchId || 1;
        
        // 1. Initial Cash (Opening)
        const opening = cashClosingReports.find(r => r.date === todayStr && r.branchId === branchId);
        const initialCash = opening?.initialCash || 0;

        // 2. Filter today's orders for this branch
        const todaysOrders = orders.filter(o => {
            const orderDate = formatToElSalvadorDate(o.createdAt);
            return orderDate === todayStr && o.branchId === branchId;
        });

        const activeOrders = todaysOrders.filter(o => o.status === 'active');
        const completedOrders = todaysOrders.filter(o => o.status === 'completed');

        // 3. Totals by Payment Method (already collected)
        const collectedByMethod: Record<string, number> = {};
        Object.values(PaymentMethod).forEach(m => collectedByMethod[m] = 0);

        completedOrders.forEach(o => {
            o.payments.forEach(p => {
                collectedByMethod[p.method] += p.amount;
            });
        });

        // 4. Pending to collect
        const totalPending = activeOrders.reduce((sum, o) => sum + o.total, 0);

        // 5. Cash in Drawer (Physical expected)
        // Fondo + Efectivo Cobrado
        const cashCollected = collectedByMethod[PaymentMethod.Cash] || 0;
        const expectedCashInDrawer = initialCash + cashCollected;

        const totalCollected = Object.values(collectedByMethod).reduce((a, b) => a + b, 0);

        return {
            initialCash,
            collectedByMethod,
            totalPending,
            expectedCashInDrawer,
            totalCollected,
            activeCount: activeOrders.length,
            completedCount: completedOrders.length
        };
    }, [orders, cashClosingReports, currentBranchId, todayStr]);

    const getIconForMethod = (method: string) => {
        switch (method) {
            case PaymentMethod.Cash: return <CashRegisterIcon className="w-5 h-5" />;
            case PaymentMethod.Card: return <CreditCardIcon className="w-5 h-5" />;
            case PaymentMethod.Transfer: return <BankIcon className="w-5 h-5" />;
            case PaymentMethod.Bitcoin: return <BitcoinIcon className="w-5 h-5" />;
            default: return <ReceiptIcon className="w-5 h-5" />;
        }
    };

    return (
        <div className="flex flex-col h-full bg-gray-950 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <ViewHeader title="ARQUEO <span class='text-amber-500'>EN VIVO</span>" onBack={onBack} />

            <div className="flex-1 overflow-y-auto p-4 md:p-8">
                <div className="max-w-6xl mx-auto space-y-8">
                    
                    {/* TOP STATS - PHYSICAL CASH */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-gray-900/50 border border-gray-800 rounded-[32px] p-8 flex flex-col items-center justify-center text-center shadow-xl">
                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-2">Fondo Inicial</span>
                            <span className="text-3xl font-black text-white italic tracking-tighter">${auditData.initialCash.toFixed(2)}</span>
                        </div>

                        <div className="bg-gray-900/50 border border-gray-800 rounded-[32px] p-8 flex flex-col items-center justify-center text-center shadow-xl">
                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-2">Efectivo Cobrado</span>
                            <span className="text-3xl font-black text-green-500 italic tracking-tighter">+${(auditData.collectedByMethod[PaymentMethod.Cash] || 0).toFixed(2)}</span>
                        </div>

                        <div className="bg-amber-500 border border-amber-400 rounded-[32px] p-10 flex flex-col items-center justify-center text-center shadow-2xl shadow-amber-500/20 relative overflow-hidden group">
                           <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110 duration-700"></div>
                            <span className="text-[10px] font-black text-amber-950 uppercase tracking-[0.2em] mb-2 relative z-10">Dinero en Gaveta</span>
                            <span className="text-5xl font-black text-white italic tracking-tighter relative z-10">${auditData.expectedCashInDrawer.toFixed(2)}</span>
                            <div className="mt-4 px-4 py-1.5 bg-amber-600/30 rounded-full backdrop-blur-md border border-white/20 relative z-10">
                                <span className="text-[9px] font-black text-white uppercase tracking-widest italic">EFECTIVO FÍSICO ESPERADO</span>
                            </div>
                        </div>
                    </div>

                    {/* TWO COLUMN LAYOUT */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        
                        {/* LEFT: COLLECTED BY METHOD */}
                        <div className="bg-gray-900 border border-gray-800 rounded-[40px] overflow-hidden shadow-2xl">
                            <div className="p-8 border-b border-gray-800 bg-gray-800/20 flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-green-500/10 rounded-2xl flex items-center justify-center border border-green-500/20">
                                        <ChartBarIcon className="w-5 h-5 text-green-500" />
                                    </div>
                                    <h3 className="text-lg font-black text-white italic uppercase tracking-tighter">Ya Cobrado</h3>
                                </div>
                                <span className="text-xs font-black text-gray-400 uppercase tracking-widest bg-gray-900 px-4 py-1.5 rounded-full border border-gray-800">
                                    {auditData.completedCount} Pedidos
                                </span>
                            </div>

                            <div className="p-8 space-y-4">
                                { (Object.entries(auditData.collectedByMethod) as [string, number][]).filter(([_, val]) => val > 0).length === 0 ? (
                                    <div className="py-12 text-center">
                                        <p className="text-gray-600 font-bold uppercase text-xs tracking-widest italic">Aún no hay cobros realizados</p>
                                    </div>
                                ) : (
                                    (Object.entries(auditData.collectedByMethod) as [PaymentMethod, number][])
                                        .filter(([_, val]) => val > 0)
                                        .map(([method, amount]) => (
                                            <div key={method} className="flex items-center justify-between p-5 bg-gray-950 rounded-[24px] border border-gray-800/50 hover:border-gray-700 transition-all">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 bg-gray-900 rounded-2xl flex items-center justify-center text-amber-500 border border-gray-800">
                                                        {getIconForMethod(method)}
                                                    </div>
                                                    <span className="text-xs font-black text-white uppercase tracking-widest">{method}</span>
                                                </div>
                                                <span className="text-xl font-black text-white italic tracking-tighter">${(amount as number).toFixed(2)}</span>
                                            </div>
                                        ))
                                )}

                                <div className="mt-8 pt-8 border-t border-gray-800 flex justify-between items-center px-4">
                                    <span className="text-sm font-black text-gray-400 uppercase tracking-widest italic">Total Cobrado</span>
                                    <span className="text-3xl font-black text-white italic tracking-tighter">${auditData.totalCollected.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT: PENDING & PROJECTIONS */}
                        <div className="space-y-8">
                            
                            {/* PENDING SECTION */}
                            <div className="bg-gray-900 border border-gray-800 rounded-[40px] overflow-hidden shadow-2xl">
                                <div className="p-8 border-b border-gray-800 bg-gray-800/20 flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-amber-500/10 rounded-2xl flex items-center justify-center border border-amber-500/20">
                                            <ClockIcon className="w-5 h-5 text-amber-500" />
                                        </div>
                                        <h3 className="text-lg font-black text-white italic uppercase tracking-tighter">Por Cobrar</h3>
                                    </div>
                                    <span className="text-xs font-black text-amber-500 uppercase tracking-widest bg-amber-500/5 px-4 py-1.5 rounded-full border border-amber-500/20 animate-pulse">
                                        {auditData.activeCount} En Mesa
                                    </span>
                                </div>

                                <div className="p-8 text-center flex flex-col items-center">
                                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-4">Monto en Órdenes Activas</span>
                                    <span className="text-5xl font-black text-white italic tracking-tighter mb-4">${auditData.totalPending.toFixed(2)}</span>
                                    <p className="text-[9px] text-gray-500 font-bold uppercase tracking-tight italic opacity-60">
                                        Este valor no se asigna a ningún método hasta que la orden se complete.
                                    </p>
                                </div>
                            </div>

                            {/* PROJECTION SECTION */}
                            <div className="bg-gradient-to-br from-indigo-900/40 to-purple-900/40 border border-indigo-500/30 rounded-[40px] p-10 shadow-2xl relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-50"></div>
                                <div className="relative z-10 flex flex-col items-center text-center">
                                    <span className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.3em] mb-6 mb-2">Proyección Final del Día</span>
                                    <div className="flex items-baseline gap-2 mb-4">
                                        <span className="text-6xl font-black text-white italic tracking-tighter">
                                            ${(auditData.totalCollected + auditData.totalPending).toFixed(2)}
                                        </span>
                                    </div>
                                    <div className="flex gap-4 mt-4 w-full justify-center">
                                        <div className="px-5 py-3 bg-white/5 rounded-2xl border border-white/10 flex flex-col items-center shrink-0">
                                            <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">COBRADO</span>
                                            <span className="font-black text-white text-sm italic tracking-tight">${auditData.totalCollected.toFixed(2)}</span>
                                        </div>
                                        <div className="px-5 py-3 bg-white/5 rounded-2xl border border-white/10 flex flex-col items-center shrink-0">
                                            <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">PENDIENTE</span>
                                            <span className="font-black text-white text-sm italic tracking-tight">${auditData.totalPending.toFixed(2)}</span>
                                        </div>
                                    </div>
                                    <p className="mt-8 text-[10px] font-bold text-indigo-300 uppercase italic tracking-widest opacity-80">
                                        Suma total de ventas cobradas y pendientes para hoy
                                    </p>
                                </div>
                            </div>

                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default CashAuditScreen;
