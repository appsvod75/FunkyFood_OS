import React, { useState, useEffect } from 'react';
import { SaveIcon } from './icons';
import { Branch } from '../types';
import { getElSalvadorDateString } from '../utils/dates';

interface CashOpeningModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (amount: number, date: string, branchId: number) => Promise<void>;
    onSilence?: () => void;
    branchName?: string;
    isAdmin?: boolean;
    isSuperAdmin?: boolean;
    branches?: Branch[];
    currentBranchId?: number;
}

const CashOpeningModal: React.FC<CashOpeningModalProps> = ({ 
    isOpen, onClose, onSave, onSilence, branchName, isAdmin, isSuperAdmin, branches, currentBranchId 
}) => {
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(getElSalvadorDateString());
    const [selectedBranchId, setSelectedBranchId] = useState<number | undefined>(currentBranchId);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setSelectedBranchId(currentBranchId);
        }
    }, [isOpen, currentBranchId]);

    if (!isOpen) return null;

    const handleSave = async () => {
        const val = parseFloat(amount);
        if (isNaN(val) || val < 0) {
            alert('Por favor ingresa un monto válido (0 o mayor)');
            return;
        }

        if (!selectedBranchId) {
            alert('Por favor selecciona una sucursal');
            return;
        }

        setIsSaving(true);
        try {
            await onSave(val, date, selectedBranchId);
            onClose();
        } catch (error) {
            console.error("Error saving cash opening:", error);
        } finally {
            setIsSaving(false);
        }
    };

    const activeBranches = branches?.filter(b => b.isActive) || [];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-gray-900 border border-gray-800 w-full max-w-sm rounded-[32px] shadow-2xl overflow-hidden animate-scale-in flex flex-col max-h-[98vh]">
                <div className="p-5 overflow-y-auto flex-1 scrollbar-hide">
                    <div className="flex flex-col items-center text-center mb-4">
                        <div className="w-14 h-14 bg-amber-500/10 rounded-full flex items-center justify-center mb-2 border border-amber-500/20">
                            <span className="text-2xl">💰</span>
                        </div>
                        <h2 className="text-xl font-black text-white italic uppercase tracking-tighter">
                            Apertura de <span className="text-amber-500">Caja</span>
                        </h2>
                    </div>

                    <div className="space-y-4">
                        {/* Branch Selector or Display */}
                        <div>
                            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 text-center">
                                Sucursal a Operar
                            </label>
                            {isSuperAdmin ? (
                                <select
                                    value={selectedBranchId}
                                    onChange={(e) => setSelectedBranchId(Number(e.target.value))}
                                    className="w-full p-3 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white font-black text-center focus:outline-none focus:border-amber-500 transition-all uppercase text-xs"
                                    disabled={activeBranches.length === 0}
                                >
                                    {activeBranches.length === 0 ? (
                                        <option value="">Cargando sucursales...</option>
                                    ) : (
                                        <>
                                            <option value="">-- SELECCIONAR SUCURSAL --</option>
                                            {activeBranches.map(b => (
                                                <option key={b.id} value={b.id}>{b.name}</option>
                                            ))}
                                        </>
                                    )}
                                </select>
                            ) : (
                                <div className="w-full p-3 bg-gray-800/50 border border-gray-700 rounded-2xl text-amber-500 font-black text-center uppercase text-xs">
                                    {branchName || 'Sucursal Actual'}
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 text-center">
                                Monto Inicial (Fondo de Caja)
                            </label>
                            <div className="relative">
                                <span className="absolute left-6 top-1/2 -translate-y-1/2 text-amber-500 font-black text-xl">$</span>
                                <input
                                    autoFocus
                                    type="number"
                                    step="0.01"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    onFocus={(e) => e.target.select()}
                                    placeholder="0.00"
                                    className="w-full p-4 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white font-black text-3xl text-center focus:outline-none focus:border-amber-500 transition-all placeholder:text-gray-700 pl-10"
                                />
                            </div>
                        </div>

                        {isAdmin && (
                            <div>
                                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 text-center">
                                    Fecha (Solo si es retroactiva)
                                </label>
                                <input
                                    type="date"
                                    value={date}
                                    max={getElSalvadorDateString()}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="w-full p-3 bg-gray-800 border-2 border-gray-700 rounded-xl text-white font-black text-center focus:outline-none focus:border-amber-500 transition-all uppercase text-xs"
                                />
                            </div>
                        )}
                    </div>

                    <div className="mt-6 flex flex-col gap-3">
                        <button
                            onClick={handleSave}
                            disabled={isSaving || amount === '' || !selectedBranchId}
                            className="w-full py-4 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:bg-gray-700 text-white rounded-[20px] font-black uppercase text-xs tracking-widest shadow-xl shadow-green-900/40 flex items-center justify-center gap-2 transition-all active:scale-[0.98] border border-white/10"
                        >
                            <SaveIcon className="w-4 h-4" />
                            {isSaving ? 'GUARDANDO...' : 'REGISTRAR APERTURA'}
                        </button>
                        
                        <div className="flex gap-2">
                            <button
                                onClick={onClose}
                                className="flex-1 py-3 bg-rose-600 text-white font-black uppercase text-[10px] tracking-widest hover:bg-rose-500 transition-all border border-rose-400/20 rounded-xl active:scale-95 shadow-lg shadow-rose-900/40"
                            >
                                Omitir
                            </button>
                            {onSilence && (
                                <button
                                    onClick={onSilence}
                                    className="flex-1 py-3 bg-blue-600 text-white font-black uppercase text-[10px] tracking-widest hover:bg-blue-500 transition-all border border-blue-400/20 rounded-xl active:scale-95 shadow-lg shadow-blue-900/20"
                                >
                                    No molestar
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CashOpeningModal;
