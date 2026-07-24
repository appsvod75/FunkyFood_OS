import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import { ChartBarIcon, SaveIcon, PencilIcon, CalendarIcon, ArrowRightIcon, PlusCircleIcon, PlusIcon, StoreIcon } from './icons';
import NotificationToast from './NotificationToast';

interface DailySale {
    day: number;
    total: number;
}

interface ProjectionData {
    monthYear: string;
    targetAmount: number;
    totalWorkDays: number;
    currentSales: number;
    projection: number;
    daysInMonth: number;
    elapsedDays: number;
    dailySales: DailySale[];
    manualSales?: number | null;
    manualDays?: number | null;
}

interface SalesGoal {
    id: number;
    month_year: string;
    target_amount: number;
    total_work_days: number;
    current_sales: number;
    days_with_sales: number;
    manual_sales: number | null;
    manual_days: number | null;
}

interface Branch {
    id: number;
    name: string;
}

interface SalesProjectionsDashboardProps {
    branchId: number;
    branchName?: string;
    branches?: Branch[]; // Optional for backward combat
    onBack: () => void;
}

export const SalesProjectionsDashboard: React.FC<SalesProjectionsDashboardProps> = ({ branchId, branchName, branches, onBack }) => {
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState<{ message: string | null; title?: string; type?: 'success' | 'error' | 'warning' | 'info' }>({ message: null });

    // Mode: 'list' | 'create_config' | 'detail_view'
    const [viewMode, setViewMode] = useState<'list' | 'create_config' | 'detail_view'>('list');
    const [displayMode, setDisplayMode] = useState<'grid' | 'trend'>('grid');

    // STATE: Active Branch (Centralized Management)
    const [selectedBranchId, setSelectedBranchId] = useState<number>(branchId);

    // LIST DATA
    const [goalsList, setGoalsList] = useState<SalesGoal[]>([]);

    // DETAIL DATA
    const [selectedMonth, setSelectedMonth] = useState<string>('');
    const [projectionData, setProjectionData] = useState<ProjectionData | null>(null);

    // CONFIG FORM STATE
    const [formMonth, setFormMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [formTarget, setFormTarget] = useState('');
    const [formWorkDays, setFormWorkDays] = useState('26');
    const [formManualSales, setFormManualSales] = useState('');
    const [formManualDays, setFormManualDays] = useState('');

    // --- DRAG SCROLL LOGIC ---
    const listScrollRef = useRef<HTMLDivElement>(null);
    const detailScrollRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStartY, setDragStartY] = useState(0);
    const [dragScrollTop, setDragScrollTop] = useState(0);

    const onMouseDown = (e: React.MouseEvent, ref: React.RefObject<HTMLDivElement | null>) => {
        if (!ref.current) return;
        setIsDragging(true);
        setDragStartY(e.pageY - ref.current.offsetTop);
        setDragScrollTop(ref.current.scrollTop);
    };

    const onMouseMove = (e: React.MouseEvent, ref: React.RefObject<HTMLDivElement | null>) => {
        if (!isDragging || !ref.current) return;
        e.preventDefault();
        const y = e.pageY - ref.current.offsetTop;
        const walk = (y - dragStartY) * 1.5; // Scroll speed
        ref.current.scrollTop = dragScrollTop - walk;
    };

    const onMouseUpOrLeave = () => setIsDragging(false);

    // --- EFFECT: Handle Prop Updates ---
    useEffect(() => {
        setSelectedBranchId(branchId);
    }, [branchId]);

    // --- FETCH HANDLERS ---

    const fetchList = async (targetBranchId: number) => {
        setLoading(true);
        try {
            const res = await api.get(`/sales/goals?branchId=${targetBranchId}`);
            if (Array.isArray(res)) {
                setGoalsList(res);
            }
        } catch (error) {
            console.error(error);
            setToast({ title: 'Error', message: 'No se pudo cargar el historial.', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const fetchDetail = async (monthYear: string) => {
        setLoading(true);
        try {
            const res = await api.get(`/sales/projection?branchId=${selectedBranchId}&monthYear=${monthYear}`);
            if (res) {
                setProjectionData(res);
                setViewMode('detail_view');
                setSelectedMonth(monthYear);
            }
        } catch (error) {
            console.error(error);
            setToast({ title: 'Error', message: 'Error al cargar detalles.', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    // Initial Load & On Branch Change
    useEffect(() => {
        fetchList(selectedBranchId);
    }, [selectedBranchId]);


    // --- ACTION HANDLERS ---

    const handleCreateNew = () => {
        setFormMonth(new Date().toISOString().slice(0, 7));
        setFormTarget('');
        setFormWorkDays('26');
        setFormManualSales('');
        setFormManualDays('');
        setViewMode('create_config');
    };

    const handleEditConfig = () => {
        if (!projectionData) return;
        setFormMonth(projectionData.monthYear);
        setFormTarget(String(projectionData.targetAmount));
        setFormWorkDays(String(projectionData.totalWorkDays));
        setFormManualSales(projectionData.manualSales ? String(projectionData.manualSales) : '');
        setFormManualDays(projectionData.manualDays ? String(projectionData.manualDays) : '');
        setViewMode('create_config');
    };

    const handleSaveConfig = async () => {
        const amount = parseFloat(formTarget);
        const days = parseInt(formWorkDays);

        if (isNaN(amount) || amount <= 0) {
            setToast({ title: 'Error', message: 'Ingresa una meta válida.', type: 'warning' });
            return;
        }
        if (isNaN(days) || days <= 0 || days > 31) {
            setToast({ title: 'Error', message: 'Días laborales inválidos.', type: 'warning' });
            return;
        }

        try {
            setLoading(true);
            await api.post('/sales/goals', {
                branchId: selectedBranchId,
                monthYear: formMonth,
                targetAmount: amount,
                totalWorkDays: days,
                manualSales: formManualSales ? parseFloat(formManualSales) : 0,
                manualDays: formManualDays ? parseInt(formManualDays) : 0
            });
            setToast({ title: 'Guardado', message: 'Proyección guardada.', type: 'success' });

            // Reload Detail immediately
            await fetchDetail(formMonth);

            // Refresh list in background
            fetchList(selectedBranchId);

        } catch (error) {
            console.error(error);
            setToast({ title: 'Error', message: 'No se pudo guardar.', type: 'error' });
            setLoading(false);
        }
    };

    // --- HELPERS ---
    const getBranchName = (id: number) => {
        return branches?.find(b => b.id === id)?.name || 'Sucursal desconocida';
    };


    // --- COMPONENTS ---
    const TrendAnalysis = ({ goals, branchName }: { goals: SalesGoal[], branchName: string }) => {
        // Sort goals by month (YYYY-MM)
        const sortedGoals = [...goals].sort((a, b) => a.month_year.localeCompare(b.month_year));

        if (sortedGoals.length < 1) {
            return (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-500 opacity-50">
                    <p className="text-sm font-bold uppercase tracking-widest text-center">Datos insuficientes para análisis de tendencia</p>
                </div>
            );
        }

        const maxVal = Math.max(...sortedGoals.map(g => Math.max(g.current_sales, g.target_amount)), 1000) * 1.1;
        const padding = 40;
        const width = 1000;
        const height = 300;
        const innerWidth = width - (padding * 2);
        const innerHeight = height - (padding * 2);

        const points = sortedGoals.map((g, i) => {
            const x = padding + (i / (Math.max(1, sortedGoals.length - 1))) * innerWidth;
            const yCurrent = height - padding - (g.current_sales / maxVal) * innerHeight;
            const yTarget = height - padding - (g.target_amount / maxVal) * innerHeight;
            return { x, yCurrent, yTarget, month: g.month_year, sales: g.current_sales, target: g.target_amount };
        });

        const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.yCurrent}`).join(' ');
        const targetPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.yTarget}`).join(' ');

        return (
            <div className="flex-1 flex flex-col">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-white font-black uppercase italic">Análisis de Tendencia</h3>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{branchName}</p>
                    </div>
                    <div className="flex gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-0.5 bg-amber-500"></div>
                            <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Venta Real</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-0.5 bg-gray-500 border-t border-dashed border-gray-400"></div>
                            <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Meta</span>
                        </div>
                    </div>
                </div>

                <div className="flex-1 bg-gray-950/50 rounded-2xl border border-gray-800 p-4 relative overflow-hidden flex flex-col">
                    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
                        {/* Grid Lines */}
                        {[0, 0.25, 0.5, 0.75, 1].map(tick => (
                            <line
                                key={tick}
                                x1={padding} y1={height - padding - (tick * innerHeight)}
                                x2={width - padding} y2={height - padding - (tick * innerHeight)}
                                stroke="#1f2937" strokeWidth="1"
                            />
                        ))}

                        {/* Target Line (Dashed) */}
                        <path d={targetPath} fill="none" stroke="#4b5563" strokeWidth="2" strokeDasharray="4 4" />

                        {/* Real Sales line */}
                        <path d={linePath} fill="none" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

                        {/* Nodes */}
                        {points.map((p, i) => (
                            <g key={i} className="group/node">
                                <circle cx={p.x} cy={p.yCurrent} r="5" fill="#f59e0b" className="cursor-pointer hover:r-7 transition-all" />
                                <text x={p.x} y={height - padding + 20} textAnchor="middle" fill="#9ca3af" className="text-[10px] font-bold uppercase tracking-tighter" transform={`rotate(0, ${p.x}, ${height - padding + 20})`}>
                                    {p.month}
                                </text>
                                {/* Tooltip for Price */}
                                <g className="opacity-0 group-hover/node:opacity-100 transition-opacity pointer-events-none">
                                    <rect x={p.x - 40} y={p.yCurrent - 45} width="80" height="35" rx="8" fill="black" stroke="#374151" />
                                    <text x={p.x} y={p.yCurrent - 30} textAnchor="middle" fill="#f59e0b" fontSize="10" fontWeight="bold">${Number(p.sales).toLocaleString()}</text>
                                    <text x={p.x} y={p.yCurrent - 20} textAnchor="middle" fill="#6b7280" fontSize="8">Meta: ${Number(p.target).toLocaleString()}</text>
                                </g>
                            </g>
                        ))}
                    </svg>
                </div>

                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-gray-800/50 p-3 rounded-xl border border-gray-800 text-center">
                        <p className="text-[8px] text-gray-500 font-black uppercase tracking-widest mb-1">Mejor Mes</p>
                        <p className="text-white font-black italic">{[...sortedGoals].sort((a, b) => b.current_sales - a.current_sales)[0]?.month_year}</p>
                    </div>
                    <div className="bg-gray-800/50 p-3 rounded-xl border border-gray-800 text-center">
                        <p className="text-[8px] text-gray-500 font-black uppercase tracking-widest mb-1">Promedio Mensual</p>
                        <p className="text-white font-black italic">${(goals.reduce((s, g) => s + Number(g.current_sales), 0) / goals.length).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                    </div>
                    <div className="bg-gray-800/50 p-3 rounded-xl border border-gray-800 text-center">
                        <p className="text-[8px] text-gray-500 font-black uppercase tracking-widest mb-1">Crecimiento Est.</p>
                        <p className={`font-black italic ${(() => {
                            if (sortedGoals.length < 2) return 'text-gray-500';
                            const last = sortedGoals[sortedGoals.length - 1].current_sales;
                            const prev = sortedGoals[sortedGoals.length - 2].current_sales;
                            const growth = ((last - prev) / prev) * 100;
                            return growth >= 0 ? 'text-green-500' : 'text-red-500';
                        })()}`}>
                            {(() => {
                                if (sortedGoals.length < 2) return 'N/A';
                                const last = sortedGoals[sortedGoals.length - 1].current_sales;
                                const prev = sortedGoals[sortedGoals.length - 2].current_sales;
                                const growth = ((last - prev) / prev) * 100;
                                return (growth >= 0 ? '+' : '') + growth.toFixed(1) + '%';
                            })()}
                        </p>
                    </div>
                    <div className="bg-gray-800/50 p-3 rounded-xl border border-gray-800 text-center">
                        <p className="text-[8px] text-gray-500 font-black uppercase tracking-widest mb-1">Meses Procesados</p>
                        <p className="text-white font-black italic">{goals.length}</p>
                    </div>
                </div>
            </div>
        );
    };

    // GAUGE CHART
    const GaugeChart = ({ percent, label, value, subLabel }: { percent: number, label: string, value: string, subLabel: React.ReactNode }) => {
        const radius = 100; // Increased from 80
        const stroke = 14;  // Slightly thicker stroke
        const normalizedRadius = radius - stroke * 2;
        const circumference = normalizedRadius * 2 * Math.PI;
        const strokeDashoffset = circumference - (Math.min(percent, 100) / 100) * circumference;

        return (
            <div className="relative flex items-center justify-center">
                <svg height={radius * 2} width={radius * 2} className="transform -rotate-90">
                    <circle stroke="#374151" strokeWidth={stroke} fill="transparent" r={normalizedRadius} cx={radius} cy={radius} />
                    <circle
                        stroke={percent >= 110 ? '#3b82f6' : percent >= 100 ? '#4ade80' : '#f59e0b'}
                        strokeWidth={stroke}
                        strokeDasharray={circumference + ' ' + circumference}
                        style={{ strokeDashoffset, transition: 'stroke-dashoffset 1s ease-in-out' }}
                        strokeLinecap="round"
                        fill="transparent"
                        r={normalizedRadius}
                        cx={radius}
                        cy={radius}
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-1">{label}</p>
                    <p className="text-4xl font-black text-white">{value}</p>
                    <div className="text-[10px] font-bold text-gray-400 mt-1">{subLabel}</div>
                </div>
            </div>
        );
    };

    // --- VIEWS RENDERING ---

    if (viewMode === 'list') {
        return (
            <div className="flex flex-col h-full animate-in fade-in duration-300">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 px-1">
                    <div className="flex items-center gap-3">
                        <button onClick={onBack} className="bg-gray-800 p-2.5 rounded-full hover:bg-gray-700 active:scale-90 transition-all shadow-lg border border-gray-700/50">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <h1 className="text-2xl font-black text-white italic uppercase tracking-tighter leading-none">
                            HISTORIAL <span className="text-amber-500">PROYECCIONES</span>
                        </h1>
                    </div>

                    <div className="flex bg-gray-900/50 p-1 rounded-xl border border-gray-800">
                        <button
                            onClick={() => setDisplayMode('grid')}
                            className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${displayMode === 'grid' ? 'bg-amber-500 text-black shadow-lg shadow-amber-900/20' : 'text-gray-500 hover:text-white'}`}
                        >
                            Cuadrícula
                        </button>
                        <button
                            onClick={() => setDisplayMode('trend')}
                            className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${displayMode === 'trend' ? 'bg-amber-500 text-black shadow-lg shadow-amber-900/20' : 'text-gray-500 hover:text-white'}`}
                        >
                            Tendencia
                        </button>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                        {/* BRANCH SELECTOR */}
                        <div className="relative group min-w-[200px]">
                            <StoreIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-hover:text-amber-500 transition-colors" />
                            <select
                                value={selectedBranchId}
                                onChange={(e) => setSelectedBranchId(Number(e.target.value))}
                                className="w-full bg-gray-900 border border-gray-700 text-white text-[11px] font-bold py-2.5 pl-9 pr-8 rounded-2xl appearance-none outline-none focus:border-amber-500 cursor-pointer hover:bg-gray-800 transition-colors uppercase tracking-wide"
                            >
                                {branches?.map(b => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </div>
                        </div>

                        <button
                            onClick={handleCreateNew}
                            className="flex-shrink-0 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-black py-2.5 px-6 rounded-2xl active:scale-95 transition-all text-[11px] uppercase shadow-xl tracking-widest italic"
                        >
                            <PlusIcon className="w-4 h-4" /> Nueva Proyección
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="p-12 text-center text-gray-500 animate-pulse uppercase font-bold tracking-widest text-xs">Cargando historial...</div>
                ) : goalsList.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-500 opacity-50">
                        <p className="text-4xl mb-4">📂</p>
                        <p className="text-sm font-bold uppercase tracking-widest">No hay proyecciones para esta sucursal</p>
                        <p className="text-xs mt-2">Gestionando: {getBranchName(selectedBranchId)}</p>
                    </div>
                ) : displayMode === 'trend' ? (
                    <div className="flex-1 bg-gray-900/30 rounded-[32px] border border-gray-800/50 p-6 flex flex-col shrink-0 min-h-[400px]">
                        <TrendAnalysis goals={goalsList} branchName={getBranchName(selectedBranchId)} />
                    </div>
                ) : (
                    <div
                        ref={listScrollRef}
                        onMouseDown={(e) => onMouseDown(e, listScrollRef)}
                        onMouseMove={(e) => onMouseMove(e, listScrollRef)}
                        onMouseUp={onMouseUpOrLeave}
                        onMouseLeave={onMouseUpOrLeave}
                        className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 overflow-y-auto pb-4 pr-2 scrollbar-hide select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                    >
                        {goalsList.map((goal) => {
                            // Calculations for Card
                            const displayPct = (goal.current_sales / goal.target_amount) * 100;
                            const visualPct = Math.min(100, displayPct);

                            const realAvg = goal.days_with_sales > 0 ? (goal.current_sales / goal.days_with_sales) : 0;
                            const projected = realAvg * goal.total_work_days;
                            const projVal = goal.manual_sales !== null ? Number(goal.manual_sales) : projected;
                            const isProjectedComplete = projVal >= goal.target_amount;
                            const isManual = goal.manual_sales !== null;

                            return (
                                <div
                                    key={goal.id}
                                    onClick={() => fetchDetail(goal.month_year)}
                                    className="bg-gray-800 p-4 rounded-2xl border border-gray-700 shadow-lg hover:border-amber-500/50 hover:bg-gray-800/80 cursor-pointer transition-all group relative overflow-hidden flex flex-col justify-between min-h-[170px]"
                                >
                                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                        <CalendarIcon className="w-20 h-20 text-white" />
                                    </div>

                                    {/* Header */}
                                    <div className="relative z-10 mb-2">
                                        <div className="flex justify-between items-center mb-1">
                                            <div className="bg-gray-900/80 px-2.5 py-1 rounded-lg border border-gray-700 backdrop-blur-sm">
                                                <p className="text-amber-500 font-mono font-bold text-xs tracking-wider">{goal.month_year}</p>
                                            </div>
                                            <div className="text-[11px] font-black text-gray-300 uppercase tracking-widest bg-gray-900/40 px-2 py-0.5 rounded-md flex items-center gap-1">
                                                {isManual && <span className="text-[9px] text-amber-500">M</span>}
                                                {goal.days_with_sales} / {goal.total_work_days} días
                                            </div>
                                        </div>
                                    </div>

                                    {/* Metrics */}
                                    <div className="relative z-10 space-y-3">
                                        <div>
                                            <p className="text-gray-400 text-[9px] font-bold uppercase tracking-widest mb-0.5">Venta Actual</p>
                                            <p className="text-2xl font-black text-white tracking-tight group-hover:text-amber-400 transition-colors">
                                                ${Number(goal.current_sales).toLocaleString('en-US', { notation: "compact", maximumFractionDigits: 1 })}
                                            </p>
                                        </div>

                                        {/* Progress Bar */}
                                        <div className="space-y-1.5">
                                            <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest">
                                                <span className="text-gray-550">Progreso</span>
                                                <span className={displayPct >= 110 ? "text-blue-400" : displayPct >= 100 ? "text-green-400" : "text-amber-500"}>
                                                    {displayPct.toFixed(0)}%
                                                </span>
                                            </div>
                                            <div className="w-full bg-gray-700 rounded-full h-1.5 overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-1000 ${displayPct >= 110 ? 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]' : displayPct >= 100 ? 'bg-green-500' : 'bg-amber-500'}`}
                                                    style={{ width: `${visualPct}%` }}
                                                ></div>
                                            </div>
                                        </div>

                                        <div className="flex justify-between items-end">
                                            <div>
                                                <p className="text-gray-500 text-[8px] font-bold uppercase tracking-widest mb-0.5">Proyección Est.</p>
                                                <p className={`text-lg font-black tracking-tight ${isProjectedComplete ? 'text-green-400' : 'text-gray-300'}`}>
                                                    ${projVal.toLocaleString('en-US', { notation: "compact", maximumFractionDigits: 1 })}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-gray-500 text-[8px] font-bold uppercase tracking-widest mb-0.5">Meta</p>
                                                <p className="text-xs font-black text-gray-400 tracking-tight">
                                                    ${Number(goal.target_amount).toLocaleString('en-US', { notation: "compact" })}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                <NotificationToast
                    message={toast.message}
                    title={toast.title}
                    type={toast.type}
                    onClose={() => setToast({ ...toast, message: null })}
                    position="top"
                />
            </div>
        );
    }

    if (viewMode === 'create_config') {
        return (
            <div className="flex flex-col h-full animate-in fade-in duration-300">
                <div className="flex items-center gap-3 mb-8 px-1">
                    <button onClick={() => setViewMode('list')} className="bg-gray-800 p-2.5 rounded-full hover:bg-gray-700 active:scale-90 transition-all shadow-lg border border-gray-700/50">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter leading-none">
                        CONFIGURAR <span className="text-amber-500">PROYECCIÓN</span>
                    </h2>
                </div>

                <div className="max-w-md mx-auto w-full bg-gray-800 p-8 rounded-[40px] border border-gray-700 shadow-2xl relative overflow-hidden">
                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
                    <div className="space-y-6 relative z-10">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Sucursal</label>

                            {/* BRANCH SELECTOR (LOCKED TO CONTEXT IF NEEDED, OR EDITABLE) */}
                            {/* User requested centralized. Let's make it select based on context but show it clearly */}
                            <div className="relative group">
                                <StoreIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-amber-500" />
                                <select
                                    value={selectedBranchId}
                                    onChange={(e) => setSelectedBranchId(Number(e.target.value))}
                                    className="w-full bg-gray-900 border-2 border-gray-700 text-white text-sm font-bold py-3 pl-12 pr-5 rounded-2xl outline-none focus:border-amber-500 cursor-pointer uppercase"
                                >
                                    {branches?.map(b => (
                                        <option key={b.id} value={b.id}>{b.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Mes de Proyección</label>
                            <div className="relative">
                                <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-amber-500" />
                                <input
                                    type="month"
                                    value={formMonth}
                                    onChange={e => setFormMonth(e.target.value)}
                                    // Disable editing month if coming from detail view (technically allowed but better to guide creation)
                                    // For now, let them change it.
                                    className="w-full py-3 pl-12 pr-5 bg-gray-900 border-2 border-gray-700 rounded-2xl text-white font-black text-lg outline-none focus:border-amber-500 shadow-inner"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Meta de Venta Mensual ($)</label>
                            <input
                                type="number"
                                value={formTarget}
                                onChange={e => setFormTarget(e.target.value)}
                                placeholder="0.00"
                                className="w-full py-4 px-6 bg-gray-900 border-2 border-gray-700 rounded-2xl text-white font-black text-3xl text-center outline-none focus:border-amber-500 shadow-inner tracking-tight placeholder:text-gray-700"
                                autoFocus
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Días Laborales Est. (Mes)</label>
                            <input
                                type="number"
                                value={formWorkDays}
                                onChange={e => setFormWorkDays(e.target.value)}
                                className="w-full py-3 px-5 bg-gray-900 border-2 border-gray-700 rounded-2xl text-white font-black text-xl text-center outline-none focus:border-amber-500 shadow-inner"
                            />
                        </div>
                    </div>

                    {/* MANUAL DATA INJECTION SECTION */}
                    <div className="pt-4 border-t border-gray-700/50 space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <PlusCircleIcon className="w-3.5 h-3.5 text-amber-500/50" />
                            <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest italic">Ajuste / Saldo Inicial (Aditivo)</span>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest ml-1">Ventas Previas ($)</label>
                                <input
                                    type="number"
                                    value={formManualSales}
                                    onChange={e => setFormManualSales(e.target.value)}
                                    placeholder="0.00"
                                    className="w-full py-2.5 px-4 bg-gray-900/50 border border-gray-700 rounded-xl text-white font-bold text-sm outline-none focus:border-amber-500 shadow-inner"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest ml-1">Días Previos</label>
                                <input
                                    type="number"
                                    value={formManualDays}
                                    onChange={e => setFormManualDays(e.target.value)}
                                    placeholder="0"
                                    className="w-full py-2.5 px-4 bg-gray-900/50 border border-gray-700 rounded-xl text-white font-bold text-sm outline-none focus:border-amber-500 shadow-inner"
                                />
                            </div>
                        </div>
                        <p className="text-[8px] text-gray-600 italic px-1 leading-relaxed">
                            * Los valores ingresados aquí se SUMARÁN a los tickets reales registrados en la App.
                        </p>
                    </div>

                    <button
                        onClick={handleSaveConfig}
                        disabled={loading}
                        className="w-full py-4 bg-amber-500 hover:bg-amber-400 text-black font-black rounded-2xl uppercase tracking-widest shadow-lg shadow-amber-500/20 active:scale-95 transition-all mt-4 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {loading ? 'Guardando...' : 'Guardar y Ver'} <ArrowRightIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>
        );
    }

    if (viewMode === 'detail_view' && projectionData) {
        // ... calculations ...
        const daysFromOrders = projectionData.dailySales.filter(d => Number(d.total) > 0).length;
        const daysWithSales = daysFromOrders + (projectionData.manualDays || 0);
        const realDailyAverage = daysWithSales > 0 ? (projectionData.currentSales / daysWithSales) : 0;
        const newProjection = realDailyAverage * (projectionData.totalWorkDays || 30);
        const progressPercent = Math.min(100, (projectionData.currentSales / (projectionData.targetAmount || 1)) * 100);
        const idealDailyGoal = projectionData.targetAmount / (projectionData.totalWorkDays || 30);
        const expectedByNow = idealDailyGoal * daysWithSales;
        const gap = projectionData.currentSales - expectedByNow;
        const isAhead = gap >= 0;
        const maxDaily = Math.max(...projectionData.dailySales.map(d => Number(d.total)), idealDailyGoal * 1.5, 1);

        return (
            <div
                ref={detailScrollRef}
                onMouseDown={(e) => onMouseDown(e, detailScrollRef)}
                onMouseMove={(e) => onMouseMove(e, detailScrollRef)}
                onMouseUp={onMouseUpOrLeave}
                onMouseLeave={onMouseUpOrLeave}
                className={`flex flex-col h-full animate-in fade-in duration-300 overflow-y-auto scrollbar-hide select-none pr-1 pb-10 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
            >
                {/* Standardized Header */}
                <div className="flex justify-between items-center gap-4 mb-6 shrink-0 px-1 relative z-50">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setViewMode('list')} className="bg-gray-800 p-2.5 rounded-full hover:bg-gray-700 active:scale-90 transition-all shadow-lg border border-gray-700/50">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <div>
                            <h1 className="text-2xl font-black text-white italic uppercase tracking-tighter leading-none">
                                {projectionData.monthYear}
                            </h1>
                            <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mt-1 italic">{getBranchName(selectedBranchId)}</p>
                        </div>
                    </div>

                    <button
                        onClick={handleEditConfig}
                        className="bg-gray-800 px-4 py-2.5 rounded-2xl hover:bg-gray-700 text-gray-400 hover:text-white transition-all border border-gray-700 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest italic"
                    >
                        <PencilIcon className="w-3.5 h-3.5" /> Editar Meta
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                    {/* 1. GAUGE */}
                    <div className="bg-gray-800 p-6 rounded-[32px] border border-gray-700 shadow-xl flex items-center justify-center relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <ChartBarIcon className="w-32 h-32 text-white" />
                        </div>
                        <div className="scale-125 transform">
                            <GaugeChart
                                percent={progressPercent}
                                label="Meta Mensual"
                                value={`$${projectionData.targetAmount.toLocaleString('en-US', { notation: "compact", maximumFractionDigits: 1 })}`}
                                subLabel={
                                    <span className={progressPercent >= 110 ? "text-blue-400" : progressPercent >= 100 ? "text-green-400" : "text-amber-500"}>
                                        {progressPercent.toFixed(1)}% Completado
                                    </span>
                                }
                            />
                        </div>
                    </div>

                    {/* 2. KPIs */}
                    <div className="bg-gray-800 p-6 rounded-[32px] border border-gray-700 shadow-xl flex flex-col justify-center gap-6">
                        <div className="bg-gray-900/50 p-4 rounded-2xl border border-gray-800">
                            <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">Venta Actual</p>
                            <p className="text-4xl font-black text-white tracking-tight">
                                ${projectionData.currentSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                        </div>
                        <div className="bg-gray-900/50 p-4 rounded-2xl border border-gray-800 relative overflow-hidden">
                            <div className={`absolute left-0 top-0 bottom-0 w-1 ${isAhead ? 'bg-green-500' : 'bg-red-500'}`}></div>
                            <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">Proyección Cierre (Est.)</p>
                            <p className={`text-4xl font-black tracking-tight ${isAhead ? 'text-green-400' : 'text-red-400'}`}>
                                ${newProjection.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                            <p className="text-[10px] text-gray-500 mt-1">
                                Basado en {daysWithSales} días de venta efectiva
                            </p>
                        </div>
                    </div>

                    {/* 3. DETAILS */}
                    <div className="bg-gray-800 p-6 rounded-[32px] border border-gray-700 shadow-xl flex flex-col justify-between">
                        <div>
                            <h3 className="text-white font-black uppercase italic mb-4">Detalles</h3>
                            <ul className="space-y-3">
                                <li className="flex justify-between text-sm">
                                    <span className="text-gray-500 font-bold">Días Laborales Est.</span>
                                    <span className="text-white font-mono">{projectionData.totalWorkDays}</span>
                                </li>
                                <li className="flex justify-between text-sm">
                                    <span className="text-gray-500 font-bold">Días con Venta</span>
                                    <span className="text-amber-500 font-mono font-bold">{daysWithSales} / {projectionData.totalWorkDays}</span>
                                </li>
                                <li className="flex justify-between text-sm">
                                    <span className="text-gray-500 font-bold">Promedio Diario Real</span>
                                    <span className="text-white font-mono font-bold">${realDailyAverage.toFixed(2)}</span>
                                </li>
                                <li className="flex justify-between text-sm opacity-50">
                                    <span className="text-gray-500 font-bold">Promedio Ideal Req.</span>
                                    <span className="text-white font-mono">${idealDailyGoal.toFixed(2)}</span>
                                </li>
                            </ul>
                        </div>
                        <div className="mt-4 pt-4 border-t border-gray-700 text-center">
                            <p className="text-[10px] text-gray-500 uppercase tracking-widest">Gap vs Ideal (A la fecha)</p>
                            <p className={`text-2xl font-black ${isAhead ? 'text-green-500' : 'text-red-500'}`}>
                                {isAhead ? '+' : ''}{gap.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                        </div>
                    </div>
                </div>

                {/* VELOCITY CHART */}
                <div className="flex-1 bg-gray-800 rounded-[32px] border border-gray-700 shadow-xl p-6 min-h-[300px] flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-gray-400 text-sm font-bold uppercase tracking-wider">Velocidad de Venta Diaria</h3>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-amber-500 rounded-sm"></div> <span className="text-[10px] text-gray-500 uppercase">Hoy</span>
                            <div className="w-3 h-3 bg-blue-500 opacity-60 rounded-sm ml-2"></div> <span className="text-[10px] text-gray-500 uppercase">Venta</span>
                            <div className="w-full h-[1px] bg-red-500/50 w-8 ml-2"></div> <span className="text-[10px] text-gray-500 uppercase">Meta Diaria Ideal</span>
                        </div>
                    </div>

                    <div className="flex-1 flex items-end justify-between gap-1 relative pl-8 pb-6 border-l border-b border-gray-700">
                        {/* Goal Line */}
                        <div
                            className="absolute w-full border-t border-red-500/30 border-dashed z-0 pointer-events-none"
                            style={{ bottom: `${Math.min(100, (idealDailyGoal / maxDaily) * 100)}%` }}
                        ></div>

                        {/* Bars */}
                        {Array.from({ length: projectionData.daysInMonth }).map((_, i) => {
                            const dayNum = i + 1;
                            const dayData = projectionData.dailySales.find(d => d.day === dayNum);
                            const amount = dayData ? Number(dayData.total) : 0;
                            const barHeight = (amount / maxDaily) * 100;
                            // Check exact date match for styling "Today" - Simplified for history view

                            return (
                                <div key={dayNum} className="flex-1 h-full flex flex-col justify-end group relative z-10 hover:bg-white/5 rounded-t-sm transition-colors">
                                    {/* Tooltip */}
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-black text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 pointer-events-none border border-gray-700">
                                        Dia {dayNum}: <span className="font-bold text-amber-500">${amount.toFixed(2)}</span>
                                    </div>

                                    <div
                                        className={`w-full max-w-[12px] md:max-w-[18px] mx-auto rounded-t-sm transition-all duration-500 bg-blue-500 opacity-60 hover:opacity-100`}
                                        style={{ height: `${Math.max(1, barHeight)}%` }}
                                    ></div>
                                    <span className="text-[8px] md:text-[9px] text-gray-500 text-center mt-2 absolute -bottom-6 left-0 right-0">{dayNum}</span>
                                </div>
                            )
                        })}
                    </div>
                </div>

                <NotificationToast message={toast.message} title={toast.title} onClose={() => setToast({ message: null })} position="top" />
            </div>
        );
    }

    return null;
};
