import React, { useState, useMemo } from 'react';
import { Product, Category, Meat, ProductExtra } from '../types';
import { XIcon, CheckCircleIcon, ArrowRightIcon } from './icons';

interface ComboSelectionModalProps {
    combo: Product;
    categories: Category[];
    products: Product[];
    meats: Meat[];
    masas: Meat[];
    onClose: () => void;
    onConfirm: (selections: any[]) => void;
}

export const ComboSelectionModal: React.FC<ComboSelectionModalProps> = ({ combo, categories, products, meats, masas, onClose, onConfirm }) => {
    // Correctly parse combo definition with fallback
    const slots = useMemo(() => {
        try {
            const def = typeof combo.comboDefinition === 'string'
                ? JSON.parse(combo.comboDefinition)
                : (combo.comboDefinition || { slots: [] });
            return def.slots || [];
        } catch (e) {
            console.error("Error parsing combo definition", e);
            return [];
        }
    }, [combo]);

    const [currentSlotIndex, setCurrentSlotIndex] = useState(0);
    // Track selections per slot index
    const [selections, setSelections] = useState<{ [slotIndex: number]: any[] }>({});
    const [productToConfig, setProductToConfig] = useState<{
        product: Product;
        meatId?: number;
        masaId?: number;
    } | null>(null);

    // Safety check for empty slots
    if (slots.length === 0) {
        return null;
    }

    const currentSlot = slots[currentSlotIndex];
    const category = categories.find(c => c.id === currentSlot.categoryId);

    // Calculate current quantity selected for this slot
    const currentSlotSelections = selections[currentSlotIndex] || [];
    const currentSelectedQty = currentSlotSelections.reduce((sum, s) => sum + (s.qty || 1), 0);
    const canProceed = currentSelectedQty === currentSlot.qty;

    const slotProducts = useMemo(() => {
        if (!category) return [];
        return products.filter(p => p.categoryId === category.id && (p.isActive !== false));
    }, [category, products]);

    const handleSelect = (product: Product) => {
        const remaining = currentSlot.qty - currentSelectedQty;
        if (remaining <= 0) return;

        if (product.requiresMeat || product.requiresMasa) {
            setProductToConfig({
                product,
                meatId: product.requiresMeat ? meats[0]?.id : undefined,
                masaId: product.requiresMasa ? masas[0]?.id : undefined
            });
        } else {
            addSelectionToSlot(product);
        }
    };

    const addSelectionToSlot = (product: Product, meat?: Meat, masa?: Meat) => {
        setSelections(prev => {
            const slotSels = prev[currentSlotIndex] || [];
            // If it has meat/masa, we treat it as a unique variant, don't group if different
            const existingIndex = slotSels.findIndex(s =>
                s.product.id === product.id &&
                s.meat?.id === meat?.id &&
                s.masa?.id === masa?.id
            );

            let newSlotSels;
            if (existingIndex >= 0) {
                newSlotSels = [...slotSels];
                newSlotSels[existingIndex] = { ...newSlotSels[existingIndex], qty: newSlotSels[existingIndex].qty + 1 };
            } else {
                newSlotSels = [...slotSels, {
                    product,
                    qty: 1,
                    meat,
                    masa,
                    productName: product.name,
                    productId: product.id
                }];
            }

            return { ...prev, [currentSlotIndex]: newSlotSels };
        });
    };

    const confirmConfig = () => {
        if (!productToConfig) return;
        const meat = meats.find(m => m.id === productToConfig.meatId);
        const masa = masas.find(m => m.id === productToConfig.masaId);
        addSelectionToSlot(productToConfig.product, meat, masa);
        setProductToConfig(null);
    };

    const handleRemove = (product: Product, variantKey?: string) => {
        setSelections(prev => {
            const slotSels = prev[currentSlotIndex] || [];
            // Find by product ID and potentially meat/masa (simple heuristic for now)
            const idx = slotSels.findLastIndex(s => s.product.id === product.id);
            if (idx === -1) return prev;

            const newSlotSels = [...slotSels];
            if (newSlotSels[idx].qty > 1) {
                newSlotSels[idx] = { ...newSlotSels[idx], qty: newSlotSels[idx].qty - 1 };
            } else {
                newSlotSels.splice(idx, 1);
            }

            return { ...prev, [currentSlotIndex]: newSlotSels };
        });
    };

    const handleNext = () => {
        if (currentSlotIndex < slots.length - 1) {
            setCurrentSlotIndex(prev => prev + 1);
        } else {
            // FINISH
            const flatSelections: any[] = [];
            Object.values(selections).forEach((slotSels: any[]) => {
                slotSels.forEach(s => {
                    // Repeat based on qty
                    for (let i = 0; i < s.qty; i++) {
                        flatSelections.push({
                            productId: Number(s.product.id),
                            productName: s.product.name,
                            quantity: 1,
                            meat: s.meat,
                            masa: s.masa,
                            meatName: s.meat?.name,
                            masaName: s.masa?.name
                        });
                    }
                });
            });
            onConfirm(flatSelections);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-gray-900 w-full max-w-4xl rounded-[40px] border border-gray-800 shadow-2xl flex flex-col h-[85vh] relative overflow-hidden">
                {/* OVERLAY DE CONFIGURACIÓN DE PRODUCTO (CARNE/MASA) */}
                {productToConfig && (
                    <div className="absolute inset-0 bg-gray-900/98 backdrop-blur-md z-[110] p-6 flex flex-col animate-in zoom-in duration-300">
                        <div className="flex-1 overflow-y-auto scrollbar-hide pr-1">
                            <h3 className="text-xl font-black text-white italic uppercase mb-2 tracking-tighter">CONFIGURAR PRODUCTO</h3>
                            <p className="text-purple-500 font-bold uppercase text-xs mb-8 italic tracking-widest">{productToConfig.product.name}</p>

                            <div className="space-y-8">
                                {productToConfig.product.requiresMeat && (
                                    <div className="space-y-4">
                                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] ml-1 italic">SELECCIONAR PROTEÍNA (CARNE)</p>
                                        <div className="grid grid-cols-2 gap-2.5">
                                            {meats.filter(m => (m.isActive !== false) && (!m.type || m.type === 'meat') && (
                                                !productToConfig.product.availableMeatIds ||
                                                productToConfig.product.availableMeatIds.length === 0 ||
                                                productToConfig.product.availableMeatIds.map(id => Number(id)).includes(Number(m.id))
                                            )).map(m => (
                                                <button
                                                    key={m.id}
                                                    type="button"
                                                    onClick={() => setProductToConfig({ ...productToConfig, meatId: m.id })}
                                                    className={`p-4 rounded-2xl border-2 font-black uppercase text-[10px] italic transition-all ${productToConfig.meatId === m.id ? 'bg-amber-500 border-amber-400 text-white shadow-[0_8px_20px_-4px_rgba(245,158,11,0.4)] scale-[1.02]' : 'bg-gray-800/50 border-gray-700 text-gray-500 hover:bg-gray-800'}`}
                                                >
                                                    {m.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {productToConfig.product.requiresMasa && (
                                    <div className="space-y-4">
                                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] ml-1 italic">SELECCIONAR MASA / HARINA</p>
                                        <div className="grid grid-cols-2 gap-2.5">
                                            {masas.map(m => (
                                                <button
                                                    key={m.id}
                                                    type="button"
                                                    onClick={() => setProductToConfig({ ...productToConfig, masaId: m.id })}
                                                    className={`p-4 rounded-2xl border-2 font-black uppercase text-[10px] italic transition-all ${productToConfig.masaId === m.id ? 'bg-fuchsia-600 border-fuchsia-400 text-white shadow-[0_8px_20px_-4px_rgba(192,38,211,0.4)] scale-[1.02]' : 'bg-gray-800/50 border-gray-700 text-gray-500 hover:bg-gray-800'}`}
                                                >
                                                    {m.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mt-8 shrink-0 pb-2">
                            <button type="button" onClick={() => setProductToConfig(null)} className="p-4 bg-gray-800 text-gray-400 font-black rounded-2xl uppercase text-[10px] tracking-widest active:scale-95 border border-gray-700">CANCELAR</button>
                            <button type="button" onClick={confirmConfig} className="p-4 bg-green-600 text-white font-black rounded-2xl uppercase text-[10px] shadow-lg active:scale-95 transition-transform tracking-widest italic border border-green-500">CONFIRMAR</button>
                        </div>
                    </div>
                )}
                {/* HEAD */}
                <div className="p-8 border-b border-gray-800 flex justify-between items-start bg-gray-900/50 shrink-0">
                    <div>
                        <h2 className="text-3xl font-black text-white italic uppercase tracking-tight">{combo.name}</h2>
                        <div className="flex items-center gap-3 mt-2">
                            <span className="bg-purple-500/20 text-purple-400 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-purple-500/30">
                                PASO {currentSlotIndex + 1} DE {slots.length}
                            </span>
                            <span className="text-gray-400 font-bold uppercase tracking-widest text-xs">
                                SELECCIONA {currentSlot.qty} {category?.name || 'Items'}
                            </span>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-4 bg-gray-800 hover:bg-white text-white hover:text-black rounded-full transition-all active:scale-90">
                        <XIcon className="w-6 h-6" />
                    </button>
                </div>

                {/* BODY */}
                <div className="flex-1 overflow-y-auto p-8">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {slotProducts.map(p => {
                            const selectedCount = (selections[currentSlotIndex] || []).find(s => s.product.id === p.id)?.qty || 0;
                            const isMaxReached = currentSelectedQty >= currentSlot.qty;

                            return (
                                <button
                                    key={p.id}
                                    onClick={() => handleSelect(p)}
                                    disabled={isMaxReached && selectedCount === 0}
                                    className={`relative h-40 rounded-[30px] border-4 flex flex-col items-center justify-center p-4 transition-all group ${selectedCount > 0
                                        ? 'bg-purple-900/30 border-purple-500 shadow-[0_0_30px_-10px_rgba(168,85,247,0.4)]'
                                        : (isMaxReached ? 'bg-gray-900 border-gray-800 opacity-40 grayscale cursor-not-allowed' : 'bg-gray-800 border-gray-700 hover:border-gray-500 active:scale-95 hover:bg-gray-700')
                                        }`}
                                >
                                    <span className={`font-black uppercase italic text-center leading-none transition-colors ${selectedCount > 0 ? 'text-white text-lg' : 'text-gray-400 text-sm group-hover:text-white'}`}>
                                        {p.name}
                                    </span>

                                    {selectedCount > 0 && (
                                        <div className="absolute -top-3 -right-3 w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center text-white font-black text-lg border-4 border-gray-900 shadow-lg animate-in zoom-in spin-in-12 duration-300">
                                            {selectedCount}
                                        </div>
                                    )}

                                    {selectedCount > 0 && (
                                        <div
                                            onClick={(e) => { e.stopPropagation(); handleRemove(p); }}
                                            className="absolute -bottom-3 -right-3 w-10 h-10 bg-red-500 text-white rounded-full flex items-center justify-center border-4 border-gray-900 shadow-lg hover:scale-110 transition-transform cursor-pointer"
                                        >
                                            <div className="w-3 h-1 bg-white rounded-full"></div>
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* FOOTER */}
                <div className="p-8 border-t border-gray-800 bg-gray-900/90 backdrop-blur-md shrink-0 flex flex-col gap-6">
                    {/* PROGRESS BAR */}
                    <div className="flex gap-2">
                        {slots.map((_, idx) => (
                            <div key={idx} className={`h-2 flex-1 rounded-full transition-all duration-500 ${idx <= currentSlotIndex ? 'bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]' : 'bg-gray-800'}`} />
                        ))}
                    </div>

                    <button
                        onClick={handleNext}
                        disabled={!canProceed}
                        className={`w-full py-6 rounded-3xl font-black text-white uppercase italic tracking-widest text-2xl flex items-center justify-center gap-4 transition-all duration-300 ${canProceed
                            ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:to-indigo-500 shadow-[0_10px_40px_-10px_rgba(147,51,234,0.5)] hover:-translate-y-1'
                            : 'bg-gray-800 text-gray-600 cursor-not-allowed grayscale'
                            }`}
                    >
                        <span>{currentSlotIndex < slots.length - 1 ? 'SIGUIENTE' : 'CONFIRMAR COMBO'}</span>
                        <ArrowRightIcon className={`w-8 h-8 transition-transform duration-300 ${canProceed ? 'translate-x-0' : '-translate-x-2 opacity-0'}`} />
                    </button>

                    {!canProceed && (
                        <p className="text-center text-gray-500 font-bold uppercase text-[10px] tracking-[0.2em] animate-pulse">
                            Selecciona {currentSlot.qty - currentSelectedQty} item(s) más para continuar
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};
