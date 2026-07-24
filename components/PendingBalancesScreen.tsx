import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../api';
import { PendingBalance } from '../types';
import { toast } from 'react-hot-toast';
import { ArrowPathIcon, CheckCircleIcon, UserIcon, UserGroupIcon, SearchIcon, CalendarIcon, TrashIcon, ClockIcon } from './icons';
import { getElSalvadorDateString } from '../utils/dates';
import ConfirmationModal from './ConfirmationModal';
import { ViewHeader } from './AdminShared';

interface PendingBalancesScreenProps {
    branchId: number;
    onBack: () => void;
}

const PendingBalancesScreen: React.FC<PendingBalancesScreenProps> = ({ branchId, onBack }) => {
    const [balances, setBalances] = useState<PendingBalance[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<'PENDING' | 'PAID'>('PENDING');
    const [filterType, setFilterType] = useState<'ALL' | 'CUSTOMER' | 'EMPLOYEE'>('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [startDate, setStartDate] = useState(getElSalvadorDateString());
    const [endDate, setEndDate] = useState(getElSalvadorDateString());

    // Modal state
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [selectedBalance, setSelectedBalance] = useState<PendingBalance | null>(null);

    const fetchBalances = async () => {
        setIsLoading(true);
        try {
            const results = await api.getPendingBalances({
                branchId,
                status: filterStatus,
                startDate,
                endDate,
                search: searchQuery
            });
            setBalances(results);
        } catch (error) {
            console.error('Error fetching balances:', error);
            toast.error('Error al cargar saldos pendientes');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchBalances();
    }, [branchId, startDate, endDate, filterStatus]);

    // On-the-fly search with debounce
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchBalances();
        }, 200); // Reduced to 200ms for snappier feel

        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Manual search trigger (for form submit)
    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        fetchBalances();
    };

    const handleLiquidation = (balance: PendingBalance) => {
        setSelectedBalance(balance);
        setIsConfirmModalOpen(true);
    };

    const confirmLiquidation = async () => {
        if (!selectedBalance) return;

        setIsConfirmModalOpen(false);
        try {
            await api.payPendingBalance(selectedBalance.id, selectedBalance.balance);
            toast.success('Saldo liquidado correctamente');
            fetchBalances();
        } catch (error) {
            console.error('Error paying balance:', error);
            toast.error('Error al procesar el pago');
        } finally {
            setSelectedBalance(null);
        }
    };

    const totals = useMemo(() => {
        return balances.reduce((acc, curr) => {
            acc.total += curr.balance;
            if (curr.type === 'CUSTOMER') acc.customer += curr.balance;
            if (curr.type === 'EMPLOYEE') acc.employee += curr.balance;
            return acc;
        }, { total: 0, customer: 0, employee: 0 });
    }, [balances]);

    const filteredBalances = balances.filter(b => filterType === 'ALL' || b.type === filterType);

    return (
        <div className="flex flex-col h-full bg-gray-950 text-white p-4 md:p-6 overflow-hidden">
            <ViewHeader title="CUENTAS POR <span class='text-amber-500'>COBRAR</span>" onBack={onBack} />

            {/* Search Bar & Status Tabs */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 mb-6 shrink-0 px-1">
                <form onSubmit={handleSearch} className="relative group flex-1">
                    <div className="absolute -inset-1 bg-gradient-to-r from-amber-500/20 to-transparent rounded-[24px] blur opacity-0 group-focus-within:opacity-100 transition-duration-500"></div>
                    <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-amber-500 transition-colors z-30" />
                    <input
                        type="text"
                        placeholder="BUSCAR CLIENTE O EMPLEADO..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full h-12 py-2 pl-12 pr-12 bg-gray-900/60 backdrop-blur-xl border border-white/5 rounded-[20px] text-white font-black uppercase outline-none focus:border-amber-500/40 placeholder:text-gray-600 text-[10px] shadow-lg transition-all relative z-20"
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-gray-500 hover:text-red-500 transition-all z-30 bg-gray-900/40 rounded-full hover:bg-red-500/10"
                        >
                            <TrashIcon className="w-3.5 h-3.5" />
                        </button>
                    )}
                </form>

                <div className="flex bg-gray-900 border border-white/5 p-1 rounded-[22px] gap-1 shadow-lg shrink-0">
                    <button
                        onClick={() => setFilterStatus('PENDING')}
                        className={`flex items-center gap-2 px-6 h-10 rounded-[18px] text-[10px] font-black uppercase italic transition-all ${filterStatus === 'PENDING' ? 'bg-amber-500 text-black shadow-[0_0_15px_rgba(245,158,11,0.3)]' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        <ClockIcon className="w-4 h-4" /> PENDIENTES
                    </button>
                    <button
                        onClick={() => setFilterStatus('PAID')}
                        className={`flex items-center gap-2 px-6 h-10 rounded-[18px] text-[10px] font-black uppercase italic transition-all ${filterStatus === 'PAID' ? 'bg-green-600 text-white shadow-[0_0_15px_rgba(22,163,74,0.3)]' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        <CheckCircleIcon className="w-4 h-4" /> LIQUIDADOS
                    </button>
                </div>
            </div>

            {/* Filters & Totals */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
                {/* Date Inputs */}
                <div className="flex items-center gap-2 bg-gray-900/50 border border-gray-800 p-2 rounded-2xl">
                    <div className="flex-1 flex flex-col">
                        <span className="text-[8px] font-black text-gray-500 uppercase ml-2 mb-0.5">Inicio</span>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="bg-transparent text-[11px] font-black uppercase text-white outline-none px-2 [color-scheme:dark]"
                        />
                    </div>
                    <div className="w-px h-8 bg-gray-800" />
                    <div className="flex-1 flex flex-col">
                        <span className="text-[8px] font-black text-gray-500 uppercase ml-2 mb-0.5">Fin</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="bg-transparent text-[11px] font-black uppercase text-white outline-none px-2 [color-scheme:dark]"
                        />
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="col-span-1 lg:col-span-3 grid grid-cols-3 gap-2">
                    <div className="bg-gray-900/50 border border-gray-800 p-3 rounded-2xl flex flex-col justify-center group hover:border-amber-500/30 transition-all">
                        <span className="text-[8px] font-black text-gray-500 uppercase mb-1">{filterStatus === 'PENDING' ? 'Total Pendiente' : 'Total Recaudado'}</span>
                        <span className={`text-lg font-black font-mono leading-none tracking-tighter ${filterStatus === 'PENDING' ? 'text-white' : 'text-green-500'}`}>
                            ${totals.total.toFixed(2)}
                        </span>
                    </div>
                    <div className="bg-blue-500/5 border border-blue-500/20 p-3 rounded-2xl flex flex-col justify-center">
                        <span className="text-[8px] font-black text-blue-400/60 uppercase mb-1">Total Créditos</span>
                        <span className="text-lg font-black text-blue-400 font-mono leading-none tracking-tighter">
                            ${totals.customer.toFixed(2)}
                        </span>
                    </div>
                    <div className="bg-purple-500/5 border border-purple-500/20 p-3 rounded-2xl flex flex-col justify-center">
                        <span className="text-[8px] font-black text-purple-400/60 uppercase mb-1">Total Empleados</span>
                        <span className="text-lg font-black text-purple-400 font-mono leading-none tracking-tighter">
                            ${totals.employee.toFixed(2)}
                        </span>
                    </div>
                </div>
            </div>

            {/* Type Filter Tabs */}
            <div className="flex gap-2 mb-4">
                {(['ALL', 'CUSTOMER', 'EMPLOYEE'] as const).map(t => (
                    <button
                        key={t}
                        onClick={() => setFilterType(t)}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${filterType === t
                            ? 'bg-amber-600 border-amber-500 text-white shadow-lg shadow-amber-900/20'
                            : 'bg-gray-900 border-gray-800 text-gray-500 hover:border-gray-700'
                            }`}
                    >
                        {t === 'ALL' ? 'Todos' : (t === 'CUSTOMER' ? 'Créditos' : 'Empleados')}
                    </button>
                ))}
            </div>

            {/* Content Range */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 grayscale opacity-50">
                        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" />
                        <p className="text-xs font-black uppercase tracking-widest text-gray-400">Consultando registros...</p>
                    </div>
                ) : filteredBalances.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-gray-900/30 border border-dashed border-gray-800 rounded-[32px]">
                        <CheckCircleIcon className="w-10 h-10 text-gray-700 mb-3" />
                        <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Sin cuentas en este periodo/filtro</p>
                    </div>
                ) : (
                    filteredBalances.map(balance => (
                        <div
                            key={balance.id}
                            className="bg-gray-900/60 border border-gray-800/50 rounded-2xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-gray-900 hover:border-gray-700 transition-all relative overflow-hidden group"
                        >
                            <div className={`absolute top-0 left-0 w-1 h-full ${balance.type === 'CUSTOMER' ? 'bg-blue-600' : 'bg-purple-600'}`} />

                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-xl ${balance.type === 'CUSTOMER' ? 'bg-blue-500/10 text-blue-500' : 'bg-purple-500/10 text-purple-500'}`}>
                                    {balance.type === 'CUSTOMER' ? <UserGroupIcon className="w-5 h-5" /> : <UserIcon className="w-5 h-5" />}
                                </div>
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-sm font-black text-white uppercase leading-none truncate max-w-[150px] md:max-w-none">
                                            {balance.type === 'CUSTOMER' ? (balance.customerName || 'Cliente Varios') : (balance.userName || 'Empleado')}
                                        </h3>
                                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border ${balance.type === 'CUSTOMER'
                                            ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                                            : 'bg-purple-500/10 border-purple-500/20 text-purple-400'
                                            }`}>
                                            {balance.type === 'CUSTOMER' ? 'CRÉDITO' : 'EMPLEADO'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1.5 text-gray-500 font-black text-[9px] uppercase tracking-tighter">
                                        <span className="bg-gray-800 px-1.5 py-0.5 rounded">ORDEN #{String(balance.dailyOrderNumber).padStart(3, '0')}</span>
                                        <span className="flex items-center gap-1 text-amber-500/60 font-black"><CalendarIcon className="w-3 h-3" /> {new Date(balance.createdAt).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between md:justify-end gap-4 border-t md:border-t-0 border-gray-800/50 pt-2 md:pt-0">
                                <div className="text-right">
                                    <p className="text-[8px] font-black text-gray-500 uppercase tracking-tighter mb-0.5">{filterStatus === 'PENDING' ? 'Saldo' : 'Recaudado'}</p>
                                    <p className={`text-xl font-black font-mono leading-none tracking-tighter ${filterStatus === 'PENDING' ? 'text-white' : 'text-green-500'}`}>
                                        ${balance.balance.toFixed(2)}
                                    </p>
                                </div>
                                {filterStatus === 'PENDING' && (
                                    <button
                                        onClick={() => handleLiquidation(balance)}
                                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-all shadow-lg shadow-emerald-900/20 active:scale-95 group/btn"
                                    >
                                        <span className="text-[10px] font-black uppercase tracking-widest hidden md:block">Liquidar</span>
                                        <CheckCircleIcon className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            <ConfirmationModal
                isOpen={isConfirmModalOpen}
                onClose={() => setIsConfirmModalOpen(false)}
                onConfirm={confirmLiquidation}
                title="LIQUIDAR DEUDA"
                message={`¿Confirmas que deseas liquidar el saldo de $${selectedBalance?.balance.toFixed(2)} para ${selectedBalance?.type === 'CUSTOMER' ? selectedBalance?.customerName : selectedBalance?.userName}?`}
                confirmText="SÍ, LIQUIDAR"
                isDestructive={false}
            />
        </div>
    );
};

export default PendingBalancesScreen;
