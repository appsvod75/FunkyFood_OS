
import React, { useState, useRef } from 'react';
import { CompanySettings } from '../types';
import { SaveIcon, TrashIcon, InfoIcon, ArrowRightIcon } from './icons';
import toast from 'react-hot-toast';
import { getElSalvadorDateString } from '../utils/dates';
import { QRCodeCanvas } from 'qrcode.react';
import { DownloadIcon, QrCodeIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { api } from '../api';

interface MasterSettingsScreenProps {
    settings: CompanySettings;
    setSettings: React.Dispatch<React.SetStateAction<CompanySettings>>;
    onBack: () => void;
    currentUser?: any;
    branches?: any[];
    onDataCleared?: () => void;
}

const formatPhone = (phone: string | null | undefined) => {
    if (!phone) return '';
    const clean = phone.replace(/\D/g, '');
    if (clean.length === 8) {
        return `${clean.slice(0, 4)}-${clean.slice(4)}`;
    }
    return phone;
};

const MasterSettingsScreen: React.FC<MasterSettingsScreenProps> = ({ settings, setSettings, onBack, currentUser, branches = [], onDataCleared }) => {
    const [formState, setFormState] = useState({
        globalStoreName: settings.name || 'RESTAURANTE',
        globalLogoUrl: settings.logoUrl || '',
        geminiApiKey: '',
        gasWebhookUrl: '',
        enableCommission: settings.enableCommission || false,
        commissionPercentage: settings.commissionPercentage || 5,
        enableServiceCharge: settings.enableServiceCharge || false,
        serviceChargePercentage: settings.serviceChargePercentage || 10
    });
    const [isSaving, setIsSaving] = useState(false);
    const [clearingType, setClearingType] = useState<'SALES' | 'INVENTORY' | 'ALL' | null>(null);
    const [pin, setPin] = useState('');
    const [isPinModalOpen, setIsPinModalOpen] = useState(false);

    // Sales Wizard (targeted deletion by branch, date range, and sessions)
    const [showSalesWizard, setShowSalesWizard] = useState(false);
    const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
    const [selBranchId, setSelBranchId] = useState<number | ''>('');
    const [wizStartDate, setWizStartDate] = useState('');
    const [wizEndDate, setWizEndDate] = useState('');
    const [availableSessions, setAvailableSessions] = useState<any[]>([]);
    const [selectedSessionIds, setSelectedSessionIds] = useState<number[]>([]);
    const [loadingSessions, setLoadingSessions] = useState(false);

    // Initial Load of Global Settings
    React.useEffect(() => {
        // @ts-ignore
        import('../api').then(m => m.api.getSettings()).then(globalSettings => {
            setFormState({
                globalStoreName: globalSettings.global_store_name || settings.name || 'RESTAURANTE OS',
                globalLogoUrl: globalSettings.global_logo_url || settings.logoUrl || '',
                geminiApiKey: globalSettings.gemini_api_key || '',
                gasWebhookUrl: globalSettings.gas_webhook_url || '',
                enableCommission: globalSettings.enable_commission === '1' || globalSettings.enable_commission === true,
                commissionPercentage: parseFloat(globalSettings.commission_percentage || '5'),
                enableServiceCharge: globalSettings.enable_service_charge === '1' || globalSettings.enable_service_charge === true,
                serviceChargePercentage: parseFloat(globalSettings.service_charge_percentage || '10')
            });
        }).catch(err => console.error("Error loading global settings:", err));
    }, [settings.name]);

    // Lógica para el scroll por arrastre (Drag to Scroll)
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
        const walk = (y - startY) * 2; // Sensibilidad del arrastre
        scrollRef.current.scrollTop = scrollTop - walk;
    };

    const handleWheel = (e: React.WheelEvent) => {
        if (!scrollRef.current) return;
        e.preventDefault();
        scrollRef.current.scrollTop += e.deltaY;
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const api = await import('../api').then(m => m.api);

            // Save Global Integrations -> App Config Table
            // @ts-ignore
            await api.updateSettings({
                global_store_name: formState.globalStoreName.toUpperCase(),
                global_logo_url: formState.globalLogoUrl,
                gemini_api_key: formState.geminiApiKey,
                gas_webhook_url: formState.gasWebhookUrl, // Mapping frontend prop to DB key
                enable_commission: formState.enableCommission ? '1' : '0',
                commission_percentage: formState.commissionPercentage.toString(),
                enable_service_charge: formState.enableServiceCharge ? '1' : '0',
                service_charge_percentage: formState.serviceChargePercentage.toString()
            });

            // Update App state via setSettings (which is setCompanySettings in App.tsx)
            setSettings(prev => ({
                ...prev,
                name: formState.globalStoreName.toUpperCase(),
                logoUrl: formState.globalLogoUrl,
                geminiApiKey: formState.geminiApiKey,
                gasWebhookUrl: formState.gasWebhookUrl,
                enableCommission: formState.enableCommission,
                commissionPercentage: formState.commissionPercentage,
                enableServiceCharge: formState.enableServiceCharge,
                serviceChargePercentage: formState.serviceChargePercentage
            }));

            // Allow time for feedback
            setTimeout(() => {
                setIsSaving(false);
                toast.custom(
                    <div className="w-[90%] max-w-sm bg-emerald-950/60 backdrop-blur-xl text-emerald-400 px-6 py-4 rounded-full shadow-[0_0_20px_rgba(52,211,153,0.3)] flex items-center justify-center gap-3 border border-emerald-500/50 text-center pointer-events-none animate-in zoom-in duration-300">
                        <span className="text-xl drop-shadow-[0_0_5px_rgba(52,211,153,0.8)]">✅</span>
                        <span className="font-black tracking-widest uppercase italic text-lg drop-shadow-[0_0_5px_rgba(52,211,153,0.5)]">CONFIGURACIÓN GLOBAL GUARDADA</span>
                    </div>,
                    { duration: 2000, position: 'top-center' }
                );
            }, 600);
        } catch (e) {
            console.error(e);
            setIsSaving(false);
            toast.custom(
                <div className="w-[90%] max-w-sm bg-rose-950/60 backdrop-blur-xl text-rose-400 px-6 py-4 rounded-full shadow-[0_0_20px_rgba(251,113,133,0.3)] flex items-center justify-center gap-3 border border-rose-500/50 text-center pointer-events-none animate-in zoom-in duration-300">
                    <span className="text-xl drop-shadow-[0_0_5px_rgba(251,113,133,0.8)]">❌</span>
                    <span className="font-black tracking-widest uppercase italic text-lg drop-shadow-[0_0_5px_rgba(251,113,133,0.5)]">ERROR AL GUARDAR</span>
                </div>,
                { duration: 3000, position: 'top-center' }
            );
        }
    };
    const downloadQRCode = () => {
        try {
            const canvas = document.getElementById('portal-qr') as HTMLCanvasElement;
            if (!canvas) {
                toast.error("No se encontró el código QR");
                return;
            }

            // Asegurarnos de que el canvas tenga contenido antes de descargar
            const pngUrl = canvas.toDataURL('image/png');
            const downloadLink = document.createElement('a');
            downloadLink.href = pngUrl;
            downloadLink.download = `QR_MENU_${formState.globalStoreName.replace(/\s+/g, '_')}.png`;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);

            toast.success("QR Descargado correctamente");
        } catch (err) {
            console.error("QR Download Error:", err);
            toast.error("Error al descargar: El logo externo no permite descargas (CORS).");
        }
    };

    const handleClearRequest = (type: 'SALES' | 'INVENTORY' | 'ALL') => {
        if (type === 'SALES') {
            setShowSalesWizard(true);
            setWizardStep(1);
            setSelBranchId('');
            setWizStartDate('');
            setWizEndDate('');
            setAvailableSessions([]);
            setSelectedSessionIds([]);
        } else {
            setClearingType(type);
            setIsPinModalOpen(true);
        }
    };

    const loadSessions = async () => {
        if (!selBranchId || !wizStartDate || !wizEndDate) return;
        setLoadingSessions(true);
        try {
            const sessions = await api.getCashSessions(selBranchId as number, wizStartDate, wizEndDate);
            setAvailableSessions(sessions);
            setWizardStep(3);
        } catch (err: any) {
            toast.error(err.message || 'Error al cargar turnos');
        } finally {
            setLoadingSessions(false);
        }
    };

    const toggleSession = (id: number) => {
        setSelectedSessionIds(prev =>
            prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
        );
    };

    const handleProceedToPin = () => {
        if (selectedSessionIds.length === 0) {
            toast.error('Selecciona al menos un turno');
            return;
        }
        setClearingType('SALES');
        setIsPinModalOpen(true);
    };

    const confirmClear = async () => {
        if (!clearingType || !pin || !currentUser) return;

        const loading = toast.loading('Ejecutando limpieza...');
        try {
            const filters = clearingType === 'SALES' && selectedSessionIds.length > 0
                ? { branchId: selBranchId as number, startDate: wizStartDate, endDate: wizEndDate, cashReportIds: selectedSessionIds }
                : undefined;
            await api.clearData(clearingType, pin, currentUser.id, filters);
            toast.success('LIMPIEZA COMPLETADA EXITOSAMENTE', { id: loading });
            setIsPinModalOpen(false);
            setPin('');
            setClearingType(null);
            setShowSalesWizard(false);
            if (onDataCleared) onDataCleared();
        } catch (err: any) {
            console.error(err);
            toast.error(err.message || 'Error en la limpieza', { id: loading });
        }
    };

    const handleBackup = async () => {
        const loading = toast.loading('Generando respaldo de la base de datos...');
        try {
            const blob = await api.backupDatabase();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const dateStr = getElSalvadorDateString();
            a.download = `backup_${dateStr}.sql`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast.success('RESPALDO DESCARGADO EXITOSAMENTE', { id: loading });
        } catch (err: any) {
            toast.error(err.message || 'Error al generar respaldo', { id: loading });
        }
    };

    const portalUrl = `${window.location.origin}/menu`;

    return (
        <div className="h-full flex flex-col max-w-2xl mx-auto p-4 sm:p-6 overflow-hidden animate-in fade-in duration-500">
            {/* Header Unificado de Dos Colores */}
            <div className="flex justify-between items-center gap-4 mb-8 shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="bg-gray-800 p-2.5 rounded-full hover:bg-gray-700 active:scale-90 transition-all shadow-lg border border-gray-700/50">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <h1 className="text-2xl font-black text-white italic uppercase tracking-tighter leading-none">
                        CONFIG. <span className="text-amber-500">MAESTRA</span>
                    </h1>
                </div>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className={`flex items-center gap-2 font-black py-2.5 px-6 rounded-2xl active:scale-95 transition-all text-[10px] uppercase shadow-lg shadow-green-900/20 ${isSaving ? 'bg-gray-700 text-gray-400' : 'bg-green-600 text-white hover:bg-green-500'}`}
                >
                    <SaveIcon className={`w-4 h-4 ${isSaving ? 'animate-spin' : ''}`} />
                    {isSaving ? 'GUARDANDO...' : 'GUARDAR'}
                </button>
            </div>

            {/* Formulario con Drag to Scroll (sin scrollbar) */}
            <div className="flex-1 relative overflow-hidden">
                <div
                    ref={scrollRef}
                    onMouseDown={handleMouseDown}
                    onMouseLeave={handleMouseLeave}
                    onMouseUp={handleMouseUp}
                    onMouseMove={handleMouseMove}
                    onWheel={handleWheel}
                    className={`absolute inset-0 space-y-6 select-none pb-32 ${isDragging ? 'cursor-grabbing' : 'cursor-default'}`}
                    style={{ overflowY: 'hidden' }}
                >
                {/* SECCIÓN: IDENTIDAD GLOBAL */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 px-1">
                        <div className="w-1 h-4 bg-amber-500 rounded-full"></div>
                        <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest italic">Identidad de la Aplicación</h2>
                    </div>

                    <div className="bg-gray-800/40 backdrop-blur-md p-6 rounded-[32px] border border-gray-700/50 shadow-xl space-y-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Nombre Global del Negocio</label>
                            <input
                                type="text"
                                value={formState.globalStoreName}
                                onChange={e => setFormState({ ...formState, globalStoreName: e.target.value })}
                                className="w-full py-4 px-6 bg-gray-900 border-2 border-gray-700 rounded-2xl text-white font-black uppercase outline-none focus:border-amber-500 shadow-inner transition-all"
                                placeholder="EJ: RESTAURANTE OS"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Logo Global URL (Imagen principal)</label>
                            <input
                                type="text"
                                value={formState.globalLogoUrl}
                                onChange={e => setFormState({ ...formState, globalLogoUrl: e.target.value })}
                                className="w-full py-4 px-6 bg-gray-900 border-2 border-gray-700 rounded-2xl text-white font-black outline-none focus:border-amber-500 shadow-inner transition-all"
                                placeholder="https://..."
                            />
                        </div>
                    </div>
                </div>

                {/* SECCIÓN: COBROS Y COMISIONES */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 px-1 text-emerald-400">
                        <div className="w-1 h-4 bg-emerald-500 rounded-full"></div>
                        <h2 className="text-[10px] font-black uppercase tracking-widest italic">Cobros y Comisiones</h2>
                    </div>

                    <div className="bg-gray-800/40 backdrop-blur-md p-6 rounded-[32px] border border-gray-700/50 shadow-xl space-y-6">
                        <div className="flex items-center justify-between gap-4 p-2">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-emerald-400/70 uppercase tracking-widest ml-1 italic leading-none">Comisión por Tarjeta</label>
                                <p className="text-[9px] text-gray-500 ml-1 italic leading-tight">Aplica recargo automático a pagos con tarjeta.</p>
                            </div>
                            <div className="flex items-center gap-4">
                                {formState.enableCommission && (
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={formState.commissionPercentage}
                                            onChange={e => setFormState({ ...formState, commissionPercentage: parseFloat(e.target.value) || 0 })}
                                            onFocus={() => setFormState({ ...formState, commissionPercentage: 0 })}
                                            className="w-16 py-2 px-3 bg-gray-900 border-2 border-emerald-500/30 rounded-xl text-white text-xs font-black outline-none focus:border-emerald-500 transition-all text-center"
                                        />
                                        <span className="absolute -right-2 top-1/2 -translate-y-1/2 text-[10px] font-black text-emerald-500">%</span>
                                    </div>
                                )}
                                <button
                                    onClick={() => setFormState({ ...formState, enableCommission: !formState.enableCommission })}
                                    className={`w-12 h-6 rounded-full transition-all relative ${formState.enableCommission ? 'bg-emerald-600' : 'bg-gray-700'}`}
                                >
                                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${formState.enableCommission ? 'left-7' : 'left-1'}`}></div>
                                </button>
                            </div>
                        </div>

                        <div className="w-full h-px bg-gray-700/30"></div>

                        <div className="flex items-center justify-between gap-4 p-2">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-blue-400/70 uppercase tracking-widest ml-1 italic leading-none">Cargo por Servicio (Propina)</label>
                                <p className="text-[9px] text-gray-500 ml-1 italic leading-tight">Sugiere un porcentaje de propina sobre el subtotal.</p>
                            </div>
                            <div className="flex items-center gap-4">
                                {formState.enableServiceCharge && (
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={formState.serviceChargePercentage}
                                            onChange={e => setFormState({ ...formState, serviceChargePercentage: parseFloat(e.target.value) || 0 })}
                                            onFocus={() => setFormState({ ...formState, serviceChargePercentage: 0 })}
                                            className="w-16 py-2 px-3 bg-gray-900 border-2 border-blue-500/30 rounded-xl text-white text-xs font-black outline-none focus:border-blue-500 transition-all text-center"
                                        />
                                        <span className="absolute -right-2 top-1/2 -translate-y-1/2 text-[10px] font-black text-blue-400">%</span>
                                    </div>
                                )}
                                <button
                                    onClick={() => setFormState({ ...formState, enableServiceCharge: !formState.enableServiceCharge })}
                                    className={`w-12 h-6 rounded-full transition-all relative ${formState.enableServiceCharge ? 'bg-blue-600' : 'bg-gray-700'}`}
                                >
                                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${formState.enableServiceCharge ? 'left-7' : 'left-1'}`}></div>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>


                {/* SECCIÓN: PORTAL DE CLIENTES (QR) */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 px-1 text-amber-500">
                        <QrCodeIcon className="w-4 h-4" />
                        <h2 className="text-[10px] font-black uppercase tracking-widest italic">Menú Digital (Código QR)</h2>
                    </div>

                    <div className="bg-gray-800/40 backdrop-blur-md p-8 rounded-[40px] border border-gray-700/50 shadow-2xl flex flex-col items-center gap-6">
                        <div className="bg-white p-6 rounded-[32px] shadow-2xl shadow-amber-500/10 border-4 border-amber-500/20">
                            <QRCodeCanvas
                                id="portal-qr"
                                value={portalUrl}
                                size={2048} // Ultra-HD 2K resolution for perfect printing
                                style={{ width: 220, height: 220 }} // Display size in UI
                                level="H" // Highest error correction
                                includeMargin={true}
                                imageSettings={formState.globalLogoUrl ? {
                                    src: formState.globalLogoUrl,
                                    x: undefined,
                                    y: undefined,
                                    height: 480, // High-res internal logo rendering
                                    width: 480,
                                    excavate: true,
                                    crossOrigin: 'anonymous'
                                } : undefined}
                            />
                        </div>

                        <div className="text-center space-y-2">
                            <p className="text-white font-black text-xs uppercase italic tracking-widest">Tu Portal está en vivo</p>
                            <p className="text-gray-500 text-[10px] font-bold break-all opacity-50 px-4">{portalUrl}</p>
                        </div>

                        <button
                            onClick={downloadQRCode}
                            className="flex items-center gap-3 bg-amber-500 hover:bg-amber-400 text-black font-black py-4 px-8 rounded-2xl transition-all active:scale-95 shadow-xl shadow-amber-900/20 text-[10px] uppercase tracking-widest italic"
                        >
                            <DownloadIcon className="w-5 h-5" />
                            Descargar QR para imprimir
                        </button>
                        <p className="text-[9px] text-gray-600 font-bold uppercase italic text-center leading-tight">
                            Este código dirigirá a tus clientes directamente<br />a ver tus productos con fotos y descripciones.
                        </p>
                    </div>
                </div>

                {/* SECCIÓN: INTEGRACIONES */}
                <div className="space-y-4 pb-12">
                    <div className="flex items-center gap-2 px-1 text-purple-400">
                        <div className="w-1 h-4 bg-purple-500 rounded-full"></div>
                        <h2 className="text-[10px] font-black uppercase tracking-widest italic">Inteligencia Artificial & Webhooks</h2>
                    </div>

                    <div className="bg-gray-800/40 backdrop-blur-md p-6 rounded-[32px] border border-gray-700/50 shadow-xl space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-purple-400/70 uppercase tracking-widest ml-1 italic">Gemini Flash API Key</label>
                            <input
                                type="password"
                                value={formState.geminiApiKey}
                                onChange={e => setFormState({ ...formState, geminiApiKey: e.target.value })}
                                className="w-full py-4 px-6 bg-gray-900 border-2 border-gray-700 rounded-2xl text-white font-mono text-xs outline-none focus:border-purple-500 shadow-inner transition-all"
                                placeholder="TU_API_KEY_AQUI..."
                            />
                            <p className="text-[9px] text-gray-500 ml-1 italic leading-relaxed">Necesario para el procesamiento inteligente de pedidos por voz y texto.</p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-blue-400/70 uppercase tracking-widest ml-1 italic">Webhook Global de Respaldo</label>
                            <input
                                type="text"
                                value={formState.gasWebhookUrl || ''}
                                onChange={e => setFormState({ ...formState, gasWebhookUrl: e.target.value })}
                                className="w-full py-4 px-6 bg-gray-900 border-2 border-gray-700 rounded-2xl text-white font-mono text-[10px] outline-none focus:border-blue-500 shadow-inner transition-all"
                                placeholder="https://script.google.com/macros/..."
                            />
                            <p className="text-[9px] text-gray-500 ml-1 italic leading-relaxed">Este webhook se usará globalmente si una sucursal no tiene uno configurado particularmente.</p>
                        </div>
                    </div>
                </div>

                {/* SECCIÓN: MANTENIMIENTO (LIMPIEZA) */}
                <div className="space-y-4 pb-20">
                    <div className="flex items-center gap-2 px-1 text-red-500">
                        <TrashIcon className="w-4 h-4" />
                        <h2 className="text-[10px] font-black uppercase tracking-widest italic">Mantenimiento de Base de Datos</h2>
                    </div>

                    <div className="bg-gray-800/40 backdrop-blur-md p-6 rounded-[32px] border border-red-500/20 shadow-xl space-y-6">
                        <div className="flex gap-4 p-4 bg-red-500/10 rounded-2xl border border-red-500/20 items-start">
                            <InfoIcon className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                            <p className="text-[9px] text-red-300 font-bold uppercase leading-relaxed tracking-wide">
                                Acciones destructivas. Estos procesos borrarán datos operativos de forma irreversible. Se recomienda precaución.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                            {/* SALES WIZARD */}
                            {showSalesWizard ? (
                                <div className="w-full p-4 bg-orange-600/10 border border-orange-500/30 text-orange-500 rounded-2xl space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className="font-black text-[11px] uppercase italic tracking-tighter">Limpiar Ventas Selectivo</span>
                                        <button
                                            onClick={() => setShowSalesWizard(false)}
                                            className="text-[9px] font-black text-gray-500 hover:text-white uppercase tracking-widest transition-colors"
                                        >
                                            CANCELAR
                                        </button>
                                    </div>

                                    {/* Step indicators */}
                                    <div className="flex gap-1">
                                        {[1, 2, 3].map(step => (
                                            <div key={step} className={`flex-1 h-1 rounded-full ${wizardStep >= step ? 'bg-orange-500' : 'bg-gray-700'}`} />
                                        ))}
                                    </div>

                                    {/* Step 1: Branch */}
                                    {wizardStep === 1 && (
                                        <div className="space-y-3">
                                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">
                                                Paso 1: Selecciona Sucursal
                                            </label>
                                            <select
                                                value={selBranchId}
                                                onChange={e => setSelBranchId(e.target.value ? Number(e.target.value) : '')}
                                                className="w-full py-3 px-4 bg-gray-900 border-2 border-gray-700 rounded-xl text-white text-xs font-black outline-none focus:border-orange-500 transition-all"
                                            >
                                                <option value="">-- SELECCIONA --</option>
                                                {branches.map(b => (
                                                    <option key={b.id} value={b.id}>{b.name}</option>
                                                ))}
                                            </select>
                                            <button
                                                onClick={() => setWizardStep(2)}
                                                disabled={!selBranchId}
                                                className="w-full py-3 bg-orange-600 text-white rounded-xl font-black text-[10px] uppercase italic tracking-widest hover:bg-orange-500 transition-all disabled:opacity-30"
                                            >
                                                SIGUIENTE
                                            </button>
                                        </div>
                                    )}

                                    {/* Step 2: Date range */}
                                    {wizardStep === 2 && (
                                        <div className="space-y-3">
                                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">
                                                Paso 2: Rango de Fechas
                                            </label>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="space-y-1">
                                                    <span className="text-[8px] text-gray-500 font-bold uppercase tracking-widest ml-1">Desde</span>
                                                    <input
                                                        type="date"
                                                        value={wizStartDate}
                                                        onChange={e => setWizStartDate(e.target.value)}
                                                        className="w-full py-3 px-3 bg-gray-900 border-2 border-gray-700 rounded-xl text-white text-xs font-black outline-none focus:border-orange-500 transition-all"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <span className="text-[8px] text-gray-500 font-bold uppercase tracking-widest ml-1">Hasta</span>
                                                    <input
                                                        type="date"
                                                        value={wizEndDate}
                                                        onChange={e => setWizEndDate(e.target.value)}
                                                        className="w-full py-3 px-3 bg-gray-900 border-2 border-gray-700 rounded-xl text-white text-xs font-black outline-none focus:border-orange-500 transition-all"
                                                    />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <button
                                                    onClick={() => setWizardStep(1)}
                                                    className="py-3 bg-gray-800 text-gray-400 rounded-xl font-black text-[10px] uppercase italic tracking-widest hover:bg-gray-700 transition-all"
                                                >
                                                    ATRÁS
                                                </button>
                                                <button
                                                    onClick={loadSessions}
                                                    disabled={!wizStartDate || !wizEndDate || loadingSessions}
                                                    className="py-3 bg-orange-600 text-white rounded-xl font-black text-[10px] uppercase italic tracking-widest hover:bg-orange-500 transition-all disabled:opacity-30"
                                                >
                                                    {loadingSessions ? 'CARGANDO...' : 'BUSCAR TURNOS'}
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Step 3: Session selection */}
                                    {wizardStep === 3 && (
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                                                    Paso 3: Selecciona Turno(s)
                                                </label>
                                                <span className="text-[9px] font-black text-gray-500">
                                                    {availableSessions.length} encontrado(s)
                                                </span>
                                            </div>

                                            {availableSessions.length === 0 ? (
                                                <p className="text-[10px] text-gray-500 italic text-center py-4">
                                                    No hay turnos en este rango de fechas
                                                </p>
                                            ) : (
                                                <div className="max-h-48 overflow-y-auto space-y-2">
                                                    {availableSessions.map(session => {
                                                        const isSelected = selectedSessionIds.includes(session.id);
                                                        const openTime = session.opening_timestamp
                                                            ? new Date(session.opening_timestamp).toLocaleString('es-MX', { hour: '2-digit', minute: '2-digit' })
                                                            : '--:--';
                                                        const closeTime = session.closing_timestamp
                                                            ? new Date(session.closing_timestamp).toLocaleString('es-MX', { hour: '2-digit', minute: '2-digit' })
                                                            : 'ABIERTO';
                                                        return (
                                                            <button
                                                                key={session.id}
                                                                onClick={() => toggleSession(session.id)}
                                                                className={`w-full p-3 rounded-xl border-2 text-left flex items-center gap-3 transition-all ${isSelected
                                                                        ? 'bg-orange-600/20 border-orange-500 text-orange-400'
                                                                        : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500'
                                                                    }`}
                                                            >
                                                                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-orange-500 border-orange-500' : 'border-gray-600'}`}>
                                                                    {isSelected && <span className="text-black text-[10px] font-black">✓</span>}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <span className="block text-[10px] font-black uppercase tracking-tight">
                                                                        {session.date} {openTime} - {closeTime}
                                                                    </span>
                                                                    <span className="block text-[8px] opacity-60 font-bold uppercase tracking-widest">
                                                                        {session.total_orders || 0} órdenes | ${Number(session.total_sales || 0).toFixed(2)}
                                                                    </span>
                                                                </div>
                                                                <span className={`text-[8px] font-black uppercase ${session.status === 'OPEN' ? 'text-emerald-500' : 'text-gray-600'}`}>
                                                                    {session.status === 'OPEN' ? 'ACTIVO' : 'CERRADO'}
                                                                </span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}

                                            <div className="grid grid-cols-2 gap-2">
                                                <button
                                                    onClick={() => setWizardStep(2)}
                                                    className="py-3 bg-gray-800 text-gray-400 rounded-xl font-black text-[10px] uppercase italic tracking-widest hover:bg-gray-700 transition-all"
                                                >
                                                    ATRÁS
                                                </button>
                                                <button
                                                    onClick={handleProceedToPin}
                                                    disabled={selectedSessionIds.length === 0}
                                                    className="py-3 bg-red-600 text-white rounded-xl font-black text-[10px] uppercase italic tracking-widest hover:bg-red-500 transition-all disabled:opacity-30"
                                                >
                                                    BORRAR ({selectedSessionIds.length})
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <button
                                    onClick={() => handleClearRequest('SALES')}
                                    className="w-full p-4 bg-orange-600/10 border border-orange-500/30 text-orange-500 rounded-2xl flex justify-between items-center group hover:bg-orange-600 hover:text-white transition-all active:scale-[0.98]"
                                >
                                    <div className="text-left">
                                        <span className="block font-black text-[11px] uppercase italic tracking-tighter">Wizard Limpiado Ventas (3 Pasos)</span>
                                        <span className="block text-[8px] opacity-60 font-bold uppercase tracking-widest">Selecciona sucursal, fecha y turnos a borrar</span>
                                    </div>
                                    <ArrowRightIcon className="w-5 h-5 opacity-40 group-hover:opacity-100 transition-opacity" />
                                </button>
                            )}

                            {/* STOCK */}
                            <button
                                onClick={() => handleClearRequest('INVENTORY')}
                                className="w-full p-4 bg-cyan-600/10 border border-cyan-500/30 text-cyan-500 rounded-2xl flex justify-between items-center group hover:bg-cyan-600 hover:text-white transition-all active:scale-[0.98]"
                            >
                                <div className="text-left">
                                    <span className="block font-black text-[11px] uppercase italic tracking-tighter">Reiniciar Inventario</span>
                                    <span className="block text-[8px] opacity-60 font-bold uppercase tracking-widest">Borra historial de movimientos y stock</span>
                                </div>
                                <ArrowRightIcon className="w-5 h-5 opacity-40 group-hover:opacity-100 transition-opacity" />
                            </button>

                            {/* FULL RESET */}
                            <button
                                onClick={() => handleClearRequest('ALL')}
                                className="w-full p-5 bg-red-600/10 border-2 border-red-600/40 text-red-500 rounded-3xl flex justify-between items-center group hover:bg-red-600 hover:text-white transition-all active:scale-[0.98] mt-2 shadow-lg shadow-red-950/10"
                            >
                                <div className="text-left">
                                    <span className="block font-black text-[13px] uppercase italic tracking-tighter text-red-600 group-hover:text-white">Reset Total de Operación</span>
                                    <span className="block text-[8px] opacity-60 font-bold uppercase tracking-widest">Deja la app vacía (Mantiene Catálogos)</span>
                                </div>
                                <TrashIcon className="w-6 h-6 opacity-40 group-hover:opacity-100 transition-opacity" />
                            </button>
                        </div>

                        {/* BACKUP */}
                        <div className="pt-2">
                            <button
                                onClick={handleBackup}
                                className="w-full p-4 bg-emerald-600/10 border border-emerald-500/30 text-emerald-500 rounded-2xl flex justify-between items-center group hover:bg-emerald-600 hover:text-white transition-all active:scale-[0.98]"
                            >
                                <div className="text-left">
                                    <span className="block font-black text-[11px] uppercase italic tracking-tighter">Respaldo de Base de Datos</span>
                                    <span className="block text-[8px] opacity-60 font-bold uppercase tracking-widest">Descarga un archivo .sql con toda la información</span>
                                </div>
                                <svg className="w-5 h-5 opacity-40 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            </div>

            {/* PIN VERIFICATION MODAL */}
            {isPinModalOpen && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center z-[110] p-4">
                    <div className="bg-gray-950 border border-red-500/30 rounded-[40px] p-8 w-full max-w-sm shadow-2xl animate-in zoom-in duration-300 space-y-6">
                        <div className="text-center space-y-2">
                            <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter">Verificación</h2>
                            <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest animate-pulse">
                                {clearingType === 'SALES' && showSalesWizard
                                    ? `BORRARÁS ${selectedSessionIds.length} TURNO(S) - ${availableSessions.filter(s => selectedSessionIds.includes(s.id)).reduce((sum, s) => sum + (s.total_orders || 0), 0)} ÓRDENES`
                                    : clearingType === 'SALES' ? 'ESTÁS POR BORRAR TODAS LAS VENTAS' :
                                        clearingType === 'INVENTORY' ? 'BORRARÁS TODO EL HISTORIAL DE STOCK' :
                                            'RESET TOTAL: BORRARÁS TODA LA OPERACIÓN'}
                            </p>
                            {clearingType === 'SALES' && showSalesWizard && (
                                <p className="text-[8px] text-gray-500 font-bold uppercase tracking-widest">
                                    {branches.find(b => b.id === selBranchId)?.name || ''} | {wizStartDate} a {wizEndDate}
                                </p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Ingresa PIN de SuperAdmin</label>
                            <input
                                type="password"
                                maxLength={6}
                                value={pin}
                                onChange={e => setPin(e.target.value)}
                                className="w-full py-6 bg-gray-900 border-2 border-gray-800 rounded-3xl text-white text-center text-4xl font-black tracking-[0.3em] outline-none focus:border-red-500 transition-all"
                                placeholder="••••••"
                                autoFocus
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => { setIsPinModalOpen(false); setPin(''); }}
                                className="py-4 bg-gray-800 text-gray-400 rounded-2xl font-black text-[10px] uppercase italic tracking-widest hover:bg-gray-700 transition-all"
                            >
                                CANCELAR
                            </button>
                            <button
                                onClick={confirmClear}
                                disabled={pin.length < 4}
                                className="py-4 bg-red-600 text-white rounded-2xl font-black text-[10px] uppercase italic tracking-widest hover:bg-red-500 transition-all active:scale-95 disabled:opacity-30"
                            >
                                CONFIRMAR
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MasterSettingsScreen;
