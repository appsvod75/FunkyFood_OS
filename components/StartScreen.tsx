
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { OrderType, Waiter, Table, TableArea, OrderDetails, Customer, Address, Order, UserRole, Product, Meat, ProductExtra, Branch } from '../types';
import { UserIcon, TableIcon, PlusIcon, UserGroupIcon, CheckCircleIcon, MapIcon, RobotIcon, SearchIcon, ReceiptIcon, TrashIcon, ClockIcon } from './icons';
import { useDragScroll } from '../hooks/useDragScroll';
import TicketModal from './TicketModal';
import PinVerificationModal from './PinVerificationModal';

import { api } from '../api';
import AIOrderParserModal from './AIOrderParserModal'; // Import Shared Component
import toast from 'react-hot-toast';

interface StartScreenProps {
    onStartOrder: (details: OrderDetails) => void;
    activeOrders: Order[];
    onSelectOrder: (orderId: string) => void;
    onShowCompleted: () => void;
    onShowActive: () => void;
    onManageCustomers: () => void;
    waiters: Waiter[];
    tables: Table[];
    tableAreas: TableArea[];
    customers: Customer[];
    setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
    orderToEdit?: Order | null;
    onUpdateOrder?: (details: OrderDetails) => void;
    onCancelEdit?: () => void;
    onDeleteOrder: (orderId: string, adminUserId: number, reason: string) => Promise<void>;

    onCreateCustomer: (customer: Customer) => Promise<Customer>;
    // AI Parser Props
    products?: Product[];
    meats?: Meat[];
    productExtras?: ProductExtra[];
    branches: Branch[];
    currentBranchId: number | null;
    initialIsCreating?: boolean;
    companySettings?: any;
    onUpdateCustomerEmail?: (customerId: number, email: string) => void;
    isCashOpeningMissing?: boolean;
    isAdmin?: boolean;
    redigitationMode?: { cashReportId: number; date: string; branchId: number } | null;
    onExitRedigitation?: () => void;
    showRedigitatedOrders?: boolean;
    onToggleRedigitatedOrders?: () => void;
    redigitatedActiveOrdersCount?: number;
}

const formatPhone = (phone: string | null | undefined) => {
    if (!phone) return '';
    const clean = phone.replace(/\D/g, '');
    if (clean.length === 8) {
        return `${clean.slice(0, 4)}-${clean.slice(4)}`;
    }
    return phone;
};

const normalize = (str: any) => {
    if (str === null || str === undefined) return '';
    return String(str).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
};

interface StepProps {
    title: string;
    stepNumber: number;
    value?: string | null;
    openStep: number;
    setOpenStep: (n: number) => void;
    children: React.ReactNode;
}

const Step: React.FC<StepProps> = ({ title, stepNumber, value, openStep, setOpenStep, children }) => {
    const isOpen = openStep === stepNumber;
    return (
        <div className={`bg-gray-900 rounded-3xl transition-all border ${isOpen ? 'border-amber-500/50 overflow-visible' : 'border-gray-800 overflow-hidden'}`}>
            <button
                onClick={() => setOpenStep(isOpen ? 0 : stepNumber)}
                className="w-full p-4 flex justify-between items-center active:bg-gray-800/50"
            >
                <span className="text-xs font-black text-gray-400 tracking-widest uppercase">{title}</span>
                {value && !isOpen && (
                    <div className="flex items-center gap-1.5 bg-green-600 text-white px-3 py-1 rounded-full border border-green-700 shadow-md">
                        <CheckCircleIcon className="w-3 h-3" />
                        <span className="text-[10px] font-black uppercase truncate max-w-[150px]">{value}</span>
                    </div>
                )}
            </button>
            {isOpen && <div className="p-4 pt-0">{children}</div>}
        </div>
    );
};

const AddCustomerModal: React.FC<{ initialName: string, initialPhone?: string, initialAddress?: string, initialEmail?: string, onClose: () => void, onSave: (c: Customer) => void, isSaving?: boolean }> = ({ initialName, initialPhone, initialAddress, initialEmail, onClose, onSave, isSaving }) => {
    const [name, setName] = useState(initialName.toUpperCase());
    const [phone, setPhone] = useState(initialPhone || '');
    const [address, setAddress] = useState(initialAddress || '');
    const [email, setEmail] = useState(initialEmail || '');
    const [birthDate, setBirthDate] = useState('');
    const [error, setError] = useState('');

    const handleSave = () => {
        let cleanPhone = phone.replace(/\D/g, '');

        if (cleanPhone === '') {
            cleanPhone = '00000000';
        } else if (cleanPhone.length !== 8) {
            setError('EL TELÉFONO DEBE TENER 8 DÍGITOS');
            return;
        }
        if (!name.trim()) {
            setError('EL NOMBRE ES OBLIGATORIO');
            return;
        }

        const newCustomer: Customer = {
            id: 0,
            name: name.trim().toUpperCase(),
            phone: cleanPhone,
            email: email.trim().toLowerCase() || undefined,
            birthDate: (birthDate && birthDate.trim() !== '') ? birthDate : undefined,
            addresses: address.trim() ? [{
                id: `temp-${Date.now()}`,
                street: address.trim().toUpperCase(),
                city: 'SAN SALVADOR',
                details: 'Registrada al crear cliente'
            } as any] : []
        };
        onSave(newCustomer);
    };

    const portalRoot = document.getElementById('portal-root');
    if (!portalRoot) return null;

    return createPortal(
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4">
            <div className="bg-gray-900 w-full max-w-md rounded-[32px] p-6 border border-gray-800 shadow-2xl">
                <div className="flex items-center gap-3 mb-6">
                    <div className="bg-amber-500 p-2 rounded-xl">
                        <UserGroupIcon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">NUEVO CLIENTE</h3>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Nombre Completo</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => { setName(e.target.value); setError(''); }}
                            className="w-full p-4 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white font-black uppercase outline-none focus:border-amber-500"
                            placeholder="EJ: PEDRO MARTINEZ"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Teléfono (8 Dígitos)</label>
                        <input
                            type="tel"
                            maxLength={8}
                            value={phone}
                            onChange={(e) => { setPhone(e.target.value); setError(''); }}
                            className="w-full p-4 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white font-black text-xl text-center outline-none focus:border-amber-500"
                            placeholder="00000000"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Dirección (Opcional)</label>
                        <input
                            type="text"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            className="w-full p-4 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white font-black uppercase outline-none focus:border-amber-500"
                            placeholder="EJ: COL. ESCALON #123"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Email (Opcional)</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full p-4 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white font-black outline-none focus:border-amber-500"
                            placeholder="EJ: CLIENTE@CORREO.COM"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">CUMPLEAÑOS (Opcional)</label>
                        <input
                            type="date"
                            value={birthDate}
                            onChange={(e) => setBirthDate(e.target.value)}
                            className="w-full p-4 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white font-black uppercase outline-none focus:border-amber-500 calendar-picker-indicator-white"
                        />
                    </div>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/50 p-3 rounded-xl">
                            <p className="text-red-500 text-[10px] font-black text-center uppercase">{error}</p>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3 pt-2">
                        <button onClick={onClose} className="p-4 bg-gray-800 text-gray-400 font-black rounded-2xl uppercase text-xs">CERRAR</button>
                        <button onClick={handleSave} className="p-4 bg-green-600 text-white font-black rounded-2xl uppercase text-xs shadow-lg active:scale-95 transition-transform">GUARDAR</button>
                    </div>
                </div>
            </div>
        </div>,
        portalRoot
    );
};

const AddAddressModal: React.FC<{ onClose: () => void, onSave: (street: string, details: string, lat?: number, lng?: number) => void }> = ({ onClose, onSave }) => {
    const [street, setStreet] = useState('');
    const [details, setDetails] = useState('');
    const [lat, setLat] = useState<number | undefined>(undefined);
    const [lng, setLng] = useState<number | undefined>(undefined);

    const handleSave = () => {
        if (!street.trim()) return;
        onSave(street, details, lat, lng);
    };

    const handleGetLocation = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((position) => {
                setLat(position.coords.latitude);
                setLng(position.coords.longitude);
                setDetails(prev => (prev ? prev + ' ' : '') + '[UBICACIÓN GPS]');
            }, (error) => {
                console.error("GPS Error", error);
            });
        }
    }

    const portalRoot = document.getElementById('portal-root');
    if (!portalRoot) return null;

    return createPortal(
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4">
            <div className="bg-gray-900 w-full max-w-md rounded-[32px] p-6 border border-gray-800 shadow-2xl">
                <div className="flex items-center gap-3 mb-6">
                    <div className="bg-amber-500 p-2 rounded-xl">
                        <MapIcon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">NUEVA DIRECCIÓN</h3>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Calle / Avenida / Colonia</label>
                        <input
                            type="text"
                            value={street}
                            onChange={(e) => setStreet(e.target.value)}
                            className="w-full p-4 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white font-black uppercase outline-none focus:border-amber-500"
                            placeholder="EJ: COL. ESCALÓN, FINAL CALLE PPAL"
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Detalles / Referencia</label>
                        <textarea
                            value={details}
                            onChange={(e) => setDetails(e.target.value)}
                            className="w-full p-4 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white font-bold uppercase outline-none focus:border-amber-500 h-24 resize-none"
                            placeholder="EJ: CASA BLANCA PORTÓN NEGRO..."
                        />
                    </div>

                    <button
                        onClick={handleGetLocation}
                        type="button"
                        className="w-full py-3 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 font-bold rounded-xl border border-blue-500/20 flex items-center justify-center gap-2 transition-colors"
                    >
                        <MapIcon className="w-4 h-4" />
                        {lat ? 'UBICACIÓN GUARDADA' : 'USAR MI UBICACIÓN ACTUAL'}
                    </button>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                        <button onClick={onClose} className="p-4 bg-gray-800 text-gray-400 font-black rounded-2xl uppercase text-xs">CANCELAR</button>
                        <button onClick={handleSave} className="p-4 bg-green-600 text-white font-black rounded-2xl uppercase text-xs shadow-lg active:scale-95 transition-transform">GUARDAR</button>
                    </div>
                </div>
            </div>
        </div>,
        portalRoot
    );
};



const StartScreen: React.FC<StartScreenProps> = ({
    onStartOrder,
    activeOrders,
    onSelectOrder,
    onShowCompleted,
    onShowActive,
    onManageCustomers,
    waiters,
    tables,
    tableAreas = [],
    customers = [],
    setCustomers,
    orderToEdit,
    onUpdateOrder,
    onCancelEdit,
    onDeleteOrder,
    onCreateCustomer,
    products = [],
    meats = [],
    productExtras = [],
    branches,
    currentBranchId,
    initialIsCreating = false,
    companySettings,
    onUpdateCustomerEmail,
    isCashOpeningMissing = false,
    isAdmin = false,
    redigitationMode,
    onExitRedigitation,
    showRedigitatedOrders = false,
    onToggleRedigitatedOrders,
    redigitatedActiveOrdersCount = 0
}) => {
    const isEditing = !!orderToEdit;
    const [orderType, setOrderType] = useState<OrderType | null>(null);
    const [waiter, setWaiter] = useState<Waiter | null>(null);
    const [table, setTable] = useState<Table | null>(null);
    const [openStep, setOpenStep] = useState(1);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
    const [selectedAreaId, setSelectedAreaId] = useState<number | null>(null);
    const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState(false);
    const [isAddAddressModalOpen, setIsAddAddressModalOpen] = useState(false);
    const [isSavingCustomer, setIsSavingCustomer] = useState(false);
    const [pendingAIResult, setPendingAIResult] = useState<any | null>(null); // To store AI result while creating customer // Valid loading state
    const [notification, setNotification] = useState<{ title: string; message: string } | null>(null);
    const [isAIModalVisible, setIsAIModalVisible] = useState(false); // AI Modal State
    const [isCreating, setIsCreating] = useState(initialIsCreating); // Toggle between List and New Order Wizard
    const [listSearchQuery, setListSearchQuery] = useState('');
    const [selectedOrderForTicket, setSelectedOrderForTicket] = useState<Order | null>(null);
    const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);
    const dragScroll = useDragScroll();
    const customerScrollRef = useDragScroll();

    useEffect(() => {
        setIsCreating(initialIsCreating);
    }, [initialIsCreating]);

    const showNotification = (title: string, message: string) => {
        setNotification({ title, message });
        setTimeout(() => setNotification(null), 3000); // Hide after 3s
    };

    const lastOrderIdRef = useRef<string | null>(null);

    useEffect(() => {
        if (isEditing && orderToEdit) {
            // Solo inicializamos si es una orden distinta a la que ya tenemos cargada
            if (lastOrderIdRef.current !== orderToEdit.id) {
                setOrderType(orderToEdit.type);
                setWaiter(orderToEdit.waiter || null);
                setTable(orderToEdit.table || null);
                setSelectedCustomer(orderToEdit.customer || null);
                if (orderToEdit.customer) setSearchQuery(orderToEdit.customer.name.toUpperCase());
                setSelectedAddress(orderToEdit.deliveryAddress || null);
                setOpenStep(0);
                lastOrderIdRef.current = orderToEdit.id;
            }
        } else if (!isEditing) {
            lastOrderIdRef.current = null;
        }
    }, [isEditing, orderToEdit]);

    const handleConfirm = () => {
        if (!orderType) return;
        const details: OrderDetails = {
            type: orderType,
            waiter: waiter ?? undefined,
            table: table ?? undefined,
            customer: selectedCustomer ?? undefined,
            deliveryAddress: selectedAddress ?? undefined,
            // Explicitly pass IDs to avoid undefined issues in strict backends
            waiterId: waiter ? waiter.id : undefined,
            tableId: table ? table.id : undefined,
            customerId: selectedCustomer ? selectedCustomer.id : undefined,
            deliveryDriverId: undefined // Not selected here
        };
        if (isEditing && onUpdateOrder) onUpdateOrder(details);
        else onStartOrder(details);
    };


    const filteredCustomers = useMemo(() => {
        const safeSearchQuery = normalize(searchQuery);
        if (!safeSearchQuery) return [];

        if (!Array.isArray(customers)) return [];

        // BUSQUEDA INTELIGENTE: Si hay letras, asumimos búsqueda por NOMBRE.
        // Solo buscamos por TELÉFONO si la búsqueda es puramente numérica.
        const hasLetters = /[a-z]/i.test(searchQuery);
        const searchDigits = safeSearchQuery.replace(/\D/g, '');

        try {
            return customers.filter(c => {
                if (!c || typeof c !== 'object') return false;
                // Only active customers can be assigned to new orders
                if (c.isActive === false) return false;
                const customerName = normalize(c.name);
                const nameMatch = customerName.includes(safeSearchQuery);

                let phoneMatch = false;
                if (!hasLetters && searchDigits.length > 0) {
                    const customerDigits = String(c.phone || '').replace(/\D/g, '');
                    phoneMatch = customerDigits.includes(searchDigits);
                }

                return nameMatch || phoneMatch;
            }).slice(0, 30);
        } catch (error) {
            console.error("Critical Error filtering customers:", error);
            return [];
        }
    }, [searchQuery, customers]);

    const handleAIParse = async (text: string) => {
        try {
            const result = await api.aiParseOrder(text, currentBranchId || 1);

            // 1. Resolve Items First
            const parsedItems: any[] = [];
            if (result.items && Array.isArray(result.items)) {
                result.items.forEach((aiItem: any) => {
                    const product = products.find(p => p.id === aiItem.productId);
                    if (product) {
                        const meat = aiItem.meatId ? meats.find(m => m.id === aiItem.meatId) : undefined;
                        const masa = aiItem.masaId ? meats.find(m => m.id === aiItem.masaId) : undefined;
                        const extras = aiItem.extraIds ? productExtras.filter(e => aiItem.extraIds.includes(e.id)) : [];

                        parsedItems.push({
                            id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                            product,
                            quantity: aiItem.quantity || 1,
                            meat,
                            masa,
                            extras,
                            total: (product.price + extras.reduce((sum, e) => sum + Number(e.price), 0)) * (aiItem.quantity || 1),
                            observations: aiItem.note ? aiItem.note.toUpperCase() : undefined,
                            completed: false
                        });
                    }
                });
            }

            // 2. Determine Type First
            let type = OrderType.Delivery;
            const lowerText = text.toLowerCase();
            const pickupKeywords = [
                'llegare', 'llegaré', 'llegaran', 'llegarán', 'paso por', 'pasaré',
                'recoger', 'recogere', 'recogeré', 'retiro', 'retira', 'cliente retira', 'llego por',
                'retirare', 'retiraré', 'paso a traer', 'paso a recoger'
            ];

            if (pickupKeywords.some(k => lowerText.includes(k))) {
                type = OrderType.Pickup;
            }

            // 3. Resolve Customer
            let customer: Customer | undefined;
            const aiName = result.customerName ? result.customerName.toUpperCase() : '';
            const aiPhone = result.customerPhone ? result.customerPhone.replace(/\D/g, '') : '';
            const aiEmail = result.customerEmail || '';

            if (aiName || aiPhone) {
                let existing = customers.find(c => {
                    if (c.isActive === false) return false;
                    const cName = normalize(c.name);
                    const cPhone = c.phone ? c.phone.replace(/\D/g, '') : '';
                    const nameMatch = aiName && cName.includes(normalize(aiName));
                    const phoneMatch = aiPhone && cPhone.includes(aiPhone);
                    return nameMatch || phoneMatch;
                });

                if (!existing && aiName) {
                    try {
                        const apiMatches: Customer[] = await api.searchCustomers(aiName);
                        if (apiMatches && apiMatches.length > 0) existing = apiMatches[0];
                    } catch (err) {
                        console.warn("[AI] API Search failed", err);
                    }
                }

                if (existing) {
                    customer = existing;
                    showNotification('CLIENTE ENCONTRADO', `${existing.name}`);
                } else if (aiName) {
                    setSearchQuery(aiName);
                    setPendingAIResult({
                        customerName: aiName,
                        customerPhone: aiPhone,
                        customerEmail: aiEmail,
                        items: parsedItems,
                        type,
                        address: result.address
                    });
                    setIsAIModalVisible(false);
                    setIsAddCustomerModalOpen(true);
                    showNotification('NUEVO CLIENTE DETECTADO', 'Confirme los datos para continuar');
                    return;
                }
            }

            // 4. Resolve Address
            let address: Address | undefined;
            if (type === OrderType.Delivery && customer) {
                if (result.address) {
                    const searchAddr = result.address.toLowerCase();
                    const match = customer.addresses.find(a =>
                        a.street.toLowerCase().includes(searchAddr) ||
                        searchAddr.includes(a.street.toLowerCase())
                    );

                    if (match) {
                        address = match;
                    } else {
                        const newAddr: Address = {
                            id: `addr-${Date.now()}`,
                            customerId: customer.id,
                            street: result.address,
                            city: 'San Salvador',
                            details: 'Detectada por IA'
                        };
                        try {
                            const updatedAddresses = [...(customer.addresses || []), newAddr];
                            customer = { ...customer, addresses: updatedAddresses };
                            address = newAddr;
                            api.updateCustomer(customer.id, { addresses: updatedAddresses })
                                .catch(e => console.error("Failed to auto-save address", e));
                        } catch (e) {
                            console.error("Address auto-add logic error", e);
                        }
                    }
                } else if (customer && customer.addresses.length > 0) {
                    address = customer.addresses[0];
                }
            }

            if (!customer) {
                setOrderType(type);
                setOpenStep(4);
                setIsAIModalVisible(false);
                setIsCreating(true);
            } else {
                onStartOrder({
                    type,
                    customer,
                    deliveryAddress: address,
                    initialItems: parsedItems
                });
                setIsAIModalVisible(false);
            }
        } catch (e: any) {
            console.error(e);
            showNotification('ERROR IA', e.message);
        }
    };

    const handleSelectCustomer = (c: Customer) => {
        setSelectedCustomer(c);
        setSearchQuery(c.name);
        if (c.addresses && c.addresses.length > 0) setSelectedAddress(c.addresses[0]);
    };

    const needsWaiter = orderType === OrderType.Restaurant || orderType === OrderType.Takeaway;
    const needsTable = orderType === OrderType.Restaurant;

    const hasActiveOrders = activeOrders.filter(o => o.status === 'active').length > 0;

    // Payment banner logic
    const graceDays = companySettings?.paymentGraceDays ?? 3;
    const paymentInfo = useMemo(() => {
        const dayStr = companySettings?.paymentDueDate;
        const isPending = companySettings?.paymentPending;
        if (!dayStr || !isPending) return null;

        const d = parseInt(dayStr, 10);
        if (isNaN(d) || d < 1 || d > 31) return null;

        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const year = now.getFullYear();
        const month = now.getMonth();

        const daysInThisMonth = new Date(year, month + 1, 0).getDate();
        const thisDue = new Date(year, month, Math.min(d, daysInThisMonth));

        let lastDue;
        if (now >= thisDue) {
            lastDue = thisDue;
        } else {
            const prevMonth = month === 0 ? 11 : month - 1;
            const prevYear = month === 0 ? year - 1 : year;
            const daysInPrev = new Date(prevYear, prevMonth + 1, 0).getDate();
            lastDue = new Date(prevYear, prevMonth, Math.min(d, daysInPrev));
        }

        if (now <= lastDue) return null;

        const diffTime = now.getTime() - lastDue.getTime();
        const overdueDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        const isBlocked = overdueDays > graceDays;

        return { overdueDays, isBlocked };
    }, [companySettings?.paymentDueDate, companySettings?.paymentPending, graceDays]);

    // Grouping logic for Unified List
    const groupedOrders = useMemo(() => {
        const groups: Record<string, Order[]> = {
            'RESTAURANTE': [],
            'PARA LLEVAR': [],
            'DELIVERY': [],
            'CLIENTE RETIRA': []
        };

        activeOrders.forEach(order => {
            if (order.type === OrderType.Restaurant || order.type === OrderType.Takeaway) {
                groups['RESTAURANTE'].push(order);
            } else if (order.type === OrderType.Delivery) {
                groups['DELIVERY'].push(order);
            } else if (order.type === OrderType.Pickup) {
                groups['CLIENTE RETIRA'].push(order);
            }
        });

        // Filter out empty groups
        return Object.entries(groups).filter(([_, list]) => list.length > 0);
    }, [activeOrders]);


    return (
        <>
            {(!isCreating && !isEditing) ? (
                <div
                    ref={dragScroll.ref}
                    onMouseDown={dragScroll.onMouseDown}
                    onMouseMove={dragScroll.onMouseMove}
                    onMouseUp={dragScroll.onMouseUp}
                    onMouseLeave={dragScroll.onMouseLeave}
                    className="h-screen overflow-y-auto scrollbar-hide select-none relative"
                >
                    <div className="w-full max-w-[1920px] mx-auto space-y-6 pb-32 px-4">
                        <header className="sticky top-0 z-30 bg-[#0a0a0b] p-4 lg:p-8 -mx-4 lg:-mx-8 mb-2 flex flex-col gap-4 border-b border-white/5">
                            <div className="flex items-center justify-between">
                                <h1 className="text-2xl font-black text-white italic uppercase tracking-tighter shrink-0">
                                    {showRedigitatedOrders ? (
                                        <>REDIGITADAS <span className="text-amber-500">ANTERIORES</span></>
                                    ) : (
                                        <>PEDIDOS <span className="text-amber-500">DE HOY</span></>
                                    )}
                                </h1>
                                <div className="flex gap-2">
                                    <button
                                        onClick={onShowCompleted}
                                        className="p-2 bg-gray-800 rounded-xl text-amber-500 hover:bg-amber-500/10 active:scale-90 transition-all border border-gray-700"
                                        title="Ver pedidos pagados de hoy"
                                    >
                                        <ClockIcon className="w-6 h-6" />
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (isCashOpeningMissing) {
                                                toast.error('SE REQUIERE APERTURA DE CAJA POR PARTE DEL ADMINISTRADOR', {
                                                    duration: 5000,
                                                    icon: '⚠️',
                                                });
                                                return;
                                            }
                                            setIsAIModalVisible(true);
                                        }}
                                        className="p-2 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl text-white active:scale-90 transition-all shadow-lg border border-white/10"
                                    >
                                        <RobotIcon className="w-6 h-6" />
                                    </button>
                                    <button onClick={onManageCustomers} className="p-2 bg-gray-800 rounded-xl text-gray-400 active:scale-90 transition-transform">
                                        <UserGroupIcon className="w-6 h-6" />
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="relative group flex-1">
                                    <input
                                        type="text"
                                        placeholder="BUSCAR PEDIDO, CLIENTE, MESA..."
                                        value={listSearchQuery}
                                        onChange={(e) => setListSearchQuery(e.target.value)}
                                        className="w-full bg-gray-900 border border-gray-700 text-white px-4 py-3 rounded-2xl focus:border-amber-500 focus:outline-none text-sm font-bold uppercase pl-11 pr-10 shadow-inner group-hover:border-gray-600 transition-colors"
                                    />
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                    </div>
                                    {listSearchQuery && (
                                    <button
                                        onClick={() => setListSearchQuery('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-full transition-all active:scale-90"
                                        title="Limpiar búsqueda"
                                    >
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                            {redigitationMode ? (
                                <div className="flex items-center gap-2 bg-red-600/20 border border-red-500/40 rounded-xl px-3 py-2 shrink-0">
                                    <span className="text-red-500 text-xs">🔴</span>
                                    <span className="text-[9px] font-black text-red-400 uppercase tracking-widest whitespace-nowrap">
                                        REDIGITANDO {redigitationMode.date}
                                    </span>
                                    <button
                                        onClick={onExitRedigitation}
                                        className="text-[8px] font-black text-red-400 hover:text-white uppercase tracking-widest ml-1 bg-red-500/20 hover:bg-red-500/40 px-2 py-0.5 rounded-lg transition-colors"
                                    >
                                        SALIR
                                    </button>
                                </div>
                            ) : isAdmin && redigitatedActiveOrdersCount > 0 ? (
                                <button
                                    onClick={onToggleRedigitatedOrders}
                                    className={`flex items-center gap-1.5 shrink-0 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all active:scale-90 border ${
                                        showRedigitatedOrders
                                            ? 'bg-amber-500/20 border-amber-400/60 text-amber-300 hover:bg-amber-500/30'
                                            : 'bg-orange-600/20 border-orange-500/40 text-orange-400 hover:bg-orange-600/30'
                                    }`}
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                    </svg>
                                    {showRedigitatedOrders ? 'VER HOY' : `VER REDIGITADAS (${redigitatedActiveOrdersCount})`}
                                </button>
                            ) : null}
                            </div>
                            {paymentInfo && (
                                <div className={`-mx-4 lg:-mx-8 px-4 lg:px-8 py-2.5 ${paymentInfo.isBlocked ? 'bg-red-600/20 border-t border-red-500/30' : 'bg-amber-600/20 border-t border-amber-500/30'}`}>
                                    <div className="flex items-center gap-2">
                                        <div className={`w-1.5 h-1.5 rounded-full animate-pulse shrink-0 ${paymentInfo.isBlocked ? 'bg-red-500' : 'bg-amber-500'}`} />
                                        <p className={`font-black text-[10px] uppercase tracking-wider ${paymentInfo.isBlocked ? 'text-red-400' : 'text-amber-400'}`}>
                                            {paymentInfo.isBlocked
                                                ? `🚫 CREACIÓN DE ÓRDENES DESACTIVADA POR FALTA DE PAGO (${paymentInfo.overdueDays} DÍAS DE MORA)`
                                                : `⚠️ USO DE APLICACIÓN CON ${paymentInfo.overdueDays} DÍA${paymentInfo.overdueDays !== 1 ? 'S' : ''} DE MORA. POR FAVOR EFECTÚA EL PAGO.`}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </header>

                        <div className="p-4 lg:p-8 pt-0 lg:pt-0 space-y-6">

                            {(() => {
                                const filteredList = activeOrders.filter(order => {
                                    if (!listSearchQuery) return true;
                                    const term = normalize(listSearchQuery);
                                    const orderId = String(order.dailyOrderNumber).padStart(3, '0');
                                    const customer = normalize(order.customer?.name || '');
                                    const table = normalize(order.table?.name || '');
                                    const waiter = normalize(order.waiter?.name || '');
                                    return orderId.includes(term) || customer.includes(term) || table.includes(term) || waiter.includes(term);
                                });

                                const groups = [
                                    { name: 'RESTAURANTE', list: filteredList.filter(o => o.type === OrderType.Restaurant), color: 'blue' },
                                    { name: 'PARA LLEVAR', list: filteredList.filter(o => o.type === OrderType.Takeaway), color: 'emerald' },
                                    { name: 'DELIVERY', list: filteredList.filter(o => o.type === OrderType.Delivery), color: 'amber' },
                                    { name: 'CLIENTE RETIRA', list: filteredList.filter(o => o.type === OrderType.Pickup), color: 'purple' }
                                ].filter(g => g.list.length > 0);

                                if (groups.length === 0) {
                                    return (
                                        <div className="flex flex-col items-center justify-center py-20 opacity-30 italic">
                                            <p className="text-xl font-black uppercase tracking-tighter text-center">
                                                {listSearchQuery ? 'No se encontraron coincidencias' : 'No hay pedidos hoy'}
                                            </p>
                                        </div>
                                    );
                                }

                                return (
                                    <div className="flex flex-col gap-4">
                                        {groups.map((group) => (
                                            <section key={group.name} className="relative">
                                                <div className="sticky top-[128px] lg:top-[160px] z-20 py-2 mb-1 flex justify-start">
                                                    <div className={`px-4 py-1.5 rounded-full border-2 font-black text-[12px] tracking-[0.2em] shadow-md uppercase italic
                                                    ${group.color === 'blue' ? 'bg-blue-600/20 border-blue-500/30 text-blue-400' :
                                                            group.color === 'emerald' ? 'bg-emerald-600/20 border-emerald-500/30 text-emerald-400' :
                                                                group.color === 'amber' ? 'bg-amber-600/20 border-amber-500/30 text-amber-400' :
                                                                    'bg-purple-600/20 border-purple-500/30 text-purple-400'}`}
                                                    >
                                                        {group.name}
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 gap-3">
                                                    {group.list.sort((a, b) => (b.dailyOrderNumber || 0) - (a.dailyOrderNumber || 0)).map(order => {
                                                        const isPaid = order.status === 'completed';
                                                        const cardBg = group.color === 'blue' ? 'bg-blue-600/10' :
                                                            group.color === 'emerald' ? 'bg-emerald-600/10' :
                                                                group.color === 'amber' ? 'bg-amber-600/10' :
                                                                    'bg-purple-600/10';
                                                        const cardBorder = group.color === 'blue' ? 'border-blue-500/20' :
                                                            group.color === 'emerald' ? 'border-emerald-500/20' :
                                                                group.color === 'amber' ? 'border-amber-500/20' :
                                                                    'border-purple-500/20';

                                                        return (
                                                            <button
                                                                key={order.id}
                                                                onClick={() => onSelectOrder(order.id)}
                                                                className={`p-2.5 border ${cardBorder} ${cardBg} rounded-2xl shadow-md hover:brightness-125 transition-all text-left flex flex-col gap-1 relative overflow-hidden group`}
                                                            >
                                                                <div className="flex justify-between items-center">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="font-black text-[#E0650D] text-lg tracking-tighter">
                                                                            #{String(order.dailyOrderNumber).padStart(3, '0')}
                                                                        </span>
                                                                        {order.table && (
                                                                            <span className="px-1.5 py-0.5 bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded text-[11px] font-black uppercase backdrop-blur-sm">
                                                                                {order.table.name}
                                                                            </span>
                                                                        )}
                                                                        {order.waiter && (
                                                                            <span className="px-1.5 py-0.5 bg-amber-500/20 border border-amber-500/30 text-amber-400 rounded text-[11px] font-black uppercase backdrop-blur-sm">
                                                                                {order.waiter.name.split(' ')[0]}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-white font-black text-lg tabular-nums">
                                                                            ${Number(order.total).toFixed(2)}
                                                                        </span>
                                                                        {isPaid && (
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    setSelectedOrderForTicket(order);
                                                                                }}
                                                                                className="p-1.5 bg-cyan-600/20 text-cyan-400 rounded-lg hover:bg-cyan-600/40 hover:text-white transition-all active:scale-90"
                                                                                title="Ver Ticket"
                                                                            >
                                                                                <ReceiptIcon className="w-5 h-5" />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                <div className="flex items-center justify-between gap-2">
                                                                    <span className="text-white font-black text-base truncate uppercase italic opacity-90">
                                                                        {order.customer?.name || 'CLIENTES VARIOS'}
                                                                    </span>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase italic border ${isPaid
                                                                            ? 'bg-green-500/20 border-green-500/30 text-green-400'
                                                                            : 'bg-red-500/20 border-red-500/30 text-red-400 animate-urgent'
                                                                            }`}>
                                                                            {isPaid ? 'PAGADO' : 'PENDIENTE'}
                                                                        </span>
                                                                        <span className="text-[10px] text-gray-400 font-bold uppercase whitespace-nowrap bg-black/20 px-2 py-0.5 rounded">
                                                                            {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                        </span>
                                                                        {!isPaid && (
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    setDeletingOrderId(order.id);
                                                                                }}
                                                                                className="p-1 bg-red-500/10 hover:bg-red-500/30 text-red-500 rounded-lg transition-all opacity-20 hover:opacity-100 active:scale-90"
                                                                                title="Eliminar Pedido"
                                                                            >
                                                                                <TrashIcon className="w-3.5 h-3.5" />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </section>
                                        ))}
                                    </div>
                                );
                            })()}
                        </div>

                        <button
                            onClick={() => {
                                if (paymentInfo?.isBlocked) {
                                    toast.error(`🚫 CREACIÓN DESACTIVADA: ${paymentInfo.overdueDays} DÍAS DE MORA. EFECTÚA EL PAGO.`, {
                                        duration: 5000,
                                        icon: '🚫',
                                    });
                                    return;
                                }
                                if (isCashOpeningMissing && !isAdmin) {
                                    toast.error('❌ CAJA CERRADA: SOLICITA LA APERTURA AL ADMINISTRADOR PARA CONTINUAR', {
                                        duration: 5000,
                                        icon: '⚠️',
                                    });
                                    return;
                                }
                                setIsCreating(true);
                            }}
                            className={`fixed bottom-6 right-6 w-16 h-16 rounded-full flex items-center justify-center transition-all z-50 group border-4 border-gray-950 ${paymentInfo?.isBlocked ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-[#0DB6E0] shadow-[0_10px_40px_rgba(13,182,224,0.4)] text-gray-950 active:scale-90'}`}
                        >
                            <PlusIcon className="w-8 h-8 transition-transform group-hover:scale-110" />
                        </button>
                    </div>
                </div>
            ) : (
                <div className="w-full space-y-6 pb-32 pt-4 lg:pt-8">
                    <header className="max-w-4xl mx-auto px-4 lg:px-0 flex items-center justify-between mb-2">
                        <div className="flex flex-col">
                            <h1 className="text-2xl font-black text-white italic uppercase tracking-tighter">
                                {isEditing ? 'EDITAR' : 'NUEVO'} <span className="text-amber-500">PEDIDO</span>
                            </h1>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setIsAIModalVisible(true)}
                                className="p-2 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl text-white active:scale-90 transition-all shadow-lg border border-white/10 flex items-center gap-2"
                            >
                                <RobotIcon className="w-6 h-6" />
                            </button>
                            <button onClick={onManageCustomers} className="p-2 bg-gray-800 rounded-xl text-gray-400 active:scale-90 transition-transform">
                                <UserGroupIcon className="w-6 h-6" />
                            </button>
                        </div>
                    </header>

                    <div className="max-w-4xl mx-auto px-4 lg:px-0 space-y-3">
                        <Step title="1. SERVICIO" stepNumber={1} value={orderType} openStep={openStep} setOpenStep={setOpenStep}>
                            <div className="grid grid-cols-2 gap-2">
                                {Object.values(OrderType).map(type => (
                                    <button
                                        key={type}
                                        onClick={() => { setOrderType(type); setSelectedAreaId(null); setOpenStep(needsWaiter ? 2 : 4); }}
                                        className={`py-4 px-2 rounded-2xl font-black text-xs uppercase transition-all border-2 ${orderType === type ? 'bg-amber-500 text-white border-amber-400 shadow-lg' : 'bg-gray-800 text-gray-300 border-gray-800'}`}
                                    >
                                        {type}
                                    </button>
                                ))}
                            </div>
                        </Step>

                        {needsWaiter && (
                            <Step title="2. MESERO" stepNumber={2} value={waiter?.name} openStep={openStep} setOpenStep={setOpenStep}>
                                <div className="grid grid-cols-3 gap-2">
                                    {waiters.filter(w => w.isActive && (w.roles?.includes(UserRole.Waiter) || w.roles?.includes(UserRole.Cashier))).map(w => (
                                        <button
                                            key={w.id}
                                            onClick={() => { setWaiter(w); setOpenStep(needsTable ? 3 : 4); }}
                                            className={`py-3 rounded-2xl flex flex-col items-center gap-1 border-2 transition-all ${waiter?.id === w.id ? 'bg-amber-500 text-white border-amber-400' : 'bg-gray-800 text-gray-300 border-gray-800'}`}
                                        >
                                            <UserIcon className="w-5 h-5" />
                                            <span className="text-[10px] font-black uppercase truncate w-full px-1">{w.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </Step>
                        )}

                        {needsTable && (
                            <Step title="3. MESA" stepNumber={3} value={table ? `${table.area} - ${table.name}` : (selectedAreaId ? tableAreas.find(a => a.id === selectedAreaId)?.name : null)} openStep={openStep} setOpenStep={setOpenStep}>
                                {!selectedAreaId ? (
                                    <div className="flex flex-col gap-3">
                                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest text-center mb-1">Selecciona una Zona</p>
                                        <div className="grid grid-cols-3 gap-2">
                                            {tableAreas.map(area => (
                                                <button
                                                    key={area.id}
                                                    onClick={() => setSelectedAreaId(area.id)}
                                                    className="py-6 rounded-2xl bg-gray-800 border-2 border-gray-700 hover:border-amber-500 text-white flex flex-col items-center gap-2 transition-all active:scale-95"
                                                >
                                                    <div className={`p-2 rounded-lg ${area.name === 'JARDÍN' ? 'bg-green-500/20 text-green-500' : area.name === 'TERRAZA' ? 'bg-orange-500/20 text-orange-500' : 'bg-blue-500/20 text-blue-500'}`}>
                                                        <TableIcon className="w-6 h-6" />
                                                    </div>
                                                    <span className="text-[10px] font-black uppercase tracking-widest">{area.name}</span>
                                                </button>
                                            ))}
                                            {tableAreas.length === 0 && (
                                                <div className="col-span-3 p-10 text-center text-gray-500 italic uppercase">Cargando Zonas...</div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <button
                                            onClick={() => { setSelectedAreaId(null); setTable(null); }}
                                            className="w-full flex items-center justify-between bg-gray-800/50 p-3 rounded-2xl border border-gray-700 hover:border-amber-500/50 hover:bg-gray-800 transition-all active:scale-[0.98] group"
                                        >
                                            <div className="flex items-center gap-2">
                                                {(() => {
                                                    const area = tableAreas.find(a => a.id === selectedAreaId);
                                                    const name = area?.name || '';
                                                    const color = name === 'JARDÍN' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : name === 'TERRAZA' ? 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]' : 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]';
                                                    return (
                                                        <>
                                                            <div className={`w-2 h-2 rounded-full ${color}`}></div>
                                                            <span className="text-xs font-black text-white uppercase tracking-widest">{name}</span>
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                            <div className="px-3 py-1.5 bg-gray-900/50 rounded-lg border border-gray-700 group-hover:border-amber-500/50 transition-colors">
                                                <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">
                                                    CAMBIAR ZONA
                                                </span>
                                            </div>
                                        </button>

                                        <div className="grid grid-cols-4 gap-2">
                                            {tables.filter(t => t.areaId === selectedAreaId).map(t => {
                                                const isOccupied = activeOrders.some(o =>
                                                    o.type === OrderType.Restaurant &&
                                                    o.table &&
                                                    Number(o.table.id) === Number(t.id) &&
                                                    o.status === 'active'
                                                );

                                                return (
                                                    <button
                                                        key={t.id}
                                                        onClick={() => { setTable(t); setOpenStep(4); }}
                                                        className={`py-3 rounded-2xl flex flex-col items-center gap-1 border-2 transition-all relative overflow-hidden
                                                    ${table?.id === t.id
                                                                ? 'bg-amber-500 text-white border-amber-400 shadow-[0_4px_15px_rgba(245,158,11,0.3)]'
                                                                : isOccupied
                                                                    ? 'bg-amber-500/10 text-amber-500 border-amber-500/30 ring-2 ring-amber-500/10 animate-pulse'
                                                                    : 'bg-gray-800 text-gray-300 border-gray-800 hover:border-gray-600'
                                                            }`}
                                                    >
                                                        <TableIcon className="w-5 h-5" />
                                                        <span className="text-[10px] font-black uppercase">{t.name}</span>
                                                        {isOccupied && (
                                                            <span className="absolute top-0 right-0 bg-amber-500 text-black text-[7px] font-black px-1 rounded-bl-lg uppercase tracking-tighter">
                                                                OCUPADA
                                                            </span>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </Step>
                        )}

                        <Step title="4. CLIENTE" stepNumber={4} value={selectedCustomer?.name} openStep={openStep} setOpenStep={setOpenStep}>
                            <div className="space-y-3 relative">
                                {!selectedCustomer ? (
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="BUSCAR NOMBRE O TEL..."
                                            className="w-full p-4 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white font-bold outline-none focus:border-amber-500 uppercase"
                                        />

                                        {searchQuery.trim().length > 0 && (
                                            <div className="absolute left-0 right-0 mt-2 bg-gray-800 border-2 border-gray-700 rounded-2xl overflow-hidden shadow-2xl z-[60] animate-in fade-in slide-in-from-top-2 duration-200 flex flex-col max-h-[280px]">
                                                {filteredCustomers.length > 0 ? (
                                                    <div
                                                        ref={customerScrollRef.ref}
                                                        onMouseDown={customerScrollRef.onMouseDown}
                                                        onMouseMove={customerScrollRef.onMouseMove}
                                                        onMouseUp={customerScrollRef.onMouseUp}
                                                        onMouseLeave={customerScrollRef.onMouseLeave}
                                                        onTouchStart={customerScrollRef.onTouchStart}
                                                        onTouchMove={customerScrollRef.onTouchMove}
                                                        onTouchEnd={customerScrollRef.onTouchEnd}
                                                        className="divide-y divide-gray-700 overflow-y-auto cursor-ns-resize scrollbar-hide"
                                                    >
                                                        {filteredCustomers.map(c => (
                                                            <button
                                                                key={c.id}
                                                                onClick={() => handleSelectCustomer(c)}
                                                                className="w-full p-4 flex justify-between items-center hover:bg-gray-700 active:bg-amber-500 transition-colors"
                                                            >
                                                                <div className="text-left">
                                                                    <p className="font-black text-sm text-white uppercase">{c.name}</p>
                                                                    <p className="text-xs text-gray-400 font-bold">{formatPhone(c.phone)}</p>
                                                                </div>
                                                                <CheckCircleIcon className="w-5 h-5 text-amber-500" />
                                                            </button>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => setIsAddCustomerModalOpen(true)}
                                                        className="w-full p-6 text-center hover:bg-gray-700 transition-colors group"
                                                    >
                                                        <p className="text-xs font-black text-gray-400 uppercase mb-2">No se encontraron resultados</p>
                                                        <div className="inline-flex items-center gap-2 bg-amber-500 text-white px-6 py-3 rounded-xl font-black text-sm uppercase italic group-active:scale-95 transition-transform">
                                                            <PlusIcon className="w-5 h-5" />
                                                            AGREGAR: {searchQuery.toUpperCase()}
                                                        </div>
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="bg-amber-500 p-4 rounded-2xl flex justify-between items-center shadow-lg animate-in fade-in zoom-in duration-200">
                                        <div className="min-w-0 pr-4">
                                            <p className="font-black text-white italic uppercase truncate">{selectedCustomer.name}</p>
                                            <p className="text-xs text-amber-100 font-bold">{formatPhone(selectedCustomer.phone)}</p>
                                        </div>
                                        <button
                                            onClick={() => { setSelectedCustomer(null); setSearchQuery(''); }}
                                            className="shrink-0 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl text-[10px] font-black uppercase text-white"
                                        >
                                            CAMBIAR
                                        </button>
                                    </div>
                                )}

                                {orderType === OrderType.Delivery && selectedCustomer && (
                                    <div className="mt-4 p-4 bg-gray-800/50 rounded-2xl border border-gray-700">
                                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Dirección de Entrega</p>
                                        {selectedCustomer.addresses && selectedCustomer.addresses.length > 0 ? (
                                            <div className="space-y-2">
                                                {selectedCustomer.addresses.map(addr => (
                                                    <button
                                                        key={addr.id}
                                                        onClick={() => setSelectedAddress(addr)}
                                                        className={`w-full p-3 rounded-xl text-left border-2 transition-all ${selectedAddress?.id === addr.id ? 'bg-amber-500/10 border-amber-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400'}`}
                                                    >
                                                        <p className="text-xs font-bold uppercase">{addr.street}</p>
                                                        {addr.details && <p className="text-[10px] opacity-60 italic">{addr.details}</p>}
                                                    </button>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="flex flex-col gap-2">
                                                <p className="text-xs text-amber-500 font-bold italic uppercase">Este cliente no tiene direcciones guardadas.</p>
                                            </div>
                                        )}

                                        <button
                                            onClick={() => setIsAddAddressModalOpen(true)}
                                            className="mt-3 w-full py-3 bg-gray-700 hover:bg-gray-600 text-white font-black rounded-xl uppercase text-xs flex items-center justify-center gap-2 transition-colors active:scale-95 border border-gray-600 border-dashed"
                                        >
                                            <PlusIcon className="w-4 h-4 text-green-500" />
                                            AGREGAR NUEVA DIRECCIÓN
                                        </button>
                                    </div>
                                )}
                            </div>
                        </Step>
                    </div >

                    <div className="fixed bottom-0 left-0 right-0 bg-[#0a0a0b] border-t border-gray-800 z-30">
                        <div className="max-w-4xl mx-auto px-4 lg:px-0 py-4">
                            <button
                                onClick={handleConfirm}
                                disabled={!orderType || (needsWaiter && !waiter) || (needsTable && !table) || (orderType === OrderType.Delivery && (!selectedCustomer || selectedCustomer.id === 999))}
                                className="w-full py-4 bg-green-600 hover:bg-green-500 disabled:bg-gray-800 text-white font-black rounded-2xl shadow-xl transition-all active:scale-95 text-lg uppercase italic tracking-tighter"
                            >
                                {isEditing ? 'ACTUALIZAR' : 'SELECCIONAR PRODUCTOS'}
                            </button>
                        </div>
                    </div>

                    {
                        isAddCustomerModalOpen && (
                            <AddCustomerModal
                                initialName={searchQuery}
                                initialPhone={pendingAIResult?.customerPhone || ''}
                                initialAddress={pendingAIResult?.address || ''}
                                initialEmail={pendingAIResult?.customerEmail || ''}
                                onClose={() => {
                                    setIsAddCustomerModalOpen(false);
                                    setPendingAIResult(null); // Clear on cancel
                                }}
                                isSaving={isSavingCustomer}
                                onSave={async (newCustomerData) => {
                                    setIsSavingCustomer(true);
                                    try {
                                        const saved = await onCreateCustomer(newCustomerData);
                                        setCustomers(prev => [...prev, saved]);

                                        // NEW: Check if there is a pending AI Order
                                        if (pendingAIResult) {
                                            handleSelectCustomer(saved); // This just sets context
                                            setIsAddCustomerModalOpen(false);

                                            // Use the newly created address if available
                                            let addressToUse = undefined;
                                            if (saved.addresses && saved.addresses.length > 0) {
                                                addressToUse = saved.addresses[0];
                                            }

                                            // Trigger Order Start with Pending Items
                                            onStartOrder({
                                                type: pendingAIResult.type,
                                                customer: saved,
                                                deliveryAddress: addressToUse,
                                                initialItems: pendingAIResult.items
                                            });

                                            setPendingAIResult(null);
                                            showNotification('CLIENTE CREADO', `PEDIDO IA INICIADO AUTOMÁTICAMENTE`);

                                        } else {
                                            handleSelectCustomer(saved);
                                            setIsAddCustomerModalOpen(false);
                                            setOpenStep(0); // Colapsar el paso para mostrar el resumen con el cliente cargado
                                            showNotification('CLIENTE GUARDADO', `${saved.name} REGISTRADO CORRECTAMENTE`);
                                        }

                                    } catch (e: any) {
                                        console.error(e);
                                        showNotification('ERROR', e.message || 'NO SE PUDO GUARDAR EL CLIENTE');
                                    } finally {
                                        setIsSavingCustomer(false);
                                    }
                                }}
                            />
                        )
                    }

                    {
                        isAddAddressModalOpen && selectedCustomer && (
                            <AddAddressModal
                                onClose={() => setIsAddAddressModalOpen(false)}
                                onSave={async (street, details, lat, lng) => {
                                    setIsSavingCustomer(true);
                                    try {
                                        const newAddress: Address = {
                                            id: `addr-${Date.now()}`,
                                            street: street.trim().toUpperCase(),
                                            city: 'SAN SALVADOR',
                                            details: details.trim().toUpperCase() || undefined,
                                            latitude: lat,
                                            longitude: lng
                                        };

                                        const updatedAddresses = [...(selectedCustomer.addresses || []), newAddress];

                                        // 0. LOGGING FOR DEBUG
                                        console.log('[StartScreen] Saving Address Payload:', {
                                            customerId: selectedCustomer.id,
                                            addresses: updatedAddresses
                                        });

                                        // 1. Update Backend
                                        const updatedCustomer = await api.updateCustomer(selectedCustomer.id, {
                                            ...selectedCustomer,
                                            addresses: updatedAddresses
                                        });

                                        // 2. Update Local State (Customers List)
                                        setCustomers(prev => prev.map(c => c.id === selectedCustomer.id ? { ...c, addresses: updatedAddresses } : c));

                                        // 3. Update Currently Selected Customer & Address
                                        setSelectedCustomer(prev => prev ? { ...prev, addresses: updatedAddresses } : null);
                                        setSelectedAddress(newAddress);

                                        setIsAddAddressModalOpen(false);
                                        showNotification('DIRECCIÓN GUARDADA', `SE AGREGÓ: ${street}`);

                                    } catch (e: any) {
                                        console.error("Failed to add address", e);
                                        showNotification('ERROR', 'NO SE PUDO GUARDAR LA DIRECCIÓN. REVISA LA CONEXIÓN.');
                                    } finally {
                                        setIsSavingCustomer(false);
                                    }
                                }}
                            />
                        )
                    }

                </div>
            )}

            {isAIModalVisible && (
                <AIOrderParserModal
                    onClose={() => setIsAIModalVisible(false)}
                    onParse={async (text) => {
                        try {
                            const result = await api.aiParseOrder(text, currentBranchId || 1);

                            // 1. Resolve Items First (MOVED UP to fix ReferenceError)
                            const parsedItems: any[] = [];
                            if (result.items && Array.isArray(result.items)) {
                                result.items.forEach((aiItem: any) => {
                                    const product = products.find(p => p.id === aiItem.productId);
                                    if (product) {
                                        const meat = aiItem.meatId ? meats.find(m => m.id === aiItem.meatId) : undefined;
                                        const masa = aiItem.masaId ? meats.find(m => m.id === aiItem.masaId) : undefined;
                                        const extras = aiItem.extraIds ? productExtras.filter(e => aiItem.extraIds.includes(e.id)) : [];

                                        parsedItems.push({
                                            id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                                            product,
                                            quantity: aiItem.quantity || 1,
                                            meat,
                                            masa,
                                            extras,
                                            total: (product.price + extras.reduce((sum, e) => sum + Number(e.price), 0)) * (aiItem.quantity || 1),
                                            observations: aiItem.note ? aiItem.note.toUpperCase() : undefined,
                                            completed: false
                                        });
                                    }
                                });
                            }

                            // 2. Determine Type First (MOVED UP to fix ReferenceError)
                            let type = OrderType.Delivery;
                            const lowerText = text.toLowerCase();
                            const pickupKeywords = [
                                'llegare', 'llegaré', 'llegaran', 'llegarán', 'paso por', 'pasaré',
                                'recoger', 'recogere', 'recogeré', 'retiro', 'retira', 'cliente retira', 'llego por',
                                'retirare', 'retiraré', 'paso a traer', 'paso a recoger'
                            ]; // Strong pickup intent only

                            if (pickupKeywords.some(k => lowerText.includes(k))) {
                                type = OrderType.Pickup;
                            }

                            // 3. Resolve Customer (After Items and Type are defined)
                            let customer: Customer | undefined;


                            const aiName = result.customerName ? result.customerName.toUpperCase() : '';
                            const aiPhone = result.customerPhone ? result.customerPhone.replace(/\D/g, '') : '';
                            const aiEmail = result.customerEmail || '';

                            if (aiName || aiPhone) {
                                // Try simplified local search (Name OR Phone)
                                let existing = customers.find(c => {
                                    if (c.isActive === false) return false;
                                    const cName = normalize(c.name);
                                    const cPhone = c.phone ? c.phone.replace(/\D/g, '') : '';

                                    const nameMatch = aiName && cName.includes(normalize(aiName));
                                    const phoneMatch = aiPhone && cPhone.includes(aiPhone);

                                    return nameMatch || phoneMatch;
                                });

                                // Fallback: API Search
                                if (!existing && aiName) {
                                    try {
                                        console.log(`[AI] Local match failed. Searching API for: ${aiName}`);
                                        const apiMatches: Customer[] = await api.searchCustomers(aiName);
                                        if (apiMatches && apiMatches.length > 0) {
                                            existing = apiMatches[0];
                                        }
                                    } catch (err) {
                                        console.warn("[AI] API Search failed", err);
                                    }
                                }

                                if (existing) {
                                    customer = existing;
                                    showNotification('CLIENTE ENCONTRADO', `${existing.name}`);

                                    // IF existing customer has NO phone, but AI found one, notify user?
                                    if (!existing.phone && aiPhone) {
                                        showNotification('DATOS NUEVOS DETECTADOS', `Tel: ${aiPhone} (Actualiza en Editar)`);
                                    }
                                } else {
                                    // Prepare for NEW Customer
                                    if (aiName) setSearchQuery(aiName);

                                    // NEW: Auto-open Add Customer Modal with AI Data - RELAXED CONDITION
                                    // JUST NAME is enough to start the "New Customer" flow
                                    if (aiName) {
                                        setPendingAIResult({
                                            customerName: aiName,
                                            customerPhone: aiPhone, // Might be empty, that's fine
                                            customerEmail: aiEmail,
                                            items: parsedItems, // Persist parsed items (Now defined!)
                                            type, // Persist type (Now defined!)
                                            address: result.address // Keep original string address
                                        });

                                        // CRITICAL: Close AI Modal and Open Add Customer Modal
                                        setIsAIModalVisible(false);
                                        setIsAddCustomerModalOpen(true);

                                        showNotification('NUEVO CLIENTE DETECTADO', 'Confirme los datos para continuar');
                                    } else {
                                        if (aiPhone) showNotification('CLIENTE NUEVO DETECTADO', 'Complete el registro');
                                    }
                                }
                            }

                            // 4. Resolve Address (Only if Delivery and Customer Exists)
                            let address: Address | undefined;
                            if (type === OrderType.Delivery && customer) {
                                if (result.address) {
                                    // 1. Try to find existing address (Simple Fuzzy Match)
                                    const searchAddr = result.address.toLowerCase();
                                    const match = customer.addresses.find(a =>
                                        a.street.toLowerCase().includes(searchAddr) ||
                                        searchAddr.includes(a.street.toLowerCase())
                                    );

                                    if (match) {
                                        address = match;
                                        // showNotification('DIRECCIÓN CONFIRMADA', match.street);
                                    } else {
                                        // 2. Auto-Add New Address to Customer
                                        const newAddr: Address = {
                                            id: `addr-${Date.now()}`,
                                            customerId: customer.id,
                                            street: result.address,
                                            city: 'San Salvador', // Default city
                                            details: 'Detectada por IA'
                                        };

                                        try {
                                            const updatedAddresses = [...(customer.addresses || []), newAddr];
                                            // Optimistic update of local customer object
                                            customer = { ...customer, addresses: updatedAddresses };
                                            address = newAddr;

                                            // Persist to Backend in background
                                            api.updateCustomer(customer.id, { addresses: updatedAddresses })
                                                .then(() => showNotification('DIRECCIÓN GUARDADA', 'Nueva dirección agregada al cliente'))
                                                .catch(e => console.error("Failed to auto-save address", e));

                                        } catch (e) {
                                            console.error("Address auto-add logic error", e);
                                        }
                                    }
                                } else if (customer && customer.addresses.length > 0) {
                                    // No address from AI, but customer has one? Default to first?
                                    // Maybe safer to ask user, but for speed, let's keep previous behavior or just leave undefined
                                    address = customer.addresses[0];
                                }
                            }

                            if (!customer) {
                                // No Customer Found -> Fill Form and Let User Finish (Only if NOT opening modal)
                                // If pendingAIResult (and thus modal) was set above, this block is skipped for the modal logic
                                if (!pendingAIResult && !isAddCustomerModalOpen) {
                                    setOrderType(type);
                                    setOpenStep(4); // Go to Customer Step
                                    showNotification('IA FINALIZADA', 'Selecciona el cliente para continuar');
                                    setIsAIModalVisible(false);
                                }
                                // Else: Modal is opening (handled above), so just ensure AI modal is closed (done above too)

                            } else {
                                // Customer Found -> Start Order directly (Go to Cart/Payment)
                                onStartOrder({
                                    type,
                                    customer,
                                    deliveryAddress: address,
                                    initialItems: parsedItems
                                });
                                setIsAIModalVisible(false);
                            }

                        } catch (e: any) {
                            console.error(e);
                            showNotification('ERROR IA', e.message);
                        }
                    }}
                />
            )
            }
            {notification && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200]">
                    <div className="bg-gray-900 border-2 border-amber-500 rounded-2xl p-4 shadow-2xl flex items-center gap-3">
                        <div className="bg-amber-500 p-2 rounded-xl">
                            <CheckCircleIcon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">{notification.title}</p>
                            <p className="text-white font-black text-xs uppercase italic">{notification.message}</p>
                        </div>
                    </div>
                </div>
            )}
            {selectedOrderForTicket && (
                <TicketModal
                    order={selectedOrderForTicket}
                    onClose={() => setSelectedOrderForTicket(null)}
                    onNewOrder={() => { }}
                    isViewingCompleted={true}
                    companySettings={companySettings}
                    onUpdateCustomerEmail={onUpdateCustomerEmail}
                    branches={branches}
                />
            )}
            <PinVerificationModal
                isOpen={!!deletingOrderId}
                onClose={() => setDeletingOrderId(null)}
                onSuccess={async (adminUser) => {
                    if (!deletingOrderId) return;
                    await onDeleteOrder(deletingOrderId, adminUser.id, `Eliminado por ${adminUser.username}`);
                    setDeletingOrderId(null);
                }}
                title="ELIMINAR PEDIDO"
                message="INGRESA PIN DE ADMINISTRADOR PARA CONFIRMAR ELIMINACIÓN"
                requiredRole={UserRole.Admin}
            />
        </>
    );
};




export default StartScreen;
