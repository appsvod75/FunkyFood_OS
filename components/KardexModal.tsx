import React, { useState, useEffect } from 'react';
import { InventoryTransaction, Branch } from '../types';
import { api } from '../api';
import { ClockIcon, EyeIcon, RefreshIcon } from './icons';
import TransactionDetailModal from './TransactionDetailModal';

interface KardexModalProps {
    productId: number;
    productName: string;
    initialBranchId?: number;
    branches: Branch[];
    onClose: () => void;
}

const KardexModal: React.FC<KardexModalProps> = ({ productId, productName, initialBranchId, branches, onClose }) => {
    const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedBranchId, setSelectedBranchId] = useState<number | 'all'>(initialBranchId || 'all');
    const [selectedTransaction, setSelectedTransaction] = useState<InventoryTransaction | null>(null);

    // Drag to scroll refs and state
    const containerRef = React.useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startY, setStartY] = useState(0);
    const [scrollTop, setScrollTop] = useState(0);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!containerRef.current) return;
        setIsDragging(true);
        setStartY(e.pageY - containerRef.current.offsetTop);
        setScrollTop(containerRef.current.scrollTop);
    };

    const handleMouseLeave = () => {
        setIsDragging(false);
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !containerRef.current) return;
        e.preventDefault();
        const y = e.pageY - containerRef.current.offsetTop;
        const walk = (y - startY) * 2; // Scroll-fast
        containerRef.current.scrollTop = scrollTop - walk;
    };

    const fetchKardex = async () => {
        setIsLoading(true);
        try {
            const bId = selectedBranchId === 'all' ? undefined : selectedBranchId;
            const data = await api.getInventoryKardex(productId, bId);
            setTransactions(data);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchKardex();
    }, [selectedBranchId]);

    const typeConfig: any = {
        INITIAL: { label: 'INICIAL', color: 'text-blue-500', bg: 'bg-blue-500/10' },
        PURCHASE: { label: 'INGRESO COMPRA', color: 'text-green-500', bg: 'bg-green-500/10' },
        ADJUSTMENT_ADD: { label: 'INGRESO AJP', color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
        ADJUSTMENT_SUB: { label: 'SALIDA AJN', color: 'text-red-500', bg: 'bg-red-500/10' },
        SALE: { label: 'VENTA', color: 'text-amber-500', bg: 'bg-amber-500/10' },
        TRANSFER_IN: { label: 'INGRESO TRS', color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
        TRANSFER_OUT: { label: 'SALIDA TRS', color: 'text-purple-500', bg: 'bg-purple-500/10' },
    };

    return (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl flex items-center justify-center z-[200] p-4">
            <div className="bg-[#0a0a0c] w-full max-w-4xl h-[85vh] rounded-[40px] border border-white/5 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in duration-300 relative">

                {/* Header */}
                <div className="p-8 border-b border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 shrink-0 relative z-10 bg-gray-900/50">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <div className="bg-amber-500/10 p-2 rounded-xl text-amber-500 border border-amber-500/20">
                                <ClockIcon className="w-5 h-5" />
                            </div>
                            <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">{productName}</h3>
                        </div>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.3em] pl-1">AUDITORÍA DE KARDEX CRONOLÓGICO</p>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <div className="relative group flex-1 sm:flex-none">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[9px] font-black text-gray-500 uppercase tracking-widest italic pointer-events-none">FILTRAR POR SEDE:</div>
                            <select
                                value={selectedBranchId}
                                onChange={(e) => setSelectedBranchId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                                className="h-12 bg-gray-950 border border-white/10 rounded-xl pl-32 pr-8 text-[11px] font-bold text-white uppercase outline-none focus:border-amber-500/50 w-full sm:w-64 appearance-none cursor-pointer hover:bg-black transition-colors"
                            >
                                <option value="all">TODAS LAS SEDES</option>
                                {branches.map(b => (
                                    <option key={b.id} value={b.id}>{b.name.toUpperCase()}</option>
                                ))}
                            </select>
                        </div>
                        <button onClick={onClose} className="h-12 w-12 flex items-center justify-center bg-white/5 hover:bg-red-500/20 hover:text-red-500 rounded-xl transition-all border border-white/5">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                </div>

                {/* Table Header */}
                <div className="bg-white/[0.02] border-b border-white/5 px-8 py-4 grid grid-cols-[160px,120px,100px,100px,100px,100px,60px] gap-4 shrink-0">
                    <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest italic">FECHA / HORA</span>
                    <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest italic">OPERACIÓN</span>
                    <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest italic text-center">ESTADO</span>
                    <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest italic text-center">CANTIDAD</span>
                    <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest italic text-center">STOCK RESULT.</span>
                    <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest italic text-right">COSTO UNIT.</span>
                    <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest italic text-center">DOC</span>
                </div>

                {/* List */}
                <div
                    ref={containerRef}
                    onMouseDown={handleMouseDown}
                    onMouseLeave={handleMouseLeave}
                    onMouseUp={handleMouseUp}
                    onMouseMove={handleMouseMove}
                    className={`flex-1 overflow-y-auto p-4 scrollbar-hide ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                >
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-full opacity-50 space-y-4">
                            <RefreshIcon className="w-10 h-10 animate-spin text-amber-500" />
                            <span className="text-[10px] font-black uppercase tracking-widest">CARGANDO MOVIMIENTOS...</span>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {transactions
                                .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                                .map(tx => {
                                    const cfg = typeConfig[tx.transactionType] || { label: tx.transactionType, color: 'text-gray-500', bg: 'bg-gray-500/10' };
                                    const isPositive = Number(tx.newStock) > Number(tx.previousStock);
                                    return (
                                        <div key={tx.id} className="grid grid-cols-[160px,120px,100px,100px,100px,100px,60px] gap-4 items-center px-4 py-4 rounded-xl hover:bg-white/5 transition-colors border border-transparent hover:border-white/5 group">

                                            <span className="text-[10px] font-bold text-gray-500 font-mono uppercase">{new Date(tx.createdAt).toLocaleString()}</span>

                                            <span className={`text-[10px] font-black uppercase italic ${cfg.color}`}>{cfg.label}</span>

                                            <div className="flex justify-center">
                                                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[8px] font-black uppercase tracking-widest">COMPLETED</span>
                                            </div>

                                            <div className="text-center">
                                                {/* MODIFIED: No sign, Absolute Integer */}
                                                <span className={`text-[13px] font-black font-mono italic ${isPositive ? 'text-emerald-400' : 'text-red-500'}`}>
                                                    {Math.abs(Math.round(tx.quantity))}
                                                </span>
                                            </div>

                                            <div className="text-center">
                                                <span className="text-[13px] font-black text-purple-400 font-mono italic">{tx.newStock}</span>
                                            </div>

                                            <div className="text-right">
                                                <span className="text-[11px] font-bold text-gray-400 font-mono">${Number(tx.unitCost || 0).toFixed(2)}</span>
                                            </div>

                                            <div className="flex justify-center">
                                                <button
                                                    onClick={() => setSelectedTransaction(tx)}
                                                    className="w-8 h-8 rounded-lg bg-blue-500/10 hover:bg-blue-500 text-blue-500 hover:text-white flex items-center justify-center transition-all cursor-pointer border border-blue-500/20"
                                                >
                                                    <EyeIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}

                            {transactions.length === 0 && (
                                <div className="py-20 text-center opacity-20 select-none border-2 border-dashed border-gray-800 rounded-3xl m-4">
                                    <ClockIcon className="w-12 h-12 mx-auto mb-4 text-gray-600" />
                                    <p className="font-black uppercase italic text-xs tracking-[0.2em]">NO SE ENCONTRARON MOVIMIENTOS</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer simple stats */}
                <div className="p-6 bg-gray-900/50 border-t border-white/5 shrink-0 flex items-center justify-between text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                    <span>MOSTRANDO {transactions.length} MOVIMIENTOS</span>
                    <span>{selectedBranchId === 'all' ? 'CONSOLIDADO GLOBAL' : 'FILTRADO POR SEDE'}</span>
                </div>
            </div>

            {selectedTransaction && (
                <TransactionDetailModal
                    transaction={selectedTransaction}
                    onClose={() => setSelectedTransaction(null)}
                />
            )}
        </div>
    );
};

export default KardexModal;
