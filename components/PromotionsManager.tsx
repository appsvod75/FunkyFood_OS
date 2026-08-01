import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { PromotionRule, PromoType, Product, Category, DiscountType, TargetType } from '../types';
import { api } from '../api';
import { PencilIcon, TrashIcon, CheckCircleIcon, PlusIcon, CalendarIcon, ClockIcon } from './icons';
import ConfirmationModal from './ConfirmationModal';

interface PromotionsManagerProps {
    promotions: PromotionRule[];
    setPromotions: React.Dispatch<React.SetStateAction<PromotionRule[]>>;
    products: Product[];
    categories: Category[];
    onBack: () => void;
}

const PromoTypeLabels: Record<PromoType, string> = {
    QUANTITY: 'Por Cantidad (Múltiplos)',
    HAPPY_HOUR: 'Happy Hour (Hora Feliz)',
    EVENT: 'Evento / Fecha',
    COMBO: 'Combo Dinámico',
    CATEGORY: 'Descuento x Categoría',
    BIRTHDAY: 'Cumpleaños',
    GLOBAL: 'Global (Todo el Menú)'
};

const DiscountTypeLabels: Record<DiscountType, string> = {
    PERCENTAGE: 'Porcentaje (%)',
    FIXED_PRICE: 'Precio Fijo ($)',
    FIXED_AMOUNT_OFF: 'Descuento Fijo (-$)'
};

const useDragScroll = () => {
    const ref = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startY, setStartY] = useState(0);
    const [scrollTop, setScrollTop] = useState(0);

    const onMouseDown = (e: React.MouseEvent) => {
        if (!ref.current) return;
        setIsDragging(true);
        setStartY(e.pageY - ref.current.offsetTop);
        setScrollTop(ref.current.scrollTop);
    };

    const onMouseLeave = () => setIsDragging(false);
    const onMouseUp = () => setIsDragging(false);

    const onMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !ref.current) return;
        e.preventDefault();
        const y = e.pageY - ref.current.offsetTop;
        const walk = (y - startY) * 2;
        ref.current.scrollTop = scrollTop - walk;
    };

    return { ref, isDragging, onMouseDown, onMouseLeave, onMouseUp, onMouseMove };
};

const PromotionsManager: React.FC<PromotionsManagerProps> = ({ promotions, setPromotions, products, categories, onBack }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [targetSearch, setTargetSearch] = useState(''); // NEW: Search for items
    const [promoToDelete, setPromoToDelete] = useState<number | null>(null);

    const [form, setForm] = useState<Partial<PromotionRule>>({
        name: '',
        type: 'QUANTITY',
        isActive: true,
        priority: 0,
        discount_type: 'PERCENTAGE',
        discount_value: 0,
        target_type: 'PRODUCT',
        target_ids: [],
        days_of_week: []
    });

    // Main List Scroll
    const mainScroll = useDragScroll();

    // Items List Scroll (Modal)
    const itemsScroll = useDragScroll();

    // Modal Form Scroll
    const modalFormScroll = useDragScroll();

    const filteredPromotions = promotions.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleOpen = (p?: PromotionRule) => {
        setTargetSearch(''); // Reset search
        if (p) {
            setForm({ ...p });
        } else {
            setForm({
                name: '',
                type: 'QUANTITY',
                isActive: true,
                priority: 0,
                discount_type: 'PERCENTAGE',
                discount_value: 0,
                target_type: 'PRODUCT',
                target_ids: [],
                days_of_week: [],
                trigger_quantity: 2
            });
        }
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!form.name?.trim()) return alert('Nombre requerido');
        if (!form.discount_value && form.type !== 'COMBO') return alert('Valor de descuento requerido');

        try {
            const payload = { ...form, name: form.name?.toUpperCase() };
            // Clean up payload based on type? Backend handles loose JSON, so it's fine.

            if (form.id) {
                await api.updatePromotion(form.id, payload);
                setPromotions(prev => prev.map(p => p.id === form.id ? { ...payload, id: form.id } as PromotionRule : p));
            } else {
                const res = await api.createPromotion(payload);
                // @ts-ignore
                setPromotions(prev => [...prev, { ...payload, id: res.id } as PromotionRule]);
            }
            setIsModalOpen(false);
        } catch (e) {
            console.error(e);
            alert('Error al guardar promoción');
        }
    };

    const handleDelete = (id: number) => {
        setPromoToDelete(id);
    };

    const confirmDeletePromotion = async () => {
        if (!promoToDelete) return;
        try {
            await api.deletePromotion(promoToDelete);
            setPromotions(prev => prev.filter(p => p.id !== promoToDelete));
            setPromoToDelete(null);
        } catch (e) {
            console.error(e);
            alert('Error al eliminar');
        }
    };

    const toggleTargetId = (id: number) => {
        const current = form.target_ids || [];
        if (current.includes(id)) {
            setForm({ ...form, target_ids: current.filter(x => x !== id) });
        } else {
            setForm({ ...form, target_ids: [...current, id] });
        }
    };

    const toggleDay = (day: number) => {
        const current = form.days_of_week || [];
        if (current.includes(day)) {
            setForm({ ...form, days_of_week: current.filter(d => d !== day) });
        } else {
            setForm({ ...form, days_of_week: [...current, day].sort() });
        }
    };

    const portal = document.getElementById('portal-root');

    return (
        <div className="flex flex-col h-full overflow-hidden animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex justify-between items-center gap-4 mb-6 shrink-0 px-1">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="bg-gray-800 p-2.5 rounded-full hover:bg-gray-700 active:scale-90 transition-all shadow-lg border border-gray-700/50">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <h1 className="text-2xl font-black text-white italic uppercase tracking-tighter leading-none">MAESTRO DE <span className="text-amber-500">PROMOCIONES</span></h1>
                </div>
                <button onClick={() => handleOpen()} className="flex items-center gap-2 bg-green-600 text-white font-black py-2.5 px-6 rounded-2xl active:scale-95 transition-all text-[11px] uppercase shadow-xl shadow-green-900/20 italic tracking-widest">
                    <PlusIcon className="w-5 h-5" /> NUEVA PROMO
                </button>
            </div>

            {/* List */}
            <div className="mb-6 shrink-0 px-1">
                <input
                    type="text"
                    placeholder="BUSCAR PROMOCIÓN..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full py-4 px-6 bg-gray-800/50 border-2 border-gray-700 rounded-[24px] text-white font-black uppercase outline-none focus:border-amber-500 placeholder:text-gray-600 text-sm shadow-inner transition-all"
                />
            </div>

            <div
                ref={mainScroll.ref}
                onMouseDown={mainScroll.onMouseDown}
                onMouseLeave={mainScroll.onMouseLeave}
                onMouseUp={mainScroll.onMouseUp}
                onMouseMove={mainScroll.onMouseMove}
                className={`flex-1 overflow-y-auto bg-gray-900/50 rounded-[40px] border border-gray-800 shadow-inner scrollbar-hide select-none ${mainScroll.isDragging ? 'cursor-grabbing' : 'cursor-default'}`}
            >
                <ul className="divide-y divide-gray-800/50">
                    {filteredPromotions.map(p => (
                        <li key={p.id} className="p-5 flex justify-between items-center group hover:bg-gray-800/20 transition-colors">
                            <div className="min-w-0 pr-4">
                                <div className="flex items-center gap-2">
                                    <p className="text-[14px] font-black text-white uppercase italic truncate leading-none group-hover:text-amber-500 transition-colors">{p.name}</p>
                                    {!p.isActive && <span className="bg-red-500/20 text-red-500 text-[9px] font-black px-2 py-0.5 rounded border border-red-500/30">INACTIVA</span>}
                                </div>
                                <p className="text-gray-500 text-[9px] font-black uppercase tracking-[0.1em] italic mt-2.5 flex gap-2">
                                    <span className="text-cyan-500">{PromoTypeLabels[p.type]}</span>
                                    <span>•</span>
                                    <span>{p.discount_type === 'PERCENTAGE' ? `${p.discount_value}% OFF` : p.discount_type === 'FIXED_PRICE' ? `A $${p.discount_value}` : `$${p.discount_value} OFF`}</span>
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => !mainScroll.isDragging && handleOpen(p)} className="p-2.5 bg-gray-800 text-amber-500 rounded-full border border-gray-700 hover:bg-amber-600 hover:border-amber-400 hover:text-white transition-all shadow-lg active:scale-90"><PencilIcon className="w-4 h-4" /></button>
                                <button onClick={() => !mainScroll.isDragging && handleDelete(p.id)} className="p-2.5 bg-gray-800 text-red-500 rounded-full border border-gray-700 hover:bg-red-600 hover:border-red-400 hover:text-white transition-all shadow-lg active:scale-90"><TrashIcon className="w-4 h-4" /></button>
                            </div>
                        </li>
                    ))}
                    {filteredPromotions.length === 0 && <li className="p-20 text-center text-gray-700 font-black uppercase italic tracking-[0.3em] opacity-30 text-xs">Sin promociones</li>}
                </ul>
            </div>

            {/* Modal */}
            {isModalOpen && portal && createPortal(
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
                    <div className="bg-gray-900 rounded-[40px] p-8 w-full max-w-2xl border border-gray-800 shadow-2xl animate-in zoom-in duration-300 overflow-hidden flex flex-col max-h-[92vh]">
                        <h3 className="text-xl font-black text-white italic uppercase mb-6 tracking-tighter leading-none shrink-0">
                            {form.id ? 'EDITAR' : 'NUEVA'} <span className="text-amber-500">PROMOCIÓN</span>
                        </h3>

                        <div
                            ref={modalFormScroll.ref}
                            onMouseDown={modalFormScroll.onMouseDown}
                            onMouseLeave={modalFormScroll.onMouseLeave}
                            onMouseUp={modalFormScroll.onMouseUp}
                            onMouseMove={modalFormScroll.onMouseMove}
                            className={`space-y-6 flex-1 overflow-y-auto scrollbar-hide pr-2 pb-4 select-none ${modalFormScroll.isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                        >
                            {/* Basics */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Nombre Promoción</label>
                                    <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full py-3 px-4 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white font-black uppercase outline-none focus:border-amber-500 shadow-inner" placeholder="EJ: MARTES DE TACOS" />
                                </div>
                                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Tipo de Regla</label>
                                    <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as PromoType })} className="w-full py-3 px-4 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white font-black uppercase outline-none focus:border-amber-500 appearance-none shadow-inner">
                                        {Object.entries(PromoTypeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* Configuration Logic */}
                            <div className="bg-gray-950/50 p-4 rounded-3xl border border-gray-800 space-y-4">
                                <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-2 border-b border-gray-800 pb-2">
                                    <ClockIcon className="w-3 h-3" /> Configuración de la Regla
                                </h4>

                                {/* QUANTITY LOGIC */}
                                {form.type === 'QUANTITY' && (
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Múltiplo {form.trigger_quantity || 2}</label>
                                        <input type="number" value={form.trigger_quantity || 2} onChange={e => setForm({ ...form, trigger_quantity: parseInt(e.target.value) || 2 })} className="w-full py-3 px-4 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white font-black text-xl outline-none focus:border-amber-500 shadow-inner" />
                                    </div>
                                )}

                                {/* TIME/DATE LOGIC - Always Valid Except for specific exceptions if needed */}
                                {form.type !== 'BIRTHDAY' && (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Fecha Inicio</label>
                                            <input type="date" value={form.start_date ? form.start_date.split('T')[0] : ''} onChange={e => setForm({ ...form, start_date: e.target.value })} className="w-full py-3 px-4 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white font-black outline-none focus:border-amber-500 shadow-inner" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Fecha Fin</label>
                                            <input type="date" value={form.end_date ? form.end_date.split('T')[0] : ''} onChange={e => setForm({ ...form, end_date: e.target.value })} className="w-full py-3 px-4 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white font-black outline-none focus:border-amber-500 shadow-inner" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Hora Inicio</label>
                                            <input type="time" value={form.start_time || ''} onChange={e => setForm({ ...form, start_time: e.target.value })} className="w-full py-3 px-4 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white font-black outline-none focus:border-amber-500 shadow-inner" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Hora Fin</label>
                                            <input type="time" value={form.end_time || ''} onChange={e => setForm({ ...form, end_time: e.target.value })} className="w-full py-3 px-4 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white font-black outline-none focus:border-amber-500 shadow-inner" />
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Días Activos</label>
                                    <div className="flex gap-2 flex-wrap">
                                        {['DOM', 'LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB'].map((d, idx) => (
                                            <button key={idx} onClick={() => toggleDay(idx)} className={`w-10 h-10 rounded-xl font-black text-[10px] transition-all border ${form.days_of_week?.includes(idx) ? 'bg-amber-500 border-amber-400 text-white shadow-lg' : 'bg-gray-800 border-gray-700 text-gray-600'}`}>
                                                {d}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Discount Configuration */}
                            <div className="bg-gray-950/50 p-4 rounded-3xl border border-gray-800 space-y-4">
                                <h4 className="text-[10px] font-black text-green-400 uppercase tracking-widest flex items-center gap-2 border-b border-gray-800 pb-2">
                                    <ClockIcon className="w-3 h-3" /> Beneficio
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Tipo Descuento</label>
                                        <select value={form.discount_type} onChange={e => setForm({ ...form, discount_type: e.target.value as DiscountType })} className="w-full py-3 px-4 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white font-black uppercase outline-none focus:border-amber-500 appearance-none shadow-inner">
                                            {Object.entries(DiscountTypeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Valor ({form.discount_type === 'PERCENTAGE' ? '%' : '$'})</label>
                                        <input type="number" value={form.discount_value} onChange={e => setForm({ ...form, discount_value: parseFloat(e.target.value) || 0 })} className="w-full py-3 px-4 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white font-black text-xl outline-none focus:border-amber-500 shadow-inner" />
                                    </div>
                                </div>
                            </div>

                            {/* Targets */}
                            <div className="bg-gray-950/50 p-4 rounded-3xl border border-gray-800 space-y-4">
                                <h4 className="text-[10px] font-black text-purple-400 uppercase tracking-widest flex items-center gap-2 border-b border-gray-800 pb-2">
                                    <ClockIcon className="w-3 h-3" /> items Aplicables
                                </h4>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Aplicar A:</label>
                                    <div className="flex bg-gray-800 p-1 rounded-2xl border border-gray-700">
                                        {(['PRODUCT', 'CATEGORY', 'GLOBAL'] as TargetType[]).map(t => (
                                            <button key={t} onClick={() => setForm({ ...form, target_type: t, target_ids: [] })} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${form.target_type === t ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}>
                                                {t === 'PRODUCT' ? 'Productos' : t === 'CATEGORY' ? 'Categorías' : 'Todo'}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {form.target_type !== 'GLOBAL' && (
                                    <div className="space-y-2">
                                        <input
                                            type="text"
                                            className="w-full p-2 bg-gray-800 border border-gray-700 rounded-xl text-xs text-white font-bold uppercase placeholder:text-gray-600 focus:border-purple-500 outline-none"
                                            placeholder="Buscar item..."
                                            value={targetSearch}
                                            onChange={e => setTargetSearch(e.target.value)}
                                        />

                                        <div
                                            ref={itemsScroll.ref}
                                            onMouseDown={itemsScroll.onMouseDown}
                                            onMouseLeave={itemsScroll.onMouseLeave}
                                            onMouseUp={itemsScroll.onMouseUp}
                                            onMouseMove={itemsScroll.onMouseMove}
                                            className={`grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1 select-none ${itemsScroll.isDragging ? 'cursor-grabbing' : 'cursor-default'} scrollbar-hide`}
                                        >
                                            {form.target_type === 'PRODUCT' && products.filter(p => p.isActive && p.name.toLowerCase().includes(targetSearch.toLowerCase())).map(p => (
                                                <button key={p.id} onClick={() => !itemsScroll.isDragging && toggleTargetId(p.id)} className={`text-left text-[10px] font-black p-2 rounded-lg border transition-all ${form.target_ids?.includes(p.id) ? 'bg-purple-500/20 border-purple-500 text-purple-300' : 'bg-gray-800 border-gray-700 text-gray-500'}`}>
                                                    {p.name}
                                                </button>
                                            ))}
                                            {form.target_type === 'CATEGORY' && categories.filter(c => c.name.toLowerCase().includes(targetSearch.toLowerCase())).map(c => (
                                                <button key={c.id} onClick={() => !itemsScroll.isDragging && toggleTargetId(c.id)} className={`text-left text-[10px] font-black p-2 rounded-lg border transition-all ${form.target_ids?.includes(c.id) ? 'bg-purple-500/20 border-purple-500 text-purple-300' : 'bg-gray-800 border-gray-700 text-gray-500'}`}>
                                                    {c.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                        </div>

                        <div className="grid grid-cols-2 gap-4 mt-6 shrink-0">
                            <button onClick={() => setIsModalOpen(false)} className="p-4 bg-gray-800 text-gray-400 font-black rounded-[20px] uppercase text-[10px] tracking-widest active:scale-95">CANCELAR</button>
                            <button onClick={handleSave} className="p-4 bg-green-600 text-white font-black rounded-[20px] uppercase text-[10px] shadow-lg active:scale-95 transition-transform tracking-widest italic">GUARDAR PROMOCIÓN</button>
                        </div>
                    </div>
                </div>, portal
            )}


            <ConfirmationModal
                isOpen={promoToDelete !== null}
                onClose={() => setPromoToDelete(null)}
                onConfirm={confirmDeletePromotion}
                title="¿ELIMINAR PROMOCIÓN?"
                message="Esta acción no se puede deshacer"
                confirmText="SÍ, ELIMINAR"
            />
        </div>
    );
};

export default PromotionsManager;
