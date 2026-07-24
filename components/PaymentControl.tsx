
import React, { useState, useEffect } from 'react';
import { CompanySettings } from '../types';
import { api } from '../api';
import toast from 'react-hot-toast';
import { CheckCircleIcon, XCircleIcon, SaveIcon, CalendarIcon } from './icons';
import { useDragScroll } from '../hooks/useDragScroll';
import { getLastDueDate, getNextDueDate, getDaysOverdue } from '../lib/utils';

interface PaymentControlProps {
    settings: CompanySettings;
    setSettings: React.Dispatch<React.SetStateAction<CompanySettings>>;
    onBack: () => void;
}

const PaymentControl: React.FC<PaymentControlProps> = ({ settings, setSettings, onBack }) => {
    const [paymentDay, setPaymentDay] = useState(settings.paymentDueDate || '');
    const [graceDays, setGraceDays] = useState(String(settings.paymentGraceDays ?? 3));
    const [isPending, setIsPending] = useState(settings.paymentPending || false);
    const [isSaving, setIsSaving] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [loadedValues, setLoadedValues] = useState({ day: settings.paymentDueDate || '', grace: String(settings.paymentGraceDays ?? 3), pending: settings.paymentPending || false });
    const dragScroll = useDragScroll();

    const hasChanges = paymentDay !== loadedValues.day || graceDays !== loadedValues.grace || isPending !== loadedValues.pending;

    useEffect(() => {
        api.getSettings().then(globalSettings => {
            const day = globalSettings.payment_due_date || settings.paymentDueDate || '';
            const pending = globalSettings.payment_pending === '1';
            const grace = String(parseInt(globalSettings.payment_grace_days) ?? settings.paymentGraceDays ?? 3);
            setPaymentDay(day);
            setGraceDays(grace);
            setIsPending(pending);
            setLoadedValues({ day, grace, pending });
            setInitialLoading(false);
        }).catch(err => {
            console.error("Error loading payment settings:", err);
            setInitialLoading(false);
        });
    }, []);

    const nextDueDate = paymentDay ? getNextDueDate(paymentDay) : null;
    const overdueDays = paymentDay ? getDaysOverdue(paymentDay) : 0;
    const isOverdue = paymentDay && isPending && overdueDays > 0;

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await api.updateSettings({
                payment_due_date: paymentDay,
                payment_pending: isPending ? '1' : '0',
                payment_grace_days: String(parseInt(graceDays) || 0)
            });
            setSettings(prev => ({
                ...prev,
                paymentDueDate: paymentDay,
                paymentPending: isPending,
                paymentGraceDays: parseInt(graceDays) || 0
            }));
            setLoadedValues({ day: paymentDay, grace: graceDays, pending: isPending });
            toast.custom(
                <div className="w-[90%] max-w-sm bg-emerald-950 text-emerald-400 px-6 py-4 rounded-full shadow-[0_0_20px_rgba(52,211,153,0.3)] flex items-center justify-center gap-3 border border-emerald-500/50 text-center pointer-events-none">
                    <span className="font-black tracking-widest uppercase italic text-lg">CONFIGURACIÓN DE PAGO GUARDADA</span>
                </div>,
                { duration: 2000, position: 'top-center' }
            );
        } catch (e) {
            console.error(e);
            toast.error('ERROR AL GUARDAR CONFIGURACIÓN DE PAGO');
        } finally {
            setIsSaving(false);
        }
    };

    if (initialLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col max-w-2xl mx-auto p-4 sm:p-6 overflow-hidden animate-in fade-in duration-500">
            <div className="flex justify-between items-center gap-4 mb-8 shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="bg-gray-800 p-2.5 rounded-full hover:bg-gray-700 active:scale-90 transition-all shadow-lg border border-gray-700/50">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <h1 className="text-2xl font-black text-white italic uppercase tracking-tighter leading-none">
                        CONTROL <span className="text-amber-500">DE PAGO</span>
                    </h1>
                </div>
                <button
                    onClick={handleSave}
                    disabled={isSaving || !hasChanges}
                    className={`flex items-center gap-2 font-black py-2.5 px-6 rounded-2xl active:scale-95 transition-all text-[10px] uppercase shadow-lg ${isSaving || !hasChanges ? 'bg-gray-700 text-gray-400' : 'bg-amber-600 text-white hover:bg-amber-500 shadow-amber-900/20'}`}
                >
                    <SaveIcon className={`w-4 h-4 ${isSaving ? 'animate-spin' : ''}`} />
                    {isSaving ? 'GUARDANDO...' : 'GUARDAR'}
                </button>
            </div>

            <div
                ref={dragScroll.ref}
                onMouseDown={dragScroll.onMouseDown}
                onMouseMove={dragScroll.onMouseMove}
                onMouseUp={dragScroll.onMouseUp}
                onMouseLeave={dragScroll.onMouseLeave}
                onTouchStart={dragScroll.onTouchStart}
                onTouchMove={dragScroll.onTouchMove}
                onTouchEnd={dragScroll.onTouchEnd}
                className={`flex-1 overflow-y-auto scrollbar-hide space-y-6 pb-32 select-none ${dragScroll.isDragging ? 'cursor-grabbing' : 'cursor-default'}`}
            >
                {/* ESTADO ACTUAL */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 px-1">
                        <div className="w-1 h-4 bg-amber-500 rounded-full"></div>
                        <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest italic">Estado de Pago</h2>
                    </div>

                    <div className="bg-gray-800 p-6 rounded-[32px] border border-gray-700/50 shadow-xl space-y-6">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Estado Actual</span>
                            <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl font-black text-xs uppercase tracking-widest ${isPending ? 'bg-red-950 border border-red-500/30 text-red-400' : 'bg-emerald-950 border border-emerald-500/30 text-emerald-400'}`}>
                                {isPending ? (
                                    <><XCircleIcon className="w-4 h-4" /> PENDIENTE</>
                                ) : (
                                    <><CheckCircleIcon className="w-4 h-4" /> PAGADA</>
                                )}
                            </div>
                        </div>

                        {nextDueDate && (
                            <p className="text-[10px] text-gray-500 font-bold">
                                Próximo vencimiento: <span className="text-white">{nextDueDate}</span>
                            </p>
                        )}

                        {isPending && isOverdue && (
                            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl">
                                <p className="text-red-400 font-black text-xs uppercase tracking-wider">
                                    ⚠️ {overdueDays} DÍA{overdueDays !== 1 ? 'S' : ''} DE MORA
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* CONFIGURACIÓN */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 px-1">
                        <CalendarIcon className="w-4 h-4 text-amber-500" />
                        <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest italic">Configuración</h2>
                    </div>

                    <div className="bg-gray-800 p-6 rounded-[32px] border border-gray-700/50 shadow-xl space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Día de Pago (1-31)</label>
                            <input
                                type="number"
                                min={1}
                                max={31}
                                value={paymentDay}
                                onChange={e => { const v = e.target.value; if (v === '' || (parseInt(v) >= 1 && parseInt(v) <= 31)) setPaymentDay(v); }}
                                className="w-full py-4 px-6 bg-gray-900 border-2 border-gray-700 rounded-2xl text-white font-black uppercase outline-none focus:border-amber-500 shadow-inner transition-all"
                                placeholder="EJ: 1"
                            />
                            <p className="text-[9px] text-gray-500 ml-1 italic">
                                El sistema calcula automáticamente la próxima fecha de pago cada mes.
                                {nextDueDate && <span className="text-amber-400"> Próximo vencimiento calculado: <strong>{nextDueDate}</strong></span>}
                            </p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Días de Gracia</label>
                            <input
                                type="number"
                                min={0}
                                value={graceDays}
                                onChange={e => { const v = e.target.value; if (v === '' || (!isNaN(parseInt(v)) && parseInt(v) >= 0)) setGraceDays(v); }}
                                className="w-full py-4 px-6 bg-gray-900 border-2 border-gray-700 rounded-2xl text-white font-black uppercase outline-none focus:border-amber-500 shadow-inner transition-all"
                                placeholder="EJ: 3"
                            />
                            <p className="text-[9px] text-gray-500 ml-1 italic">
                                Días después del vencimiento antes de bloquear la creación de órdenes. Actual: {graceDays} día{parseInt(graceDays) !== 1 ? 's' : ''} — bloqueo al día {parseInt(graceDays) + 1} de mora.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Estado de Pago</label>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setIsPending(true)}
                                    className={`flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 border-2 ${isPending ? 'bg-red-600 text-white border-red-500 shadow-lg' : 'bg-gray-900 text-gray-500 border-gray-700 hover:border-red-500/50'}`}
                                >
                                    <XCircleIcon className="w-5 h-5 mx-auto mb-1" />
                                    PENDIENTE
                                </button>
                                <button
                                    onClick={() => setIsPending(false)}
                                    className={`flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 border-2 ${!isPending ? 'bg-emerald-600 text-white border-emerald-500 shadow-lg' : 'bg-gray-900 text-gray-500 border-gray-700 hover:border-emerald-500/50'}`}
                                >
                                    <CheckCircleIcon className="w-5 h-5 mx-auto mb-1" />
                                    PAGADA
                                </button>
                            </div>
                            <p className="text-[9px] text-gray-500 ml-1 italic">
                                {isPending
                                    ? 'SI = Pendiente: Se mostrarán banners y se bloqueará creación de órdenes si la fecha ya venció.'
                                    : 'NO = Pagada: No se muestra ningún banner ni bloqueo, incluso si la fecha ya pasó.'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* INFO PANEL */}
                <div className="bg-gray-800/40 p-6 rounded-[32px] border border-gray-700/50 shadow-xl">
                    <div className="flex gap-4 p-4 bg-amber-500/10 rounded-2xl border border-amber-500/20 items-start">
                        <svg className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                            <p className="text-[10px] text-amber-300 font-black uppercase tracking-wider">
                                ¿Cómo funciona?
                            </p>
                            <ul className="text-[9px] text-amber-300/70 font-bold mt-2 space-y-1 leading-relaxed">
                                <li>• Seteás el <span className="text-white">día del mes</span> en que vence el pago (ej: 1 = cada 1ro).</li>
                                <li>• 5 días antes de la próxima fecha, el sistema cambia automáticamente a <span className="text-red-400">PENDIENTE</span>.</li>
                                <li>• Al día siguiente del vencimiento (si está PENDIENTE), aparece un banner en la vista de pedidos.</li>
                                <li>• Tenés <span className="text-amber-400">{graceDays} día{parseInt(graceDays) !== 1 ? 's' : ''} de gracia</span> antes de bloquear la creación de órdenes.</li>
                                <li>• Al día {parseInt(graceDays) + 1} de mora, se desactiva el botón de crear nuevas órdenes.</li>
                                <li>• Si cambias a <span className="text-emerald-400">PAGADA</span>, todo vuelve a la normalidad.</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PaymentControl;
