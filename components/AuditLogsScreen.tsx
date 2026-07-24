import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { toast } from 'react-hot-toast';
import { useDragScroll } from '../hooks/useDragScroll';
import { getElSalvadorDateString, formatToElSalvadorDate } from '../utils/dates';

const AuditLogsScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    // Default to last 3 days
    const defaultEnd = new Date();
    const defaultStart = new Date();
    defaultStart.setDate(defaultEnd.getDate() - 3);

    const [logs, setLogs] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedLogId, setExpandedLogId] = useState<number | null>(null);
    const [startDate, setStartDate] = useState(formatToElSalvadorDate(defaultStart));
    const [endDate, setEndDate] = useState(formatToElSalvadorDate(defaultEnd));
    const [filterType, setFilterType] = useState<'ALL' | 'ORDER' | 'ITEM'>('ALL');

    // Drag Scroll
    const dragScroll = useDragScroll();

    useEffect(() => {
        loadLogs();
    }, [startDate, endDate]);

    const loadLogs = async () => {
        setIsLoading(true);
        try {
            const data = await api.getAuditLogs({
                startDate,
                endDate: endDate + ' 23:59:59'
            });
            setLogs(data);
        } catch (error) {
            console.error('Error loading audit logs:', error);
            toast.error('Error al cargar historial de auditoría');
        } finally {
            setIsLoading(false);
        }
    };

    const toggleExpand = (id: number) => {
        setExpandedLogId(expandedLogId === id ? null : id);
    };

    return (
        <div className="flex flex-col h-full bg-gray-900 overflow-hidden animate-in fade-in duration-300">
            {/* Header matches GlobalHistoryScreen */}
            <div className="flex justify-between items-center p-6 border-b border-gray-800 shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-3 bg-gray-800 rounded-full hover:bg-gray-700 active:scale-90 transition-all border border-gray-700">
                        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <div>
                        <h1 className="text-3xl font-black text-white italic uppercase tracking-tighter flex items-center gap-4">
                            AUDITORÍA <span className="text-red-500">BORRADOS</span>

                            <div className="flex bg-gray-800 rounded-lg p-1 gap-1 ml-4 border border-gray-700">
                                <button
                                    onClick={() => setFilterType('ALL')}
                                    className={`px-3 py-1 text-[10px] font-black rounded-md transition-all ${filterType === 'ALL' ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                                >
                                    TODOS
                                </button>
                                <button
                                    onClick={() => setFilterType('ORDER')}
                                    className={`px-3 py-1 text-[10px] font-black rounded-md transition-all ${filterType === 'ORDER' ? 'bg-red-500/20 text-red-500 border border-red-500/50 shadow-sm' : 'text-gray-500 hover:text-red-400'}`}
                                >
                                    PEDIDOS
                                </button>
                                <button
                                    onClick={() => setFilterType('ITEM')}
                                    className={`px-3 py-1 text-[10px] font-black rounded-md transition-all ${filterType === 'ITEM' ? 'bg-orange-500/20 text-orange-500 border border-orange-500/50 shadow-sm' : 'text-gray-500 hover:text-orange-400'}`}
                                >
                                    ITEMS
                                </button>
                            </div>
                        </h1>
                        <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">
                            HISTORIAL DE SEGURIDAD Y ELIMINACIÓN
                        </p>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="p-4 grid grid-cols-2 gap-4 bg-gray-900/50 shrink-0 border-b border-gray-800/50">
                <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest ml-1">DESDE</label>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white font-bold outline-none focus:border-red-500" />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest ml-1">HASTA</label>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white font-bold outline-none focus:border-red-500" />
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
                </div>
            ) : logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 opacity-30 italic">
                    <p className="text-xl font-black uppercase text-gray-500">No hay registros de auditoría</p>
                </div>
            ) : (
                <div
                    {...dragScroll}
                    className={`flex-1 overflow-auto p-4 scrollbar-hide ${dragScroll.isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                >
                    <div className="grid gap-4 max-w-7xl mx-auto pb-32 w-full">
                        {logs.filter(log => filterType === 'ALL' || log.log_type === filterType).map((log) => (
                            <div
                                key={log.id}
                                className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-lg hover:border-gray-700 transition-colors"
                            >
                                <div
                                    onClick={() => toggleExpand(log.id)}
                                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-800/50 transition-colors"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20 text-red-500">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-black ${log.log_type === 'ITEM' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/20' : 'bg-red-500/20 text-red-400 border border-red-500/20'}`}>
                                                    {log.log_type === 'ITEM' ? 'PRODUCTO' : 'PEDIDO'}
                                                </span>
                                                <h3 className="text-white font-bold uppercase">
                                                    #{String(log.daily_order_number || log.data?.daily_order_number || log.data?.dailyOrderNumber || '???').padStart(3, '0')}
                                                    {log.log_type === 'ITEM' && log.data?.product?.name && (
                                                        <span className="text-gray-400 ml-2">({log.data.product.name})</span>
                                                    )}
                                                </h3>
                                            </div>
                                            <div className="text-xs text-gray-400 mt-1 flex gap-3">
                                                <span className="flex items-center gap-1">
                                                    👤 <span className="text-red-400 font-bold">{log.deleted_by_name || 'Desconocido'}</span>
                                                </span>
                                                <span className="flex items-center gap-1 opacity-60">
                                                    📅 {new Date(log.deleted_at).toLocaleString()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="text-right">
                                        <div className="text-sm font-bold text-gray-300 uppercase">
                                            Razón: <span className="text-white italic">"{log.reason || 'Sin razón especificada'}"</span>
                                        </div>
                                        <div className="mt-1 text-xs text-gray-500 font-bold uppercase opacity-50">
                                            Clic para detalles {expandedLogId === log.id ? '▲' : '▼'}
                                        </div>
                                    </div>
                                </div>

                                {expandedLogId === log.id && (
                                    <div className="bg-black/30 p-4 border-t border-gray-800 text-xs font-mono text-gray-400 space-y-2 animate-in slide-in-from-top-2">
                                        <p className="uppercase font-bold text-gray-500 mb-2">
                                            {log.log_type === 'ITEM' ? 'Detalles del Producto Eliminado:' : 'Detalles del Pedido Eliminado:'}
                                        </p>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <span className="block text-gray-600 uppercase">Cliente:</span>
                                                <span className="text-white">{log.customer_name || log.data?.customer?.name || 'CLIENTES VARIOS'}</span>
                                            </div>
                                            <div>
                                                <span className="block text-gray-600 uppercase">Total {log.log_type === 'ITEM' ? 'Item' : 'Pedido'}:</span>
                                                <span className="text-green-400 font-bold">${Number(log.data?.total || 0).toFixed(2)}</span>
                                            </div>
                                            <div className="col-span-2">
                                                <span className="block text-gray-600 uppercase mb-1">
                                                    {log.log_type === 'ITEM' ? 'Composición del Producto:' : 'Contenido del Pedido:'}
                                                </span>
                                                <ul className="list-disc pl-4 space-y-1">
                                                    {log.log_type === 'ITEM' ? (
                                                        <li>
                                                            {log.data.quantity}x {log.data.product?.name || 'Producto'}
                                                            {log.data.meat && <span className="text-amber-500 ml-1">[{log.data.meat.name}]</span>}
                                                            {log.data.masa && <span className="text-fuchsia-400 ml-1">[{log.data.masa.name}]</span>}
                                                            {log.data.extras?.length > 0 && (
                                                                <span className="text-green-400 ml-1">
                                                                    + ({log.data.extras.map((e: any) => e.name).join(', ')})
                                                                </span>
                                                            )}
                                                        </li>
                                                    ) : (
                                                        log.data?.items?.map((item: any, idx: number) => (
                                                            <li key={idx}>
                                                                {item.quantity}x {item.product?.name || item.name || 'Producto'} (${Number(item.total).toFixed(2)})
                                                            </li>
                                                        ))
                                                    )}
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AuditLogsScreen;
