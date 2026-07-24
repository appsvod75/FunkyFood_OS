
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Product, Category, Branch } from '../types';
import { api } from '../api';
import { SearchIcon, StoreIcon, SlidersHorizontalIcon, InfoIcon, X, LogOut } from 'lucide-react';

interface CustomerPortalProps {
    products: Product[];
    categories: Category[];
    branches: Branch[];
    isLoggedIn?: boolean;
    onBack?: () => void;
}

const CustomerPortal: React.FC<CustomerPortalProps> = ({ products, categories, branches, isLoggedIn, onBack }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
    const [selectedBranchId, setSelectedBranchId] = useState<number>(branches[0]?.id || 1);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

    // Refs for Drag-to-Scroll
    const categoriesRef = useRef<HTMLDivElement>(null);
    const productsRef = useRef<HTMLDivElement>(null);

    const [isDraggingCats, setIsDraggingCats] = useState(false);
    const [startXCats, setStartXCats] = useState(0);
    const [scrollLeftCats, setScrollLeftCats] = useState(0);

    const [isDraggingProds, setIsDraggingProds] = useState(false);
    const [startYProds, setStartYProds] = useState(0);
    const [scrollTopProds, setScrollTopProds] = useState(0);

    const onMouseDownCats = (e: React.MouseEvent) => {
        if (!categoriesRef.current) return;
        setIsDraggingCats(true);
        setStartXCats(e.pageX - categoriesRef.current.offsetLeft);
        setScrollLeftCats(categoriesRef.current.scrollLeft);
    };

    const onMouseMoveCats = (e: React.MouseEvent) => {
        if (!isDraggingCats || !categoriesRef.current) return;
        e.preventDefault();
        const x = e.pageX - categoriesRef.current.offsetLeft;
        const walk = (x - startXCats) * 2;
        categoriesRef.current.scrollLeft = scrollLeftCats - walk;
    };

    const onMouseDownProds = (e: React.MouseEvent) => {
        if (!productsRef.current) return;
        setIsDraggingProds(true);
        setStartYProds(e.pageY - productsRef.current.offsetTop);
        setScrollTopProds(productsRef.current.scrollTop);
    };

    const onMouseMoveProds = (e: React.MouseEvent) => {
        if (!isDraggingProds || !productsRef.current) return;
        e.preventDefault();
        const y = e.pageY - productsRef.current.offsetTop;
        const walk = (y - startYProds) * 2;
        productsRef.current.scrollTop = scrollTopProds - walk;
    };

    const filteredProducts = useMemo(() => {
        return products.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (p.description?.toLowerCase() || '').includes(searchQuery.toLowerCase());
            const matchesCategory = !selectedCategoryId || p.categoryId === selectedCategoryId;
            return matchesSearch && matchesCategory && p.isActive;
        });
    }, [products, searchQuery, selectedCategoryId]);

    // Group categories that have active products
    const activeCategories = useMemo(() => {
        const categoryIdsWithProducts = new Set(products.filter(p => p.isActive).map(p => p.categoryId));
        return categories.filter(c => categoryIdsWithProducts.has(c.id) && c.isActive !== false);
    }, [categories, products]);

    const currentBranch = branches.find(b => b.id === selectedBranchId) || branches[0];

    return (
        <div
            className="h-screen bg-black text-white font-sans selection:bg-amber-500/30 flex flex-col overflow-hidden"
            onMouseUp={() => { setIsDraggingCats(false); setIsDraggingProds(false); }}
            onMouseLeave={() => { setIsDraggingCats(false); setIsDraggingProds(false); }}
        >
            {/* Header / Brand Section - Ultra Compact Desktop Layout */}
            <div className="relative h-28 sm:h-32 xl:h-24 w-full overflow-hidden shrink-0">
                <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/60 to-black z-10" />
                <img
                    src={currentBranch?.logoUrl || "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&q=80&w=1000"}
                    alt="Brand Cover"
                    className="w-full h-full object-cover opacity-20 scale-105 blur-[2px]"
                />

                <div className="absolute inset-0 flex items-center justify-center px-6 z-20 animate-in fade-in zoom-in duration-700">
                    <div className="flex flex-row items-center gap-4 sm:gap-6 text-left max-w-7xl w-full justify-center">
                        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-amber-500 p-2 shadow-2xl shadow-amber-500/40 border-2 border-white/20 overflow-hidden rotate-3 hover:rotate-0 transition-transform duration-500 shrink-0">
                            <img src={currentBranch?.logoUrl || "/logo.png"} alt="Logo" className="w-full h-full object-contain" />
                        </div>
                        <div className="space-y-0.5">
                            <h1 className="text-2xl sm:text-3xl xl:text-4xl font-black italic uppercase tracking-tighter leading-none drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]">
                                {currentBranch?.name || "Funky Food"}
                            </h1>
                            <div className="flex items-center gap-2 text-amber-500 text-[8px] sm:text-[9px] font-black uppercase tracking-[0.3em] italic opacity-80">
                                <StoreIcon className="w-2.5 h-2.5" />
                                <span>Menú Digital Premium</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Exit Buttons - TOP RIGHT */}
            <div className="absolute top-4 right-4 z-[100] flex items-center gap-2 animate-in fade-in duration-300">
                {isLoggedIn && onBack && (
                    <button
                        onClick={onBack}
                        className="bg-black/60 backdrop-blur-sm text-amber-500 hover:text-white hover:bg-amber-500 hover:border-amber-400 p-3 sm:px-4 sm:py-2.5 rounded-xl font-black uppercase text-[9px] sm:text-[10px] shadow-xl border border-white/10 active:scale-95 transition-all flex items-center gap-2.5 group"
                        title="VOLVER AL PANEL"
                    >
                        <LogOut className="w-3.5 h-3.5 sm:w-4 h-4 group-hover:rotate-[-12deg] transition-transform" />
                        <span className="hidden sm:inline tracking-widest whitespace-nowrap">VOLVER AL PANEL</span>
                    </button>
                )}
                <button
                    onClick={() => window.location.href = 'https://google.com'}
                    className="px-4 py-2 rounded-full bg-red-600/20 border border-red-500/40 text-red-400 hover:bg-red-600 hover:text-white font-black uppercase text-[10px] tracking-wider active:scale-90 transition-all shadow-xl"
                    title="SALIR"
                >
                    SALIR
                </button>
            </div>

            {/* Search & Filters Sticky Bar */}
            <div className="shrink-0 bg-black/80 backdrop-blur-md border-b border-white/10 px-4 py-3 sm:py-4 space-y-3">
                <div className="relative group max-w-2xl mx-auto w-full">
                    <div className="absolute -inset-1 bg-amber-500/10 rounded-xl blur opacity-20 group-focus-within:opacity-40 transition-opacity duration-500" />
                    <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-amber-500/40 group-focus-within:text-amber-500 transition-colors z-10" />
                    <input
                        type="text"
                        placeholder="BUSCAR..."
                        value={searchQuery}
                        onFocus={(e) => {
                            if (searchQuery === '') e.target.select();
                        }}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white/5 border border-amber-500/10 rounded-xl py-2.5 sm:py-3 pl-11 pr-10 text-[10px] sm:text-[11px] font-black placeholder:text-gray-700 text-white uppercase tracking-[0.2em] outline-none focus:border-amber-500/40 focus:bg-white/[0.08] transition-all relative z-10"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-500 hover:text-amber-500 transition-colors z-20"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* Categories Pill Scroller with Drag Support */}
                <div
                    ref={categoriesRef}
                    onMouseDown={onMouseDownCats}
                    onMouseMove={onMouseMoveCats}
                    className={`flex gap-2 overflow-x-auto pb-0.5 -mx-4 px-4 select-none justify-start sm:justify-center ${isDraggingCats ? 'cursor-grabbing' : 'cursor-grab'}`}
                >
                    <button
                        onClick={() => setSelectedCategoryId(null)}
                        className={`px-6 py-2 rounded-full text-[8px] sm:text-[9px] font-black uppercase tracking-[0.2em] italic whitespace-nowrap transition-all border ${!selectedCategoryId ? 'bg-amber-500 border-amber-400 text-black shadow-lg shadow-amber-500/20' : 'bg-white/5 border-white/10 text-gray-500 hover:text-white hover:border-white/20'}`}
                    >
                        TODOS
                    </button>
                    {activeCategories.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setSelectedCategoryId(cat.id)}
                            className={`px-6 py-2 rounded-full text-[8px] sm:text-[9px] font-black uppercase tracking-[0.2em] italic whitespace-nowrap transition-all border ${selectedCategoryId === cat.id ? 'bg-amber-500 border-amber-400 text-black shadow-lg shadow-amber-500/20' : 'bg-white/5 border-white/10 text-gray-500 hover:text-white hover:border-white/20'}`}
                        >
                            {cat.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* Product Scroll Area with Drag Support */}
            <div
                ref={productsRef}
                onMouseDown={onMouseDownProds}
                onMouseMove={onMouseMoveProds}
                className={`flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pt-4 select-none transition-all ${isDraggingProds ? 'cursor-grabbing scale-[0.999]' : 'cursor-default'}`}
            >
                <div className="grid grid-cols-1 md:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8 gap-4 sm:gap-5">
                    {filteredProducts.map(product => (
                        <div
                            key={product.id}
                            className="group bg-white/[0.02] border border-white/5 rounded-[24px] overflow-hidden flex flex-col hover:bg-white/[0.04] transition-all duration-300 hover:border-white/10 hover:translate-y--0.5 shadow-lg cursor-zoom-in"
                            onClick={() => setSelectedProduct(product)}
                        >
                            {/* Image Placeholder or Actual Image */}
                            <div className="relative h-36 sm:h-40 xl:h-32 w-full bg-gray-900 overflow-hidden">
                                <img
                                    src={product.imageUrl || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=500"}
                                    alt={product.name}
                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                />
                                <div className="absolute top-2.5 right-2.5 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10">
                                    <p className="text-amber-500 font-bold italic text-sm leading-none">${Number(product.price).toFixed(2)}</p>
                                </div>
                                {product.isCombo && (
                                    <div className="absolute top-2.5 left-2.5 bg-purple-600 px-2 py-0.5 rounded-full text-[7px] font-black uppercase italic tracking-widest border border-purple-400 shadow-lg">
                                        COMBO
                                    </div>
                                )}
                            </div>

                            <div className="p-4 flex-1 flex flex-col">
                                <div className="mb-2">
                                    <p className="text-[8px] font-black text-amber-500/80 uppercase tracking-widest italic mb-0.5">
                                        {categories.find(c => c.id === product.categoryId)?.name || 'General'}
                                    </p>
                                    <h3 className="text-base font-black uppercase leading-tight italic tracking-tighter group-hover:text-amber-500 transition-colors line-clamp-1">
                                        {product.name}
                                    </h3>
                                </div>

                                <div className="rounded-lg">
                                    <p className="text-gray-400 text-[10px] font-medium leading-relaxed mb-4 line-clamp-2 italic whitespace-pre-line border-l border-amber-500/20 pl-3 py-0.5">
                                        {product.description || "Delicioso y gourmet. ✨"}
                                    </p>
                                </div>

                                <div className="mt-auto flex items-center justify-between">
                                    <div className="flex gap-1.5">
                                        {product.requiresMeat && <div className="w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.5)]" title="Requiere Proteína" />}
                                        {product.requiresMasa && <div className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" title="Requiere Masa" />}
                                    </div>
                                    {(product.requiresMeat || product.requiresMasa) && (
                                        <div className="flex items-center gap-2 text-[10px] font-black uppercase italic tracking-widest text-[#fff] drop-shadow-[0_0_12px_rgba(245,158,11,0.8)] select-none">
                                            {product.requiresMeat && product.requiresMasa ? 'Personalizable' :
                                                product.requiresMeat ? 'Carne de Selección' :
                                                    'Masa de Selección'} <InfoIcon className="w-3.5 h-3.5 opacity-60" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {filteredProducts.length === 0 && (
                    <div className="py-20 text-center space-y-4 opacity-50">
                        <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                            <SearchIcon className="w-8 h-8 text-gray-600" />
                        </div>
                        <h3 className="text-xl font-black uppercase italic tracking-widest">No encontramos nada</h3>
                        <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Intenta con otra búsqueda o categoría</p>
                        <button
                            onClick={() => { setSearchQuery(''); setSelectedCategoryId(null); }}
                            className="px-8 py-4 bg-amber-500 text-black font-black text-[10px] rounded-full uppercase italic tracking-widest shadow-xl shadow-amber-500/20 active:scale-95 transition-all"
                        >
                            Limpiar Filtros
                        </button>
                    </div>
                )}

                {/* Footer Content */}
                <footer className="mt-16 pb-12 text-center">
                    <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center mx-auto mb-6 border border-amber-500/20">
                        <img src={currentBranch?.logoUrl || "/logo.png"} alt="Logo" className="w-6 h-6 object-contain opacity-50" />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-800 italic">
                        Powered by FunkyFood AI
                    </p>
                </footer>
            </div>


            {/* Product Detail Modal (Zoom) */}
            {selectedProduct && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8 animate-in fade-in duration-300 backdrop-blur-sm bg-black/80"
                    onClick={() => setSelectedProduct(null)}
                >
                    <div
                        className="bg-[#0a0a0a] border border-white/10 w-full max-w-2xl rounded-[40px] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="relative h-64 sm:h-80 w-full overflow-hidden">
                            <img
                                src={selectedProduct.imageUrl || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=1000"}
                                alt={selectedProduct.name}
                                className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent" />
                            <button
                                onClick={() => setSelectedProduct(null)}
                                className="absolute top-6 right-6 w-10 h-10 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-white border border-white/10 hover:bg-white/10 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-8 sm:p-10 -mt-8 relative z-10">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <p className="text-amber-500 text-xs font-black uppercase tracking-[0.3em] italic mb-2">
                                        {categories.find(c => c.id === selectedProduct.categoryId)?.name || 'General'}
                                    </p>
                                    <h2 className="text-3xl sm:text-4xl font-black italic uppercase tracking-tighter leading-none">
                                        {selectedProduct.name}
                                    </h2>
                                </div>
                                <div className="text-right">
                                    <p className="text-3xl font-black text-amber-500 italic tracking-tighter">
                                        ${Number(selectedProduct.price).toFixed(2)}
                                    </p>
                                </div>
                            </div>

                            <p className="text-gray-300 text-base sm:text-lg leading-relaxed italic whitespace-pre-line border-l-4 border-amber-500/20 pl-6 py-2 mb-8">
                                {selectedProduct.description || "Suave, delicioso y gourmet. Preparado con pasión y los mejores ingredientes seleccionados para una explosión de sabor inigualable. ✨"}
                            </p>

                            <div className="flex flex-wrap gap-4">
                                {selectedProduct.requiresMeat && (
                                    <div className="px-5 py-2.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-[10px] font-black uppercase italic tracking-widest shadow-[0_0_15px_rgba(6,182,212,0.1)]">
                                        Carne de Selección
                                    </div>
                                )}
                                {selectedProduct.requiresMasa && (
                                    <div className="px-5 py-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-500 text-[10px] font-black uppercase italic tracking-widest shadow-[0_0_15px_rgba(245,158,11,0.1)]">
                                        Masa de Selección
                                    </div>
                                )}
                                {selectedProduct.isCombo && (
                                    <div className="px-5 py-2.5 rounded-2xl bg-purple-500/10 border border-purple-500/30 text-purple-400 text-[10px] font-black uppercase italic tracking-widest shadow-[0_0_15px_rgba(168,85,247,0.1)]">
                                        Combo Especial
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomerPortal;
