
import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { XIcon, ChartBarIcon, CalendarIcon, ClockIcon, UserIcon } from './icons';
import { getElSalvadorDateString } from '../utils/dates';

interface ChefStats {
    chefName: string;
    totalOrders: number;
    avgPrepTimeSeconds: number;
}

interface ChefStatsModalProps {
    isOpen: boolean;
    onClose: () => void;
    branchId: number;
}

const ChefStatsModal: React.FC<ChefStatsModalProps> = ({ isOpen, onClose, branchId }) => {
    const [stats, setStats] = useState<ChefStats[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [dateRange, setDateRange] = useState({
        startDate: getElSalvadorDateString(),
        endDate: getElSalvadorDateString()
    });

    const fetchStats = async () => {
        setIsLoading(true);
        try {
            const data = await api.getChefPerformance({
                ...dateRange,
                branchId
            });
            setStats(data);
        } catch (error) {
            console.error('Error fetching chef stats:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchStats();
        }
    }, [isOpen, dateRange]);

    if (!isOpen) return null;

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.round(seconds % 60);
        return `${mins}m ${secs}s`;
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-gray-900 border border-gray-800 w-full max-w-2xl rounded-3xl flex flex-col h-[80vh] shadow-2xl overflow-hidden">
                <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 backdrop-blur-md">
                    <div>
                        <h2 className="text-xl font-black text-white uppercase tracking-tighter italic">ESTADÍSTICAS <span className="text-amber-500">CHEF</span></h2>
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">Productividad y tiempos de respuesta</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-full transition-colors">
                        <XIcon className="w-6 h-6 text-gray-400" />
                    </button>
                </div>

                <div className="p-4 bg-gray-800/20 border-b border-gray-800 flex gap-4 overflow-x-auto">
                    <div className="flex-1 min-w-[140px]">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1 block">Desde</label>
                        <input
                            type="date"
                            value={dateRange.startDate}
                            onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white font-bold focus:border-amber-500 outline-none transition-colors"
                        />
                    </div>
                    <div className="flex-1 min-w-[140px]">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1 block">Hasta</label>
                        <input
                            type="date"
                            value={dateRange.endDate}
                            onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white font-bold focus:border-amber-500 outline-none transition-colors"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-full gap-4">
                            <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest animate-pulse">Cargando métricas...</p>
                        </div>
                    ) : stats.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-600 italic">
                            No hay datos para este periodo
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-3">
                            {stats.map((chef, idx) => (
                                <div key={chef.chefName} className="bg-gray-800/40 border border-gray-700/50 rounded-2xl p-3.5 flex flex-wrap gap-4 items-center hover:bg-gray-800/60 hover:border-amber-500/30 transition-all group">
                                    <div className="flex items-center gap-3 flex-1 min-w-[150px]">
                                        <div className="bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20 group-hover:scale-105 transition-transform">
                                            <UserIcon className="w-5 h-5 text-amber-500" />
                                        </div>
                                        <div>
                                            <div className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Cocinero</div>
                                            <div className="text-base font-black text-white uppercase italic tracking-tight">{chef.chefName}</div>
                                        </div>
                                    </div>

                                    <div className="flex gap-6">
                                        <div>
                                            <div className="text-[9px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-1">
                                                <ChartBarIcon className="w-3 h-3 text-blue-400" /> Volumen
                                            </div>
                                            <div className="text-lg font-black text-white leading-none mt-1">{chef.totalOrders} <span className="text-[9px] text-gray-500 uppercase">Órdenes</span></div>
                                        </div>
                                        <div>
                                            <div className="text-[9px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-1">
                                                <ClockIcon className="w-3 h-3 text-green-400" /> Promedio
                                            </div>
                                            <div className="text-lg font-black text-white leading-none mt-1">{formatTime(chef.avgPrepTimeSeconds)}</div>
                                        </div>
                                    </div>

                                    {/* Velocity Indicator */}
                                    <div className="w-full bg-gray-900 h-1 rounded-full overflow-hidden mt-2.5">
                                        <div
                                            className="h-full bg-gradient-to-r from-blue-500 to-green-500 opacity-80"
                                            style={{ width: `${Math.min(100, (chef.totalOrders / stats[0].totalOrders) * 100)}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ChefStatsModal;
