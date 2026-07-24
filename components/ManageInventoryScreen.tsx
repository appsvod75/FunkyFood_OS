
import React, { useState, useEffect, useRef } from 'react';
import { api, socket } from '../api';
import { InventoryItem, InventoryTransaction, TransactionType, Branch, Product } from '../types';
import { ViewHeader, AdminModal } from './AdminShared';
import { PlusIcon, RefreshIcon, SearchIcon, ClockIcon, CheckCircleIcon, ExclamationIcon, CashRegisterIcon, ProductIcon } from './icons';
import NotificationToast from './NotificationToast';
import KardexModal from './KardexModal';

interface ManageInventoryScreenProps {
    onBack: () => void;
    branches: Branch[];
    currentBranchId: number | null;
    currentUser: any; // Using any for now to avoid User type import issues if not already imported
}

const StatHeaderCard = ({ icon, label, value, sub, color }: { icon: React.ReactNode, label: string, value: string, sub: string, color?: string }) => (
    <div className="bg-gray-800 p-4 rounded-[24px] border border-white/5 shadow-2xl group hover:border-amber-500/40 transition-all flex-1 min-w-[160px] relative overflow-hidden select-none">
        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-amber-500/10 to-transparent rounded-full -mr-12 -mt-12 group-hover:bg-amber-500/20 transition-all"></div>
        <div className="flex items-center gap-2 text-gray-400 mb-2 relative z-10">
            <div className={`p-1.5 rounded-lg border border-white/5 ${color ? 'bg-amber-500/10' : 'bg-white/5'}`}>
                {icon}
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest opacity-60">{label}</span>
        </div>
        <div className={`text-2xl font-black ${color || 'text-white'} italic tracking-tighter mb-1 relative z-10 truncate drop-shadow-lg`}>{value}</div>
        <div className="text-[8px] font-bold text-gray-400 uppercase tracking-widest italic opacity-40 relative z-10">{sub}</div>
    </div>
);

const ManageInventoryScreen: React.FC<ManageInventoryScreenProps> = (props) => {
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
    const [kardex, setKardex] = useState<InventoryTransaction[]>([]);
    const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
    const [isKardexModalOpen, setIsKardexModalOpen] = useState(false);
    const [isERPModalOpen, setIsERPModalOpen] = useState(false);
    const [toast, setToast] = useState<{ message: string | null; title?: string; type: 'success' | 'error' | 'info' }>({ message: null, type: 'info' });

    const groupedInventory = React.useMemo(() => {
        const map = new Map<number, InventoryItem & { branchStocks: { branchId: number, branchName: string, quantity: number, averageCost: number }[] }>();
        inventory.forEach(item => {
            if (!map.has(item.productId)) {
                map.set(item.productId, { ...item, quantity: 0, branchStocks: [] });
            }
            const prod = map.get(item.productId)!;
            prod.quantity += Number(item.quantity || 0);
            
            // Si el producto no ha tenido movimientos, branchId vendrá null desde el backend
            if (item.branchId) {
                prod.branchStocks.push({
                    branchId: item.branchId,
                    branchName: item.branchName || `SEDE #${item.branchId}`,
                    quantity: Number(item.quantity || 0),
                    averageCost: Number(item.averageCost || 0)
                });
            }
        });
        return Array.from(map.values());
    }, [inventory]);

    // Stats calculation
    const totalItems = groupedInventory.length;
    const totalStock = inventory.reduce((acc, item) => acc + Number(item.quantity || 0), 0);
    const lowStockCount = groupedInventory.filter(item => Number(item.quantity || 0) <= Number(item.minStock || 0)).length;
    const totalValue = inventory.reduce((acc, item) => acc + (Number(item.quantity || 0) * Number(item.averageCost || 0)), 0);

    const [adjustForm, setAdjustForm] = useState({
        type: TransactionType.Purchase,
        quantity: 0,
        reason: '',
        unitCost: 0,
        relatedBranchId: undefined as number | undefined
    });

    const [selectedDetailId, setSelectedDetailId] = useState<number | null>(null);

    const scrollRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startY, setStartY] = useState(0);
    const [scrollTop, setScrollTop] = useState(0);

    const fetchInventory = async () => {
        setIsLoading(true);
        try {
            const data = await api.getInventory();
            if (Array.isArray(data)) {
                setInventory(data);
            } else {
                console.error("Inventory error:", data);
                setInventory([]);
                setToast({ message: data?.error || 'Error cargando inventario', type: 'error' });
            }
        } catch (e: any) {
            console.error(e);
            setToast({ message: 'Error cargando inventario', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const fetchKardex = async (productId: number) => {
        try {
            const data = await api.getInventoryKardex(productId, props.currentBranchId || undefined);
            setKardex(data);
            setIsKardexModalOpen(true);
        } catch (e: any) {
            console.error(e);
            setToast({ message: 'Error cargando historial', type: 'error' });
        }
    };

    useEffect(() => {
        fetchInventory();

        // Real-time listeners
        socket.on('catalog_updated', fetchInventory);
        socket.on('order_updated', fetchInventory);

        return () => {
            socket.off('catalog_updated', fetchInventory);
            socket.off('order_updated', fetchInventory);
        };
    }, []);

    const handleAdjust = async () => {
        // Validation: Prevent self-transfer
        if (adjustForm.type === TransactionType.TransferOut && adjustForm.relatedBranchId === (selectedItem?.branchId || props.currentBranchId)) {
            setToast({ message: 'No puedes realizar traslados a la misma sede de origen.', type: 'error' });
            return;
        }


        if (!selectedItem || adjustForm.quantity <= 0) return;

        try {
            await api.adjustInventory({
                productId: selectedItem.productId,
                branchId: props.currentBranchId || 1,
                type: adjustForm.type,
                quantity: adjustForm.quantity,
                reason: adjustForm.reason || (adjustForm.type === TransactionType.Purchase ? 'Compra de productos' : 'Ajuste manual'),
                unitCost: adjustForm.unitCost,
                relatedBranchId: adjustForm.relatedBranchId
            });
            setToast({ message: 'Inventario actualizado correctamente', type: 'success' });
            setIsAdjustModalOpen(false);
            setAdjustForm({ type: TransactionType.Purchase, quantity: 0, reason: '', unitCost: 0, relatedBranchId: undefined });
            fetchInventory();
        } catch (e: any) {
            console.error(e);
            setToast({ message: 'Error al actualizar inventario', type: 'error' });
        }
    };

    const [erpLines, setErpLines] = useState<{ id: string, productId?: number, productName?: string, quantity: number, unitCost: number, totalStr?: string }[]>([]);
    const [erpType, setErpType] = useState<TransactionType>(TransactionType.Purchase);
    const [erpBranchFrom, setErpBranchFrom] = useState<number | null>(props.currentBranchId);
    const [erpBranchTo, setErpBranchTo] = useState<number | null>(null);
    const [erpTercero, setErpTercero] = useState('');
    const [erpRefFactura, setErpRefFactura] = useState('');
    const [erpReason, setErpReason] = useState('');
    const [erpSearchQuery, setErpSearchQuery] = useState('');
    const [activeLineId, setActiveLineId] = useState<string | null>(null);

    const filteredInventory = groupedInventory.filter(item =>
        (item.productName || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const selectedDetailItem = groupedInventory.find(i => i.productId === selectedDetailId);

    // Search in all inventory items (server already filters by track_stock)
    const erpSearchResults = groupedInventory.filter(item =>
        (item.productName || '').toLowerCase().includes(erpSearchQuery.toLowerCase())
    );

    const addERPLine = () => {
        setErpLines([...erpLines, { id: Math.random().toString(36).substring(7), quantity: 0, unitCost: 0 }]);
    };

    const removeERPLine = (id: string) => {
        if (erpLines.length <= 1) return; // Keep at least one line
        setErpLines(erpLines.filter(l => l.id !== id));
    };

    const selectProductForLine = (productId: number, productName: string, avgCost: number) => {
        if (!activeLineId) return;
        setErpLines(erpLines.map(l => l.id === activeLineId ? { ...l, productId, productName, unitCost: avgCost } : l));
        setActiveLineId(null);
        setErpSearchQuery('');
    };

    const handleLineKeyDown = (e: React.KeyboardEvent, lineId: string, isLastInput: boolean) => {
        if (e.key === 'Enter' && isLastInput) {
            e.preventDefault();
            addERPLine();
        }
    };

    const processERPTransaction = async () => {
        const validLines = erpLines.filter(l => l.productId && l.quantity > 0);
        if (validLines.length === 0) return setToast({ message: 'No hay líneas válidas para procesar', type: 'error' });
        if (erpType === TransactionType.TransferOut && !erpBranchTo) return setToast({ message: 'Seleccione una sede destino', type: 'error' });

        setIsLoading(true);
        try {
            for (const line of validLines) {
                // Registrar movimiento con toda la metadata concatenada en reason para no romper el esquema actual si no se desea migrar
                const enrichedReason = `[${erpTercero || 'S/P'}] [REF: ${erpRefFactura || 'S/R'}] ${erpReason || 'S/O'}`.toUpperCase();

                // Registrar movimiento en sede origen
                await api.adjustInventory({
                    productId: line.productId!,
                    branchId: erpBranchFrom || props.currentBranchId || 1,
                    type: erpType,
                    quantity: line.quantity,
                    reason: enrichedReason,
                    unitCost: line.unitCost,
                    relatedBranchId: erpBranchTo || undefined,
                    userId: props.currentUser?.id
                });

                // Si es traslado, registrar entrada en sede destino
                if (erpType === TransactionType.TransferOut && erpBranchTo) {
                    await api.adjustInventory({
                        productId: line.productId!,
                        branchId: erpBranchTo,
                        type: TransactionType.TransferIn,
                        quantity: line.quantity,
                        reason: `RECIBIDO DE SEDE #${erpBranchFrom || props.currentBranchId || 1} | ${enrichedReason}`,
                        unitCost: line.unitCost,
                        relatedBranchId: erpBranchFrom || props.currentBranchId || 1,
                        userId: props.currentUser?.id
                    });
                }
            }
            setToast({ message: 'Movimiento procesado con éxito', type: 'success' });
            setIsERPModalOpen(false);
            setErpLines([]);
            setErpTercero('');
            setErpRefFactura('');
            setErpReason('');
            fetchInventory();
        } catch (e: any) {
            console.error(e);
            setToast({ message: 'Error procesando movimiento', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const onMouseDown = (e: React.MouseEvent) => {
        if (!scrollRef.current) return;
        setIsDragging(true);
        setStartY(e.pageY - scrollRef.current.offsetTop);
        setScrollTop(scrollRef.current.scrollTop);
    };
    const onMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !scrollRef.current) return;
        e.preventDefault();
        const y = e.pageY - scrollRef.current.offsetTop;
        const walk = (y - startY) * 2;
        scrollRef.current.scrollTop = scrollTop - walk;
    };

    // Horizontal Drag for Stats
    const statsScrollRef = useRef<HTMLDivElement>(null);
    const [isStatsDragging, setIsStatsDragging] = useState(false);
    const [statsStartX, setStatsStartX] = useState(0);
    const [statsScrollLeft, setStatsScrollLeft] = useState(0);

    const onStatsMouseDown = (e: React.MouseEvent) => {
        if (!statsScrollRef.current) return;
        setIsStatsDragging(true);
        setStatsStartX(e.pageX - statsScrollRef.current.offsetLeft);
        setStatsScrollLeft(statsScrollRef.current.scrollLeft);
    };

    const onStatsMouseMove = (e: React.MouseEvent) => {
        if (!isStatsDragging || !statsScrollRef.current) return;
        e.preventDefault();
        const x = e.pageX - statsScrollRef.current.offsetLeft;
        const walk = (x - statsStartX) * 2; // Scroll speed
        statsScrollRef.current.scrollLeft = statsScrollLeft - walk;
    };

    return (
        <div className="flex flex-col h-full overflow-hidden transition-all duration-300">
            <ViewHeader title="CONTROL DE <span class='text-amber-500'>INVENTARIO</span>" onBack={props.onBack} />

            {/* Stats Header */}
            {/* Stats Header */}
            <div
                ref={statsScrollRef}
                onMouseDown={onStatsMouseDown}
                onMouseLeave={() => setIsStatsDragging(false)}
                onMouseUp={() => setIsStatsDragging(false)}
                onMouseMove={onStatsMouseMove}
                className={`flex gap-4 mb-6 overflow-x-auto pb-2 scrollbar-hide shrink-0 px-1 cursor-grab ${isStatsDragging ? 'cursor-grabbing' : ''}`}
            >
                <StatHeaderCard
                    icon={<CashRegisterIcon className="w-4 h-4" />}
                    label="Items Totales"
                    value={totalItems.toString()}
                    sub="Bebidas en catálogo"
                />
                <StatHeaderCard
                    icon={<RefreshIcon className="w-4 h-4" />}
                    label="Stock Global"
                    value={Number(totalStock).toFixed(0)}
                    sub="Unidades físicas"
                    color="text-amber-500"
                />
                <StatHeaderCard
                    icon={<ExclamationIcon className="w-4 h-4 text-red-500" />}
                    label="Stock Bajo"
                    value={lowStockCount.toString()}
                    sub="Requiere atención"
                    color="text-red-500"
                />
                <StatHeaderCard
                    icon={<CheckCircleIcon className="w-4 h-4 text-green-500" />}
                    label="Valorización"
                    value={`$${Number(totalValue).toFixed(2)}`}
                    sub="Inversión estimada"
                    color="text-green-500"
                />
            </div>

            <div className="mb-6 flex items-center gap-3 px-1 shrink-0 relative z-[20]">
                <div className="relative flex-1 group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-amber-500/20 to-transparent rounded-[24px] opacity-0 group-focus-within:opacity-100 transition-duration-500"></div>
                    <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-amber-500 transition-colors z-30" />
                    <input
                        type="text"
                        placeholder="BUSCAR PRODUCTO..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full h-12 py-2 pl-12 pr-4 bg-gray-800 border border-gray-700 rounded-[20px] text-white font-black uppercase outline-none focus:border-amber-500/40 placeholder:text-gray-500 text-[10px] shadow-lg transition-all relative z-20"
                    />
                </div>
                <div className="flex gap-2 relative z-20">
                    <button
                        onClick={() => { setErpLines([{ id: '1', quantity: 1, unitCost: 0 }]); setIsERPModalOpen(true); }}
                        className="h-12 px-6 bg-gradient-to-b from-amber-400 to-amber-600 text-black font-black text-[12px] uppercase tracking-widest rounded-[20px] hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2 shadow-[0_4px_20px_-5px_rgba(245,158,11,0.4)] border-t border-white/20 italic"
                    >
                        <PlusIcon className="w-4 h-4" /> <span className="hidden sm:inline">MOVIMIENTO</span>
                    </button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden relative">
                <div
                    ref={scrollRef}
                    onMouseDown={onMouseDown}
                    onMouseLeave={() => setIsDragging(false)}
                    onMouseUp={() => setIsDragging(false)}
                    onMouseMove={onMouseMove}
                    className={`flex-1 relative overflow-y-auto scrollbar-hide select-none transition-all ${isDragging ? 'cursor-grabbing scale-[0.995]' : 'cursor-default'}`}
                >
                    <div className="flex flex-col gap-2 p-1 pb-32">
                        {/* Header Table (Labels) */}
                        <div className="hidden sm:grid grid-cols-[1fr,100px,100px,100px,100px] gap-4 px-8 py-4 bg-gray-900 sticky top-0 z-20 shadow-lg border-b border-white/5">
                            <span className="text-[10px] font-black uppercase italic tracking-widest opacity-40">PRODUCTO / CATEGORÍA</span>
                            <span className="text-[10px] font-black uppercase italic tracking-widest text-right opacity-40">PRECIO VENTA</span>
                            <span className="text-[10px] font-black uppercase italic tracking-widest text-right opacity-40">COSTO PROM.</span>
                            <span className="text-[10px] font-black uppercase italic tracking-widest text-right opacity-40">VALOR TOTAL</span>
                            <span className="text-[10px] font-black uppercase italic tracking-widest text-right opacity-40">STOCK GLOBAL</span>
                        </div>

                        {filteredInventory.map(item => (
                            <div
                                key={item.productId}
                                onClick={() => setSelectedDetailId(item.productId)}
                                className={`group relative flex flex-col sm:grid sm:grid-cols-[1fr,100px,100px,100px,100px] items-start sm:items-center gap-3 sm:gap-4 bg-gray-800 rounded-[16px] px-4 py-2 sm:h-12 border border-gray-700 transition-all hover:bg-gray-700 cursor-pointer ${selectedDetailId === item.productId ? 'ring-2 ring-amber-500/50 bg-gray-700' : ''}`}
                            >
                                <div className="flex items-center gap-3 w-full mb-1 sm:mb-0 h-full">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all shrink-0 ${selectedDetailId === item.productId ? 'bg-amber-500 text-black shadow-[0_0_20px_rgba(245,158,11,0.3)]' : 'bg-gray-800 text-gray-400 group-hover:text-white'}`}>
                                        <CashRegisterIcon className="w-4 h-4" />
                                    </div>
                                    <div className="flex flex-col truncate justify-center">
                                        <h4 className="text-xs font-black text-white italic uppercase tracking-tighter truncate leading-none mb-0.5">{item.productName}</h4>
                                        <span className="text-[8px] font-bold text-gray-500 uppercase tracking-widest italic leading-none">{item.categoryName}</span>
                                    </div>
                                </div>

                                {/* Mobile Horizontal Layout for Metrics */}
                                <div className="flex w-full sm:contents justify-between items-center pl-[44px] sm:pl-0 h-full">
                                    <div className="flex flex-col sm:items-end justify-center">
                                        <span className="sm:hidden text-[8px] font-black text-gray-600 uppercase italic mb-0.5">P. VENTA</span>
                                        <span className="text-xs font-black text-blue-400 italic">${Number(item.sellingPrice || 0).toFixed(2)}</span>
                                    </div>

                                    <div className="flex flex-col sm:items-end justify-center">
                                        <span className="sm:hidden text-[8px] font-black text-gray-600 uppercase italic mb-0.5">COSTO P.</span>
                                        <span className="text-xs font-bold text-gray-400 font-mono italic opacity-60">${Number(item.averageCost || 0).toFixed(2)}</span>
                                    </div>

                                    <div className="flex flex-col sm:items-end justify-center">
                                        <span className="sm:hidden text-[8px] font-black text-emerald-600 uppercase italic mb-0.5">TOTAL</span>
                                        <span className="text-xs font-black text-emerald-500 font-mono italic opacity-90">
                                            ${(Number(item.quantity || 0) * Number(item.averageCost || 0)).toFixed(2)}
                                        </span>
                                    </div>

                                    <div className="flex flex-col sm:items-end justify-center">
                                        <span className="sm:hidden text-[8px] font-black text-gray-600 uppercase italic mb-0.5">STOCK</span>
                                        <div className={`px-2 py-0.5 rounded-md font-black text-[9px] italic flex items-center gap-1 ${item.quantity <= item.minStock ? 'bg-red-500/20 text-red-500 border border-red-500/30' : 'bg-gray-800 text-gray-300'}`}>
                                            {Number(item.quantity).toFixed(0)} <span className="opacity-40">UN</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {filteredInventory.length === 0 && !isLoading && (
                            <div className="col-span-full py-40 text-center opacity-30 select-none">
                                <CashRegisterIcon className="w-16 h-16 mx-auto mb-4 text-gray-500" />
                                <p className="font-black uppercase italic text-xs tracking-[0.3em]">NO SE ENCONTRARON PRODUCTOS</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Detail Panel / Master-Detail Soul */}
                <div className={`fixed inset-0 sm:static sm:w-[380px] z-[200] flex items-end sm:items-stretch transition-all duration-500 ${selectedDetailItem ? 'bg-black/80 sm:bg-transparent pointer-events-auto' : 'hidden sm:flex sm:bg-transparent pointer-events-none sm:pointer-events-auto'}`}>
                    <div className={`absolute inset-0 sm:hidden bg-black/60 transition-opacity duration-300 ${!selectedDetailItem ? 'opacity-0' : 'opacity-100'}`} onClick={() => setSelectedDetailId(null)}></div>
                    <div className={`bg-gray-900 w-full h-[85vh] sm:h-auto rounded-t-[30px] sm:rounded-l-[35px] border-t sm:border-t-0 sm:border-l border-white/5 flex flex-col p-5 sm:p-6 relative overflow-hidden shadow-2xl transition-transform duration-500 z-10 ${!selectedDetailItem ? 'translate-y-full sm:translate-y-0' : 'translate-y-0'}`}>
                        {/* Detail Header */}
                        <div className="flex justify-between items-start mb-4 shrink-0">
                            <div className="flex flex-col gap-1">
                                <span className="text-[9px] font-black text-gray-500 uppercase tracking-[0.3em] italic leading-none">DETALLE MAESTRO</span>
                                <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter leading-tight drop-shadow-xl truncate">{selectedDetailItem?.productName || 'SELECCIONA ITEM'}</h2>
                            </div>
                            <button onClick={() => setSelectedDetailId(null)} className="p-2 bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-500 rounded-xl border border-white/5 transition-all sm:hidden">
                                <PlusIcon className="w-5 h-5 rotate-45" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto scrollbar-hide flex flex-col gap-4">
                            {selectedDetailItem ? (
                                <>
                                    {/* Valorización Box (Compact) */}
                                    <div className="bg-emerald-500/10 rounded-[20px] p-4 border border-emerald-500/20 relative overflow-hidden group shadow-lg shadow-emerald-500/5">
                                        <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/20 rounded-full -mr-10 -mt-10 group-hover:scale-150 transition-transform duration-700"></div>
                                        <div className="relative z-10 flex flex-col">
                                            <span className="text-[9px] font-black text-emerald-500/70 uppercase tracking-[0.2em] italic mb-1">VALORIZACIÓN STOCK</span>
                                            <div className="text-3xl font-black text-emerald-400 italic tracking-tighter leading-none mb-1 drop-shadow-[0_0_10px_rgba(52,211,153,0.3)]">
                                                ${Number((selectedDetailItem.quantity || 0) * (selectedDetailItem.averageCost || 0)).toFixed(2)}
                                            </div>
                                            <span className="text-[9px] font-bold text-emerald-500/50 uppercase italic tracking-widest">CAPITAL GLOBAL</span>
                                        </div>
                                    </div>

                                    {/* Cost / Price / Margin Matrix (Compact) */}
                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="bg-gray-800/40 rounded-[20px] p-3 border border-white/5 flex flex-col justify-center">
                                            <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1 block italic opacity-60">COSTO</span>
                                            <span className="text-[14px] sm:text-base font-black text-amber-500 italic drop-shadow-md">${Number(selectedDetailItem.averageCost || 0).toFixed(2)}</span>
                                        </div>
                                        <div className="bg-gray-800/40 rounded-[20px] p-3 border border-white/5 flex flex-col justify-center">
                                            <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1 block italic opacity-60">P. VENTA</span>
                                            <span className="text-[14px] sm:text-base font-black text-white italic drop-shadow-md">${Number(selectedDetailItem.sellingPrice || 0).toFixed(2)}</span>
                                        </div>
                                        <div className="bg-gray-800/40 rounded-[20px] p-3 border border-white/5 flex flex-col justify-center">
                                            <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1 block italic opacity-60">MARGEN</span>
                                            <span className="text-[14px] sm:text-base font-black text-emerald-500 italic drop-shadow-md">
                                                ${Number((selectedDetailItem.sellingPrice || 0) - (selectedDetailItem.averageCost || 0)).toFixed(2)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Action Button: Kardex (Compact) */}
                                    <button
                                        onClick={() => setIsKardexModalOpen(true)}
                                        className="w-full py-4 bg-gray-800/80 hover:bg-indigo-600 text-gray-400 hover:text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-[20px] border border-white/5 transition-all active:scale-95 shadow-lg flex items-center justify-center gap-3 italic group/btn"
                                    >
                                        <ClockIcon className="w-4 h-4 group-hover/btn:rotate-12 transition-transform" /> VER KARDEX
                                    </button>

                                    {/* Stock by branch breakdown (Compact) */}
                                    <div className="flex flex-col gap-3 mt-2">
                                        <div className="flex items-center gap-2 opacity-30 px-1">
                                            <ExclamationIcon className="w-3 h-3" />
                                            <span className="text-[9px] font-black uppercase tracking-[0.2em] italic">STOCK POR SEDE</span>
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            {selectedDetailItem.branchStocks.map(s => (
                                                <div key={s.branchId} className="bg-black/40 rounded-[20px] p-3 px-4 border border-white/5 flex items-center justify-between group/branch transition-all hover:bg-black/60 hover:border-white/10 cursor-pointer" onClick={() => {
                                                    setSelectedItem({ ...selectedDetailItem, branchId: s.branchId, quantity: s.quantity });
                                                    setAdjustForm({ ...adjustForm, type: TransactionType.AdjustmentAdd, unitCost: s.averageCost, relatedBranchId: s.branchId });
                                                    setIsAdjustModalOpen(true);
                                                }}>
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-black text-white uppercase italic tracking-tighter mb-0.5">{s.branchName}</span>
                                                        <div className="flex gap-3">
                                                            <span className="text-[8px] font-bold text-blue-400 opacity-60 uppercase italic">PV: ${Number(selectedDetailItem.sellingPrice || 0).toFixed(2)}</span>
                                                            <span className="text-[8px] font-bold text-amber-400 opacity-40 uppercase italic">CP: ${Number(s.averageCost || 0).toFixed(2)}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <span className={`text-lg font-black italic ${Number(s.quantity || 0) <= (Number(selectedDetailItem.minStock) / (selectedDetailItem.branchStocks.length || 1)) ? 'text-red-500' : 'text-emerald-400'}`}>
                                                            {Number(s.quantity || 0).toFixed(0)} <span className="text-[9px] opacity-30">UN</span>
                                                        </span>
                                                        <div className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center group-hover/branch:bg-amber-500 group-hover/branch:text-black transition-all">
                                                            <PlusIcon className="w-3 h-3" />
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                            {selectedDetailItem.branchStocks.length === 0 && (
                                                <div className="py-6 text-center opacity-20 border-2 border-dashed border-gray-800 rounded-[20px]">
                                                    <span className="text-[9px] font-black uppercase tracking-widest italic">SIN SEDES</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center opacity-30 select-none">
                                    <ProductIcon className="w-16 h-16 mb-4 text-white/20" />
                                    <p className="text-[10px] font-black uppercase tracking-[0.3em] italic mb-1">SELECCIONA UN ITEM</p>
                                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">PARA VER DETALLES</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Adjustment Modal */}
            {isAdjustModalOpen && selectedItem && (
                <AdminModal
                    title="AJUSTAR <span class='text-amber-500'>STOCK</span>"
                    onClose={() => setIsAdjustModalOpen(false)}
                    onSave={handleAdjust}
                    saveLabel="GUARDAR AJUSTE"
                >
                    <div className="space-y-6">
                        <div className="bg-gray-950/50 p-4 rounded-2xl border border-gray-800">
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1 italic">PRODUCTO SELECCIONADO</p>
                            <p className="text-lg font-black text-white uppercase italic">{selectedItem.productName}</p>
                            <div className="flex items-center gap-2 mt-2">
                                <span className="text-xs text-gray-400 font-bold">STOCK ACTUAL:</span>
                                <span className="text-xl font-black text-amber-500 italic">{selectedItem.quantity}</span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">TIPO DE AJUSTE</label>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => setAdjustForm({ ...adjustForm, type: TransactionType.Purchase })}
                                    className={`py-3 rounded-xl font-black text-[9px] uppercase tracking-tighter italic border-2 transition-all ${adjustForm.type === TransactionType.Purchase ? 'bg-green-600 border-green-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-500'}`}
                                >
                                    COMPRA (+)
                                </button>
                                <button
                                    onClick={() => setAdjustForm({ ...adjustForm, type: TransactionType.AdjustmentAdd })}
                                    className={`py-3 rounded-xl font-black text-[9px] uppercase tracking-tighter italic border-2 transition-all ${adjustForm.type === TransactionType.AdjustmentAdd ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-500'}`}
                                >
                                    AJUSTE (+)
                                </button>
                                <button
                                    onClick={() => setAdjustForm({ ...adjustForm, type: TransactionType.AdjustmentSub })}
                                    className={`py-3 rounded-xl font-black text-[9px] uppercase tracking-tighter italic border-2 transition-all ${adjustForm.type === TransactionType.AdjustmentSub ? 'bg-red-600 border-red-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-500'}`}
                                >
                                    AJUSTE (-)
                                </button>
                                <button
                                    onClick={() => setAdjustForm({ ...adjustForm, type: TransactionType.TransferOut })}
                                    className={`py-3 rounded-xl font-black text-[9px] uppercase tracking-tighter italic border-2 transition-all ${adjustForm.type === TransactionType.TransferOut ? 'bg-amber-600 border-amber-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-500'}`}
                                >
                                    TRASLADO (-)
                                </button>
                            </div>
                        </div>

                        {adjustForm.type === TransactionType.TransferOut && (
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">SEDE DESTINO</label>
                                <select
                                    value={adjustForm.relatedBranchId || ''}
                                    onChange={(e) => setAdjustForm({ ...adjustForm, relatedBranchId: parseInt(e.target.value) || undefined })}
                                    className="w-full py-4 px-6 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white font-black uppercase text-xs italic outline-none focus:border-amber-500"
                                >
                                    <option value="">SELECCIONAR SEDE...</option>
                                    {props.branches.filter(b => b.id !== props.currentBranchId).map(b => (
                                        <option key={b.id} value={b.id}>{b.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">CANTIDAD</label>
                                <input
                                    type="number"
                                    value={adjustForm.quantity || ''}
                                    onChange={(e) => setAdjustForm({ ...adjustForm, quantity: parseFloat(e.target.value) || 0 })}
                                    className="w-full py-4 px-6 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white font-black text-xl italic outline-none focus:border-amber-500"
                                    placeholder="0.00"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">COSTO UNIT.</label>
                                <input
                                    type="number"
                                    value={adjustForm.unitCost || ''}
                                    onChange={(e) => setAdjustForm({ ...adjustForm, unitCost: parseFloat(e.target.value) || 0 })}
                                    className="w-full py-4 px-6 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white font-black text-xl italic outline-none focus:border-amber-500 font-mono"
                                    placeholder="0.00"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">MOTIVO (OPCIONAL)</label>
                            <input
                                type="text"
                                value={erpReason}
                                onChange={(e) => setErpReason(e.target.value.toUpperCase())}
                                className="w-full py-4 px-6 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white font-black uppercase text-xs italic outline-none focus:border-amber-500"
                                placeholder="EJ: RECIBIDO DE PROVEEDOR..."
                            />
                        </div>
                    </div>
                </AdminModal>
            )}

            {/* ERP Multi-line Movement Modal / The BarberOS Soul Edition */}
            {isERPModalOpen && (
                <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[500] p-4 sm:p-8 overflow-hidden">
                    <div className="bg-[#0a0a0c] w-full max-w-7xl h-full sm:h-[90vh] rounded-[48px] border border-white/5 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in duration-500 relative">
                        {/* Purple Glow Effect */}
                        <div className="absolute top-0 left-1/4 w-1/2 h-1 bg-gradient-to-r from-transparent via-purple-500/50 to-transparent"></div>

                        {/* Header Section */}
                        <div className="p-5 sm:p-6 flex justify-between items-start shrink-0 relative z-10">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20 shadow-[0_0_30px_rgba(168,85,247,0.15)]">
                                    <CashRegisterIcon className="w-6 h-6 text-purple-500" />
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter leading-tight">NUEVO MOVIMIENTO <span className="text-purple-500">ERP</span></h3>
                                    <p className="text-[9px] text-gray-500 font-black uppercase tracking-[0.4em] italic opacity-60">GESTIÓN CENTRALIZADA DE STOCK</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsERPModalOpen(false)}
                                className="bg-white/5 p-3 rounded-2xl hover:bg-red-500/20 hover:text-red-500 transition-all border border-white/5 active:scale-90 group"
                            >
                                <PlusIcon className="w-5 h-5 rotate-45 group-hover:rotate-[135deg] transition-transform duration-500" />
                            </button>
                        </div>

                        {/* Metadata Controls */}
                        <div className="px-5 sm:px-6 pb-2 shrink-0 relative z-10 overflow-y-auto max-h-[40vh] sm:max-h-none scrollbar-hide">
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 sm:gap-3">
                                <div className="flex flex-col gap-1 col-span-2 sm:col-span-1">
                                    <label className="text-[8px] sm:text-[9px] font-black text-gray-500 uppercase tracking-widest italic ml-1">OPERACION</label>
                                    <div className="relative group">
                                        <select
                                            value={erpType}
                                            onChange={(e) => setErpType(e.target.value as TransactionType)}
                                            className="w-full h-10 sm:h-11 bg-gray-900/60 border border-white/5 rounded-xl px-3 sm:px-4 text-[9px] sm:text-[10px] font-black uppercase italic text-white outline-none focus:border-purple-500 transition-all appearance-none"
                                        >
                                            <option value={TransactionType.Purchase}>COMPRA (ENTRADA)</option>
                                            <option value={TransactionType.AdjustmentAdd}>AJUSTE (+)</option>
                                            <option value={TransactionType.AdjustmentSub}>AJUSTE (-)</option>
                                            <option value={TransactionType.TransferOut}>TRASLADO (SALIDA)</option>
                                        </select>
                                        <div className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-30">
                                            <PlusIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5 rotate-90" />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-1 col-span-2 md:col-span-1">
                                    <label className="text-[8px] sm:text-[9px] font-black text-gray-500 uppercase tracking-widest italic ml-1">SEDE ORIGEN</label>
                                    <select
                                        value={erpBranchFrom || ''}
                                        onChange={(e) => setErpBranchFrom(parseInt(e.target.value) || null)}
                                        className="w-full h-10 sm:h-11 bg-gray-900/60 border border-white/5 rounded-xl px-3 sm:px-4 text-[9px] sm:text-[10px] font-black uppercase italic text-white outline-none focus:border-purple-500"
                                    >
                                        {props.branches.map(b => (
                                            <option key={b.id} value={b.id}>{b.name.toUpperCase()}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex flex-col gap-1 col-span-1">
                                    <label className="text-[8px] sm:text-[9px] font-black text-gray-500 uppercase tracking-widest italic ml-1 truncate">TERCERO</label>
                                    <input
                                        type="text"
                                        placeholder="NOMBRE..."
                                        value={erpTercero}
                                        onChange={(e) => setErpTercero(e.target.value.toUpperCase())}
                                        className="w-full h-10 sm:h-11 bg-gray-900/60 border border-white/5 rounded-xl px-3 sm:px-4 text-[9px] sm:text-[10px] font-black uppercase italic text-white outline-none focus:border-purple-500 placeholder:text-gray-700"
                                    />
                                </div>

                                <div className="flex flex-col gap-1 col-span-1">
                                    <label className="text-[8px] sm:text-[9px] font-black text-gray-500 uppercase tracking-widest italic ml-1 truncate">FACTURA</label>
                                    <input
                                        type="text"
                                        placeholder="DOC-000..."
                                        value={erpRefFactura}
                                        onChange={(e) => setErpRefFactura(e.target.value.toUpperCase())}
                                        className="w-full h-10 sm:h-11 bg-gray-900/60 border border-white/5 rounded-xl px-3 sm:px-4 text-[9px] sm:text-[10px] font-black uppercase italic text-white outline-none focus:border-purple-500 placeholder:text-gray-700 font-mono"
                                    />
                                </div>

                                <div className="flex flex-col gap-1 col-span-2 md:col-span-1">
                                    <label className="text-[8px] sm:text-[9px] font-black text-gray-500 uppercase tracking-widest italic ml-1">MOTIVO / OBS.</label>
                                    <input
                                        type="text"
                                        placeholder="DETALLE OP..."
                                        value={erpReason}
                                        onChange={(e) => setErpReason(e.target.value.toUpperCase())}
                                        className="w-full h-10 sm:h-11 bg-gray-900/60 border border-white/5 rounded-xl px-3 sm:px-4 text-[9px] sm:text-[10px] font-black uppercase italic text-white outline-none focus:border-purple-500 placeholder:text-gray-700"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Scrolling Container for Table */}
                        <div className="flex-1 overflow-auto flex flex-col relative z-10 border-t border-white/5 bg-black/20">
                            <div className="min-w-[650px] w-full flex flex-col h-full">
                                {/* Column Header */}
                                <div className="px-4 py-2 bg-white/[0.02] border-b border-white/5 grid grid-cols-[30px,1fr,90px,110px,110px] gap-3 shrink-0">
                                    <span className="text-[9px] font-black text-gray-600 uppercase italic">#</span>
                                    <span className="text-[9px] font-black text-gray-600 uppercase italic">BÚSQUEDA DE ARTÍCULO</span>
                                    <span className="text-[9px] font-black text-gray-600 uppercase italic text-center">CANTIDAD</span>
                                    <span className="text-[9px] font-black text-gray-600 uppercase italic text-right">COSTO UNT.</span>
                                    <span className="text-[9px] font-black text-gray-600 uppercase italic text-right">TOTAL</span>
                                </div>

                                {/* Lines Section */}
                                <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-hide pb-20">
                                    {erpLines.map((line, idx) => (
                                        <div key={line.id} className="grid grid-cols-[30px,1fr,90px,110px,110px] gap-3 items-center animate-in slide-in-from-left duration-300">
                                            <span className="text-[10px] font-black text-gray-700 italic pl-1">{idx + 1}</span>

                                            <div className="relative group/search">
                                                <button
                                                    onClick={() => { setActiveLineId(line.id); setErpSearchQuery(''); }}
                                                    className={`w-full h-10 sm:h-12 px-4 sm:px-6 rounded-full text-left border transition-all flex items-center justify-between ${activeLineId === line.id ? 'border-purple-500 bg-purple-500/5' : 'border-white/5 bg-gray-950/40 hover:border-white/10'}`}
                                                >
                                                    <div className="flex items-center gap-2 sm:gap-3 overflow-hidden">
                                                        <SearchIcon className={`shrink-0 w-3 h-3 sm:w-4 sm:h-4 ${activeLineId === line.id ? 'text-purple-500' : 'text-gray-600'}`} />
                                                        <span className={`text-[9px] sm:text-[10px] font-black uppercase italic tracking-widest truncate ${line.productName ? 'text-white' : 'text-gray-600'}`}>
                                                            {line.productName || 'BUSCAR...'}
                                                        </span>
                                                    </div>
                                                    {line.productId && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); removeERPLine(line.id); }}
                                                            className="p-1 sm:p-1.5 hover:text-red-500 transition-colors opacity-100 sm:opacity-0 group-hover/search:opacity-100 shrink-0"
                                                        >
                                                            <PlusIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5 rotate-45" />
                                                        </button>
                                                    )}
                                                </button>

                                                {activeLineId === line.id && (
                                                    <div className="absolute top-full left-0 w-[280px] sm:w-full bg-[#121214] border border-purple-500 rounded-[20px] mt-2 shadow-2xl z-[600] overflow-hidden animate-in slide-in-from-top-2 duration-300">
                                                        <div className="p-2 sm:p-3 border-b border-white/5">
                                                            <input
                                                                autoFocus
                                                                type="text"
                                                                placeholder="FILTRAR..."
                                                                value={erpSearchQuery}
                                                                onChange={(e) => setErpSearchQuery(e.target.value)}
                                                                className="w-full h-9 sm:h-10 bg-black/40 border border-white/5 rounded-xl px-3 sm:px-4 text-[9px] sm:text-[10px] font-black uppercase italic text-white outline-none focus:border-purple-500"
                                                            />
                                                        </div>
                                                        <div className="max-h-60 overflow-y-auto scrollbar-hide py-2">
                                                            {erpSearchResults.map(p => (
                                                                <button
                                                                    key={p.productId}
                                                                    onClick={() => selectProductForLine(p.productId, p.productName, p.averageCost || 0)}
                                                                    className="w-full text-left px-4 sm:px-6 py-2 sm:py-3 hover:bg-purple-500 hover:text-white transition-all flex justify-between items-center group/item"
                                                                >
                                                                    <div className="flex flex-col overflow-hidden">
                                                                        <span className="text-[9px] sm:text-[10px] font-black uppercase italic tracking-tighter truncate">{p.productName}</span>
                                                                        <span className="text-[7px] sm:text-[8px] font-black opacity-40 uppercase tracking-widest truncate">{p.categoryName}</span>
                                                                    </div>
                                                                    <div className="text-right shrink-0 ml-2">
                                                                        <span className="text-[8px] sm:text-[9px] font-mono font-black italic opacity-60">STOCK: {Number(p.quantity).toFixed(0)}</span>
                                                                    </div>
                                                                </button>
                                                            ))}
                                                            {erpSearchResults.length === 0 && (
                                                                <div className="py-6 text-center opacity-20">
                                                                    <span className="text-[9px] font-black uppercase italic">SIN RESULTADOS</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="relative group">
                                                <input
                                                    type="number"
                                                    value={line.quantity || ''}
                                                    onFocus={() => setErpLines(erpLines.map(l => l.id === line.id ? { ...l, quantity: 0, totalStr: undefined } : l))}
                                                    onChange={(e) => setErpLines(erpLines.map(l => l.id === line.id ? { ...l, quantity: parseFloat(e.target.value) || 0, totalStr: undefined } : l))}
                                                    onKeyDown={(e) => handleLineKeyDown(e, line.id, true)}
                                                    className="w-full h-10 sm:h-12 bg-gray-950/40 border border-white/5 rounded-[12px] sm:rounded-[18px] text-white font-black text-center text-[10px] sm:text-xs outline-none focus:border-purple-500/50 transition-all font-mono"
                                                    placeholder="0"
                                                />
                                            </div>

                                            <div className="relative group">
                                                <div className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 text-gray-700 text-[9px] sm:text-[10px] font-black italic">$</div>
                                                <input
                                                    type="number"
                                                    value={line.unitCost || ''}
                                                    onFocus={() => setErpLines(erpLines.map(l => l.id === line.id ? { ...l, unitCost: 0, totalStr: undefined } : l))}
                                                    onChange={(e) => setErpLines(erpLines.map(l => l.id === line.id ? { ...l, unitCost: parseFloat(e.target.value) || 0, totalStr: undefined } : l))}
                                                    onKeyDown={(e) => handleLineKeyDown(e, line.id, true)}
                                                    className="w-full h-10 sm:h-12 bg-gray-950/40 border border-white/5 rounded-[12px] sm:rounded-[18px] text-white font-black text-right pr-3 sm:pr-6 text-[10px] sm:text-xs outline-none focus:border-purple-500/50 transition-all font-mono"
                                                    placeholder="0.00"
                                                    step="0.01"
                                                />
                                            </div>

                                            <div className="relative group">
                                                <div className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 text-gray-700 text-[9px] sm:text-[10px] font-black italic">$</div>
                                                <input
                                                    type="number"
                                                    value={line.totalStr !== undefined ? line.totalStr : ((line.quantity && line.unitCost) ? Number(parseFloat((line.quantity * line.unitCost).toFixed(4))) : '')}
                                                    onFocus={() => setErpLines(erpLines.map(l => l.id === line.id ? { ...l, unitCost: 0, totalStr: '' } : l))}
                                                    onChange={(e) => {
                                                        const valStr = e.target.value;
                                                        const valNum = parseFloat(valStr) || 0;
                                                        const safeQty = line.quantity || 1;
                                                        setErpLines(erpLines.map(l => l.id === line.id ? { ...l, totalStr: valStr, unitCost: valNum / safeQty } : l));
                                                    }}
                                                    onKeyDown={(e) => handleLineKeyDown(e, line.id, true)}
                                                    className="w-full h-10 sm:h-12 bg-purple-900/20 border border-purple-500/30 rounded-[12px] sm:rounded-[18px] text-amber-500 font-black text-right pr-3 sm:pr-6 text-[10px] sm:text-xs outline-none focus:border-amber-500/50 transition-all font-mono placeholder:text-gray-700"
                                                    placeholder="0.00"
                                                    step="0.01"
                                                />
                                            </div>
                                        </div>
                                    ))}

                                    {/* Empty space to signal you can add more lines */}
                                    <div className="py-4 opacity-5 flex justify-center italic">
                                        <span className="text-[8px] sm:text-[10px] font-black tracking-[0.3em] sm:tracking-[0.5em] uppercase text-center">PULSA ENTER PARA NUEVA LÍNEA</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer Section */}
                        <div className="p-4 sm:p-6 bg-white/[0.01] border-t border-white/5 shrink-0 flex flex-col sm:flex-row items-center justify-between z-10 gap-4 overflow-x-auto">
                            <div className="flex items-center gap-4 sm:gap-8 w-full sm:w-auto overflow-x-auto scrollbar-hide shrink-0 pb-1 sm:pb-0">
                                <div className="flex flex-col shrink-0">
                                    <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest italic leading-none mb-1">LÍNEAS</span>
                                    <span className="text-xl font-black text-white italic leading-none">{erpLines.filter(l => l.productId).length}</span>
                                </div>
                                <div className="flex flex-col shrink-0">
                                    <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest italic leading-none mb-1">TOTAL DOC.</span>
                                    <span className="text-2xl font-black text-amber-500 italic drop-shadow-md">
                                        ${Number(erpLines.reduce((acc, l) => acc + (Number(l.quantity || 0) * Number(l.unitCost || 0)), 0)).toFixed(2)}
                                    </span>
                                </div>
                                <div className="h-8 w-px bg-white/5 shrink-0"></div>
                                <div className="flex flex-col shrink-0">
                                    <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest italic leading-none mb-1">RESPONSABLE</span>
                                    <span className="text-xs font-black text-gray-300 uppercase italic leading-none truncate max-w-[80px] sm:max-w-none">SUPER ADMIN</span>
                                </div>
                            </div>

                            <div className="flex gap-2 sm:gap-3 w-full sm:w-auto shrink-0 justify-end">
                                <button
                                    onClick={() => setIsERPModalOpen(false)}
                                    className="flex-1 sm:flex-none px-4 sm:px-8 h-12 sm:h-16 bg-white/5 hover:bg-gray-800 text-gray-500 font-black rounded-2xl sm:rounded-3xl uppercase text-[9px] sm:text-[10px] tracking-wider sm:tracking-[0.2em] transition-all italic border border-white/5 active:scale-95 whitespace-nowrap"
                                >
                                    DESCARTAR
                                </button>
                                <button
                                    onClick={processERPTransaction}
                                    disabled={isLoading || erpLines.filter(l => l.productId).length === 0}
                                    className="flex-1 sm:flex-none px-4 sm:px-12 h-12 sm:h-16 bg-purple-600 hover:bg-purple-500 text-white font-black rounded-2xl sm:rounded-3xl uppercase text-[9px] sm:text-[10px] tracking-wider sm:tracking-[0.2em] transition-all italic shadow-[0_10px_40px_-5px_rgba(147,51,234,0.4)] flex items-center justify-center gap-2 sm:gap-4 active:scale-95 disabled:opacity-30 disabled:pointer-events-none whitespace-nowrap"
                                >
                                    {isLoading ? <RefreshIcon className="w-5 h-5 animate-spin shrink-0" /> : <CheckCircleIcon className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />}
                                    PROCESAR
                                </button>
                            </div>
                        </div>

                        {/* Background subtle art */}
                        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-purple-600/5 rounded-full pointer-events-none -mr-40 -mb-40"></div>
                    </div>
                </div>
            )}

            {/* Kardex Modal (New Component) */}
            {isKardexModalOpen && selectedDetailItem && (
                <KardexModal
                    productId={selectedDetailItem.productId}
                    productName={selectedDetailItem.productName}
                    initialBranchId={props.currentBranchId || undefined}
                    branches={props.branches}
                    onClose={() => setIsKardexModalOpen(false)}
                />
            )}

            <NotificationToast
                message={toast.message}
                title={toast.title}
                type={toast.type}
                onClose={() => setToast({ ...toast, message: null })}
                persistent={toast.type === 'error'}
            />
        </div>
    );
};

export default ManageInventoryScreen;
