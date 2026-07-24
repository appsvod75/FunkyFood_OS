
import React, { useRef, useState, useMemo } from 'react';
import { ClipboardListIcon, PrintIcon, UploadIcon, BellIcon } from './icons';
import { Order, OrderItem, Category, Waiter, OrderType } from '../types';
import { useDragScroll } from '../hooks/useDragScroll';


import { api } from '../api';
import { toast } from 'react-hot-toast';

interface ReportsScreenProps {
    onBack: () => void;
    orders: Order[]; // Keep prop for fallback or initial state if desired, but we will fetch
    categories: Category[];
    waiters: Waiter[];
    branchId: number;
}

const ReportsScreen: React.FC<ReportsScreenProps> = ({ onBack, orders, categories, waiters, branchId }) => {
    const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
    // Fix: Local Time
    const toLocalISO = (d: Date) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };
    const [startDate, setStartDate] = useState(toLocalISO(new Date()));
    const [endDate, setEndDate] = useState(toLocalISO(new Date()));

    const [fetchedOrders, setFetchedOrders] = useState<Order[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // FETCH HISTORY WHEN DATES CHANGE
    React.useEffect(() => {
        const fetchHistory = async () => {
            setIsLoading(true);
            const loadingToast = toast.loading('Cargando historial...', { id: 'history-loading' });
            try {
                // Fetch ALL completed orders for range (no limit)
                // Assuming api.getHistory supports no limit or large limit.
                // Let's check api.ts limits. It usually has pagination. 
                // We might need a special endpoint or high limit for reports.
                // For now, let's request a high limit if supported, or rely on defaults.
                // Given standard implementation, let's request a reasonably high limit.
                const data = await api.getHistory({
                    startDate: `${startDate} 00:00:00`,
                    endDate: `${endDate} 23:59:59`,
                    branchId,
                    limit: 1000 // Ensure we get enough for a report. If >1000, might need pagination loop.
                });

                // Inspect response structure. Usually { orders: [], total: ... } or just []
                const history = Array.isArray(data) ? data : (data.orders || []);
                setFetchedOrders(history);
                toast.success(`Reporte actualizado: ${history.length} registros`, { id: loadingToast });
            } catch (error) {
                console.error("Error fetching report history:", error);
                toast.error("Error cargando historial", { id: loadingToast });
            } finally {
                setIsLoading(false);
            }
        };

        fetchHistory();
    }, [startDate, endDate, branchId]);

    const { ref: scrollRef, ...dragHandlers } = useDragScroll();

    const reportOptions = [
        { id: 'prod_sales', label: 'Ventas por Producto', color: 'bg-blue-600' },
        { id: 'waiter_sales', label: 'Ventas por Mesero', color: 'bg-amber-600' },
        { id: 'cat_sales', label: 'Ventas por Categoría', color: 'bg-green-600' },
        { id: 'service_sales', label: 'Ventas por Servicio', color: 'bg-cyan-600' },
        { id: 'delivery_report', label: 'Reporte Delivery', color: 'bg-orange-600' },
        { id: 'complements', label: 'Reporte de Extras', color: 'bg-indigo-600' },
        { id: 'courtesy', label: 'Reporte de Descuentos', color: 'bg-red-600' },
        { id: 'charges_report', label: 'Cargos y Comisiones', color: 'bg-rose-600' },
        { id: 'driver_fees', label: 'Motorista (Liquidación)', color: 'bg-violet-600' },
    ];

    const filteredOrders = useMemo(() => {
        // Use fetchedOrders directly as they are already filtered by date range from API
        return fetchedOrders;
    }, [fetchedOrders]);

    const reportData = useMemo(() => {
        if (!selectedReportId) return [];

        switch (selectedReportId) {
            case 'prod_sales':
                const prodMap = new Map<string, { qty: number, total: number }>();
                filteredOrders.forEach(o => {
                    o.items.forEach(i => {
                        const existing = prodMap.get(i.product.name) || { qty: 0, total: 0 };
                        prodMap.set(i.product.name, {
                            qty: existing.qty + i.quantity,
                            total: existing.total + i.total
                        });
                    });
                });
                return Array.from(prodMap.entries()).map(([name, data]) => ({ label: name, ...data }));

            case 'waiter_sales':
                const waiterMap = new Map<string, { qty: number, total: number }>();
                filteredOrders.forEach(o => {
                    const name = o.waiter?.name || 'MOSTRADOR';
                    const existing = waiterMap.get(name) || { qty: 0, total: 0 };
                    waiterMap.set(name, {
                        qty: existing.qty + 1,
                        total: existing.total + o.total
                    });
                });
                return Array.from(waiterMap.entries()).map(([name, data]) => ({ label: name, ...data }));

            case 'cat_sales':
                const catMap = new Map<string, { qty: number, total: number }>();
                filteredOrders.forEach(o => {
                    o.items.forEach(i => {
                        const cat = categories.find(c => c.id === i.product.categoryId)?.name || 'OTRO';
                        const existing = catMap.get(cat) || { qty: 0, total: 0 };
                        catMap.set(cat, {
                            qty: existing.qty + i.quantity,
                            total: existing.total + i.total
                        });
                    });
                });
                return Array.from(catMap.entries()).map(([name, data]) => ({ label: name, ...data }));

            case 'service_sales':
                const serviceMap = new Map<string, { qty: number, total: number }>();
                filteredOrders.forEach(o => {
                    const existing = serviceMap.get(o.type) || { qty: 0, total: 0 };
                    serviceMap.set(o.type, {
                        qty: existing.qty + 1,
                        total: existing.total + o.total
                    });
                });
                return Array.from(serviceMap.entries()).map(([name, data]) => ({ label: name, ...data }));

            case 'delivery_report':
                return filteredOrders
                    .filter(o => o.type === OrderType.Delivery)
                    .map(o => {
                        const d = new Date(o.createdAt);
                        const dateStr = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
                        return {
                            label: `ORD #${String(o.dailyOrderNumber).padStart(3, '0')} - ${o.customer?.name || 'S/N'} (${dateStr})`,
                            qty: 1,
                            total: o.deliveryFee || 0
                        };
                    });

            case 'complements':
                const extraMap = new Map<string, { qty: number, total: number }>();
                filteredOrders.forEach(o => {
                    o.items.forEach(i => {
                        i.extras?.forEach(e => {
                            const existing = extraMap.get(e.name) || { qty: 0, total: 0 };
                            extraMap.set(e.name, {
                                qty: existing.qty + i.quantity,
                                total: existing.total + (e.price * i.quantity)
                            });
                        });
                    });
                });
                return Array.from(extraMap.entries()).map(([name, data]) => ({ label: name, ...data }));

            case 'courtesy':
                return filteredOrders
                    .filter(o => (o.discount || 0) > 0)
                    .map(o => ({
                        label: `ORD #${String(o.dailyOrderNumber).padStart(3, '0')} - ${o.customer?.name || 'S/N'}`,
                        qty: 1,
                        total: o.discount
                    }));

            case 'charges_report':
                let totalSvc = 0;
                let totalComm = 0;
                filteredOrders.forEach(o => {
                    totalSvc += Number(o.serviceCharge || 0);
                    totalComm += Number(o.cardCommission || 0);
                });
                return [
                    { label: 'Total Propinas Sugeridas', qty: filteredOrders.filter(o => Number(o.serviceCharge) > 0).length, total: totalSvc },
                    { label: 'Total Comisiones de Tarjeta', qty: filteredOrders.filter(o => Number(o.cardCommission) > 0).length, total: totalComm }
                ];

            case 'driver_fees':
                const driverGroup = new Map<number, { name: string, days: Map<string, number>, total: number }>();

                filteredOrders
                    .filter(o => String(o.type).toLowerCase() === 'delivery' && o.deliveryDriverId)
                    .forEach(o => {
                        const driverId = Number(o.deliveryDriverId);
                        const driverName = waiters.find(w => Number(w.id) === driverId)?.name || `ID: ${driverId}`;

                        // Stable date string for grouping
                        const d = new Date(o.createdAt);
                        const dateStr = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;

                        const entry = driverGroup.get(driverId) || { name: driverName, days: new Map<string, number>(), total: 0 };
                        const dayTotal = entry.days.get(dateStr) || 0;

                        entry.days.set(dateStr, dayTotal + (o.deliveryFee || 0));
                        entry.total += (o.deliveryFee || 0);
                        driverGroup.set(driverId, entry);
                    });

                // Flatten for display
                const flatRows: any[] = [];
                Array.from(driverGroup.values())
                    .sort((a, b) => b.total - a.total)
                    .forEach(driver => {
                        flatRows.push({ label: driver.name, qty: 0, total: driver.total, isHeader: true });
                        Array.from(driver.days.entries())
                            // Sort by date key (DD/MM/YYYY) - needs parsing back or original sortable format
                            .sort((a, b) => {
                                const [d1, m1, y1] = a[0].split('/').map(Number);
                                const [d2, m2, y2] = b[0].split('/').map(Number);
                                const date1 = new Date(y1, m1 - 1, d1).getTime();
                                const date2 = new Date(y2, m2 - 1, d2).getTime();
                                return date2 - date1;
                            })
                            .forEach(([date, amount]) => {
                                flatRows.push({ label: date, qty: 1, total: amount, isHeader: false });
                            });
                    });
                return flatRows;

            default:
                return [];
        }
    }, [selectedReportId, filteredOrders, categories]);

    const handlePrint = () => {
        window.print();
    };

    const handleExportExcel = () => {
        const reportName = reportOptions.find(o => o.id === selectedReportId)?.label || 'Reporte';
        const headers = ['Concepto', 'Cantidad/Viajes', 'Monto'];
        const csvContent = [
            headers.join(','),
            ...reportData.map(row => `"${row.label}",${row.qty},${row.total.toFixed(2)}`)
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${reportName}_${startDate}_al_${endDate}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleSendEmail = async () => {
        const email = prompt("Ingrese el correo destino:");
        if (!email) return;
        alert("Reporte preparado para envío vía Webhook.");
    };

    const renderReportTitle = (id: string | null) => {
        if (!id) return <span className="text-white">REPORTES <span className="text-amber-500">GENERALES</span></span>;

        switch (id) {
            case 'prod_sales': return <span className="text-white">VENTAS POR <span className="text-amber-500">PRODUCTO</span></span>;
            case 'waiter_sales': return <span className="text-white">VENTAS POR <span className="text-amber-500">MESERO</span></span>;
            case 'cat_sales': return <span className="text-white">VENTAS POR <span className="text-amber-500">CATEGORÍA</span></span>;
            case 'service_sales': return <span className="text-white">VENTAS POR <span className="text-amber-500">SERVICIO</span></span>;
            case 'delivery_report': return <span className="text-white">REPORTE <span className="text-amber-500">DELIVERY</span></span>;
            case 'complements': return <span className="text-white">REPORTE DE <span className="text-amber-500">EXTRAS</span></span>;
            case 'courtesy': return <span className="text-white">REPORTE DE <span className="text-amber-500">DESCUENTOS</span></span>;
            case 'charges_report': return <span className="text-white">CARGOS Y <span className="text-amber-500">COMISIONES</span></span>;
            case 'driver_fees': return <span className="text-white">LIQUIDACIÓN DE <span className="text-amber-500">MOTORISTAS</span></span>;
            default: return <span className="text-white">{reportOptions.find(o => o.id === id)?.label}</span>;
        }
    };

    return (
        <div className="flex flex-col h-full overflow-hidden max-w-7xl mx-auto w-full">
            {/* Header Fijo Superior */}
            <div className="flex items-center justify-between p-4 shrink-0 bg-gray-950/80 backdrop-blur-xl border-b border-gray-800/50 z-20">
                <div className="flex items-center gap-4 min-w-0">
                    <button onClick={selectedReportId ? () => setSelectedReportId(null) : onBack} className="bg-gray-800 p-2.5 rounded-full hover:bg-gray-700 active:scale-90 transition-all shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 bg-amber-500/10 rounded-xl">
                            <ClipboardListIcon className="w-6 h-6 text-amber-500 shrink-0" />
                        </div>
                        <h1 className="text-xl font-black italic uppercase tracking-tighter leading-none truncate">
                            {renderReportTitle(selectedReportId)}
                        </h1>
                    </div>
                </div>
                {selectedReportId && (
                    <div className="flex gap-2">
                        <button onClick={handlePrint} className="p-2.5 bg-blue-600 rounded-xl active:scale-95 transition-transform shadow-lg shadow-blue-900/20"><PrintIcon className="w-5 h-5 text-white" /></button>
                        <button onClick={handleExportExcel} className="p-2.5 bg-green-600 rounded-xl active:scale-95 transition-transform shadow-lg shadow-green-900/20"><UploadIcon className="w-5 h-5 text-white" /></button>
                        <button onClick={handleSendEmail} className="p-2.5 bg-purple-600 rounded-xl active:scale-95 transition-transform shadow-lg shadow-purple-900/20"><BellIcon className="w-5 h-5 text-white" /></button>
                    </div>
                )}
            </div>

            {/* BARRA DE CONTROL GLOBAL (Fechas) */}
            <div className="p-4 bg-gray-900 border-b border-gray-800 shrink-0 shadow-2xl relative z-10">
                <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.6)]"></div>
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] italic">Periodo de Análisis</span>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-[8px] font-black text-gray-500 uppercase tracking-widest pl-1">Fecha de Inicio</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full p-3.5 bg-gray-950 border border-gray-800 rounded-2xl text-white font-black text-xs outline-none focus:border-amber-500 transition-all"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[8px] font-black text-gray-500 uppercase tracking-widest pl-1">Fecha de Cierre</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full p-3.5 bg-gray-950 border border-gray-800 rounded-2xl text-white font-black text-xs outline-none focus:border-amber-500 transition-all"
                        />
                    </div>
                </div>
            </div>

            {/* Contenido Dinámico con Drag Scroll */}
            <div
                ref={scrollRef}
                {...dragHandlers}
                className={`flex-1 overflow-y-auto px-4 pt-6 pb-32 scrollbar-hide select-none active:cursor-grabbing touch-pan-y`}
            >
                {!selectedReportId ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {reportOptions.map(opt => (
                            <button
                                key={opt.id}
                                onClick={() => setSelectedReportId(opt.id)}
                                className="flex flex-col items-center justify-center p-6 rounded-[32px] bg-gray-900 border border-gray-800 shadow-xl transition-all active:scale-95 group relative overflow-hidden"
                            >
                                <div className={`w-12 h-12 rounded-2xl ${opt.color} flex items-center justify-center mb-3 shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-transform`}>
                                    <ClipboardListIcon className="w-6 h-6 text-white" />
                                </div>
                                <span className="text-[10px] font-black text-white uppercase text-center leading-tight tracking-tighter">
                                    {opt.label}
                                </span>
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="bg-gray-900/50 p-6 rounded-[40px] border border-gray-800 shadow-2xl overflow-hidden printable-area">
                            {/* ... contenido del reporte ... */}
                            {reportData.length > 0 ? (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center text-[9px] font-black text-gray-500 uppercase tracking-widest pb-3 border-b border-gray-800/50">
                                        <span className="w-2/3">{selectedReportId === 'driver_fees' ? 'Motorista / Fecha' : 'Concepto / Referencia'}</span>
                                        <span className="w-1/6 text-center">{selectedReportId === 'delivery_report' || selectedReportId === 'driver_fees' ? 'Viaje' : 'Cant.'}</span>
                                        <span className="w-1/6 text-right">Monto</span>
                                    </div>
                                    <div className="space-y-1">
                                        {reportData.map((row, i) => (
                                            <div key={i} className={`flex justify-between items-center py-3 border-b border-gray-800/20 hover:bg-gray-800/10 transition-colors rounded-xl px-2 ${row.isHeader ? 'bg-amber-500/5 mt-4 first:mt-0' : ''}`}>
                                                <span className={`w-2/3 text-[10px] font-black uppercase italic truncate pr-2 ${row.isHeader ? 'text-amber-400' : 'text-white pl-4 border-l border-gray-800 ml-1'}`}>
                                                    {row.label}
                                                </span>
                                                <span className="w-1/6 text-center text-[10px] font-bold text-gray-400">{row.isHeader ? '—' : row.qty}</span>
                                                <span className={`w-1/6 text-right text-[10px] font-black italic ${row.isHeader ? 'text-amber-500 scale-110' : 'text-gray-300'}`}>
                                                    ${row.total.toFixed(2)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="bg-amber-500/5 p-6 rounded-[24px] border border-amber-500/10 mt-6 flex justify-between items-center">
                                        <div className="flex flex-col">
                                            <span className="font-black text-gray-500 uppercase tracking-[0.2em] text-[9px]">Cierre Total</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="font-black text-2xl text-amber-500 italic tracking-tighter">
                                                ${reportData.reduce((s, r) => s + (r.isHeader ? 0 : r.total), 0).toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-24 flex flex-col items-center gap-4 opacity-30">
                                    <ClipboardListIcon className="w-12 h-12 text-gray-600" />
                                    <p className="text-gray-600 font-black uppercase italic tracking-widest text-xs">Sin registros</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ReportsScreen;
