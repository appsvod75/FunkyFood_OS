
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Order, PaymentMethod, CashClosingReport } from '../types';
import { api } from '../api';
import { toast } from 'react-hot-toast';
import { getElSalvadorDateString } from '../utils/dates';
import { PrintIcon, SaveIcon, MailIcon } from './icons';
import CashClosingTicketModal from './CashClosingTicketModal';
import ConfirmationModal from './ConfirmationModal';
import PinVerificationModal from './PinVerificationModal';
import { UserRole } from '../types';
import { ClipboardListIcon, XIcon, ClockIcon, UserIcon, TableIcon } from './icons';

interface OrderAuditDetail {
    id: string;
    dailyOrderNumber: number;
    time: string;
    waiter: string;
    type: string;
    amount: number;
}

interface CashClosingScreenProps {
    orders: Order[];
    activeOrders?: Order[]; // Optional to avoid breaking other usages if any
    onForceClose?: (orders: Order[]) => Promise<void>;
    onBack: () => void;
    cashClosingReports: CashClosingReport[];
    setCashClosingReports: React.Dispatch<React.SetStateAction<CashClosingReport[]>>;
    branchId: number;
    branchName?: string;
}

// ... helper functions ...
const getTodayDateString = () => getElSalvadorDateString();

const CashClosingScreen: React.FC<CashClosingScreenProps> = ({ orders, activeOrders = [], onForceClose, onBack, cashClosingReports, setCashClosingReports, branchId, branchName }) => {
    const todayString = useMemo(() => getTodayDateString(), []);
    // RETROACTIVE LOGIC START
    const [selectedDate, setSelectedDate] = useState(() => {
        // --- SMART DEFAULT DATE ---
        // If there's an OPEN session for this branch, prioritize its date
        const openSession = [...(cashClosingReports || [])]
            .filter(r => r.branchId === branchId && r.status === 'OPEN')
            .sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0))[0];
        
        return openSession ? openSession.date : getTodayDateString();
    });
    const [historicalOrders, setHistoricalOrders] = useState<Order[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);

    useEffect(() => {
        const fetchOrdersForView = async () => {
            setIsLoadingHistory(true);
            try {
                // FIND THE REPORT FOR THIS DATE AND BRANCH
                const reportsForDate = cashClosingReports.filter(r => r.date === selectedDate && r.branchId === branchId);
                
                // Prioritize the report we are looking at (if existing) or the latest one
                const targetReport = [...reportsForDate].sort((a, b) => {
                    if (a.status === 'CLOSED' && b.status !== 'CLOSED') return -1;
                    if (a.status !== 'CLOSED' && b.status === 'CLOSED') return 1;
                    return (Number(b.id) || 0) - (Number(a.id) || 0);
                })[0];

                const filters: any = {
                    branchId: branchId,
                    limit: 1000,
                    includeActive: true
                };

                if (targetReport) {
                    filters.cashReportId = targetReport.id;
                } else {
                    filters.startDate = selectedDate;
                    filters.endDate = selectedDate;
                }

                const result = await api.getHistory(filters);

                // Hydrate slightly to match expected properties
                const hydrated = (Array.isArray(result) ? result : []).map((o: any) => ({
                    ...o,
                    id: String(o.id),
                    createdAt: o.createdAt || (o as any).created_at,
                    total: parseFloat(o.total || '0'),
                    branchId: o.branch_id || o.branchId || branchId,
                    cashReportId: o.cash_report_id || o.cashReportId
                }));

                setHistoricalOrders(hydrated);
            } catch (error) {
                console.error("Failed to fetch session orders:", error);
                toast.error("Error al cargar datos de la sesión");
            } finally {
                setIsLoadingHistory(false);
            }
        };

        fetchOrdersForView();
    }, [selectedDate, branchId, cashClosingReports]);

    const existingReport = useMemo(() => {
        if (!cashClosingReports || !Array.isArray(cashClosingReports)) return null;
        const reportsForDate = cashClosingReports.filter(report => report.date === selectedDate && report.branchId === branchId);
        if (reportsForDate.length === 0) return null;
        
        // Sort: OPEN first (needs action), then by ID descending
        return [...reportsForDate].sort((a, b) => {
            if (a.status === 'OPEN' && b.status !== 'OPEN') return -1;
            if (a.status !== 'OPEN' && b.status === 'OPEN') return 1;
            return (Number(b.id) || 0) - (Number(a.id) || 0);
        })[0];
    }, [cashClosingReports, selectedDate, branchId]);

    const globalOpenSession = useMemo(() => {
        if (!cashClosingReports || !Array.isArray(cashClosingReports)) return null;
        return [...cashClosingReports]
            .filter(r => r.branchId === branchId && r.status === 'OPEN')
            .sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0))[0];
    }, [cashClosingReports, branchId]);

    const activeOrdersForView = useMemo(() => {
        // Prioritize historicalOrders since they are fetched by strict session ID/branch
        // Fallback to props.orders ONLY if we are on today and haven't fetched anything yet
        const rawOrders = (historicalOrders && historicalOrders.length > 0) 
            ? historicalOrders 
            : (selectedDate === todayString ? orders : []);

        if (!rawOrders || rawOrders.length === 0) return [];
        
        // --- SESIÓN ACTIVA PARA REPORTE ---
        const openSession = selectedDate === todayString 
            ? [...(cashClosingReports || [])]
                .filter(r => r.branchId === branchId && r.status === 'OPEN')
                .sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0))[0]
            : null;

        return rawOrders.filter(o => {
            if (!o) return false;
            
            const orderReportId = o.cashReportId ? String(o.cashReportId) : null;
            const currentReportId = existingReport?.id ? String(existingReport.id) : null;

            // Prioridad 1: Órdenes vinculadas explícitamente al reporte que estamos viendo
            if (currentReportId && orderReportId === currentReportId) return true;

            // Prioridad 2: Órdenes vinculadas a la sesión abierta actual (si estamos viendo el día de hoy)
            if (openSession && orderReportId === String(openSession.id)) return true;

            // --- PROTECCIÓN MADRUGADA ---
            // Si la orden NO tiene sesión asignada (huérfana) y estamos viendo la sesión abierta actual
            // Y la orden es reciente (últimas 18 horas), la incluimos para que no se pierda el dinero.
            if (!orderReportId && openSession) {
                const orderDate = new Date(o.createdAt || (o as any).created_at);
                const diffHours = (new Date().getTime() - orderDate.getTime()) / (1000 * 60 * 60);
                if (diffHours < 18) return true; 
            }

            // Si la orden ya pertenece a OTRO reporte diferente al que estamos viendo, la ocultamos
            if (orderReportId && currentReportId && orderReportId !== currentReportId) return false;

            // Prioridad 3: Fallback por fecha del calendario
            // IMPORTANTE: Solo usamos la fecha si la orden NO pertenece ya a otra sesión diferente
            if (orderReportId && (!currentReportId || orderReportId !== currentReportId)) return false;

            const d = new Date(o.createdAt || (o as any).created_at);
            if (isNaN(d.getTime())) return false;
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const dStr = `${year}-${month}-${day}`;

            return dStr === selectedDate;
        });
    }, [selectedDate, todayString, orders, historicalOrders, cashClosingReports, branchId, existingReport]);

    const activePendingsForView = useMemo(() => {
        if (selectedDate === todayString) {
            return activeOrders || [];
        }
        // For past dates, include any order from historical data that isn't finished
        return (historicalOrders || []).filter(o => o.status === 'active' && o.deliveryStatus !== 'delivered');
    }, [selectedDate, todayString, activeOrders, historicalOrders]);

    const initialCashKey = useMemo(() => `cash_closing_initial_${branchId}_${selectedDate}`, [branchId, selectedDate]);

    const [initialCash, setInitialCash] = useState('');

    // Reset initial cash when date changes or existingReport arrives
    useEffect(() => {
        if (existingReport) {
            let val = parseFloat(String(existingReport.initialCash));
            
            // --- HEURISTIC: If existing report has 0, but there's another OPEN report for this date with money, use it ---
            if (val === 0) {
                const openReportWithCash = cashClosingReports.find(r => 
                    r.date === selectedDate && 
                    r.branchId === branchId && 
                    r.status === 'OPEN' && 
                    parseFloat(String(r.initialCash)) > 0
                );
                if (openReportWithCash) {
                    val = parseFloat(String(openReportWithCash.initialCash));
                }
            }
            
            setInitialCash(isNaN(val) ? '' : val.toFixed(2));
        } else {
            const savedDraft = localStorage.getItem(initialCashKey);
            if (savedDraft) {
                const val = parseFloat(savedDraft);
                setInitialCash(isNaN(val) ? '' : val.toFixed(2));
            } else {
                setInitialCash('');
            }
        }
    }, [existingReport, initialCashKey, cashClosingReports, selectedDate, branchId]);
    // RETROACTIVE LOGIC END

    const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
    const [isForceClosing, setIsForceClosing] = useState(false);
    const [confirmAction, setConfirmAction] = useState<{ type: 'replace' | 'force' } | null>(null);
    const [showPinModal, setShowPinModal] = useState(false); // NEW STATE FOR PIN
    const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
    const [auditTitle, setAuditTitle] = useState('');
    const [auditOrders, setAuditOrders] = useState<OrderAuditDetail[]>([]);
    const [showDateEditPinModal, setShowDateEditPinModal] = useState(false);
    const [showDateEditModal, setShowDateEditModal] = useState(false);
    const [editingNewDate, setEditingNewDate] = useState('');
    const [showDeletePinModal, setShowDeletePinModal] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const numericInitialCash = parseFloat(initialCash) || 0;

    const hasPendings = activePendingsForView && activePendingsForView.length > 0;

    // ... scroll logic ...
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

    // ... calculations ...
    const totalChangeOut = useMemo(() => {
        return activeOrdersForView.reduce((sum, order) => {
            if (order.status !== 'completed') return sum;
            return sum + (order.changeGiven || 0);
        }, 0);
    }, [activeOrdersForView]);

    const summaryAndCharges = useMemo(() => {
        let totalSvc = 0;
        let totalComm = 0;
        const orderDetailsByMethod: Record<string, OrderAuditDetail[]> = {};

        const summaryData = activeOrdersForView.reduce((acc, order) => {
            const isFinished = order.status === 'completed' || order.deliveryStatus === 'delivered';
            if (!isFinished) return acc;

            totalSvc += Number(order.serviceCharge || 0);
            totalComm += Number(order.cardCommission || 0);

            const payments = order.payments || [];
            if (payments.length === 0) return acc;

            payments.forEach(payment => {
                const rawMethod = String(payment.method || '');
                const method = (Object.values(PaymentMethod).find(
                    m => m.toLowerCase() === rawMethod.toLowerCase()
                ) || rawMethod) as PaymentMethod;

                if (!acc[method]) acc[method] = 0;
                const amt = Number(payment.amount || 0);
                acc[method] += amt;

                // Add to audit details
                if (!orderDetailsByMethod[method]) orderDetailsByMethod[method] = [];
                
                const timeStr = order.createdAt ? new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--';
                
                // For Cash, we store the NET amount (payment - change) to match the final display
                const finalAmt = (method === PaymentMethod.Cash) ? amt - (order.changeGiven || 0) : amt;

                orderDetailsByMethod[method].push({
                    id: order.id,
                    dailyOrderNumber: order.dailyOrderNumber,
                    time: timeStr,
                    waiter: (order as any).waiter_name || order.waiter?.name || (order as any).user_name || 'ADMIN',
                    type: order.type,
                    amount: finalAmt
                });
            });
            return acc;
        }, {} as Record<string, number>);

        const sortedSummary = Object.entries(summaryData).sort((a, b) => {
            if (a[0] === PaymentMethod.Cash) return -1;
            if (b[0] === PaymentMethod.Cash) return 1;
            return a[0].localeCompare(b[0]);
        }).map(([method, total]) => ({
            method: method as PaymentMethod,
            total: (method === PaymentMethod.Cash) ? Number(total) - totalChangeOut : Number(total),
        }));

        return {
            summary: sortedSummary,
            totalServiceCharge: totalSvc,
            totalCardCommission: totalComm,
            orderDetailsByMethod
        };
    }, [activeOrdersForView, totalChangeOut]);

    const orderDetailsByMethod = summaryAndCharges.orderDetailsByMethod;

    const summary = summaryAndCharges.summary;
    const totalServiceCharge = summaryAndCharges.totalServiceCharge;
    const totalCardCommission = summaryAndCharges.totalCardCommission;

    const totalSales = useMemo(() => summary.reduce((sum, item) => sum + item.total, 0), [summary]);
    const totalCashIn = useMemo(() => {
        // Find raw cash in summaryData (before change adjustment) to keep totalCashIn logic if needed elsewhere
        // But wait, totalCashIn is usually used for expected cash.
        // Let's redefine totalCashIn as the NET cash now to simplify.
        return summary.find(item => item.method === PaymentMethod.Cash)?.total || 0;
    }, [summary]);

    const totalOrdersCount = useMemo(() => {
        return activeOrdersForView.filter(o => o.status === 'completed').length;
    }, [activeOrdersForView]);

    const netCashSales = totalCashIn; // Now totalCashIn IS netCashSales
    const expectedCash = useMemo(() => numericInitialCash + netCashSales, [numericInitialCash, netCashSales]);
    
    // Revenue is the sum of net payments (which is now exactly totalSales)
    const netRevenue = totalSales;

    const isAlreadySaved = !!existingReport;

    const isDirty = useMemo(() => {
        if (!existingReport) return true;

        const savedInitial = parseFloat(String(existingReport.initialCash));
        const currentInitial = parseFloat(initialCash) || 0;

        // Check if values changed significantly
        if (Math.abs(savedInitial - currentInitial) > 0.0001) return true;
        if (Math.abs(existingReport.totalSales - netRevenue) > 0.0001) return true;
        if (Math.abs(existingReport.totalCashIn - totalCashIn) > 0.0001) return true;
        if (Math.abs(existingReport.totalChangeOut - totalChangeOut) > 0.0001) return true;
        if ((existingReport.totalOrders || 0) !== totalOrdersCount) return true;

        return false;
    }, [existingReport, initialCash, totalSales, totalCashIn, totalChangeOut, totalOrdersCount]);

    const saveButtonLabel = useMemo(() => {
        if (!isAlreadySaved) return 'GUARDAR CIERRE';
        return isDirty ? 'ACTUALIZAR CIERRE' : 'CIERRE GUARDADO';
    }, [isAlreadySaved, isDirty]);

    const generateReportObject = (): CashClosingReport => {
        const now = new Date();
        const dateString = selectedDate;

        return {
            ...(existingReport?.id ? { id: existingReport.id } : {}),
            date: dateString,
            createdAt: now, // Ensure it's a Date object for .toLocaleString()
            initialCash: numericInitialCash,
            totalSales: netRevenue, // WE SAVE THE NET REVENUE
            totalCashIn,
            totalChangeOut,
            expectedCash,
            totalOrders: totalOrdersCount,
            totalServiceCharge,
            totalCardCommission,
            summary,
            branchId
        };
    };

    const handleSaveReport = async () => {
        const report = generateReportObject();
        const isUpdate = isAlreadySaved;

        const loadingToast = toast.loading(isUpdate ? 'ACTUALIZANDO CIERRE...' : 'GUARDANDO CIERRE...');

        try {
            let savedReport;
            // The API uses a single saveCashClosing method which likely handles upsert based on date/branch
            savedReport = await api.saveCashClosing(report, true);

            setCashClosingReports(prev => {
                // Check if we are updating an existing report in state
                const exists = prev.some(r => r.date === savedReport.date && r.branchId === savedReport.branchId);
                if (exists) {
                    return prev.map(r => (r.date === savedReport.date && r.branchId === savedReport.branchId) ? savedReport : r);
                }
                return [...prev, savedReport];
            });

            // CLEAR DRAFT ON SUCCESS
            localStorage.removeItem(initialCashKey);

            toast.success(isUpdate ? 'CIERRE ACTUALIZADO CORRECTAMENTE' : 'CIERRE GUARDADO CORRECTAMENTE', { id: loadingToast });

            // Generate ticket automatically on save
            // handlePrint(); // Optional: Auto-print
        } catch (error) {
            console.error("Failed to save cash closing:", error);
            toast.error(`ERROR AL GUARDAR: ${error instanceof Error ? error.message : 'Unknown error'}`, { id: loadingToast });
        }
    };

    const handleSave = () => {
        if (hasPendings) {
            alert('NO SE PUEDE CERRAR CAJA: Hay pedidos pendientes.');
            return;
        }

        if (!isDirty && isAlreadySaved) {
            toast('El cierre ya está guardado y no tiene cambios.', { icon: 'ℹ️' });
            return;
        }

        if (isAlreadySaved) {
            // IF UPDATING: Require PIN
            setShowPinModal(true);
        } else {
            // IF NEW: Save directly
            handleSaveReport();
        }
    };

    const handlePrint = () => {
        setIsTicketModalOpen(true);
    };

    const handleDeleteSession = async () => {
        if (!existingReport?.id) return;
        setIsDeleting(true);
        try {
            await api.deleteCashClosing(existingReport.id);
            setCashClosingReports(prev => prev.filter(r => r.id !== existingReport.id));
            toast.success('Sesión de caja eliminada correctamente.');
            setShowDeletePinModal(false);
        } catch (err) {
            toast.error(`Error al eliminar: ${err instanceof Error ? err.message : 'Error desconocido'}`);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleOpenAudit = (method: string) => {
        const orders = orderDetailsByMethod[method] || [];
        setAuditTitle(`DETALLE DE PAGOS: ${method.toUpperCase()}`);
        setAuditOrders(orders);
        setIsAuditModalOpen(true);
    };

    const handleInitialCashBlur = () => {
        if (!initialCash) return;
        const val = parseFloat(initialCash);
        if (!isNaN(val)) {
            setInitialCash(val.toFixed(2));
        }
    };

    const handleInitialCashFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        // Option A: Clear
        // setInitialCash('');

        // Option B: Select (Better for numbers as user might decide not to change it)
        e.target.select();
    };

    const handleForceCloseClick = () => {
        if (!onForceClose) return;
        setConfirmAction({ type: 'force' });
    };

    const confirmForceClose = async () => {
        if (!onForceClose) return;
        setIsForceClosing(true);
        await onForceClose(activeOrders);
        setIsForceClosing(false);
        setConfirmAction(null);
    };

    return (
        <div className="flex flex-col h-full overflow-hidden max-w-7xl mx-auto w-full">
            <div className="flex flex-wrap justify-between items-center gap-4 p-4 shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="bg-gray-800 p-2 rounded-full hover:bg-gray-700 active:scale-90 transition-all">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <h1 className="text-xl font-black text-white italic uppercase tracking-tighter leading-none">CIERRE DE <span className="text-amber-400">CAJA</span></h1>
                    {existingReport && (
                        <div className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest border ${
                            existingReport.status === 'OPEN' 
                                ? 'bg-green-500/10 text-green-400 border-green-500/30' 
                                : (existingReport.initialCash === 0 && existingReport.totalOrders > 0 
                                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse'
                                    : 'bg-blue-500/10 text-blue-400 border-blue-500/30')
                        }`}>
                            {existingReport.status === 'OPEN' ? '🟢 Sesión Abierta' : (existingReport.initialCash === 0 ? '⚠️ Cierre sin Apertura' : '🔹 Cierre Guardado')}
                        </div>
                    )}
                </div>

                {/* --- SMART WARNING BANNER (Solo si hay OPEN de fecha anterior a la seleccionada) --- */}
                {globalOpenSession && globalOpenSession.date < selectedDate && (
                    <div className="flex-1 min-w-[300px] bg-rose-600/20 border border-rose-500/30 rounded-2xl p-3 flex items-center gap-3 animate-pulse">
                        <div className="w-10 h-10 bg-rose-600 rounded-full flex items-center justify-center shrink-0 shadow-lg shadow-rose-900/40">
                            <span className="text-xl">⚠️</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest leading-none mb-1">Acción Requerida</span>
                            <p className="text-xs font-bold text-white leading-tight">
                                CIERRE DE <span className="underline decoration-rose-500 decoration-2">{globalOpenSession.date}</span> AÚN NO REALIZADO. 
                                <br/>
                                <span className="text-[9px] text-gray-400 uppercase italic">Por favor haz el cierre de esa sesión antes de cambiar de fecha.</span>
                            </p>
                        </div>
                        <button 
                            onClick={() => setSelectedDate(globalOpenSession.date)}
                            className="ml-auto px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-black rounded-xl uppercase tracking-wider transition-all active:scale-95 shadow-lg shadow-rose-900/20"
                        >
                            Ir a Sesión Abierta
                        </button>
                    </div>
                )}

                <div className="flex items-center gap-2 bg-gray-800/80 p-1.5 rounded-2xl border border-gray-700 shadow-inner group">
                    <span className="text-[9px] font-black text-gray-500 uppercase ml-2 group-hover:text-amber-500 transition-colors">Fecha:</span>
                    <input
                        type="date"
                        value={selectedDate}
                        max={todayString}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="bg-transparent text-white font-black text-xs uppercase outline-none px-2 py-1 cursor-pointer focus:text-amber-400 transition-colors [color-scheme:dark]"
                    />
                    {existingReport?.id && (
                        <button
                            onClick={() => setShowDateEditPinModal(true)}
                            className="p-1.5 text-gray-500 hover:text-amber-400 transition-all active:scale-90"
                            title="Editar fecha de apertura"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                        </button>
                    )}
                    {existingReport?.id && existingReport.status === 'OPEN' && existingReport.totalOrders === 0 && (
                        <button
                            onClick={() => setShowDeletePinModal(true)}
                            className="p-1.5 text-gray-500 hover:text-red-400 transition-all active:scale-90"
                            title="Eliminar sesión vacía"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    )}
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleSave}
                        disabled={hasPendings || (isAlreadySaved && !isDirty)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all active:scale-95 font-black uppercase tracking-wide text-[10px] shadow-lg ${hasPendings
                            ? 'bg-gray-600 cursor-not-allowed opacity-50 text-gray-400'
                            : (!isAlreadySaved
                                ? 'bg-green-600 hover:bg-green-500 text-white ring-1 ring-green-500/50 ring-offset-1 ring-offset-gray-900'
                                : (isDirty
                                    ? 'bg-amber-600 hover:bg-amber-500 text-white ring-1 ring-amber-500/50 ring-offset-1 ring-offset-gray-900'
                                    : 'bg-gray-800 text-gray-500 border border-gray-700 cursor-default opacity-80'
                                )
                            )
                            }`}
                        title={hasPendings ? "Cierre mesas pendientes primero" : (isAlreadySaved ? (isDirty ? "Actualizar registro existente" : "Cierre ya guardado") : "Guardar nuevo cierre")}
                    >
                        <SaveIcon className="w-4 h-4" />
                        <span>{saveButtonLabel}</span>
                    </button>
                    {isAlreadySaved && (
                        <button
                            onClick={handleSaveReport}
                            className="flex items-center gap-2 px-3 py-2 bg-gray-800 text-emerald-400 border border-emerald-500/30 rounded-xl hover:bg-emerald-600 hover:text-white hover:border-emerald-500 transition-all active:scale-95 font-black uppercase tracking-wide text-[10px]"
                            title="Re-enviar Reporte por Correo"
                        >
                            <MailIcon className="w-4 h-4" />
                            <span>ENVIAR</span>
                        </button>
                    )}
                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 px-3 py-2 bg-gray-800 text-blue-400 border border-blue-500/30 rounded-xl hover:bg-blue-600 hover:text-white hover:border-blue-500 transition-all active:scale-95 font-black uppercase tracking-wide text-[10px]"
                        title="Imprimir Reporte"
                    >
                        <PrintIcon className="w-4 h-4" />
                        <span>IMPRIMIR</span>
                    </button>
                </div>
            </div>

            <div
                ref={scrollRef}
                onMouseDown={handleMouseDown}
                onMouseLeave={handleMouseLeave}
                onMouseUp={handleMouseUp}
                onMouseMove={handleMouseMove}
                className={`flex-1 overflow-y-auto px-4 pb-32 scrollbar-hide select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'} ${isLoadingHistory ? 'opacity-30 pointer-events-none' : ''}`}
            >
                <div className="space-y-4">
                    {/* WARNING BANNER */}
                    {hasPendings && (
                        <div className="bg-red-500/20 border-2 border-red-500 p-4 rounded-[24px] mb-4 animate-bounce-short">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-red-400 font-black uppercase text-xs tracking-widest flex items-center gap-2">
                                    <span className="text-xl">⚠️</span> {activePendingsForView.length} PEDIDOS PENDIENTES
                                </h3>
                                {selectedDate === todayString && onForceClose && (
                                    <button
                                        onClick={handleForceCloseClick}
                                        disabled={isForceClosing}
                                        className="bg-red-600 hover:bg-red-500 text-white px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50"
                                    >
                                        {isForceClosing ? 'CERRANDO...' : 'FORZAR CIERRE'}
                                    </button>
                                )}
                            </div>
                            <p className="text-gray-400 text-[10px] italic mb-2">No puedes cerrar caja con mesas abiertas. Finalízalas manualmente{selectedDate === todayString ? ' o usa "Forzar Cierre"' : ''}.</p>
                            <div className="max-h-24 overflow-y-auto space-y-1">
                                {activePendingsForView.map(o => (
                                    <div key={o.id} className="text-[10px] text-red-300 font-mono bg-red-900/20 px-2 py-1 rounded flex justify-between">
                                        <span>#{o.dailyOrderNumber} - {o.type}</span>
                                        <span>${o.total.toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className={`p-6 rounded-[32px] border shadow-xl transition-all duration-500 ${
                        numericInitialCash === 0 
                            ? 'bg-amber-900/20 border-amber-500/30 ring-1 ring-amber-500/20' 
                            : 'bg-gray-900/50 border-gray-800'
                    }`}>
                        <div className="flex flex-col items-center mb-2">
                            <label htmlFor="initial-cash" className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">
                                Fondo de Caja Inicial (Caja Chica)
                            </label>
                            {numericInitialCash === 0 && (
                                <span className="text-[8px] font-black text-amber-500 uppercase animate-pulse">⚠️ No se registró apertura este día</span>
                            )}
                        </div>
                        <input
                            id="initial-cash"
                            type="number"
                            step="0.01"
                            value={initialCash}
                            onChange={(e) => setInitialCash(e.target.value)}
                            onBlur={handleInitialCashBlur}
                            onFocus={handleInitialCashFocus}
                            placeholder="0.00"
                            className={`w-full p-4 bg-gray-800 border-2 rounded-2xl font-black text-3xl text-center focus:outline-none transition-all ${
                                numericInitialCash === 0 
                                    ? 'border-amber-500/50 text-amber-200 focus:border-amber-400' 
                                    : 'border-gray-700 text-white focus:border-amber-500'
                            }`}
                        />
                    </div>

                    <div className="bg-gray-900/50 p-6 rounded-[32px] border border-gray-800 shadow-xl space-y-4">
                        <h2 className="text-sm font-black text-amber-500 border-b border-gray-800 pb-2 mb-4 uppercase italic">Ventas por Método</h2>
                        <div className="space-y-3">
                            {summary.length > 0 ? (
                                <>
                                    {summary.map(item => {
                                        const isCxC = item.method === PaymentMethod.Credit || item.method === PaymentMethod.Employee;
                                        const isCash = item.method === PaymentMethod.Cash;
                                        const displayTotal = isCash ? netCashSales : item.total;
                                        
                                        return (
                                            <div key={item.method} className={`flex justify-between items-center ${isCxC ? 'opacity-70 border-l-2 border-amber-500/30 pl-2' : ''}`}>
                                                <div className="flex items-center gap-3">
                                                    <button 
                                                        onClick={() => handleOpenAudit(item.method)}
                                                        className="p-1.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500 hover:text-white rounded-lg transition-all active:scale-90 shadow-sm"
                                                        title="Ver desglose de órdenes"
                                                    >
                                                        <ClipboardListIcon className="w-3.5 h-3.5" />
                                                    </button>
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-bold text-gray-400 uppercase">{item.method}</span>
                                                        {isCxC && <span className="text-[8px] text-amber-500/70 font-black uppercase tracking-widest italic">Por Cobrar</span>}
                                                    </div>
                                                </div>
                                                <span className={`font-black italic ${isCxC ? 'text-gray-300' : 'text-white'}`}>${displayTotal.toFixed(2)}</span>
                                            </div>
                                        );
                                    })}
                                </>
                            ) : (
                                <p className="text-gray-600 text-center italic text-xs uppercase font-black py-4">Sin ventas hoy</p>
                            )}
                        </div>
                        <div className="border-t border-gray-800 pt-4 mt-4 space-y-2">
                            <div className="flex justify-between items-center opacity-60">
                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest italic">Cargos por Servicio</span>
                                <span className="font-bold text-gray-400 text-xs">${totalServiceCharge.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center opacity-60">
                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest italic">Comisiones de Tarjeta (Banco)</span>
                                <span className="font-bold text-gray-400 text-xs">${totalCardCommission.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center pt-2">
                                <span className="font-black text-gray-500 uppercase text-xs tracking-tighter italic">Venta Total Bruta</span>
                                <div className="flex flex-col items-end">
                                    <span className="font-black text-2xl text-amber-500 italic leading-none">${netRevenue.toFixed(2)}</span>
                                    <span className="text-[8px] text-gray-500 font-black uppercase mt-1">Suma de Pagos + Cargos</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-green-600/10 border-2 border-green-500/30 p-6 rounded-[32px] shadow-xl space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black text-gray-400 uppercase">Ventas en Efectivo (Neto)</span>
                            <span className="font-bold text-white text-sm">+ ${netCashSales.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center opacity-60">
                            <span className="text-[10px] font-black text-gray-400 uppercase">Fondo Inicial (Caja Chica)</span>
                            <span className="font-bold text-white text-sm">+ ${numericInitialCash.toFixed(2)}</span>
                        </div>
                        <div className="border-t-2 border-green-500/20 border-dashed pt-4 mt-2 flex flex-col items-center gap-1">
                            <span className="text-[10px] font-black text-green-500 uppercase tracking-[0.2em]">Dinero Total en Gaveta</span>
                            <span className="font-black text-4xl text-green-400 italic">${expectedCash.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {isTicketModalOpen && (
                <CashClosingTicketModal
                    report={generateReportObject()}
                    branchName={branchName}
                    onClose={() => setIsTicketModalOpen(false)}
                />
            )}

            <PinVerificationModal
                isOpen={showPinModal}
                onClose={() => setShowPinModal(false)}
                onSuccess={(user) => {
                    setShowPinModal(false);
                    // Proceed with save after verification
                    handleSaveReport();
                }}
                requiredRole={UserRole.Admin}
                title="ACTUALIZAR CIERRE"
                message="Se requiere autorización de Admin para modificar un cierre existente."
            />

            <PinVerificationModal
                isOpen={showDeletePinModal}
                onClose={() => setShowDeletePinModal(false)}
                onSuccess={() => {
                    setShowDeletePinModal(false);
                    handleDeleteSession();
                }}
                requiredRole={UserRole.Admin}
                title="ELIMINAR APERTURA"
                message="Se requiere autorización de Admin para eliminar una sesión de caja. Esta acción no se puede deshacer."
            />

            <PinVerificationModal
                isOpen={showDateEditPinModal}
                onClose={() => setShowDateEditPinModal(false)}
                onSuccess={() => {
                    setShowDateEditPinModal(false);
                    setEditingNewDate(selectedDate);
                    setShowDateEditModal(true);
                }}
                requiredRole={UserRole.Admin}
                title="EDITAR FECHA DE APERTURA"
                message="Se requiere autorización de Admin para modificar la fecha de apertura."
            />

            {showDateEditModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-gray-900 border border-gray-800 w-full max-w-sm rounded-3xl p-8 shadow-2xl">
                        <div className="text-center space-y-6">
                            <div className="mx-auto w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center border border-amber-500/20">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-white uppercase tracking-tight">EDITAR FECHA</h3>
                                <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-2">
                                    Selecciona la nueva fecha para la apertura
                                </p>
                            </div>
                            <input
                                type="date"
                                value={editingNewDate}
                                max={getTodayDateString()}
                                onChange={(e) => setEditingNewDate(e.target.value)}
                                className="w-full bg-gray-800 text-white font-black text-center text-lg px-4 py-3 rounded-xl border border-gray-700 focus:border-amber-500 focus:outline-none transition-colors [color-scheme:dark]"
                            />
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowDateEditModal(false)}
                                    className="flex-1 px-4 py-3 bg-gray-800 text-gray-400 rounded-xl hover:bg-gray-700 font-black text-xs uppercase tracking-wider transition-all"
                                >
                                    CANCELAR
                                </button>
                                <button
                                    onClick={async () => {
                                        if (!existingReport?.id || !editingNewDate || editingNewDate === selectedDate) {
                                            setShowDateEditModal(false);
                                            return;
                                        }
                                        try {
                                            const loadingToast = toast.loading('ACTUALIZANDO FECHA...');
                                            const updated = await api.updateCashClosingDate(existingReport.id, editingNewDate, branchId);
                                            setCashClosingReports(prev => prev.map(r => 
                                                r.id === updated.id ? { ...r, date: updated.date } : r
                                            ));
                                            setSelectedDate(editingNewDate);
                                            toast.success('FECHA ACTUALIZADA CORRECTAMENTE', { id: loadingToast });
                                            setShowDateEditModal(false);
                                        } catch (err) {
                                            toast.error(`Error: ${err instanceof Error ? err.message : 'Error desconocido'}`);
                                        }
                                    }}
                                    disabled={!editingNewDate || editingNewDate === selectedDate}
                                    className="flex-1 px-4 py-3 bg-amber-600 text-white rounded-xl hover:bg-amber-500 font-black text-xs uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    CONFIRMAR
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmationModal
                isOpen={!!confirmAction}
                onClose={() => setConfirmAction(null)}
                // @ts-ignore
                onConfirm={async () => {
                    if (confirmAction?.type === 'force') await confirmForceClose();
                }}
                title={confirmAction?.type === 'force' ? '⚠️ FORZAR CIERRE DE CAJA' : 'CONFIRMAR'}
                message={confirmAction?.type === 'force' ? 'Esto cerrará TODAS las mesas abiertas y marcará sus cuentas como PAGADAS EN EFECTIVO. ¿Seguro?' : ''}
                confirmText={confirmAction?.type === 'force' ? 'SÍ, FORZAR CIERRE' : 'CONFIRMAR'}
                cancelText="CANCELAR"
                isDestructive={confirmAction?.type === 'force'}
            />

            {/* Audit Modal */}
            {isAuditModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-gray-900 border border-white/10 w-full max-w-2xl rounded-[32px] overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="p-6 bg-gray-800/50 border-b border-white/5 flex justify-between items-center shrink-0">
                            <div>
                                <h3 className="text-xl font-black text-white italic uppercase tracking-tighter leading-none">{auditTitle}</h3>
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-2">{auditOrders.length} ÓRDENES EN TOTAL</p>
                            </div>
                            <button 
                                onClick={() => setIsAuditModalOpen(false)}
                                className="p-2 bg-gray-700/50 text-gray-400 hover:text-white hover:bg-red-500/20 rounded-full transition-all active:scale-90"
                            >
                                <XIcon className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-4 overflow-y-auto flex-1 scrollbar-hide">
                            <div className="space-y-2">
                                {auditOrders.length > 0 ? (
                                    <>
                                        <div className="grid grid-cols-12 px-4 py-2 text-[9px] font-black text-gray-600 uppercase tracking-widest italic sticky top-0 bg-gray-900 z-10">
                                            <div className="col-span-2"># ORD</div>
                                            <div className="col-span-3">HORA / TIPO</div>
                                            <div className="col-span-4">MESERO</div>
                                            <div className="col-span-3 text-right">MONTO</div>
                                        </div>
                                        {auditOrders.map((ord, idx) => (
                                            <div 
                                                key={`${ord.id}-${idx}`}
                                                className="grid grid-cols-12 items-center p-4 bg-white/[0.02] border border-white/5 rounded-2xl hover:bg-white/[0.05] transition-all group"
                                            >
                                                <div className="col-span-2">
                                                    <span className="text-sm font-black text-amber-500 italic">#{ord.dailyOrderNumber}</span>
                                                </div>
                                                <div className="col-span-3 flex flex-col gap-0.5">
                                                    <div className="flex items-center gap-1.5 text-gray-300">
                                                        <ClockIcon className="w-3 h-3 text-gray-500" />
                                                        <span className="text-[10px] font-bold">{ord.time}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-gray-500">
                                                        <TableIcon className="w-3 h-3 text-gray-600" />
                                                        <span className="text-[9px] font-black uppercase tracking-tighter truncate">{ord.type}</span>
                                                    </div>
                                                </div>
                                                <div className="col-span-4 flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                                                        <UserIcon className="w-3 h-3 text-purple-400" />
                                                    </div>
                                                    <span className="text-[10px] font-black text-gray-400 uppercase italic truncate">{ord.waiter}</span>
                                                </div>
                                                <div className="col-span-3 text-right">
                                                    <span className="text-sm font-black text-white italic">${ord.amount.toFixed(2)}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </>
                                ) : (
                                    <div className="py-20 flex flex-col items-center justify-center opacity-30">
                                        <ClipboardListIcon className="w-16 h-16 mb-4" />
                                        <p className="text-xs font-black uppercase tracking-widest text-center">NO HAY ÓRDENES REGISTRADAS</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-6 bg-gray-800/30 border-t border-white/5 flex justify-between items-center shrink-0">
                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest italic">TOTAL AUDITORÍA</span>
                            <span className="text-2xl font-black text-amber-500 italic">
                                ${auditOrders.reduce((sum, o) => sum + o.amount, 0).toFixed(2)}
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CashClosingScreen;
