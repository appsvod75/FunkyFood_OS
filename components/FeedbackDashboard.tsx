import React, { useState, useEffect, useRef } from 'react';
import { api, socket } from '../api';
import { toast } from 'react-hot-toast';

// Inline Icons
const Star: React.FC<{ className?: string, fill?: string }> = ({ className, fill }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill={fill || "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
);
const MessageSquare: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
);
const Calendar: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
);
const Smile: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" /></svg>
);
const Frown: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10" /><path d="M16 16s-1.5-2-4-2-4 2-4 2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" /></svg>
);

interface Feedback {
    id: number;
    rating: number;
    comment: string;
    created_at: string;
    branch_id: number;
}

interface FeedbackDashboardProps {
    onBack?: () => void;
}

export const FeedbackDashboard: React.FC<FeedbackDashboardProps> = ({ onBack }) => {
    const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
    const [filteredFeedbacks, setFilteredFeedbacks] = useState<Feedback[]>([]);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState<'all' | 'today' | 'week' | 'month'>('all');

    // Drag-to-Scroll Logic
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

    useEffect(() => {
        loadFeedback();

        const handleNewFeedback = (newItem: Feedback) => {
            console.log('Socket: new_feedback received', newItem);
            setFeedbacks(prev => [newItem, ...prev]);
            // Also update filtered if it matches current filter
            if (period === 'all' || period === 'today') {
                setFilteredFeedbacks(prev => [newItem, ...prev]);
            }
            toast.success('¡Nueva Opinión Recibida!', { icon: '💬' });
        };

        socket.on('new_feedback', handleNewFeedback);
        return () => { socket.off('new_feedback', handleNewFeedback); };
    }, []);

    useEffect(() => {
        filterData();
    }, [feedbacks, period]);

    const loadFeedback = async () => {
        try {
            setLoading(true);
            const data: Feedback[] = await api.get('/feedback');
            setFeedbacks(data);
        } catch (e) {
            console.error("Failed to load feedback", e);
        } finally {
            setLoading(false);
        }
    };

    const filterData = () => {
        const now = new Date();
        const filtered = feedbacks.filter(f => {
            const date = new Date(f.created_at);
            if (period === 'all') return true;
            if (period === 'today') {
                return date.getDate() === now.getDate() &&
                    date.getMonth() === now.getMonth() &&
                    date.getFullYear() === now.getFullYear();
            }
            if (period === 'week') {
                const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                return date >= weekAgo;
            }
            if (period === 'month') {
                return date.getMonth() === now.getMonth() &&
                    date.getFullYear() === now.getFullYear();
            }
            return true;
        });
        setFilteredFeedbacks(filtered);
    };

    const getAverageRating = () => {
        if (filteredFeedbacks.length === 0) return 0;
        const total = filteredFeedbacks.reduce((acc, curr) => acc + curr.rating, 0);
        return (total / filteredFeedbacks.length).toFixed(1);
    };

    const getSentimentCount = (type: 'positive' | 'negative') => {
        return filteredFeedbacks.filter(f => type === 'positive' ? f.rating >= 4 : f.rating < 4).length;
    };

    return (
        <div className="flex flex-col h-full bg-gray-900 overflow-hidden animate-in fade-in duration-300">
            {/* Header Unified Style */}
            <div className="flex flex-col md:flex-row justify-between items-center p-4 md:p-6 border-b border-gray-800 shrink-0 gap-4 md:gap-0">
                <div className="flex items-center gap-4 w-full md:w-auto">
                    {onBack && (
                        <button onClick={onBack} className="p-3 bg-gray-800 rounded-full hover:bg-gray-700 active:scale-90 transition-all border border-gray-700">
                            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        </button>
                    )}
                    <div className="flex-1 md:flex-none">
                        <h1 className="text-xl md:text-3xl font-black text-white italic uppercase tracking-tighter">RESULTADOS DE <span className="text-amber-500">CALIDAD</span></h1>
                        <p className="text-[10px] md:text-xs text-gray-500 font-bold uppercase tracking-widest">OPINIONES Y SATISFACCIÓN DEL CLIENTE</p>
                    </div>
                </div>

                <div className="flex bg-gray-800 p-1 rounded-lg border border-gray-700 w-full md:w-auto overflow-x-auto scrollbar-hide">
                    {['all', 'month', 'week', 'today'].map((p) => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p as any)}
                            className={`px-4 py-2 rounded-md text-xs font-bold uppercase tracking-widest transition-all ${period === p
                                ? 'bg-amber-500 text-black shadow-sm'
                                : 'text-slate-500 hover:text-white'
                                }`}
                        >
                            {p === 'all' ? 'Todo' :
                                p === 'month' ? 'Mes' :
                                    p === 'week' ? 'Semana' : 'Hoy'}
                        </button>
                    ))}
                </div>
            </div>

            <div
                ref={scrollRef}
                onMouseDown={handleMouseDown}
                onMouseLeave={handleMouseLeave}
                onMouseUp={handleMouseUp}
                onMouseMove={handleMouseMove}
                className={`flex-1 overflow-auto p-6 scrollbar-hide select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
            >
                {/* KPI CARDS */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    {/* Average */}
                    <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-400">
                            <Star className="w-8 h-8" fill="currentColor" />
                        </div>
                        <div>
                            <div className="text-4xl font-bold text-white">{getAverageRating()}</div>
                            <div className="text-sm text-slate-400">Promedio General</div>
                        </div>
                    </div>

                    {/* Total */}
                    <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
                            <MessageSquare className="w-8 h-8" />
                        </div>
                        <div>
                            <div className="text-4xl font-bold text-white">{filteredFeedbacks.length}</div>
                            <div className="text-sm text-slate-400">Encuestas Totales</div>
                        </div>
                    </div>

                    {/* Happy */}
                    <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center text-green-400">
                            <Smile className="w-8 h-8" />
                        </div>
                        <div>
                            <div className="text-4xl font-bold text-white">{getSentimentCount('positive')}</div>
                            <div className="text-sm text-slate-400">Clientes Felices</div>
                        </div>
                    </div>

                    {/* Sad */}
                    <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center text-red-400">
                            <Frown className="w-8 h-8" />
                        </div>
                        <div>
                            <div className="text-4xl font-bold text-white">{getSentimentCount('negative')}</div>
                            <div className="text-sm text-slate-400">Por Mejorar</div>
                        </div>
                    </div>
                </div>

                {/* COMMENTS LIST */}
                <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
                    <div className="p-6 border-b border-slate-700">
                        <h3 className="text-xl font-bold text-white">Últimos Comentarios</h3>
                    </div>
                    <div className="divide-y divide-slate-700 max-h-[600px] overflow-y-auto">
                        {loading ? (
                            <div className="p-8 text-center text-slate-400">Cargando opiniones...</div>
                        ) : filteredFeedbacks.length === 0 ? (
                            <div className="p-8 text-center text-slate-400">No hay encuestas en este periodo.</div>
                        ) : (
                            filteredFeedbacks.map((item) => (
                                <div key={item.id} className="p-6 hover:bg-slate-700/50 transition-colors">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-2">
                                            <div className={`px-3 py-1 rounded-full text-xs font-bold ${item.rating >= 4 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                                                }`}>
                                                {item.rating} ★
                                            </div>
                                            <span className="text-slate-400 text-sm flex items-center gap-1">
                                                <Calendar className="w-3 h-3" />
                                                {new Date(item.created_at).toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                    <p className="text-slate-300 italic">
                                        "{item.comment || 'Sin comentario'}"
                                    </p>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
