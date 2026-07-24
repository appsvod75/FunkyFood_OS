
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Order, OrderItem, Product, Category, Meat, OrderType, ProductExtra, Payment, CompanySettings, Branch, PaymentMethod, UserRole, PromotionRule, Waiter } from '../types';
import { calculatePromotions } from '../utils/promotionEngine';
import { CLIENTE_VARIOS } from '../constants';
import TicketModal from './TicketModal';
import PaymentModal from './PaymentModal';
import ErrorBoundary from './ErrorBoundary';
import { PlusIcon, MinusIcon, TrashIcon, PencilIcon, PlusCircleIcon, CashRegisterIcon, ReceiptIcon, CheckCircleIcon, TagIcon, BellIcon, LockClosedIcon, InfoIcon, XIcon } from './icons';
import NotificationToast from './NotificationToast';
import AIOrderParserModal from './AIOrderParserModal';
import { ComboSelectionModal } from './ComboSelectionModal';
import PinVerificationModal from './PinVerificationModal';
import { api } from '../api';

interface OrderScreenProps {
    order: Order;
    updateOrder: (orderId: string, items: OrderItem[]) => void;
    onCompleteOrder: (orderId: string, payments: Payment[], changeGiven: number, manualDiscount?: number, serviceCharge?: number, cardCommission?: number) => void;
    onStartNewOrder: () => void;
    onBackToStart: () => void;
    onEditOrderHeader: (orderId: string) => void;
    categories: Category[];
    products: Product[];
    meats: Meat[];
    productExtras: ProductExtra[];
    updateDeliveryFee: (orderId: string, fee: number) => void;
    productPopularity: Record<number, number>;
    companySettings: CompanySettings;
    onUpdateCustomerEmail: (customerId: number, email: string) => void;
    branches: Branch[];
    currentUser: { id: number; username: string; currentRole: UserRole; allRoles: UserRole[] } | null;
    promotions: PromotionRule[];
    waiters?: Waiter[];
    productAvailability?: Record<number, number>;
    redigitationMode?: { cashReportId: number; date: string; branchId: number } | null;
    onExitRedigitation?: () => void;
}

const OrderScreen: React.FC<OrderScreenProps> = ({
    order,
    updateOrder,
    onCompleteOrder,
    onStartNewOrder,
    onBackToStart,
    onEditOrderHeader,
    categories,
    products,
    meats,
    productExtras,
    updateDeliveryFee,
    productPopularity,
    companySettings,
    onUpdateCustomerEmail,
    branches,
    currentUser,
    promotions,
    waiters,
    productAvailability = {},
    redigitationMode,
    onExitRedigitation
}) => {
    // Calculate driver name
    const driverName = useMemo(() => {
        if (!order.deliveryDriverId || !waiters) return null;
        const driver = waiters.find(w => Number(w.id) === Number(order.deliveryDriverId));
        return driver ? driver.name.toUpperCase() : 'REPARTIDOR';
    }, [order.deliveryDriverId, waiters]);
    // Calculate promotions for display
    const appliedDiscounts = useMemo(() => calculatePromotions(order.items, promotions), [order.items, promotions]);

    const normalize = (str: any) => {
        if (str === null || str === undefined) return '';
        return String(str).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    };
    // DEBUG: Log what data we're receiving
    useEffect(() => {
        // console.log('🔍 OrderScreen - Order:', order);
    }, [order]);

    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.Cash);

    // Default Delivery Fee Logic
    // Default Delivery Fee Logic: Handled in App.tsx createNewOrder now
    // useEffect removed to prevent render loops.

    const filteredCategories = useMemo(() => {
        const hasPopularity = productPopularity && Object.keys(productPopularity).length > 0;
        const realCats = categories.filter(c => c.id !== 0 && (c.isActive !== false));
        if (hasPopularity) {
            return [{ id: -1, name: '⭐ TOP' } as Category, ...realCats];
        }
        return realCats;
    }, [categories, productPopularity]);

    const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
    const [productSearchQuery, setProductSearchQuery] = useState('');

    useEffect(() => {
        // Safety check: if no categories, nothing to do
        if (filteredCategories.length === 0) {
            if (selectedCategoryId !== null) setSelectedCategoryId(null);
            return;
        }

        // 1. Initialization: Select first category if none selected
        if (selectedCategoryId === null) {
            setSelectedCategoryId(filteredCategories[0].id);
            return;
        }

        // 2. Validation: Verify if the currently selected category is still valid
        const categoryExists = filteredCategories.some(c => c.id === selectedCategoryId);
        if (!categoryExists) {
            // Check if we were on TOP (-1) and it disappeared (popularity cleared), go to first real category
            // Or if permissions changed.
            // Fallback to the first available category.
            setSelectedCategoryId(filteredCategories[0].id);
        }
    }, [filteredCategories, selectedCategoryId]);

    const [isPaymentModalVisible, setIsPaymentModalVisible] = useState(false);
    const [isTicketVisible, setIsTicketVisible] = useState(false);
    const [productForMeatSelection, setProductForMeatSelection] = useState<Product | null>(null);
    const [productForMasaSelection, setProductForMasaSelection] = useState<Product | null>(null); // New state for Masa
    const [pendingMasa, setPendingMasa] = useState<Meat | null>(null); // Store masa while selecting meat
    const [comboProductToConfigure, setComboProductToConfigure] = useState<Product | null>(null);
    const [editingItem, setEditingItem] = useState<OrderItem | null>(null);
    const [itemForExtras, setItemForExtras] = useState<OrderItem | null>(null);
    const [completedOrderForTicket, setCompletedOrderForTicket] = useState<Order | null>(null);
    const [manualDiscount, setManualDiscount] = useState(0);
    // Optimization: Land on Cart if there are items, Menu if empty
    const [mobileView, setMobileView] = useState<'menu' | 'summary'>(order.items.length > 0 ? 'summary' : 'menu');
    const [addedFeedback, setAddedFeedback] = useState<string | null>(null);
    const [itemToDelete, setItemToDelete] = useState<OrderItem | null>(null); // Changed to OrderItem object
    const [isPinModalVisible, setIsPinModalVisible] = useState(false);
    const [comboForPreview, setComboForPreview] = useState<Product | null>(null);
    const [observationTags, setObservationTags] = useState<{ id: number, name: string }[]>([]);
    const [obsText, setObsText] = useState('');

    // Load Observation Tags
    useEffect(() => {
        api.getObservationTags().then(tags => {
            setObservationTags(tags);
        }).catch(err => console.error("Error fetching observation tags:", err));
    }, []);

    // Sync obsText when starting to edit
    useEffect(() => {
        if (editingItem) {
            setObsText(editingItem.observations || '');
        } else {
            setObsText('');
        }
    }, [editingItem]);

    // ... (scroll logic omitted, keeping it) ...
    const categoryScrollRef = useRef<HTMLDivElement>(null);
    const [isDraggingCat, setIsDraggingCat] = useState(false);
    const [startXCat, setStartXCat] = useState(0);
    const [scrollLeftCat, setScrollLeftCat] = useState(0);

    const handleMouseDownCat = (e: React.MouseEvent) => {
        if (!categoryScrollRef.current) return;
        setIsDraggingCat(true);
        setStartXCat(e.pageX - categoryScrollRef.current.offsetLeft);
        setScrollLeftCat(categoryScrollRef.current.scrollLeft);
    };

    const handleMouseMoveCat = (e: React.MouseEvent) => {
        if (!isDraggingCat || !categoryScrollRef.current) return;
        e.preventDefault();
        const x = e.pageX - categoryScrollRef.current.offsetLeft;
        const walk = (x - startXCat) * 2;
        categoryScrollRef.current.scrollLeft = scrollLeftCat - walk;
    };

    // --- Lógica de Drag-to-Scroll Vertical para Productos ---
    const productScrollRef = useRef<HTMLDivElement>(null);
    const [isDraggingProd, setIsDraggingProd] = useState(false);
    const [startYProd, setStartYProd] = useState(0);
    const [scrollTopProd, setScrollTopProd] = useState(0);
    const [hasDraggedProd, setHasDraggedProd] = useState(false);

    const handleMouseDownProd = (e: React.MouseEvent) => {
        if (!productScrollRef.current) return;
        setIsDraggingProd(true);
        setHasDraggedProd(false);
        setStartYProd(e.pageY - productScrollRef.current.offsetTop);
        setScrollTopProd(productScrollRef.current.scrollTop);
    };

    const handleMouseMoveProd = (e: React.MouseEvent) => {
        if (!isDraggingProd || !productScrollRef.current) return;
        e.preventDefault();
        const y = e.pageY - productScrollRef.current.offsetTop;
        const walk = (y - startYProd) * 2;
        if (Math.abs(walk) > 5) setHasDraggedProd(true);
        productScrollRef.current.scrollTop = scrollTopProd - walk;
    };

    // --- Lógica de Drag-to-Scroll Vertical para Carrito ---
    const cartScrollRef = useRef<HTMLDivElement>(null);
    const [isDraggingCart, setIsDraggingCart] = useState(false);
    const [startYCart, setStartYCart] = useState(0);
    const [scrollTopCart, setScrollTopCart] = useState(0);
    const [hasDraggedCart, setHasDraggedCart] = useState(false);

    const handleMouseDownCart = (e: React.MouseEvent) => {
        if (!cartScrollRef.current) return;
        setIsDraggingCart(true);
        setHasDraggedCart(false);
        setStartYCart(e.pageY - cartScrollRef.current.offsetTop);
        setScrollTopCart(cartScrollRef.current.scrollTop);
    };

    const handleMouseMoveCart = (e: React.MouseEvent) => {
        if (!isDraggingCart || !cartScrollRef.current) return;
        e.preventDefault();
        const y = e.pageY - cartScrollRef.current.offsetTop;
        const walk = (y - startYCart) * 2;
        if (Math.abs(walk) > 5) setHasDraggedCart(true);
        cartScrollRef.current.scrollTop = scrollTopCart - walk;
    };

    const handleMouseUpOrLeave = () => {
        setIsDraggingCat(false);
        setIsDraggingProd(false);
        setIsDraggingCart(false);
    };

    const filteredProducts = useMemo(() => {
        if (!products || !Array.isArray(products)) return [];

        const normalizedSearch = normalize(productSearchQuery);
        const isSearching = normalizedSearch.length > 0;

        // Safe access helper - Handle undefined/null popularity
        const getPop = (id: number) => {
            if (!productPopularity) return 0;
            return productPopularity[id] || 0;
        };

        try {
            let result = products.filter(p => {
                if (!p) return false;
                // Robust isActive check
                if (p.isActive === false || p.is_active === 0) return false;
                // Validate price
                if (p.price === null || p.price === undefined || isNaN(Number(p.price))) return false;

                if (isSearching) {
                    return normalize(p.name).includes(normalizedSearch);
                }

                if (selectedCategoryId === -1) {
                    // Virtual category: Top 15 products with sales
                    // Safety check: Only include if popularity > 0
                    return getPop(p.id) > 0;
                }

                // Category filter
                return String(p.categoryId) === String(selectedCategoryId);
            });

            if (isSearching) {
                return result.map(p => ({ ...p, price: Number(p.price) })).sort((a, b) => getPop(b.id) - getPop(a.id));
            }

            if (selectedCategoryId === -1) {
                return result
                    .sort((a, b) => getPop(b.id) - getPop(a.id))
                    .slice(0, 15)
                    .map(p => ({ ...p, price: Number(p.price) }));
            }

            return result
                .map(p => ({ ...p, price: Number(p.price) }))
                .sort((a, b) => getPop(b.id) - getPop(a.id));
        } catch (error) {
            console.error("Error filtering products:", error);
            return [];
        }
    }, [selectedCategoryId, products, productPopularity, productSearchQuery]);

    const showAddedFeedback = (message: string) => {
        setAddedFeedback(message);
        setTimeout(() => setAddedFeedback(null), 2000);
    };

    const handleConfirmPayment = (payments: Payment[], changeGiven: number, serviceCharge?: number, cardCommission?: number) => {
        try {
            const receiverName = currentUser?.username || 'Sistema';

            const finalOrder: Order = {
                ...order,
                manualDiscount: manualDiscount, // Send the manual discount
                serviceCharge: serviceCharge,
                cardCommission: cardCommission,
                payments: payments.map(p => ({
                    ...p,
                    receivedBy: receiverName
                })),
                amountPaid: payments.reduce((sum, p) => sum + p.amount, 0),
                changeGiven: changeGiven,
                status: 'completed' as const,
                completedAt: new Date(),
            };

            const ticketOrder = finalOrder.type === OrderType.Restaurant && !finalOrder.customer
                ? { ...finalOrder, customer: CLIENTE_VARIOS }
                : finalOrder;

            setCompletedOrderForTicket(ticketOrder);

            // Use functional state updates for modals to avoid race conditions
            setIsPaymentModalVisible(false);
            setIsTicketVisible(true);
        } catch (error) {
            console.error("Error processing payment:", error);
            alert("Error al procesar el pago.");
        }
    };

    const handleAddItem = (product: Product, meat?: Meat, masa?: Meat) => {
        // COMBO INTERCEPTION
        if (product.isCombo) {
            let comboDef = product.comboDefinition;
            if (typeof comboDef === 'string') {
                try { comboDef = JSON.parse(comboDef); } catch (e) { comboDef = null; }
            }

            // AUTO-ADICIÓN SI ES FIJO
            if (comboDef && (comboDef as any).type === 'fixed') {
                const selections = ((comboDef as any).items || []).map((item: any) => {
                    const p = products.find(prod => Number(prod.id) === Number(item.productId));
                    return {
                        productId: Number(item.productId),
                        productName: p?.name || 'Producto',
                        quantity: item.qty || 1
                    };
                });

                const newItem: OrderItem = {
                    id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                    product,
                    quantity: 1,
                    total: product.price,
                    extras: [],
                    comboSelections: selections
                };

                updateOrder(order.id, [newItem, ...order.items]);
                showAddedFeedback(`${product.name.toUpperCase()} - AGREGADO`);
                return;
            }

            // FALLBACK TO MODAL FOR DYNAMIC COMBOS
            setComboProductToConfigure(product);
            return;
        }

        // Resolve Masa (from args or pending state)
        const activeMasa = masa || pendingMasa;

        // 1. Check Masa Requirement
        if (product.requiresMasa && !activeMasa) {
            setProductForMasaSelection(product);
            return;
        }

        // 2. Check Meat Requirement
        if (product.requiresMeat && !meat) {
            // Store the already selected masa (if any) so it's not lost
            if (activeMasa) setPendingMasa(activeMasa);
            setProductForMeatSelection(product);
            return;
        }

        const existingItem = order.items.find(item =>
            item.product.id === product.id &&
            !item.observations &&
            (!item.extras || item.extras.length === 0) &&
            (product.requiresMeat ? item.meat?.id === meat?.id : true) &&
            (product.requiresMasa ? item.masa?.id === activeMasa?.id : true) &&
            !item.completed // Only merge if NOT completed
        );

        let newItems;
        if (existingItem) {
            // Update quantity AND move to the top of the list
            // REFRESH ID: This ensures that when sorted by id DESC, the merged item stays at the top
            const newId = `item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
            const updatedItem = { ...existingItem, id: newId, quantity: existingItem.quantity + 1, total: (existingItem.quantity + 1) * existingItem.product.price, completed: false };
            const otherItems = order.items.filter(item => item.id !== existingItem.id);
            newItems = [updatedItem, ...otherItems];
        } else {
            const newItem: OrderItem = {
                id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                product,
                quantity: 1,
                meat,
                masa: activeMasa || undefined,
                total: product.price,
                extras: [],
            };
            newItems = [newItem, ...order.items];
        }
        updateOrder(order.id, newItems);

        // Reset States
        setProductForMeatSelection(null);
        setProductForMasaSelection(null);
        setPendingMasa(null);

        showAddedFeedback(`${product.name} - AGREGADO`);
    };

    const handleConfirmCombo = (selections: any[]) => {
        if (!comboProductToConfigure) return;

        const newItem: OrderItem = {
            id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            product: comboProductToConfigure,
            quantity: 1,
            total: comboProductToConfigure.price,
            extras: [],
            comboSelections: selections
        };

        const newItems = [newItem, ...order.items];
        updateOrder(order.id, newItems);

        showAddedFeedback(`${comboProductToConfigure.name} - AGREGADO`);
        setComboProductToConfigure(null);
    };

    const handleUpdateQuantity = (itemId: string, delta: number) => {
        const item = order.items.find(i => i.id === itemId);
        // SECURITY: Prevent quantity reduction on COMPLETED items
        if (item?.completed && delta < 0) {
            return;
        }

        const newItems = order.items.map(item => {
            if (item.id === itemId) {
                const newQuantity = Math.max(0, item.quantity + delta);
                const isIncreased = newQuantity > item.quantity;
                const extrasPrice = item.extras?.reduce((sum, extra) => sum + Number(extra.price), 0) || 0;
                const singleItemPrice = item.product.price + extrasPrice;
                return { ...item, quantity: newQuantity, total: newQuantity * singleItemPrice, completed: isIncreased ? false : item.completed };
            }
            return item;
        }).filter(item => item.quantity > 0);
        updateOrder(order.id, newItems);
    };

    const handleRemoveItem = (itemId: string) => {
        const item = order.items.find(i => i.id === itemId);
        // Remove the block for completed items, they can be deleted with PIN
        setItemToDelete(item || null);
        setIsPinModalVisible(true);
    };

    const confirmRemoveItem = async (adminUser: { id: number }) => {
        if (itemToDelete) {
            try {
                // 1. Log the deletion
                await api.logItemDeletion(order.id, {
                    branchId: order.branchId,
                    dailyOrderNumber: order.dailyOrderNumber,
                    customerName: order.customer?.name || 'CLIENTES VARIOS',
                    itemData: itemToDelete,
                    userId: adminUser.id,
                    reason: 'Eliminación autorizada por Administrador'
                });

                // 2. Remove locally
                const newItems = order.items.filter(item => item.id !== itemToDelete.id);
                updateOrder(order.id, newItems);

                showAddedFeedback('PRODUCTO ELIMINADO');
            } catch (error) {
                console.error('Error logging item deletion:', error);
                // Even if log fails, we might want to proceed or block. 
                // Given the user wants it as a "must have" log, let's notify.
                alert('Error al registrar la auditoría. No se pudo eliminar.');
            } finally {
                setItemToDelete(null);
                setIsPinModalVisible(false);
            }
        }
    };

    const handleSaveObservations = (itemId: string, observations: string) => {
        const newItems = order.items.map(item =>
            item.id === itemId ? { ...item, observations: observations.toUpperCase() } : item
        );
        updateOrder(order.id, newItems);
        setEditingItem(null);
    };

    const [isAIModalVisible, setIsAIModalVisible] = useState(false);

    return (
        <div className="flex flex-col h-[calc(100dvh-3.5rem)] sm:h-[calc(100vh-4rem)] bg-gray-950 overflow-hidden relative">
            {/* Redigitation Banner */}
            {redigitationMode && (
                <div className="bg-red-600/20 border-b border-red-500/40 px-4 py-2 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                        <span className="text-red-500 text-lg">🔴</span>
                        <div>
                            <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">
                                REDIGITANDO ÓRDENES — Fecha: {redigitationMode.date}
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={onExitRedigitation}
                        className="text-[9px] font-black text-red-400 hover:text-white uppercase tracking-widest transition-colors bg-red-500/20 hover:bg-red-500/40 px-3 py-1.5 rounded-lg"
                    >
                        SALIR
                    </button>
                </div>
            )}

            {/* Feedback Toast - PORTALED & GREEN NEON */}
            <NotificationToast
                message={addedFeedback}
                type="success"
                position="top"
                duration={1200}
                onClose={() => setAddedFeedback(null)}
            />

            {/* Cabecera de pedido */}
            <div className="bg-gray-900 px-4 py-2 flex items-center justify-between border-b border-gray-800 shrink-0">
                <div className="min-w-0">
                    <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-1">
                        {order.type} {order.table && `• ${order.table.name}`}
                    </p>
                    <p className="text-sm font-black text-white truncate uppercase italic tracking-tight leading-none mt-0.5">
                        {order.customer?.name || 'CLIENTES VARIOS'}
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setIsAIModalVisible(true)}
                        className="p-2 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl text-white active:scale-90 transition-all shadow-lg hover:shadow-purple-500/20 border border-white/10"
                        title="Magic Bot"
                    >
                        <span className="text-lg">✨</span>
                    </button>
                    <button
                        onClick={() => onEditOrderHeader(order.id)}
                        className="p-2 bg-gray-800 rounded-xl text-gray-400 active:scale-90 transition-transform border border-gray-700/50"
                    >
                        <PencilIcon className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Selector de Vista (Móvil) */}
            <div className="lg:hidden flex border-b border-gray-800 shrink-0">
                <button
                    onClick={() => setMobileView('menu')}
                    className={`flex-1 py-3 text-sm font-black uppercase tracking-widest transition-all ${mobileView === 'menu' ? 'text-amber-500 border-b-2 border-amber-500 bg-amber-500/5' : 'text-gray-500'}`}
                >
                    MENÚ
                </button>
                <button
                    onClick={() => setMobileView('summary')}
                    className={`flex-1 py-3 text-sm font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${mobileView === 'summary'
                        ? 'text-amber-500 border-b-2 border-amber-500 bg-amber-500/10'
                        : order.items.length > 0
                            ? 'text-cyan-400 bg-cyan-900 shadow-[inset_0_0_20px_rgba(34,211,238,0.2)] ring-1 ring-cyan-500/50'
                            : 'text-gray-500'
                        }`}
                >
                    PEDIDO ({order.items.reduce((acc, i) => acc + i.quantity, 0)})
                </button>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Menú de Productos */}
                <div className={`flex-1 flex flex-col min-w-0 ${mobileView === 'summary' ? 'hidden lg:flex' : 'flex'}`}>
                    <div className="p-2 shrink-0">
                        <div
                            ref={categoryScrollRef}
                            onMouseDown={handleMouseDownCat}
                            onMouseLeave={handleMouseUpOrLeave}
                            onMouseUp={handleMouseUpOrLeave}
                            onMouseMove={handleMouseMoveCat}
                            className={`flex gap-2 overflow-x-auto pb-2 scrollbar-hide select-none ${isDraggingCat ? 'cursor-grabbing' : 'cursor-grab'}`}
                        >
                            {filteredCategories.map(category => (
                                <button
                                    key={category.id}
                                    onClick={() => !isDraggingCat && setSelectedCategoryId(category.id)}
                                    className={`px-4 py-2 rounded-2xl font-black text-xs sm:text-sm whitespace-nowrap transition-all flex-shrink-0 uppercase tracking-widest border-2 ${selectedCategoryId === category.id
                                        ? 'bg-amber-500 text-black shadow-lg border-transparent'
                                        : 'bg-gray-800 text-white border-amber-500/50 hover:border-amber-500 hover:text-amber-500 hover:bg-amber-500/20'}`}
                                >
                                    {category.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="px-2 pb-2">
                        <div className="relative">
                            <input
                                type="text"
                                value={productSearchQuery}
                                onChange={(e) => setProductSearchQuery(e.target.value)}
                                placeholder="BUSCAR PRODUCTO..."
                                className="w-full p-2.5 bg-gray-900 border border-gray-800 rounded-xl text-xs font-black text-white focus:border-amber-500 outline-none uppercase placeholder:text-gray-600 shadow-inner"
                            />
                            {productSearchQuery && (
                                <button
                                    onClick={() => setProductSearchQuery('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 active:scale-90 transition-all p-1"
                                >
                                    <XIcon className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Contenedor de Productos con DRAG-TO-SCROLL VERTICAL */}
                    <div
                        ref={productScrollRef}
                        onMouseDown={handleMouseDownProd}
                        onMouseLeave={handleMouseUpOrLeave}
                        onMouseUp={handleMouseUpOrLeave}
                        onMouseMove={handleMouseMoveProd}
                        className={`flex-1 overflow-y-auto p-2 pt-0 scrollbar-hide select-none relative ${isDraggingProd ? 'cursor-grabbing' : 'cursor-default'}`}
                    >
                        {order.status === 'completed' && (
                            <div className="absolute inset-x-2 top-0 bottom-2 bg-gray-950 z-[50] rounded-2xl flex flex-col items-center justify-center p-6 text-center border-2 border-dashed border-gray-800">
                                <div className="bg-amber-600 p-4 rounded-full mb-4 border border-amber-500 shadow-xl">
                                    <LockClosedIcon className="w-10 h-10 text-white" />
                                </div>
                                <h3 className="text-xl font-black text-amber-500 uppercase italic tracking-tighter leading-none mb-2">ORDEN COBRADA</h3>
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest max-w-[200px]">El menú está en modo lectura para este pedido</p>
                            </div>
                        )}

                        <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 ${order.status === 'completed' ? 'pointer-events-none grayscale-[0.5] opacity-50' : ''}`}>
                            {filteredProducts.map(product => {
                                // Calculate Available
                                const stock = productAvailability[product.id];
                                let displayAvailable = null;
                                let isLowStock = false;

                                if (stock !== undefined) {
                                    // Subtract what is currently in the cart
                                    const inCart = order.items
                                        .filter(i => {
                                            // Direct match
                                            if (Number(i.product.id) === Number(product.id)) return true;

                                            // Check inside Combos
                                            if (i.product.isCombo && i.comboSelections) {
                                                if (Array.isArray(i.comboSelections)) {
                                                    return i.comboSelections.some(s => Number(s.productId) === Number(product.id));
                                                }
                                            }
                                            return false;
                                        })
                                        .reduce((sum, i) => {
                                            if (Number(i.product.id) === Number(product.id)) {
                                                return sum + i.quantity;
                                            }
                                            // If it's inside a combo, we need to know how many of THIS product are in that combo instance
                                            if (i.product.isCombo && i.comboSelections && Array.isArray(i.comboSelections)) {
                                                const countInCombo = i.comboSelections
                                                    .filter(s => Number(s.productId) === Number(product.id))
                                                    .reduce((sSum, s) => sSum + s.quantity, 0);
                                                return sum + (countInCombo * i.quantity);
                                            }
                                            return sum;
                                        }, 0);

                                    displayAvailable = Math.max(0, stock - inCart);
                                    isLowStock = displayAvailable <= 5;
                                }

                                return (
                                    <button
                                        key={product.id}
                                        onClick={() => !hasDraggedProd && handleAddItem(product)}
                                        className="bg-gray-800 rounded-[20px] active:scale-95 transition-all p-2 flex flex-col items-center justify-center text-center gap-0.5 border border-gray-700/50 shadow-md h-[82px] relative overflow-hidden group"
                                    >
                                        {product.isCombo && (
                                            <div
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setComboForPreview(product);
                                                }}
                                                className="absolute top-1.5 right-1.5 p-1.5 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500 hover:text-white transition-all z-[10] active:scale-[0.8]"
                                            >
                                                <InfoIcon className="w-3.5 h-3.5" />
                                            </div>
                                        )}
                                        <span className="text-[15px] font-black text-white leading-[1.1] uppercase line-clamp-2 group-active:text-amber-200 tracking-tight px-1 w-full">{product.name}</span>
                                        <span className="text-lg font-black text-amber-500 italic tracking-tighter leading-none">${product.price.toFixed(2)}</span>

                                        {/* AVAILABILITY BADGE - MOVED TO BOTTOM RIGHT & INSET */}
                                        {displayAvailable !== null && product.trackStock && (
                                            <div className={`absolute bottom-1 right-3 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest border shadow-sm ${isLowStock ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'}`}>
                                                DISP: {displayAvailable}
                                            </div>
                                        )}

                                        {product.requiresMeat && (
                                            <div className="absolute top-2.5 right-2.5">
                                                <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full shadow-[0_0_6px_rgba(34,211,238,0.8)]"></div>
                                            </div>
                                        )}
                                        {product.requiresMasa && (
                                            <div className="absolute top-2.5 left-2.5">
                                                <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full shadow-[0_0_6px_rgba(250,204,21,0.8)]"></div>
                                            </div>
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                </div>

                {/* Resumen del Pedido */}
                <div className={`w-full lg:w-[420px] bg-gray-900 border-l border-gray-800 flex flex-col ${mobileView === 'menu' ? 'hidden lg:flex' : 'flex'}`}>
                    <div
                        ref={cartScrollRef}
                        onMouseDown={handleMouseDownCart}
                        onMouseLeave={handleMouseUpOrLeave}
                        onMouseUp={handleMouseUpOrLeave}
                        onMouseMove={handleMouseMoveCart}
                        className={`flex-1 overflow-y-auto p-3 select-none ${isDraggingCart ? 'cursor-grabbing' : 'cursor-default'}`}
                    >
                        {order.items.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center opacity-20 text-center scale-75">
                                <ReceiptIcon className="w-20 h-20 mb-4" />
                                <p className="font-black text-lg uppercase tracking-[0.2em]">CARRITO VACÍO</p>
                            </div>
                        ) : (
                            <div className="space-y-1.5">
                                {order.items.map(item => (
                                    <div key={item.id} className="bg-gray-800 rounded-[18px] pt-2.5 px-2.5 pb-2 border border-gray-700 relative group">
                                        <div className="flex justify-between items-start mb-1.5">
                                            <div className="flex-1 min-w-0 pr-3">
                                                <p className="font-black text-[15px] text-white leading-tight uppercase truncate tracking-tight group-active:text-amber-400">{item.product.name}</p>
                                                {/* COMBO DETAILS */}
                                                {item.comboSelections && item.comboSelections.length > 0 && (
                                                    <div className="pl-2 mt-1 space-y-0.5 border-l-2 border-purple-500/30">
                                                        {item.comboSelections.map((s, idx) => (
                                                            <p key={idx} className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex justify-between pr-2">
                                                                <span>
                                                                    {s.productName}
                                                                    {s.meatName && <span className="text-amber-500 ml-1">[{s.meatName}]</span>}
                                                                    {s.masaName && <span className="text-fuchsia-400 ml-1">[{s.masaName}]</span>}
                                                                </span>
                                                                <span className="text-purple-400">x{s.quantity}</span>
                                                            </p>
                                                        ))}
                                                    </div>
                                                )}
                                                {item.masa && <p className="text-sm font-black text-fuchsia-400 uppercase italic mt-0.5 tracking-wider">{item.masa.name}</p>}
                                                {item.meat && <p className="text-sm font-black text-amber-500 uppercase italic mt-0.5">{item.meat.name}</p>}
                                                {item.extras?.map(e => <p key={e.id} className="text-[11px] text-green-400 uppercase font-black tracking-tight mt-0.5 flex items-center gap-1"><PlusIcon className="w-3 h-3" /> {e.name}</p>)}
                                                {item.observations && (
                                                    <div className="bg-cyan-900/10 border border-cyan-800/20 rounded-lg p-1.5 mt-1">
                                                        <p className="text-[10px] text-cyan-400 italic leading-snug font-bold">"{item.observations}"</p>
                                                    </div>
                                                )}
                                            </div>
                                            <p className="font-black text-base text-amber-500 italic tracking-tighter leading-none">${item.total.toFixed(2)}</p>
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1 bg-gray-950 p-1 rounded-lg border border-gray-800 shadow-inner">
                                                <button
                                                    disabled={item.completed}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleUpdateQuantity(item.id, -1);
                                                    }}
                                                    className={`w-6 h-6 bg-gray-800 text-amber-500 rounded-md flex items-center justify-center transition-all active:scale-95 shadow-sm ${item.completed ? 'opacity-30 cursor-not-allowed' : 'hover:bg-gray-700'}`}
                                                    title="Disminuir"
                                                >
                                                    <MinusIcon className="w-3.5 h-3.5" />
                                                </button>
                                                <span className={`px-2 font-black text-[12px] leading-none min-w-[20px] text-center ${item.completed ? 'text-gray-500' : 'text-white'}`}>{item.quantity}</span>
                                                <button
                                                    disabled={item.completed}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleUpdateQuantity(item.id, 1);
                                                    }}
                                                    className={`w-6 h-6 bg-gray-800 text-amber-500 rounded-md flex items-center justify-center transition-all active:scale-95 shadow-sm ${item.completed ? 'opacity-30 cursor-not-allowed' : 'hover:bg-gray-700'}`}
                                                    title="Aumentar"
                                                >
                                                    <PlusIcon className="w-3.5 h-3.5" />
                                                </button>
                                            </div>

                                            <div className="flex items-center gap-1.5">
                                                {item.product.availableExtraIds && item.product.availableExtraIds.length > 0 && (
                                                    <button
                                                        disabled={item.completed}
                                                        onClick={() => !hasDraggedCart && setItemForExtras(item)}
                                                        className={`p-1.5 bg-gray-700/30 text-green-600 rounded-lg active:scale-90 border border-green-500/10 ${item.completed ? 'opacity-30 cursor-not-allowed' : ''}`}
                                                        title="Extras"
                                                    >
                                                        <PlusCircleIcon className="w-4 h-4" />
                                                    </button>
                                                )}
                                                <button
                                                    disabled={item.completed}
                                                    onClick={() => !hasDraggedCart && setEditingItem(item)}
                                                    className={`p-1.5 bg-gray-700/30 text-cyan-600 rounded-lg active:scale-90 border border-cyan-500/10 ${item.completed ? 'opacity-30 cursor-not-allowed' : ''}`}
                                                    title="Observaciones"
                                                >
                                                    <PencilIcon className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        !hasDraggedCart && handleRemoveItem(item.id);
                                                    }}
                                                    className="p-1.5 bg-red-600 text-white rounded-lg transition-colors border border-red-700 shadow-sm active:scale-90"
                                                    title="Borrar"
                                                >
                                                    <TrashIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="p-4 bg-gray-900 border-t border-gray-800 shrink-0 shadow-[0_-10px_30px_rgba(0,0,0,0.3)]">
                        {order.type === OrderType.Delivery && (
                            <div className="flex justify-between items-center mb-3 bg-gray-800/60 p-3 rounded-xl border border-gray-700">
                                <span className="text-xs font-black text-gray-300 uppercase tracking-widest italic">COSTO ENVÍO</span>
                                <div className="flex items-center gap-1">
                                    <span className="text-sm font-black text-amber-500">$</span>
                                    <input
                                        type="number"
                                        step="0.25"
                                        min="0"
                                        disabled={!currentUser || (!currentUser.allRoles.includes(UserRole.Admin) && !currentUser.allRoles.includes(UserRole.Cashier) && !currentUser.allRoles.includes(UserRole.SuperAdmin))}
                                        value={order.deliveryFee ?? 1}
                                        onFocus={(e) => e.target.select()}
                                        onChange={(e) => {
                                            const val = parseFloat(e.target.value);
                                            updateDeliveryFee(order.id, val < 0 ? 0 : val);
                                        }}
                                        className="w-20 bg-gray-900 border border-gray-600 p-2 text-right text-sm font-black text-white focus:ring-2 focus:ring-amber-500 rounded-lg outline-none disabled:opacity-50"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Promotions Breakdown */}
                        {appliedDiscounts.length > 0 && (
                            <div className="mb-3 border-b border-dashed border-gray-700 pb-2 space-y-1">
                                {appliedDiscounts.map((d, idx) => (
                                    <div key={idx} className="flex justify-between items-center px-1">
                                        <span className="text-[10px] font-black text-green-400 uppercase tracking-widest italic flex items-center gap-1">
                                            <TagIcon className="w-3 h-3" /> {d.description}
                                        </span>
                                        <span className="text-sm font-black text-green-400 italic tracking-tighter">- ${d.amount.toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {manualDiscount > 0 && (
                            <div className="flex justify-between items-baseline mb-1 px-1 text-cyan-500 italic">
                                <span className="text-[10px] font-black uppercase tracking-widest">CORTESÍA ADMIN</span>
                                <span className="text-sm font-black tracking-tighter">- ${manualDiscount.toFixed(2)}</span>
                            </div>
                        )}

                        {/* TOTAL ARRIBA */}
                        <div className="flex justify-between items-end mb-4 px-1">
                            <span className="text-xs font-black text-gray-500 uppercase tracking-[0.25em] italic">TOTAL A PAGAR</span>
                            <span className="text-3xl font-black text-amber-500 italic tracking-tighter leading-none">${(order.total - manualDiscount).toFixed(2)}</span>
                        </div>

                        {/* FILA DE BOTONES ABAJO */}
                        <div className="flex gap-2 items-stretch">
                            {/* BOTÓN NOTIFICAR (IZQUIERDA) */}
                            {order.type === OrderType.Delivery && (
                                <button
                                    disabled={!currentUser || (!currentUser.allRoles.includes(UserRole.Admin) && !currentUser.allRoles.includes(UserRole.Cashier) && !currentUser.allRoles.includes(UserRole.SuperAdmin)) || !!order.deliveryDriverId || order.deliveryStatus === 'delivered'}
                                    onClick={() => {
                                        import('../api').then(({ api }) => {
                                            api.notifyDelivery(order.id).then(() => showAddedFeedback('ALERTA ENVIADA'));
                                        });
                                    }}
                                    className={`flex-1 flex flex-col items-center justify-center p-2 rounded-2xl border transition-all active:scale-95 shadow-lg
                                        ${(!order.deliveryDriverId && order.deliveryStatus !== 'delivered')
                                            ? 'bg-yellow-600 border-yellow-500 text-white hover:bg-yellow-500'
                                            : 'bg-gray-800 border-gray-700 text-gray-500'} 
                                        disabled:opacity-40 disabled:scale-100 disabled:grayscale`}
                                >
                                    <BellIcon className="w-5 h-5 mb-0.5" />
                                    <span className="text-[9px] font-black uppercase tracking-tighter leading-none">Notificar</span>
                                </button>
                            )}

                            {/* BOTÓN COBRAR / VER TICKET (CENTRO) */}
                            {order.status === 'completed' ? (
                                <button
                                    onClick={() => {
                                        setCompletedOrderForTicket(order);
                                        setIsTicketVisible(true);
                                    }}
                                    className="flex-[3] h-14 bg-amber-600 hover:bg-amber-500 text-white font-black rounded-2xl shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 italic uppercase tracking-widest text-lg border-t border-white/10"
                                >
                                    <ReceiptIcon className="w-6 h-6" />
                                    <span>VER TICKET</span>
                                </button>
                            ) : (
                                <button
                                    onClick={() => setIsPaymentModalVisible(true)}
                                    disabled={!currentUser || (!currentUser.allRoles.includes(UserRole.Admin) && !currentUser.allRoles.includes(UserRole.Cashier) && !currentUser.allRoles.includes(UserRole.SuperAdmin)) || order.items.length === 0}
                                    className="flex-[3] h-14 bg-green-600 hover:bg-green-500 disabled:bg-gray-800 disabled:text-gray-600 text-white font-black rounded-2xl shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 italic uppercase tracking-widest text-lg border-t border-white/10"
                                >
                                    <CashRegisterIcon className="w-6 h-6" />
                                    <span>COBRAR</span>
                                </button>
                            )}

                            {/* BOTÓN NUEVO (DERECHA) */}
                            <button
                                onClick={onStartNewOrder}
                                className="w-14 h-14 bg-[#0DB6E0] rounded-2xl shadow-[0_8px_20px_rgba(13,182,224,0.3)] flex items-center justify-center text-gray-950 active:scale-90 transition-all border-4 border-gray-950 shrink-0"
                                title="Nueva Orden"
                            >
                                <PlusIcon className="w-8 h-8" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modales */}
            {
                productForMasaSelection && (
                    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[200] p-4">
                        <div className="bg-gray-900 w-full max-w-sm rounded-[40px] p-8 border border-gray-800 shadow-2xl">
                            <h3 className="text-xl font-black text-amber-500 mb-1 uppercase italic leading-none tracking-tight">{productForMasaSelection.name}</h3>
                            <p className="text-[10px] text-gray-500 mb-8 font-black uppercase tracking-[0.3em] italic">Seleccione la masa o harina</p>
                            <div className="grid grid-cols-2 gap-3 mb-8">
                                {meats.filter(m => m.type === 'masa').map(masa => (
                                    <button key={masa.id} onClick={() => handleAddItem(productForMasaSelection, undefined, masa)} className="p-4 bg-gray-800 rounded-[20px] font-black text-sm uppercase border border-gray-700 hover:bg-amber-600 hover:border-amber-400 hover:text-white active:scale-95 transition-all italic tracking-widest text-amber-100">
                                        {masa.name}
                                    </button>
                                ))}
                            </div>
                            <button onClick={() => setProductForMasaSelection(null)} className="w-full p-4 bg-gray-800 text-gray-500 font-black rounded-[20px] uppercase text-[10px] active:bg-gray-750 tracking-widest">CANCELAR</button>
                        </div>
                    </div>
                )
            }

            {
                productForMeatSelection && (
                    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[200] p-4">
                        <div className="bg-gray-900 w-full max-w-sm rounded-[40px] p-8 border border-gray-800 shadow-2xl">
                            <h3 className="text-xl font-black text-amber-500 mb-1 uppercase italic leading-none tracking-tight">{productForMeatSelection.name}</h3>
                            <p className="text-[10px] text-gray-500 mb-8 font-black uppercase tracking-[0.3em] italic">Seleccione la proteína</p>
                            <div className="grid grid-cols-2 gap-3">
                                {meats.filter(m => (m.isActive !== false) && (!m.type || m.type === 'meat') && (
                                    !productForMeatSelection.availableMeatIds ||
                                    productForMeatSelection.availableMeatIds.length === 0 ||
                                    productForMeatSelection.availableMeatIds.map(id => Number(id)).includes(Number(m.id))
                                )).map(meat => (
                                    <button key={meat.id} onClick={() => handleAddItem(productForMeatSelection, meat, pendingMasa || undefined)} className="p-4 bg-gray-800 rounded-[20px] font-black text-sm uppercase border border-gray-700 hover:bg-amber-600 hover:border-amber-400 hover:text-white active:scale-95 transition-all italic tracking-widest">
                                        {meat.name}
                                    </button>
                                ))}
                            </div>
                            <button onClick={() => { setProductForMeatSelection(null); setPendingMasa(null); }} className="w-full mt-6 p-4 bg-gray-800 text-gray-500 font-black rounded-[20px] uppercase text-[10px] active:bg-gray-750 tracking-widest">CANCELAR</button>
                        </div>
                    </div>
                )
            }

            {
                editingItem && (
                    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[200] p-4">
                        <div className="bg-gray-900 w-full max-w-sm rounded-[40px] p-8 border border-gray-800 shadow-2xl">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="bg-cyan-600 p-2 rounded-xl shadow-lg shadow-cyan-900/40">
                                    <PencilIcon className="w-6 h-6 text-white" />
                                </div>
                                <h3 className="text-xl font-black text-white mb-1 uppercase italic leading-none tracking-tighter">OBSERVACIONES</h3>
                            </div>
                            <p className="text-[10px] text-gray-500 mb-4 font-black uppercase tracking-widest italic truncate">{editingItem.product.name}</p>
                            <textarea
                                className="w-full h-36 p-5 bg-gray-800 border-2 border-gray-700 rounded-[24px] text-white font-black uppercase text-xs outline-none focus:border-cyan-500 mb-8 shadow-inner resize-none tracking-wider placeholder:text-gray-600"
                                placeholder="EJ: SIN CEBOLLA, BIEN COCIDO, SIN PICANTE..."
                                value={obsText}
                                onChange={(e) => setObsText(e.target.value.toUpperCase())}
                                id="obs-textarea"
                                autoFocus
                            />

                            {/* PREDICTIVE TAG CLOUD */}
                            <div className="mb-8">
                                <p className="text-[10px] text-gray-500 mb-3 font-black uppercase tracking-widest italic ml-1">Sugerencias Rápidas</p>
                                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-1 scrollbar-hide text-center">
                                    {observationTags.length > 0 ? (
                                        (() => {
                                            // Lógica predictiva: buscamos si lo que el usuario escribe coincide con alguna etiqueta
                                            // Tomamos la última palabra después de una coma para ser más precisos
                                            const parts = obsText.split(',');
                                            const lastPart = normalize(parts[parts.length - 1]);

                                            return observationTags.map(tag => {
                                                const normalizedTagName = normalize(tag.name);
                                                const isHighlighted = lastPart.length >= 2 && normalizedTagName.includes(lastPart);

                                                return (
                                                    <button
                                                        key={tag.id}
                                                        onClick={() => {
                                                            const currentVal = obsText.trim();
                                                            const newVal = currentVal ? `${currentVal}, ${tag.name}` : tag.name;
                                                            setObsText(newVal.toUpperCase());
                                                        }}
                                                        className={`px-3 py-1.5 rounded-full text-[10px] font-black transition-all active:scale-90 uppercase italic border-2 ${isHighlighted
                                                            ? 'bg-cyan-600 border-cyan-400 text-white shadow-[0_0_15px_rgba(8,145,178,0.4)] scale-105 z-10'
                                                            : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-cyan-400 hover:border-cyan-500/50'
                                                            }`}
                                                    >
                                                        {tag.label || tag.name}
                                                    </button>
                                                );
                                            });
                                        })()
                                    ) : (
                                        <p className="text-[9px] text-gray-700 italic font-bold ml-1 uppercase">No hay sugerencias configuradas</p>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <button onClick={() => setEditingItem(null)} className="p-4 bg-gray-800 text-gray-400 font-black rounded-2xl uppercase text-xs active:scale-95 tracking-widest">DESCARTAR</button>
                                <button
                                    onClick={() => handleSaveObservations(editingItem.id, obsText)}
                                    className="p-4 bg-cyan-600 text-white font-black rounded-2xl uppercase text-xs shadow-lg active:scale-95 transition-transform italic tracking-widest"
                                >
                                    GUARDAR
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {
                isPaymentModalVisible && (
                    <PaymentModal
                        orderTotal={order.total}
                        manualDiscount={manualDiscount}
                        onManualDiscountChange={setManualDiscount}
                        onClose={() => setIsPaymentModalVisible(false)}
                        onConfirmPayment={handleConfirmPayment}
                        waiters={waiters}
                        settings={companySettings}
                        orderType={order.type}
                    />
                )
            }

            {
                isTicketVisible && completedOrderForTicket && (
                    <ErrorBoundary name="TicketModal">
                        <TicketModal
                            order={completedOrderForTicket}
                            onClose={() => {
                                setIsTicketVisible(false);
                                onCompleteOrder(completedOrderForTicket.id, completedOrderForTicket.payments, completedOrderForTicket.changeGiven, manualDiscount, completedOrderForTicket.serviceCharge, completedOrderForTicket.cardCommission);
                                setMobileView('menu');
                            }}
                            onNewOrder={() => {
                                setIsTicketVisible(false);
                                onCompleteOrder(completedOrderForTicket.id, completedOrderForTicket.payments, completedOrderForTicket.changeGiven, manualDiscount, completedOrderForTicket.serviceCharge, completedOrderForTicket.cardCommission);
                                onStartNewOrder();
                            }}
                            companySettings={companySettings}
                            onUpdateCustomerEmail={onUpdateCustomerEmail}
                            branches={branches}
                        />
                    </ErrorBoundary>
                )
            }

            {
                itemForExtras && (
                    <ExtrasSelectionModal
                        item={itemForExtras}
                        onSave={(id, extras) => {
                            const newItems = order.items.map(i => {
                                if (i.id === id) {
                                    const extrasPrice = extras.reduce((sum, e) => sum + Number(e.price), 0);
                                    return { ...i, extras, total: (i.product.price + extrasPrice) * i.quantity };
                                }
                                return i;
                            });
                            updateOrder(order.id, newItems);
                            setItemForExtras(null);
                            showAddedFeedback('EXTRAS ACTUALIZADOS');
                        }}
                        onClose={() => setItemForExtras(null)}
                        productExtras={productExtras}
                    />
                )
            }

            <PinVerificationModal
                isOpen={isPinModalVisible}
                onClose={() => {
                    setIsPinModalVisible(false);
                    setItemToDelete(null);
                }}
                onSuccess={confirmRemoveItem}
                title="AUTORIZACIÓN DE BORRADO"
                message={`Se requiere PIN de Admin para eliminar ${itemToDelete?.product.name.toUpperCase()}`}
                requiredRole={UserRole.Admin}
            />
            {/* AI Modal */}
            {
                isAIModalVisible && (
                    <AIOrderParserModal
                        onClose={() => setIsAIModalVisible(false)}
                        onParse={async (text) => {
                            try {
                                // @ts-ignore
                                const result = await import('../api').then(m => m.api.aiParseOrder(text, order.branchId));

                                if (result.customerName || result.address) {
                                    // Call up to parent to update customer info? Or just show toast
                                    // For now, let's just toast
                                    showAddedFeedback(`CLIENTE: ${result.customerName}`);
                                }

                                if (result.items && Array.isArray(result.items)) {
                                    const newItemsFromAI: OrderItem[] = [];

                                    // We need to fetch the full product objects to use existing add logic or manual push
                                    // Since handleAddItem relies on existing state, let's just construct items manually and call updateOrder once

                                    const currentItems = [...order.items];

                                    result.items.forEach((aiItem: any) => {
                                        const product = products.find(p => p.id === aiItem.productId);
                                        if (!product) return;

                                        const meat = aiItem.meatId ? meats.find(m => m.id === aiItem.meatId) : undefined;
                                        const masa = aiItem.masaId ? meats.find(m => m.id === aiItem.masaId) : undefined;
                                        const extras = aiItem.extraIds ? productExtras.filter(e => aiItem.extraIds.includes(e.id)) : [];

                                        // Create Item
                                        const newItem: OrderItem = {
                                            id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                                            product,
                                            quantity: aiItem.quantity || 1,
                                            meat,
                                            masa,
                                            extras,
                                            // Calculate total
                                            total: (product.price + extras.reduce((sum, e) => sum + Number(e.price), 0)) * (aiItem.quantity || 1),
                                            observations: aiItem.note ? aiItem.note.toUpperCase() : undefined,
                                            completed: false
                                        };
                                        newItemsFromAI.push(newItem);
                                    });

                                    updateOrder(order.id, [...newItemsFromAI, ...currentItems]);
                                    setIsAIModalVisible(false);
                                    showAddedFeedback(`✅ ${newItemsFromAI.length} ITEMS AÑADIDOS`);
                                }
                            } catch (e: any) {
                                console.error(e);
                                alert('ERROR IA: ' + e.message);
                            }
                        }}
                    />
                )
            }
            {comboProductToConfigure && (
                <ComboSelectionModal
                    combo={comboProductToConfigure}
                    categories={categories}
                    products={products}
                    meats={meats.filter(m => !m.type || m.type === 'meat')}
                    masas={meats.filter(m => m.type === 'masa')}
                    onClose={() => setComboProductToConfigure(null)}
                    onConfirm={handleConfirmCombo}
                />
            )}
            {comboForPreview && (
                <ComboPreviewModal
                    combo={comboForPreview}
                    products={products}
                    onClose={() => setComboForPreview(null)}
                />
            )}
        </div >
    );
};

// --- SUBSIDIARY COMPONENTS ---

const ExtrasSelectionModal: React.FC<{ item: OrderItem, onSave: (itemId: string, extras: ProductExtra[]) => void, onClose: () => void, productExtras: ProductExtra[] }> = ({ item, onSave, onClose, productExtras }) => {
    const availableExtras = productExtras.filter(extra => item.product.availableExtraIds?.includes(extra.id));
    const [selectedExtras, setSelectedExtras] = useState<ProductExtra[]>(item.extras || []);

    const toggleExtra = (extra: ProductExtra) => {
        setSelectedExtras(prev => prev.some(e => e.id === extra.id) ? prev.filter(e => e.id !== extra.id) : [...prev, extra]);
    };

    return (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[210] p-4">
            <div className="bg-gray-900 w-full max-w-sm rounded-[40px] p-8 border border-gray-800 shadow-2xl flex flex-col max-h-[85vh]">
                <div className="flex items-center gap-3 mb-6 shrink-0">
                    <div className="bg-green-600 p-2 rounded-xl shadow-lg shadow-green-900/40">
                        <PlusCircleIcon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl font-black text-amber-500 uppercase italic leading-none tracking-tighter">VINCULAR EXTRAS</h3>
                </div>
                <p className="text-[10px] text-gray-500 mb-6 uppercase font-black tracking-widest italic truncate shrink-0">{item.product.name}</p>
                <div className="space-y-2 overflow-y-auto mb-8 pr-1 scrollbar-hide flex-1">
                    {availableExtras.map(extra => {
                        const isSelected = selectedExtras.some(e => e.id === extra.id);
                        return (
                            <button key={extra.id} onClick={() => toggleExtra(extra)} className={`w-full flex justify-between items-center py-[9.5px] px-5 rounded-[22px] border-2 transition-all active:scale-[0.98] ${isSelected ? 'bg-amber-500 text-white border-amber-400 shadow-lg' : 'bg-gray-800 text-gray-100 border-gray-700 hover:border-gray-500'}`}>
                                <span className="font-black text-[13px] uppercase italic tracking-widest">{extra.name}</span>
                                <span className="font-black text-base italic tracking-tighter">${Number(extra.price).toFixed(2)}</span>
                            </button>
                        );
                    })}
                    {availableExtras.length === 0 && (
                        <div className="text-center py-12 opacity-30">
                            <PlusCircleIcon className="w-16 h-16 mx-auto mb-4 text-gray-500" />
                            <p className="font-black uppercase italic text-xs tracking-widest">Sin extras permitidos</p>
                        </div>
                    )}
                </div>
                <div className="grid grid-cols-2 gap-4 mt-auto shrink-0">
                    <button onClick={onClose} className="p-4 bg-gray-800 text-gray-400 font-black rounded-[20px] uppercase text-[12px] active:scale-95 tracking-widest">CERRAR</button>
                    <button onClick={() => onSave(item.id, selectedExtras)} className="p-4 bg-green-600 text-white font-black rounded-[20px] uppercase text-[12px] shadow-lg active:scale-95 transition-transform italic tracking-widest">CONFIRMAR</button>
                </div>
            </div>
        </div>
    );
};

const ComboPreviewModal: React.FC<{ combo: Product, products: Product[], onClose: () => void }> = ({ combo, products, onClose }) => {
    let comboDef = combo.comboDefinition;
    if (typeof comboDef === 'string') {
        try { comboDef = JSON.parse(comboDef); } catch (e) { comboDef = null; }
    }

    const isFixed = !comboDef || (comboDef as any).type === 'fixed' || !(comboDef as any).type;

    return (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[210] p-4">
            <div className="bg-gray-900 w-full max-w-sm rounded-[40px] p-8 border border-gray-800 shadow-2xl flex flex-col">
                <div className="flex items-center gap-3 mb-6 shrink-0">
                    <div className="bg-purple-600 p-2 rounded-xl shadow-lg shadow-purple-900/40">
                        <InfoIcon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl font-black text-white uppercase italic leading-none tracking-tighter truncate">{combo.name}</h3>
                </div>

                <div className="space-y-3 mb-8 max-h-[50vh] overflow-y-auto pr-1 scrollbar-hide">
                    {isFixed ? (
                        ((comboDef as any)?.items || []).map((item: any, idx: number) => {
                            const p = products.find(prod => prod.id === item.productId);
                            return (
                                <div key={idx} className="flex justify-between items-center p-4 bg-gray-800/50 rounded-2xl border border-gray-700/50">
                                    <span className="text-white font-black text-[10px] uppercase italic tracking-widest truncate flex-1 pr-2">{p?.name || 'Item'}</span>
                                    <span className="bg-gray-950/40 text-purple-400 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border border-gray-800/50">x{item.qty}</span>
                                </div>
                            );
                        })
                    ) : (
                        <p className="text-center py-8 text-gray-500 font-bold uppercase italic text-xs tracking-widest leading-loose">
                            Este es un combo <span className="text-purple-400">DINÁMICO</span>.<br />Eliges los productos al agregarlo.
                        </p>
                    )}
                    {isFixed && (!((comboDef as any)?.items) || (comboDef as any).items.length === 0) && (
                        <p className="text-center py-8 text-gray-700 font-bold uppercase italic text-[10px] tracking-[0.2em]">Sin productos detallados</p>
                    )}
                </div>

                <button onClick={onClose} className="w-full p-5 bg-gray-800 text-white font-black rounded-[24px] uppercase text-xs active:scale-95 transition-transform italic tracking-[0.2em] shadow-lg">ENTENDIDO</button>
            </div>
        </div>
    );
};

export default OrderScreen;
