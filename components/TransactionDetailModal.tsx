import React from 'react';
import { InventoryTransaction } from '../types';
import { ClockIcon, UserIcon, StoreIcon, DocumentTextIcon, CheckCircleIcon } from './icons';

interface TransactionDetailModalProps {
    transaction: InventoryTransaction;
    onClose: () => void;
}

const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({ transaction, onClose }) => {

    const typeLabels: Record<string, string> = {
        ADJUSTMENT_ADD: 'INGRESO AJP',
        ADJUSTMENT_SUB: 'SALIDA AJN',
        PURCHASE: 'INGRESO COMPRA',
        TRANSFER_IN: 'INGRESO TRS',
        TRANSFER_OUT: 'SALIDA TRS',
        SALE: 'VENTA',
        INITIAL: 'INICIAL',
        // Fallback
        DEFAULT: 'TRANSACCIÓN'
    };

    const label = typeLabels[transaction.transactionType] || typeLabels.DEFAULT || transaction.transactionType;
    const isPositive = transaction.newStock > transaction.previousStock;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xl flex items-center justify-center z-[300] p-4 animate-in fade-in duration-300">
            <div className="bg-[#0a0a0c] w-full max-w-lg rounded-[40px] border border-white/5 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in duration-300 relative">
                {/* Header */}
                <div className="p-8 border-b border-white/5 flex justify-between items-start">
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] italic">DETALLE DE MOVIMIENTO</span>
                        <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">{label} <span className="text-purple-500">#{transaction.id}</span></h3>
                    </div>
                    <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-all">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Content */}
                <div className="p-8 space-y-8 overflow-y-auto max-h-[70vh] scrollbar-hide">

                    {/* Main Stats */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gray-900/50 p-6 rounded-3xl border border-white/5">
                            {/* DYNAMIC LABEL INSTEAD OF "CANTIDAD" */}
                            <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest italic mb-2 block">{label}</span>
                            {/* ABSOLUTE VALUE, NO SIGN, INTEGER */}
                            <span className={`text-3xl font-black italic ${isPositive ? 'text-emerald-400' : 'text-red-500'}`}>
                                {Math.abs(Math.round(transaction.quantity))}
                            </span>
                        </div>
                        <div className="bg-gray-900/50 p-6 rounded-3xl border border-white/5">
                            <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest italic mb-2 block">COSTO UNITARIO</span>
                            <span className="text-3xl font-black text-white italic">
                                ${Number(transaction.unitCost || 0).toFixed(2)}
                            </span>
                        </div>
                    </div>

                    {/* Stock Impact */}
                    <div className="bg-white/5 p-6 rounded-3xl border border-white/5 flex items-center justify-between">
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest italic mb-1">STOCK ANTERIOR</span>
                            <span className="text-xl font-black text-gray-400 italic">{transaction.previousStock}</span>
                        </div>
                        <div className="h-8 w-px bg-white/10"></div>
                        <div className="flex flex-col text-right">
                            <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest italic mb-1">STOCK RESULTANTE</span>
                            <span className="text-xl font-black text-white italic">{transaction.newStock}</span>
                        </div>
                    </div>

                    {/* Details List */}
                    <div className="space-y-4">
                        <div className="flex items-start gap-4 p-4 rounded-2xl bg-gray-900/30">
                            <ClockIcon className="w-5 h-5 text-gray-600 mt-0.5" />
                            <div className="flex flex-col">
                                <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest italic">FECHA Y HORA</span>
                                <span className="text-sm font-bold text-gray-300 uppercase italic font-mono">
                                    {new Date(transaction.createdAt).toLocaleString()}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-start gap-4 p-4 rounded-2xl bg-gray-900/30">
                            <DocumentTextIcon className="w-5 h-5 text-gray-600 mt-0.5" />
                            <div className="flex flex-col">
                                <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest italic">MOTIVO / REFERENCIA</span>
                                <span className="text-sm font-bold text-gray-300 uppercase italic w-full break-words">
                                    {transaction.reason || 'SIN OBSERVACIONES'}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-start gap-4 p-4 rounded-2xl bg-gray-900/30">
                            <UserIcon className="w-5 h-5 text-gray-600 mt-0.5" />
                            <div className="flex flex-col">
                                <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest italic">USUARIO</span>
                                <span className="text-sm font-bold text-gray-300 uppercase italic">
                                    {transaction.userName || (transaction.userId ? `ID: ${transaction.userId}` : 'SISTEMA')}
                                </span>
                            </div>
                        </div>

                        {transaction.relatedBranchId && (
                            <div className="flex items-start gap-4 p-4 rounded-2xl bg-gray-900/30">
                                <StoreIcon className="w-5 h-5 text-blue-500 mt-0.5" />
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest italic">SEDE VINCULADA</span>
                                    <span className="text-sm font-bold text-blue-400 uppercase italic">
                                        SUCURSAL #{transaction.relatedBranchId}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer read-only notice */}
                <div className="p-6 bg-gray-900/80 border-t border-white/5 flex items-center justify-center gap-2 opacity-50">
                    <CheckCircleIcon className="w-4 h-4 text-gray-500" />
                    <span className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em] italic">MODO SOLO LECTURA</span>
                </div>
            </div>
        </div>
    );
};

export default TransactionDetailModal;
