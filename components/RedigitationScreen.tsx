
import React, { useState, useEffect } from 'react';
import { api } from '../api';
import toast from 'react-hot-toast';

interface RedigitationScreenProps {
    branchId: number;
    onSelectSession: (session: { cashReportId: number; date: string; branchId: number }) => void;
    onBack: () => void;
}

const RedigitationScreen: React.FC<RedigitationScreenProps> = ({ branchId, onSelectSession, onBack }) => {
    const [sessions, setSessions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadSessions();
    }, [branchId]);

    const loadSessions = async () => {
        setLoading(true);
        try {
            const data = await api.getRedigitateSessions(branchId);
            setSessions(data);
        } catch (err: any) {
            toast.error(err.message || 'Error al cargar sesiones');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-full flex flex-col max-w-2xl mx-auto p-4 sm:p-6 overflow-hidden animate-in fade-in duration-500">
            <div className="flex items-center gap-4 mb-6 shrink-0">
                <button
                    onClick={onBack}
                    className="bg-gray-800 p-2.5 rounded-full hover:bg-gray-700 active:scale-90 transition-all shadow-lg border border-gray-700/50"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <h1 className="text-2xl font-black text-white italic uppercase tracking-tighter leading-none">
                    REDIGITAR <span className="text-orange-500">ÓRDENES</span>
                </h1>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pb-20">
                <div className="flex gap-4 p-4 bg-orange-500/10 rounded-2xl border border-orange-500/20 items-start">
                    <span className="text-orange-400 text-lg shrink-0 mt-0.5">🔴</span>
                    <p className="text-[10px] text-orange-300 font-bold uppercase leading-relaxed tracking-wide">
                        Selecciona una sesión de caja abierta de días anteriores para redigitar órdenes.
                        Las órdenes que crees se vincularán a ese turno.
                    </p>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : sessions.length === 0 ? (
                    <div className="text-center py-20 space-y-4">
                        <span className="text-5xl">📭</span>
                        <p className="text-gray-500 font-black text-xs uppercase tracking-widest italic">
                            No hay sesiones abiertas de días anteriores
                        </p>
                        <p className="text-gray-600 text-[9px] font-bold uppercase tracking-widest">
                            Debes aperturar una caja con fecha pasada y mantenerla abierta
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {sessions.map(session => (
                            <button
                                key={session.id}
                                onClick={() => onSelectSession({ cashReportId: session.id, date: session.date, branchId })}
                                className="w-full p-5 bg-gray-800/40 backdrop-blur-md border border-orange-500/30 text-left rounded-3xl hover:bg-orange-600/20 hover:border-orange-500 transition-all active:scale-[0.98] space-y-2 group"
                            >
                                <div className="flex items-center justify-between">
                                    <span className="font-black text-sm text-white uppercase italic tracking-tight">
                                        Fecha: <span className="text-orange-500">{session.date}</span>
                                    </span>
                                    <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-3 py-1 rounded-full">
                                        ABIERTO
                                    </span>
                                </div>
                                <div className="flex items-center gap-4 text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                                    <span>💰 ${Number(session.total_sales || 0).toFixed(2)}</span>
                                    <span>📋 {session.total_orders || 0} órdenes</span>
                                    {session.opening_timestamp && (
                                        <span>🕐 {new Date(session.opening_timestamp).toLocaleString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span>
                                    )}
                                </div>
                                <div className="pt-1">
                                    <span className="text-[8px] text-orange-500/60 font-black uppercase tracking-widest group-hover:text-orange-400 transition-colors">
                                        SELECCIONAR → REDIGITAR
                                    </span>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default RedigitationScreen;
