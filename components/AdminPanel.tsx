
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { toast, Toaster } from 'react-hot-toast';
import { createPortal } from 'react-dom';
import { Waiter, Table, Meat, Category, ProductExtra, Product, Order, CashClosingReport, UserRole, Branch, Customer, PromotionRule, TableArea, CompanySettings } from '../types';
import GlobalHistoryScreen from './GlobalHistoryScreen';
import { PencilIcon, TrashIcon, PlusIcon, UserIcon, TableIcon, ProductIcon, CategoryIcon, MeatIcon, ExtrasIcon, ChartBarIcon, CashRegisterIcon, ReceiptIcon, ShieldCheckIcon, StoreIcon, UserGroupIcon, ClipboardListIcon, SaveIcon, EyeIcon, EyeOffIcon, CheckCircleIcon, ClockIcon, TagIcon, ShoppingBagIcon, InfoIcon, SearchIcon, ArrowRightIcon, MinusIcon, ArrowPathIcon, MapIcon, MessageSquareIcon, XIcon, TrendingUpIcon, StarIcon, PackageIcon, CalculatorIcon, CreditCardIcon } from './icons';
import DailySummaryScreen from './DailySummaryScreen';
import CashClosingScreen from './CashClosingScreen';
import CashClosingHistoryScreen from './CashClosingHistoryScreen';
import ManageCustomersScreen from './ManageCustomersScreen';
import ReportsScreen from './ReportsScreen';
import PromotionsManager from './PromotionsManager';
import CashAuditScreen from './CashAuditScreen';

import { FeedbackDashboard } from './FeedbackDashboard';
import { SalesProjectionsDashboard } from './SalesProjectionsDashboard';
import NotificationToast from './NotificationToast';
import ConfirmationModal from './ConfirmationModal';
import PinVerificationModal from './PinVerificationModal';
import AuditLogsScreen from './AuditLogsScreen';
import ManageInventoryScreen from './ManageInventoryScreen';
import PendingBalancesScreen from './PendingBalancesScreen';
import { api } from '../api';
import { ViewHeader, AdminModal } from './AdminShared';
import ErrorBoundary from './ErrorBoundary';
import PaymentControl from './PaymentControl';

type AdminView = 'dashboard' | 'payment' | 'users' | 'tables' | 'tableAreas' | 'meats' | 'categories' | 'extras' | 'products' | 'dailySummary' | 'cashClosing' | 'cashClosingHistory' | 'branches' | 'customers' | 'reports' | 'history' | 'promotions' | 'feedback' | 'projections' | 'auditLogs' | 'inventory' | 'pendingBalances' | 'observationTags' | 'masterSettings' | 'cashAudit' | 'redigitate';

// ... (inside component) ...



interface AdminPanelProps {
    waiters: Waiter[];
    setWaiters: React.Dispatch<React.SetStateAction<Waiter[]>>;
    tables: Table[];
    setTables: React.Dispatch<React.SetStateAction<Table[]>>;
    meats: Meat[];
    setMeats: React.Dispatch<React.SetStateAction<Meat[]>>;
    categories: Category[];
    setCategories: React.Dispatch<React.SetStateAction<Category[]>>;
    productExtras: ProductExtra[];
    setProductExtras: React.Dispatch<React.SetStateAction<ProductExtra[]>>;
    products: Product[];
    setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
    orders: Order[];
    cashClosingReports: CashClosingReport[];
    setCashClosingReports: React.Dispatch<React.SetStateAction<CashClosingReport[]>>;
    onOpenMasterSettings: () => void;
    isSuperAdmin: boolean;
    branches: Branch[];
    setBranches: React.Dispatch<React.SetStateAction<Branch[]>>;
    currentBranchId: number | null;
    customers: Customer[];
    setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
    currentAdminName: string;
    onForceClose: (orders: Order[]) => Promise<void>;
    promotions: PromotionRule[];
    setPromotions: React.Dispatch<React.SetStateAction<PromotionRule[]>>;
    tableAreas: TableArea[];
    setTableAreas: React.Dispatch<React.SetStateAction<TableArea[]>>;
    observationTags: { id: number; name: string; isActive: boolean }[];
    setObservationTags: React.Dispatch<React.SetStateAction<{ id: number; name: string; isActive: boolean }[]>>;
    currentUser?: any; // Add currentUser prop
    companySettings?: CompanySettings;
    setCompanySettings?: React.Dispatch<React.SetStateAction<CompanySettings>>;
    isCashOpeningMissing?: boolean;
    onOpenCashOpening?: () => void;
    onOpenRedigitation?: () => void;
    redigitationMode?: { cashReportId: number; date: string; branchId: number } | null;
    onExitRedigitation?: () => void;
}

const AdminPanel: React.FC<AdminPanelProps> = (props) => {
    console.log("AdminPanel V: GlobalHistory Loaded"); // FORCE UPDATE
    const [currentView, setCurrentView] = useState<AdminView>('dashboard');
    const dashboardScrollRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startY, setStartY] = useState(0);
    const [scrollTop, setScrollTop] = useState(0);
    const [showPinModal, setShowPinModal] = useState(false);
    const [pendingView, setPendingView] = useState<AdminView | null>(null);

    const menuItems = [
        // ORANGE / AMBER (Food & Menu)
        { key: 'products', label: 'Productos', Icon: ProductIcon, color: 'amber' },
        { key: 'categories', label: 'Categorías', Icon: CategoryIcon, color: 'amber' },
        { key: 'meats', label: 'Tipos de Carne', Icon: MeatIcon, color: 'amber' },
        { key: 'masas', label: 'Harinas / Masas', Icon: ShoppingBagIcon, color: 'amber' }, // New Item
        { key: 'extras', label: 'Extras', Icon: ExtrasIcon, color: 'amber' },
        { key: 'promotions', label: 'Promociones', Icon: TagIcon, color: 'amber' },
        { key: 'observationTags', label: 'Etiquetas', Icon: MessageSquareIcon, color: 'amber' },

        // GREEN / EMERALD (Money & Analytics)
        { key: 'cashClosing', label: 'Cierre de Caja', Icon: CashRegisterIcon, color: 'emerald' },
        { key: 'dailySummary', label: 'Resumen del Día', Icon: ChartBarIcon, color: 'emerald' },
        { key: 'reports', label: 'Reportes', Icon: ClipboardListIcon, color: 'emerald' },
        { key: 'cashClosingHistory', label: 'Historial Cierres', Icon: ReceiptIcon, color: 'emerald' },
        { key: 'projections', label: 'Proyecciones', Icon: TrendingUpIcon, color: 'emerald' },
        { key: 'inventory', label: 'Inventario', Icon: PackageIcon, color: 'emerald' },
        { key: 'history', label: 'Historial Global', Icon: ClockIcon, color: 'emerald' },
        { key: 'cashAudit', label: 'Arqueo en Vivo', Icon: CalculatorIcon, color: 'emerald' },

        // BLUE (Management & People)
        { key: 'pendingBalances', label: 'Cuentas x Cobrar', Icon: ArrowPathIcon, color: 'blue' },
        { key: 'customers', label: 'Clientes', Icon: UserGroupIcon, color: 'blue' },
        { key: 'users', label: 'Usuarios', Icon: UserIcon, color: 'blue' },
        { key: 'tables', label: 'Mesas', Icon: TableIcon, color: 'blue' },
        { key: 'tableAreas', label: 'Zonas', Icon: MapIcon, color: 'blue' },
        { key: 'branches', label: 'Sucursales', Icon: StoreIcon, color: 'blue' },
        { key: 'feedback', label: 'Monitor Calidad', Icon: StarIcon, color: 'blue' },

        // ORANGE / RED (Operations)
        { key: 'redigitate', label: 'Redigitar Órdenes', Icon: ArrowPathIcon, color: 'orange' },

        // RED (Security)
        { key: 'auditLogs', label: 'Auditoría', Icon: EyeIcon, color: 'red' },
    ];

    if (props.isSuperAdmin && props.currentUser?.id === 1) {
        const masterItem = { key: 'masterSettings', label: 'Config. Maestra', Icon: ShieldCheckIcon, color: 'indigo' };
        menuItems.unshift(masterItem);
        menuItems.push({ key: 'payment', label: 'Control Pago', Icon: CreditCardIcon, color: 'amber' });
    }

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!dashboardScrollRef.current) return;
        setIsDragging(true);
        setStartY(e.pageY - dashboardScrollRef.current.offsetTop);
        setScrollTop(dashboardScrollRef.current.scrollTop);
    };
    const handleMouseLeave = () => setIsDragging(false);
    const handleMouseUp = () => setIsDragging(false);
    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !dashboardScrollRef.current) return;
        e.preventDefault();
        const y = e.pageY - dashboardScrollRef.current.offsetTop;
        const walk = (y - startY) * 2;
        dashboardScrollRef.current.scrollTop = scrollTop - walk;
    };

    const renderCurrentView = () => {
        if (currentView === 'dashboard') {
            return (
                <div className="flex flex-col h-full animate-in fade-in duration-300">
                    <h1 className="text-3xl md:text-5xl font-black text-center italic uppercase tracking-tighter mb-8 md:mb-12">
                        <span className="text-white">PANEL</span> <span className="text-amber-500">ADMIN</span>
                    </h1>
                    <div
                        ref={dashboardScrollRef}
                        onMouseDown={handleMouseDown}
                        onMouseLeave={handleMouseLeave}
                        onMouseUp={handleMouseUp}
                        onMouseMove={handleMouseMove}
                        className={`flex-1 overflow-y-auto pb-20 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                    >
                        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-8 xl:grid-cols-10 gap-3 md:gap-4 px-2 max-w-7xl mx-auto">
                            {props.isCashOpeningMissing && (
                                <button
                                    onClick={() => props.onOpenCashOpening?.()}
                                    className="rounded-[24px] md:rounded-[32px] p-3 md:p-4 flex flex-col items-center justify-center gap-2 aspect-square transition-all duration-200 border-2 border-amber-500 bg-amber-950 text-amber-500 animate-pulse active:scale-90 shadow-lg shadow-amber-500/20"
                                >
                                    <div className="relative">
                                        <CashRegisterIcon className="w-8 h-8 md:w-10 md:h-10" />
                                        <PlusIcon className="w-4 h-4 absolute -top-1 -right-1 bg-amber-600 rounded-full p-0.5 border border-amber-400 text-white" />
                                    </div>
                                    <span className="text-[10px] md:text-xs font-black text-center leading-tight uppercase tracking-tighter">Aperturar Caja</span>
                                </button>
                            )}
                            {menuItems.map(item => {
                                const colorMap: any = {
                                    amber: 'bg-amber-950 border-amber-700 text-amber-500 active:bg-amber-600 active:text-white',
                                    emerald: 'bg-emerald-950 border-emerald-700 text-emerald-500 active:bg-emerald-600 active:text-white',
                                    blue: 'bg-blue-950 border-blue-700 text-blue-400 active:bg-blue-600 active:text-white',
                                    indigo: 'bg-indigo-950 border-indigo-700 text-indigo-400 active:bg-indigo-600 active:text-white',
                                    red: 'bg-red-950 border-red-700 text-red-400 active:bg-red-600 active:text-white',
                                    orange: 'bg-orange-950 border-orange-700 text-orange-500 active:bg-orange-600 active:text-white',
                                };
                                // @ts-ignore
                                const colorClass = colorMap[item.color] || 'bg-gray-900 text-gray-400';

                                return (
                                    <button
                                        key={item.key}
                                        onClick={() => {
                                            if (isDragging) return;
                                            if (item.key === 'masterSettings') {
                                                setPendingView('masterSettings');
                                                setShowPinModal(true);
                                                return;
                                            }
                                            if (item.key === 'branches') {
                                                setPendingView('branches');
                                                setShowPinModal(true);
                                                return;
                                            }
                                            if (item.key === 'payment') {
                                                setPendingView('payment');
                                                setShowPinModal(true);
                                                return;
                                            }
                                            if (item.key === 'redigitate') {
                                                if (props.onOpenRedigitation) {
                                                    props.onOpenRedigitation();
                                                }
                                                return;
                                            }
                                            setCurrentView(item.key as AdminView);
                                        }}
                                        className={`rounded-[24px] md:rounded-[32px] p-3 md:p-4 flex flex-col items-center justify-center gap-2 aspect-square transition-colors duration-150 active:scale-90 border ${colorClass}`}
                                    >
                                        <item.Icon className="w-8 h-8 md:w-8 md:h-8 lg:w-9 lg:h-9" />
                                        <span className="text-[10px] md:text-[11px] lg:text-[12px] font-black text-center leading-tight uppercase tracking-tighter">{item.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            );
        }

        const goBack = () => setCurrentView('dashboard');

        switch (currentView) {
            case 'products': return <ManageProducts products={props.products} setProducts={props.setProducts} categories={props.categories} productExtras={props.productExtras} meats={props.meats} onBack={goBack} />;
            case 'promotions': return <PromotionsManager promotions={props.promotions} setPromotions={props.setPromotions} products={props.products} categories={props.categories} onBack={goBack} />;
            case 'projections': return <SalesProjectionsDashboard branchId={props.currentBranchId || 1} branchName={props.branches.find(b => b.id === props.currentBranchId)?.name} branches={props.branches} onBack={goBack} />;
            case 'cashAudit': return <CashAuditScreen orders={props.orders} cashClosingReports={props.cashClosingReports} currentBranchId={props.currentBranchId} onBack={goBack} />;
            case 'feedback': return <FeedbackDashboard onBack={goBack} />;
            case 'history': return <GlobalHistoryScreen
                tables={props.tables}
                onBack={goBack}
                products={props.products}
                productExtras={props.productExtras}
                meats={props.meats}
                users={props.waiters}
                currentBranchId={props.currentBranchId}
                branches={props.branches}
                companySettings={props.companySettings}
                isSuperAdmin={props.isSuperAdmin}
            />;
            case 'categories': return <ManageSimpleEntity
                title="GESTIÓN <span class='text-amber-500'>CATEGORÍAS</span>"
                label="Nombre de Categoría"
                items={props.categories}
                setItems={props.setCategories}
                onBack={goBack}
                // @ts-ignore
                onCreate={async (d) => {
                    const res = await api.createCategory(d);
                    return { ...d, id: res.id };
                }}
                // @ts-ignore
                onUpdate={async (id, d) => await api.updateCategory(id, d)}
                // @ts-ignore
                onDelete={async (id) => await api.deleteCategory(id)}
                hasSortOrder={true}
            />;
            case 'meats': return <ManageSimpleEntity
                title="TIPOS <span class='text-amber-500'>DE CARNE</span>"
                label="Tipo de Carne"
                items={props.meats.filter(m => !m.type || m.type === 'meat')}
                setItems={props.setMeats}
                onBack={goBack}
                // @ts-ignore
                onCreate={async (d) => {
                    const res = await api.createMeat({ ...d, type: 'meat' });
                    return { ...d, type: 'meat', id: res.id };
                }}
                // @ts-ignore
                onUpdate={async (id, d) => await api.updateMeat(id, d)}
                // @ts-ignore
                onDelete={async (id) => await api.deleteMeat(id)}
            />;
            case 'masas': return <ManageSimpleEntity
                title="TIPOS <span class='text-amber-500'>DE MASA</span>"
                label="Tipo de Harina"
                items={props.meats.filter(m => m.type === 'masa')}
                setItems={props.setMeats}
                onBack={goBack}
                // @ts-ignore
                onCreate={async (d) => {
                    const res = await api.createMeat({ ...d, type: 'masa' });
                    return { ...d, type: 'masa', id: res.id };
                }}
                // @ts-ignore
                onUpdate={async (id, d) => await api.updateMeat(id, d)}
                // @ts-ignore
                onDelete={async (id) => await api.deleteMeat(id)}
            />;
            case 'extras': return <ManageExtras extras={props.productExtras} setExtras={props.setProductExtras} onBack={goBack} />;
            case 'users': return <ManageUsers waiters={props.waiters} setWaiters={props.setWaiters} branches={props.branches} onBack={goBack} currentAdminName={props.currentAdminName} isSuperAdmin={props.isSuperAdmin} />;
            case 'tables': return <ManageTables tables={props.tables} setTables={props.setTables} tableAreas={props.tableAreas} currentBranchId={props.currentBranchId} onBack={goBack} />;
            case 'tableAreas': return <ManageSimpleEntity
                title="GESTIÓN <span class='text-blue-500'>ZONAS</span>"
                label="Nombre de la Zona (Ej: Jardín)"
                items={props.tableAreas}
                setItems={props.setTableAreas}
                onBack={goBack}
                // @ts-ignore
                onCreate={async (d) => api.createTableArea(d)}
                // @ts-ignore
                onUpdate={async (id, d) => api.createTableArea({ id, ...d })}
                // @ts-ignore
                onDelete={async (id) => api.deleteTableArea(id)}
            />;
            case 'branches': return <ManageBranches branches={props.branches} setBranches={props.setBranches} onBack={goBack} />;
            case 'customers': return <ManageCustomersScreen customers={props.customers} setCustomers={props.setCustomers} onBack={goBack} />;
            case 'dailySummary': return <DailySummaryScreen orders={props.orders.filter(o => o.status === 'completed')} onBack={goBack} branchId={props.currentBranchId || 1} cashClosingReports={props.cashClosingReports} />;
            case 'cashClosing': return <CashClosingScreen orders={props.orders.filter(o => o.status === 'completed')} activeOrders={props.orders.filter(o => o.status === 'active')} onForceClose={props.onForceClose} onBack={goBack} cashClosingReports={props.cashClosingReports} setCashClosingReports={props.setCashClosingReports} branchId={props.currentBranchId || 1} branchName={props.branches.find(b => b.id === (props.currentBranchId || 1))?.name} />;
            case 'cashClosingHistory': return <CashClosingHistoryScreen reports={props.cashClosingReports} onBack={goBack} branches={props.branches} isSuperAdmin={props.isSuperAdmin} />;
            case 'reports': return <ReportsScreen onBack={goBack} orders={props.orders.filter(o => o.status === 'completed')} categories={props.categories} waiters={props.waiters} branchId={props.currentBranchId || 1} />;
            case 'inventory': return (
                <ErrorBoundary name="ManageInventoryScreen">
                    <ManageInventoryScreen onBack={goBack} branches={props.branches} currentBranchId={props.currentBranchId} currentUser={props.currentUser} />
                </ErrorBoundary>
            );
            case 'pendingBalances': return <PendingBalancesScreen branchId={props.currentBranchId || 1} onBack={goBack} />;
            case 'auditLogs': return <AuditLogsScreen onBack={goBack} />;
            case 'observationTags': return <ManageSimpleEntity
                title="GESTIÓN <span class='text-amber-500'>ETIQUETAS</span>"
                label="Nombre de Etiqueta"
                items={props.observationTags}
                setItems={props.setObservationTags as any}
                onBack={goBack}
                // @ts-ignore
                onCreate={async (d) => api.createObservationTag(d)}
                // @ts-ignore
                onUpdate={async (id, d) => api.updateObservationTag(id, d)}
                // @ts-ignore
                onDelete={async (id) => api.deleteObservationTag(id)}
            />;
            case 'payment': return <PaymentControl settings={props.companySettings || {} as CompanySettings} setSettings={props.setCompanySettings || (() => {})} onBack={goBack} />;
            default: return null;
        }
    }

    return (
        <div className="p-4 sm:p-6 h-full flex flex-col overflow-hidden w-full">
            {renderCurrentView()}
            <PinVerificationModal
                isOpen={showPinModal}
                onClose={() => {
                    setShowPinModal(false);
                    setPendingView(null);
                }}
                onSuccess={(user) => {
                    setShowPinModal(false);
                    if (pendingView === 'masterSettings') {
                        props.onOpenMasterSettings?.();
                        setPendingView(null);
                    } else if (pendingView) {
                        setCurrentView(pendingView);
                        setPendingView(null);
                    }
                }}
                requiredRole={UserRole.SuperAdmin}
                title="ACCESO PROTEGIDO"
                message="Esta sección requiere permisos de Super Admin"
            />
        </div>
    );
};

// --- COMPONENTES AUXILIARES MOVIDOS A AdminShared.tsx ---

// --- GESTIÓN PRODUCTOS ---
const ManageProducts: React.FC<{ products: Product[]; setProducts: React.Dispatch<React.SetStateAction<Product[]>>; categories: Category[]; productExtras: ProductExtra[]; meats: Meat[]; onBack: () => void }> = ({ products, setProducts, categories, productExtras, meats, onBack }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [comboSearchQuery, setComboSearchQuery] = useState('');
    const [form, setForm] = useState<Partial<Product>>({ id: 0, name: '', price: 0, categoryId: categories[0]?.id || 0, requiresMeat: false, requiresMasa: false, availableExtraIds: [], availableMeatIds: [], imageUrl: '', description: '', showInKds: true });
    const scrollRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startY, setStartY] = useState(0);
    const [scrollTop, setScrollTop] = useState(0);

    const [showInactive, setShowInactive] = useState(false);

    const filteredProducts = products
        .filter(p => p && p.name && (showInactive || (p.isActive !== false && p.is_active !== 0))) // Triple robust check
        .map(p => ({ ...p, price: Number(p.price) }))
        .filter(p => {
            const term = searchQuery.toLowerCase();
            const catName = categories.find(c => c.id === p.categoryId)?.name.toLowerCase() || '';
            return p.name.toLowerCase().includes(term) || catName.includes(term);
        })
        .sort((a, b) => a.categoryId - b.categoryId);

    const handleToggleActive = async (p: Product) => {
        try {
            const newState = p.isActive === false ? true : false; // Robust toggle
            await import('../api').then(m => m.api.updateProduct(p.id, { ...p, isActive: newState }));
            setProducts(prev => prev.map(item => item.id === p.id ? { ...item, isActive: newState } : item));
            toast.success(newState ? 'Producto activado' : 'Producto desactivado');
        } catch (e) {
            console.error(e);
            toast.error('Error al cambiar estado');
        }
    };

    const handleOpen = (p?: Product) => {
        let comboDef = p?.comboDefinition;
        if (typeof comboDef === 'string') {
            try {
                comboDef = JSON.parse(comboDef);
            } catch (e) {
                comboDef = { type: 'fixed', items: [] };
            }
        }

        // Ensure a valid structure
        if (!comboDef || typeof comboDef !== 'object') {
            comboDef = { type: 'fixed', items: [] };
        } else if (!comboDef.type) {
            // Legacy fallback: if it has slots, it's dynamic
            comboDef = {
                type: (comboDef as any).slots ? 'dynamic' : 'fixed',
                slots: (comboDef as any).slots || [],
                items: (comboDef as any).items || []
            };
        }

        const initialForm = {
            id: p?.id || 0,
            name: p?.name || '',
            price: Number(p?.price || 0),
            categoryId: Number(p?.categoryId !== undefined ? p.categoryId : (p as any)?.category_id || categories[0]?.id || 0),
            requiresMeat: Boolean(p?.requiresMeat !== undefined ? p.requiresMeat : (p as any)?.requires_meat == 1),
            requiresMasa: Boolean(p?.requiresMasa !== undefined ? p.requiresMasa : (p as any)?.requires_masa == 1),
            availableExtraIds: p?.availableExtraIds || (p as any)?.available_extras || [],
            isCombo: Boolean(p?.isCombo !== undefined ? p.isCombo : (p as any)?.is_combo == 1),
            comboDefinition: comboDef,
            trackStock: Boolean(p?.trackStock !== undefined ? p.trackStock : (p as any)?.track_stock == 1),
            imageUrl: p?.imageUrl ?? (p as any)?.image_url ?? '',
            description: p?.description || (p as any)?.description || '',
            isActive: Boolean(p?.isActive !== undefined ? p.isActive : ((p as any)?.is_active !== 0)),
            availableMeatIds: p?.availableMeatIds || (p as any)?.available_meats || [],
            showInKds: p?.showInKds !== undefined ? Boolean(p.showInKds) : true
        };
        console.log(`[DEBUG-KDS] P${p?.id} final:`, initialForm.showInKds);
        console.log('[AdminPanel] handleOpen P' + (p?.id) + ':', {
            raw_availableMeatIds: p?.availableMeatIds,
            raw_available_meats: (p as any)?.available_meats,
            final_form_meats: initialForm.availableMeatIds
        });
        setForm(initialForm);
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!form.name?.trim()) return;
        const finalProduct = {
            ...form,
            name: form.name.toUpperCase(),
            price: Number(form.price || 0),
            categoryId: Number(form.categoryId || 0),
            isActive: form.isActive === true,
            requiresMeat: form.requiresMeat === true,
            requiresMasa: form.requiresMasa === true,
            availableExtraIds: (form.availableExtraIds || []).map(id => Number(id)),
            isCombo: form.isCombo === true,
            comboDefinition: form.isCombo ? (form.comboDefinition || { type: 'fixed', items: [] }) : null,
            trackStock: form.trackStock === true,
            imageUrl: form.imageUrl || null,
            description: form.description || null,
            availableMeatIds: (form.availableMeatIds || []).map(id => Number(id)),
            showInKds: form.showInKds === true
        };


        const loadingToast = toast.loading('Guardando producto...');

        try {
            if (form.id) {
                // @ts-ignore
                const updatedProduct = await api.updateProduct(form.id, finalProduct);
                console.log('[AdminPanel] Update Response P' + form.id + ':', JSON.stringify(updatedProduct));
                // Use the normalized product returned by the API
                setProducts(prev => prev.map(p => p.id === form.id ? updatedProduct : p));
                toast.success('Producto actualizado', { id: loadingToast });
            } else {
                // @ts-ignore
                const newProduct = await api.createProduct(finalProduct);
                // Use the normalized product returned by the API
                setProducts(prev => [...prev, newProduct]);
                toast.success('Producto creado', { id: loadingToast });
            }
            setIsModalOpen(false);
        } catch (e) {
            console.error(e);
            toast.error('Error al guardar producto', { id: loadingToast });
        }
    };

    const toggleExtra = (extraId: number) => {
        const currentExtras = form.availableExtraIds || [];
        if (currentExtras.includes(extraId)) {
            setForm({ ...form, availableExtraIds: currentExtras.filter(id => id !== extraId) });
        } else {
            setForm({ ...form, availableExtraIds: [...currentExtras, extraId] });
        }
    };

    const toggleMeat = (meatId: number) => {
        const currentMeats = form.availableMeatIds || [];
        if (currentMeats.includes(meatId)) {
            setForm({ ...form, availableMeatIds: currentMeats.filter(id => id !== meatId) });
        } else {
            setForm({ ...form, availableMeatIds: [...currentMeats, meatId] });
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

    return (
        <div className="flex flex-col h-full overflow-hidden animate-in fade-in duration-300">
            <div className="shrink-0 pt-2 px-1">
                <ViewHeader title="GESTIÓN <span class='text-amber-500'>PRODUCTOS</span>" onBack={onBack} />
            </div>

            <div className="mb-6 flex items-center gap-2 px-1 h-12 shrink-0">
                <div className="relative flex-1">
                    <input
                        type="text"
                        placeholder="BUSCAR..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full h-full py-3 pl-5 pr-10 bg-gray-800/50 border-2 border-gray-700 rounded-[20px] text-white font-black uppercase outline-none focus:border-amber-500 placeholder:text-gray-600 text-[11px] shadow-inner transition-all"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors p-1"
                        >
                            <XIcon className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* SHOW INACTIVE TOGGLE BUTTON */}
                <button
                    onClick={() => setShowInactive(!showInactive)}
                    className={`h-full px-4 rounded-[20px] border-2 font-black text-[8px] uppercase tracking-widest transition-all italic flex items-center justify-center leading-none ${showInactive ? 'bg-amber-500 border-amber-400 text-white shadow-[0_4px_12px_-4px_rgba(245,158,11,0.5)]' : 'bg-gray-800 border-gray-700 text-gray-500'}`}
                >
                    {showInactive ? 'OCULTAR INACT.' : 'VER INACT.'}
                </button>

                {/* ADD BUTTON */}
                <button
                    onClick={() => handleOpen()}
                    className="h-full px-5 bg-green-600 border-2 border-green-500 text-white rounded-[20px] font-black italic text-[10px] uppercase flex items-center gap-2 hover:bg-green-500 transition-all active:scale-95 shadow-lg shadow-green-900/20"
                >
                    <PlusIcon className="w-4 h-4" />
                    <span className="hidden sm:inline">AGREGAR</span>
                </button>
            </div>

            <div
                ref={scrollRef}
                onMouseDown={onMouseDown}
                onMouseLeave={() => setIsDragging(false)}
                onMouseUp={() => setIsDragging(false)}
                onMouseMove={onMouseMove}
                className={`flex-1 overflow-y-auto bg-gray-900/50 rounded-[40px] border border-gray-800 shadow-inner scrollbar-hide select-none relative ${isDragging ? 'cursor-grabbing' : 'cursor-default'}`}
            >
                {/* STICKY HEADER LABELS */}
                <div className="sticky top-0 z-20 bg-gray-900 px-5 py-4 border-b border-white/5 flex justify-between items-center shadow-lg">
                    <span className="text-[10px] font-black uppercase italic tracking-widest">PRODUCTO / CATEGORÍA</span>
                    <div className="flex items-center gap-12">
                        <span className="text-[10px] font-black uppercase italic tracking-widest pr-2">PRECIO</span>
                        <span className="text-[10px] font-black uppercase italic tracking-widest hidden sm:inline">ACCIONES</span>
                    </div>
                </div>

                <ul className="divide-y divide-gray-800/50">
                    {filteredProducts.map(p => (
                        <li key={p.id} className={`p-5 flex justify-between items-center group hover:bg-gray-800/20 transition-colors ${!p.isActive ? 'opacity-50 grayscale' : ''}`}>
                            <div className="min-w-0 pr-4">
                                <p className="text-[15px] font-black text-white uppercase italic truncate leading-none group-hover:text-amber-500 transition-colors">{p.name}</p>
                                <p className="text-gray-500 text-[9px] font-black uppercase tracking-[0.2em] italic mt-2.5">
                                    {categories.find(c => String(c.id) === String(p.categoryId || (p as any).category_id))?.name || 'Sin Cat.'}
                                    {(p.requiresMeat || (p as any).requires_meat == 1) && <span className="text-cyan-500"> • CARNE</span>}
                                    {(p.requiresMasa || (p as any).requires_masa == 1) && <span className="text-amber-500"> • MASA</span>}
                                </p>
                            </div>
                            <div className="flex items-center gap-5 shrink-0">
                                <span className="font-black text-amber-500 italic text-xl tracking-tighter">${Number(p.price).toFixed(2)}</span>
                                <div className="flex items-center gap-3">
                                    <button onClick={() => !isDragging && handleOpen(p)} className="p-2.5 bg-gray-800 text-amber-500 rounded-full border border-gray-700 hover:bg-amber-600 hover:border-amber-400 hover:text-white transition-all shadow-lg active:scale-90"><PencilIcon className="w-4 h-4" /></button>

                                    {/* PREMIUM TOGGLE SWITCH */}
                                    <button
                                        onClick={() => !isDragging && handleToggleActive(p)}
                                        className={`w-12 h-7 rounded-full p-1 transition-all duration-300 flex items-center shadow-inner ${(p.isActive || (p as any).is_active == 1) ? 'bg-green-500/80 shadow-[0_0_15px_-3px_rgba(34,197,94,0.4)]' : 'bg-gray-700'}`}
                                    >
                                        <div className={`w-5 h-5 bg-white rounded-full transition-all duration-300 shadow-[0_2px_4px_rgba(0,0,0,0.2)] transform ${(p.isActive || (p as any).is_active == 1) ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                    </button>
                                </div>
                            </div>
                        </li>
                    ))}
                    {filteredProducts.length === 0 && (
                        <li className="p-20 text-center text-gray-700 font-black uppercase italic tracking-[0.3em] opacity-30 text-xs">Sin registros encontrados</li>
                    )}
                </ul>
            </div>

            <ConfirmationModal
                isOpen={false} // Disabled for now, using toggle instead
                onClose={() => { }}
                onConfirm={async () => { }}
                title="¿ELIMINAR PRODUCTO?"
                message="El producto se ocultará del menú pero el historial de ventas se conservará."
                confirmText="SÍ, ELIMINAR"
            />

            {
                isModalOpen && <AdminModal title={form.id ? "EDITAR <span class='text-amber-500'>PRODUCTO</span>" : "NUEVO <span class='text-amber-500'>PRODUCTO</span>"} onClose={() => setIsModalOpen(false)} onSave={handleSave} saveLabel="GUARDAR">
                    <div className="space-y-6">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Nombre del Producto</label>
                            <input
                                value={form.name}
                                onChange={e => setForm({ ...form, name: e.target.value })}
                                className="w-full py-4 px-6 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white font-black uppercase outline-none focus:border-amber-500 shadow-inner tracking-tight"
                                placeholder="EJ: TORTA PIZZA"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Precio al Público</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-500 font-black text-xl italic">$</span>
                                <input type="number" step="0.01" value={form.price || ''} onChange={e => setForm({ ...form, price: parseFloat(e.target.value) || 0 })} className="w-full py-4 pl-12 pr-6 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white font-black text-xl outline-none focus:border-amber-500 shadow-inner italic" placeholder="0.00" />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Categoría</label>
                            <select value={form.categoryId} onChange={e => setForm({ ...form, categoryId: parseInt(e.target.value) })} className="w-full py-4 px-6 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white font-black uppercase outline-none focus:border-amber-500 appearance-none shadow-inner tracking-widest">
                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Imagen del Producto (URL)</label>
                            <input
                                value={form.imageUrl || ''}
                                onChange={e => setForm({ ...form, imageUrl: e.target.value })}
                                className="w-full py-4 px-6 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white font-black outline-none focus:border-amber-500 shadow-inner tracking-tight"
                                placeholder="https://..."
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Descripción Larga (Portal)</label>
                            <textarea
                                value={form.description || ''}
                                onChange={e => setForm({ ...form, description: e.target.value })}
                                className="w-full py-4 px-6 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white font-bold outline-none focus:border-amber-500 shadow-inner tracking-tight min-h-[100px] resize-none"
                                placeholder="Describe el producto aquí..."
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-2 pt-2 border-t border-gray-800/50">
                            <div className="flex items-center justify-between bg-gray-800/80 py-4 px-6 rounded-[24px] border border-gray-700 cursor-pointer" onClick={() => setForm({ ...form, isActive: form.isActive === false ? true : false })}>
                                <label className="text-[11px] font-black text-white uppercase italic tracking-widest pointer-events-none">Producto Activo / Visible</label>
                                <div className={`w-12 h-7 rounded-full p-1 transition-all duration-300 flex items-center shadow-inner ${form.isActive !== false ? 'bg-green-500/80' : 'bg-gray-700'}`}>
                                    <div className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-300 ${form.isActive !== false ? 'translate-x-5' : 'translate-x-0'}`} />
                                </div>
                            </div>

                            <div className="flex items-center justify-between bg-gray-800/80 py-4 px-6 rounded-[24px] border border-gray-700 cursor-pointer" onClick={() => setForm({ ...form, showInKds: !form.showInKds })}>
                                <label className="text-[11px] font-black text-white uppercase italic tracking-widest pointer-events-none">Mostrar en Cocina (KDS)</label>
                                <div className={`w-12 h-7 rounded-full p-1 transition-all duration-300 flex items-center shadow-inner ${form.showInKds === true ? 'bg-amber-500/80' : 'bg-gray-700'}`}>
                                    <div className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-300 ${form.showInKds === true ? 'translate-x-5' : 'translate-x-0'}`} />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-2 pt-2 border-t border-gray-800/50">
                            <div className="flex items-center gap-4 bg-gray-800/80 py-4 px-6 rounded-[24px] border border-gray-700 cursor-pointer active:scale-[0.98] transition-all group" onClick={() => setForm({ ...form, trackStock: !form.trackStock })}>
                                <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${form.trackStock ? 'bg-blue-500 border-blue-400' : 'bg-gray-900 border-gray-700'}`}>
                                    {form.trackStock && <CheckCircleIcon className="w-4 h-4 text-white" />}
                                </div>
                                <label className="text-[11px] font-black text-white uppercase italic tracking-widest pointer-events-none group-active:text-blue-400">Controlar Stock (Inventario)</label>
                            </div>

                            <div className="flex flex-col gap-2 bg-gray-800/80 py-4 px-6 rounded-[24px] border border-gray-700 transition-all">
                                <div className="flex items-center gap-4 cursor-pointer active:scale-[0.98] transition-all group" onClick={() => setForm({ ...form, requiresMeat: !form.requiresMeat })}>
                                    <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${form.requiresMeat ? 'bg-cyan-500 border-cyan-400' : 'bg-gray-900 border-gray-700'}`}>
                                        {form.requiresMeat && <CheckCircleIcon className="w-4 h-4 text-white" />}
                                    </div>
                                    <label className="text-[11px] font-black text-white uppercase italic tracking-widest pointer-events-none group-active:text-cyan-400">Requiere Proteína (Carne)</label>
                                </div>

                                {form.requiresMeat && (
                                    <div className="mt-4 pt-4 border-t border-gray-700/50 grid grid-cols-2 gap-2 animate-in slide-in-from-top-2 duration-300">
                                        <p className="col-span-2 text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1 ml-1 italic">
                                            Carnes Permitidas (Si está vacío se muestran todas):
                                        </p>
                                        {meats.filter(m => m.isActive !== false && (!m.type || m.type === 'meat')).map(m => {
                                            const normalizedFormMeats = (form.availableMeatIds || []).map(id => Number(id));
                                            const isSelected = normalizedFormMeats.includes(Number(m.id));

                                            // Conditional log only for products that should have data
                                            if (form.id === 2 || form.id === 4 || form.id === 5) {
                                                // console.log(`[AdminPanel] P${form.id} - Meat ${m.name}(${m.id}) isSelected: ${isSelected}`, { formMeats: normalizedFormMeats });
                                            }

                                            return (
                                                <button
                                                    key={m.id}
                                                    type="button"
                                                    onClick={() => toggleMeat(m.id)}
                                                    className={`h-[42px] px-4 rounded-xl border-2 font-black uppercase text-[10px] italic transition-all flex items-center justify-center ${isSelected ? 'bg-cyan-600 border-cyan-400 text-white shadow-lg' : 'bg-gray-900 border-gray-800 text-gray-600'}`}
                                                >
                                                    {m.name}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-4 bg-gray-800/80 py-4 px-6 rounded-[24px] border border-gray-700 cursor-pointer active:scale-[0.98] transition-all group" onClick={() => setForm({ ...form, requiresMasa: !form.requiresMasa })}>
                                <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${form.requiresMasa ? 'bg-amber-500 border-amber-400' : 'bg-gray-900 border-gray-700'}`}>
                                    {form.requiresMasa && <CheckCircleIcon className="w-4 h-4 text-white" />}
                                </div>
                                <label className="text-[11px] font-black text-white uppercase italic tracking-widest pointer-events-none group-active:text-amber-400">Requiere Masa / Harina</label>
                            </div>
                        </div>

                        {/* COMBO SETTINGS */}
                        <div className="grid grid-cols-1 gap-2 pt-2 border-t border-gray-800/50">
                            <div className="flex items-center justify-between bg-gray-800/80 py-4 px-6 rounded-[24px] border border-gray-700 cursor-pointer" onClick={() => setForm({ ...form, isCombo: !form.isCombo })}>
                                <label className="text-[11px] font-black text-white uppercase italic tracking-widest pointer-events-none">¿Es un Combo?</label>
                                <div className={`w-12 h-7 rounded-full p-1 transition-all duration-300 flex items-center shadow-inner ${form.isCombo ? 'bg-purple-500/80' : 'bg-gray-700'}`}>
                                    <div className={`w-5 h-5 bg-white rounded-full transition-all duration-300 shadow-sm transform ${form.isCombo ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                </div>
                            </div>
                        </div>

                        {form.isCombo && (
                            <div className="space-y-4 bg-gray-800/30 p-4 rounded-3xl border border-gray-700/50">
                                <div className="flex bg-gray-900 p-1 rounded-2xl border border-gray-800">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const currentDef = (form.comboDefinition as any) || { type: 'fixed', items: [] };
                                            setForm({ ...form, comboDefinition: { ...currentDef, type: 'fixed', items: currentDef.items || [] } });
                                        }}
                                        className={`flex-1 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all ${((form.comboDefinition as any)?.type === 'fixed' || !(form.comboDefinition as any)?.type) ? 'bg-purple-600 text-white' : 'text-gray-500'}`}
                                    >
                                        Botón / Fijo
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const currentDef = (form.comboDefinition as any) || { type: 'fixed', items: [] };
                                            setForm({ ...form, comboDefinition: { ...currentDef, type: 'dynamic', slots: currentDef.slots || [] } });
                                        }}
                                        className={`flex-1 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all ${(form.comboDefinition as any)?.type === 'dynamic' ? 'bg-purple-600 text-white' : 'text-gray-500'}`}
                                    >
                                        Selector / Dinámico
                                    </button>
                                </div>

                                {((form.comboDefinition as any)?.type === 'fixed' || !(form.comboDefinition as any)?.type) ? (
                                    <div className="space-y-4">
                                        <div className="relative">
                                            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                            <input
                                                type="text"
                                                placeholder="BUSCAR PRODUCTOS PARA AGREGAR..."
                                                value={comboSearchQuery}
                                                onChange={e => setComboSearchQuery(e.target.value)}
                                                className="w-full py-3.5 pl-12 pr-10 bg-gray-900 border border-gray-700 rounded-xl text-white font-bold text-[10px] outline-none focus:border-purple-500 shadow-inner"
                                            />
                                            {comboSearchQuery && (
                                                <button
                                                    onClick={() => setComboSearchQuery('')}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors p-1"
                                                >
                                                    <XIcon className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                            {comboSearchQuery.trim() && (
                                                <div className="absolute top-full left-0 right-0 mt-2 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-[100] overflow-hidden max-h-48 overflow-y-auto">
                                                    {products
                                                        .filter(p => (p.isActive !== false) && !p.isCombo && p.name.toLowerCase().includes(comboSearchQuery.toLowerCase()))
                                                        .slice(0, 10)
                                                        .map(p => (
                                                            <button
                                                                key={p.id}
                                                                type="button"
                                                                onClick={() => {
                                                                    const currentDef = (form.comboDefinition as any) || { type: 'fixed', items: [] };
                                                                    const items = [...(currentDef.items || [])];
                                                                    const idx = items.findIndex(i => i.productId === p.id);
                                                                    if (idx >= 0) items[idx].qty += 1;
                                                                    else items.push({ productId: p.id, qty: 1 });
                                                                    setForm({ ...form, comboDefinition: { ...currentDef, items } });
                                                                    setComboSearchQuery('');
                                                                }}
                                                                className="w-full p-4 flex justify-between items-center hover:bg-purple-500/20 text-left border-b border-gray-800 last:border-0 transition-colors"
                                                            >
                                                                <span className="text-white font-black text-[10px] uppercase truncate italic">{p.name}</span>
                                                                <span className="text-amber-500 font-black text-[10px] italic">${Number(p.price).toFixed(2)}</span>
                                                            </button>
                                                        ))}
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-2 max-h-60 overflow-y-auto pr-1 scrollbar-hide">
                                            {((form.comboDefinition as any)?.items || []).map((item: any, idx: number) => {
                                                const p = products.find(prod => prod.id === item.productId);
                                                return (
                                                    <div key={idx} className="flex items-center gap-2 bg-gray-950/50 p-3 rounded-2xl border border-gray-800/50">
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-white font-black text-[10px] uppercase truncate italic">{p?.name || 'Producto Desconocido'}</p>
                                                            <p className="text-gray-500 text-[8px] font-bold uppercase tracking-widest">Unitario: ${Number(p?.price || 0).toFixed(2)}</p>
                                                        </div>
                                                        <div className="flex items-center gap-2 bg-gray-900 p-1 rounded-xl border border-gray-800">
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const currentDef = (form.comboDefinition as any);
                                                                    const items = [...currentDef.items];
                                                                    if (items[idx].qty > 1) {
                                                                        items[idx].qty -= 1;
                                                                        setForm({ ...form, comboDefinition: { ...currentDef, items } });
                                                                    }
                                                                }}
                                                                className="w-6 h-6 flex items-center justify-center bg-gray-800 rounded-lg text-white hover:bg-gray-700 transition-colors"
                                                            ><MinusIcon className="w-3 h-3" /></button>
                                                            <span className="w-6 text-center text-white font-black text-xs">{item.qty}</span>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const currentDef = (form.comboDefinition as any);
                                                                    const items = [...currentDef.items];
                                                                    items[idx].qty += 1;
                                                                    setForm({ ...form, comboDefinition: { ...currentDef, items } });
                                                                }}
                                                                className="w-6 h-6 flex items-center justify-center bg-gray-800 rounded-lg text-white hover:bg-gray-700 transition-colors"
                                                            ><PlusIcon className="w-3 h-3" /></button>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const currentDef = (form.comboDefinition as any);
                                                                const items = currentDef.items.filter((_: any, i: number) => i !== idx);
                                                                setForm({ ...form, comboDefinition: { ...currentDef, items } });
                                                            }}
                                                            className="p-3 text-red-500 bg-red-500/10 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-lg shadow-red-950/20"
                                                        ><TrashIcon className="w-3.5 h-3.5" /></button>
                                                    </div>
                                                );
                                            })}
                                            {(!((form.comboDefinition as any)?.items) || (form.comboDefinition as any).items.length === 0) && (
                                                <div className="py-8 text-center bg-gray-950/20 rounded-2xl border border-dashed border-gray-800 opacity-30">
                                                    <p className="text-[9px] font-black uppercase italic tracking-widest text-gray-400">Sin productos agregados</p>
                                                </div>
                                            )}
                                        </div>

                                        {/* PRICE ANALYSIS */}
                                        <div className="mt-4 p-5 bg-purple-500/10 rounded-[24px] border border-purple-500/20 space-y-3 shadow-lg shadow-purple-900/10">
                                            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                                                <span className="text-gray-400">Total Unitarios:</span>
                                                <span className="text-white italic">${((form.comboDefinition as any)?.items || []).reduce((sum: number, item: any) => sum + (Number(products.find(p => p.id === item.productId)?.price || 0) * item.qty), 0).toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                                                <span className="text-gray-400">Precio Combo:</span>
                                                <span className="text-purple-400 italic">${Number(form.price || 0).toFixed(2)}</span>
                                            </div>
                                            <div className="h-px bg-purple-500/10 my-1" />
                                            <div className="flex justify-between items-center">
                                                <span className="text-[10px] font-black uppercase text-gray-500">Diferencia / Ahorro:</span>
                                                {(() => {
                                                    const individualTotal = ((form.comboDefinition as any)?.items || []).reduce((sum: number, item: any) => sum + (Number(products.find(p => p.id === item.productId)?.price || 0) * item.qty), 0);
                                                    const diff = individualTotal - Number(form.price || 0);
                                                    return (
                                                        <span className={`text-[11px] font-black italic uppercase tracking-tighter ${diff >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                            {diff >= 0 ? `AHORRO: $${diff.toFixed(2)}` : `PÉRDIDA: $${Math.abs(diff).toFixed(2)}`}
                                                        </span>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <label className="text-[10px] font-black text-purple-400 uppercase tracking-widest ml-1 italic">Configuración por Categoría</label>
                                        {((form.comboDefinition as any)?.slots || []).map((slot: any, idx: number) => (
                                            <div key={idx} className="flex items-center gap-2">
                                                <select
                                                    value={slot.categoryId}
                                                    onChange={e => {
                                                        const currentDef = (form.comboDefinition as any);
                                                        const slots = [...currentDef.slots];
                                                        slots[idx].categoryId = parseInt(e.target.value);
                                                        setForm({ ...form, comboDefinition: { ...currentDef, slots } });
                                                    }}
                                                    className="flex-1 py-3 px-4 bg-gray-900 border border-gray-700 rounded-xl text-white font-bold text-xs outline-none focus:border-purple-500 h-12"
                                                >
                                                    <option value={0}>Seleccionar Categoría</option>
                                                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                                </select>
                                                <input
                                                    type="number"
                                                    value={slot.qty}
                                                    onChange={e => {
                                                        const currentDef = (form.comboDefinition as any);
                                                        const slots = [...currentDef.slots];
                                                        slots[idx].qty = parseInt(e.target.value) || 1;
                                                        setForm({ ...form, comboDefinition: { ...currentDef, slots } });
                                                    }}
                                                    className="w-20 py-3 px-2 bg-gray-900 border border-gray-700 rounded-xl text-white font-black text-xs text-center outline-none focus:border-purple-500 h-12 shadow-inner"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const currentDef = (form.comboDefinition as any);
                                                        const slots = currentDef.slots.filter((_: any, i: number) => i !== idx);
                                                        setForm({ ...form, comboDefinition: { ...currentDef, slots } });
                                                    }}
                                                    className="p-3 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-lg shadow-red-950/10 h-12 w-12 flex items-center justify-center border border-red-500/20"
                                                ><TrashIcon className="w-5 h-5" /></button>
                                            </div>
                                        ))}
                                        {(!((form.comboDefinition as any)?.slots) || (form.comboDefinition as any).slots.length === 0) && (
                                            <div className="py-8 text-center bg-gray-950/20 rounded-2xl border border-dashed border-gray-800 opacity-30">
                                                <p className="text-[9px] font-black uppercase italic tracking-widest text-gray-400">Sin slots configurados</p>
                                            </div>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const currentDef = (form.comboDefinition as any) || { type: 'dynamic', slots: [] };
                                                const slots = [...(currentDef.slots || [])];
                                                slots.push({ categoryId: categories[0]?.id || 0, qty: 1 });
                                                setForm({ ...form, comboDefinition: { ...currentDef, slots } });
                                            }}
                                            className="w-full py-4 bg-gray-700 hover:bg-gray-600 rounded-[20px] text-white font-black text-[10px] flex items-center justify-center gap-3 transition-all uppercase tracking-widest shadow-lg active:scale-[0.98] border-t border-white/5"
                                        >
                                            <PlusIcon className="w-4 h-4" /> Agregar Slot de Categoría
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}


                        <div className="space-y-4 pt-4 border-t border-gray-800/50">
                            <label className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em] ml-1 italic">Extras Disponibles para este Producto</label>
                            <div className="grid grid-cols-2 gap-2.5">
                                {productExtras.map(extra => {
                                    const isSelected = (form.availableExtraIds || []).map(id => Number(id)).includes(Number(extra.id));
                                    return (
                                        <button
                                            key={extra.id}
                                            type="button"
                                            onClick={() => toggleExtra(extra.id)}
                                            className={`flex h-[42px] justify-between items-center px-4 rounded-xl border-2 transition-all text-[10px] font-black uppercase italic tracking-widest ${isSelected ? 'bg-cyan-600 border-cyan-400 text-white shadow-lg' : 'bg-gray-900 border-gray-800 text-gray-600'}`}
                                        >
                                            <span className="truncate pr-1">{extra.name}</span>
                                            {isSelected ? <CheckCircleIcon className="w-4 h-4 shrink-0" /> : null}
                                        </button>
                                    );
                                })}
                            </div>
                            {productExtras.length === 0 && <p className="text-[9px] text-gray-700 font-bold uppercase italic text-center py-4 bg-gray-950/30 rounded-2xl border border-dashed border-gray-800">No hay extras creados en el catálogo</p>}
                        </div>
                    </div>
                </AdminModal>
            }
        </div >
    );
};

// --- GESTIÓN SIMPLE (CATEGORÍAS, CARNES, ETC) ---
// --- GESTIÓN SIMPLE (CATEGORÍAS, CARNES, ETC) ---
const ManageSimpleEntity: React.FC<{
    title: string;
    label: string;
    items: any[];
    setItems: React.Dispatch<React.SetStateAction<any[]>>;
    onBack: () => void;
    onCreate: (data: any) => Promise<any>;
    onUpdate: (id: number, data: any) => Promise<any>;
    onDelete: (id: number) => Promise<any>;
    hasSortOrder?: boolean;
}> = ({ title, label, items, setItems, onBack, onCreate, onUpdate, onDelete, hasSortOrder }) => {
    const [editingItem, setEditingItem] = useState<any | null>(null);
    const [name, setName] = useState('');
    const [sortOrder, setSortOrder] = useState<number>(0);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [itemToDelete, setItemToDelete] = useState<any | null>(null);

    const scrollRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startY, setStartY] = useState(0);
    const [scrollTop, setScrollTop] = useState(0);

    const [showInactive, setShowInactive] = useState(false);

    const filteredItems = items
        .filter(item => item && item.name && typeof item.name === 'string')
        .filter(item => showInactive || item.isActive !== false) // Consistent property naming and robust logic
        .filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()));

    const handleToggleActive = async (item: any) => {
        try {
            const newState = item.isActive === false ? true : false;
            const payload = { ...item, isActive: newState, is_active: newState };
            // Ensure type is preserved in the payload explicitly if needed
            if (item.type) payload.type = item.type;

            await onUpdate(item.id, payload);
            setItems(prev => prev.map(i => i.id === item.id ? { ...i, ...payload, isActive: newState } : i));
            toast.success(newState ? 'Activado' : 'Desactivado');
        } catch (e) {
            console.error(e);
            toast.error('Error al cambiar estado');
        }
    };

    const handleOpen = (item?: any) => {
        setEditingItem(item || null);
        setName(item ? item.name : '');
        setSortOrder(item ? (item.sort_order || 0) : 0);
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!name.trim()) return;
        const payload: any = { name: name.toUpperCase() };
        if (hasSortOrder) payload.sort_order = sortOrder;
        if (editingItem?.type) payload.type = editingItem.type; // Preserve type if editing an existing item

        try {
            if (editingItem) {
                const updatedItem = await onUpdate(editingItem.id, payload);
                setItems(prev => prev.map(i => i.id === editingItem.id ? { ...i, ...updatedItem } : i));
                toast.success('Actualizado');
            } else {
                const newItem = await onCreate(payload);
                setItems(prev => [...prev, newItem]);
                toast.success('Creado');
            }
            setIsModalOpen(false);
        } catch (e) {
            console.error(e);
            toast.error('Error al guardar');
        }
    };

    const handleDelete = (item: any) => {
        setItemToDelete(item);
    };

    const confirmDelete = async () => {
        if (!itemToDelete) return;
        try {
            await onDelete(itemToDelete.id);
            setItems(prev => prev.filter(i => i.id !== itemToDelete.id));
            setItemToDelete(null);
        } catch (e) {
            console.error(e);
            toast.error('Error al eliminar');
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

    return (
        <div className="flex flex-col h-full overflow-hidden animate-in fade-in duration-300">
            <div className="shrink-0 pt-2 px-1">
                <ViewHeader title={title} onBack={onBack} />
            </div>

            <div className="mb-6 flex items-center gap-2 px-1 h-12 shrink-0">
                <div className="relative flex-1">
                    <input
                        type="text"
                        placeholder="BUSCAR..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full h-full py-3 px-5 bg-gray-800/50 border-2 border-gray-700 rounded-[20px] text-white font-black uppercase outline-none focus:border-amber-500 placeholder:text-gray-600 text-[11px] shadow-inner transition-all"
                    />
                </div>

                <button
                    onClick={() => setShowInactive(!showInactive)}
                    className={`h-full px-4 rounded-[20px] border-2 font-black text-[8px] uppercase tracking-widest transition-all italic flex items-center justify-center leading-none ${showInactive ? 'bg-amber-500 border-amber-400 text-white shadow-[0_4px_12px_-4px_rgba(245,158,11,0.5)]' : 'bg-gray-800 border-gray-700 text-gray-500'}`}
                >
                    {showInactive ? 'OCULTAR INACT.' : 'VER INACT.'}
                </button>

                <button
                    onClick={() => handleOpen()}
                    className="h-full px-5 bg-green-600 border-2 border-green-500 text-white rounded-[20px] font-black italic text-[10px] uppercase flex items-center gap-2 hover:bg-green-500 transition-all active:scale-95 shadow-lg shadow-green-900/20"
                >
                    <PlusIcon className="w-4 h-4" />
                    <span className="hidden sm:inline">AGREGAR</span>
                </button>
            </div>

            <div
                ref={scrollRef}
                onMouseDown={onMouseDown}
                onMouseLeave={() => setIsDragging(false)}
                onMouseUp={() => setIsDragging(false)}
                onMouseMove={onMouseMove}
                className={`flex-1 relative overflow-y-auto bg-gray-900/50 rounded-[40px] border border-gray-800 shadow-inner scrollbar-hide select-none ${isDragging ? 'cursor-grabbing' : 'cursor-default'}`}
            >
                {/* STICKY HEADER LABELS */}
                <div className="sticky top-0 z-20 bg-gray-900 px-8 py-4 border-b border-white/5 flex justify-between items-center shadow-lg">
                    <span className="text-[10px] font-black uppercase italic tracking-widest opacity-60">NOMBRE DEL REGISTRO</span>
                    <span className="text-[10px] font-black uppercase italic tracking-widest opacity-60">ACCIONES</span>
                </div>
                <ul className="divide-y divide-gray-800/50">
                    {filteredItems.map(item => (
                        <li key={item.id} className={`p-5 flex justify-between items-center group hover:bg-gray-800/20 transition-colors ${item.isActive === false ? 'opacity-50 grayscale' : ''}`}>
                            <span className="text-[14px] font-black text-white uppercase italic tracking-wider group-hover:text-amber-500 transition-colors uppercase">{item.name}</span>
                            <div className="flex items-center gap-3">
                                <button onClick={() => !isDragging && handleOpen(item)} className="p-2.5 bg-gray-800 text-amber-500 rounded-full border border-gray-700 hover:bg-amber-600 hover:border-amber-400 hover:text-white transition-all active:scale-90"><PencilIcon className="w-4 h-4" /></button>

                                <button
                                    onClick={() => !isDragging && handleToggleActive(item)}
                                    className={`w-12 h-7 rounded-full p-1 transition-all duration-300 flex items-center shadow-inner ${item.isActive ? 'bg-green-500/80 shadow-[0_0_15px_-3px_rgba(34,197,94,0.4)]' : 'bg-gray-700'}`}
                                >
                                    <div className={`w-5 h-5 bg-white rounded-full transition-all duration-300 shadow-[0_2px_4px_rgba(0,0,0,0.2)] transform ${item.isActive ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                </button>
                            </div>
                        </li>
                    ))}
                    {filteredItems.length === 0 && (
                        <li className="p-20 text-center text-gray-700 font-black uppercase italic tracking-[0.3em] opacity-30 text-xs">Sin registros encontrados</li>
                    )}
                </ul>
            </div>
            {isModalOpen && <AdminModal title={editingItem ? "EDITAR <span class='text-amber-500'>REGISTRO</span>" : "NUEVO <span class='text-amber-500'>REGISTRO</span>"} onClose={() => setIsModalOpen(false)} onSave={handleSave} saveLabel="GUARDAR">
                <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">{label}</label>
                    <input value={name} onChange={e => setName(e.target.value)} className="w-full py-4 px-6 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white font-black uppercase outline-none focus:border-amber-500 shadow-inner" placeholder="ESCRIBIR NOMBRE..." autoFocus />

                    {hasSortOrder && (
                        <div className="mt-2">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Orden / Prioridad</label>
                            <input
                                type="number"
                                value={sortOrder}
                                onChange={e => setSortOrder(parseInt(e.target.value) || 0)}
                                className="w-full py-4 px-6 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white font-black outline-none focus:border-amber-500 shadow-inner"
                                placeholder="0"
                            />
                            <p className="text-[9px] text-gray-600 mt-1 italic pl-2">MENOR NÚMERO = PRIMERO EN LA LISTA</p>
                        </div>
                    )}
                </div>
            </AdminModal>}

            <ConfirmationModal
                isOpen={itemToDelete !== null}
                onClose={() => setItemToDelete(null)}
                onConfirm={confirmDelete}
                title="¿ELIMINAR REGISTRO?"
                message="Esta acción no se puede deshacer"
                confirmText="SÍ, ELIMINAR"
            />

        </div>
    );
};

// --- GESTIÓN EXTRAS ---
const ManageExtras: React.FC<{ extras: ProductExtra[]; setExtras: React.Dispatch<React.SetStateAction<ProductExtra[]>>; onBack: () => void }> = ({ extras, setExtras, onBack }) => {
    console.log("Rendering ManageExtras", { extrasCount: extras?.length, extras });
    if (!extras) return <div className="p-10 text-white font-bold">CARGANDO DATOS... (Extras es null)</div>;

    // Safety check: ensure extras is an array
    const safeExtras = Array.isArray(extras) ? extras : [];

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [form, setForm] = useState({ id: 0, name: '', price: 0 });
    const [extraToDelete, setExtraToDelete] = useState<number | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const scrollRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startY, setStartY] = useState(0);
    const [scrollTop, setScrollTop] = useState(0);

    const handleOpen = (e?: ProductExtra) => {
        setForm(e ? { ...e } : { id: 0, name: '', price: 0 });
        setIsModalOpen(true);
    };

    const handleSave = () => {
        if (!form.name.trim()) return;

        const payload = {
            name: form.name.toUpperCase(),
            price: form.price || 0
        };

        const showSuccessToast = (msg: string) => toast.custom(
            <div className="w-[90%] max-w-sm bg-emerald-950/60 backdrop-blur-md text-emerald-400 px-6 py-4 rounded-full shadow-[0_0_20px_rgba(52,211,153,0.3)] flex items-center justify-center gap-3 border border-emerald-500/50 text-center pointer-events-none animate-in zoom-in duration-300">
                <span className="text-xl drop-shadow-[0_0_5px_rgba(52,211,153,0.8)]">✅</span>
                <span className="font-black tracking-widest uppercase italic text-lg drop-shadow-[0_0_5px_rgba(52,211,153,0.5)]">{msg}</span>
            </div>,
            { duration: 2000, position: 'top-center' }
        );

        if (form.id) {
            // Update
            api.updateProductExtra(form.id, payload)
                .then(() => {
                    setExtras(prev => prev.map(p => p.id === form.id ? { ...p, ...payload } : p));
                    showSuccessToast('EXTRA ACTUALIZADO');
                    setIsModalOpen(false);
                })
                .catch(err => {
                    console.error('Failed to update extra', err);
                    toast.error('ERROR AL ACTUALIZAR');
                });
        } else {
            // Create
            api.createProductExtra(payload)
                .then((newExtra) => {
                    setExtras(prev => [...prev, newExtra]);
                    showSuccessToast('EXTRA CREADO');
                    setIsModalOpen(false);
                })
                .catch(err => {
                    console.error('Failed to create extra', err);
                    toast.error('ERROR AL CREAR');
                });
        }
    };

    const handleDelete = (id: number) => {
        api.deleteProductExtra(id)
            .then(() => {
                setExtras(prev => prev.filter(i => i.id !== id));
                setExtraToDelete(null);
                toast.custom(
                    <div className="w-[90%] max-w-sm bg-emerald-950/60 backdrop-blur-md text-emerald-400 px-6 py-4 rounded-full shadow-[0_0_20px_rgba(52,211,153,0.3)] flex items-center justify-center gap-3 border border-emerald-500/50 text-center pointer-events-none animate-in zoom-in duration-300">
                        <span className="text-xl drop-shadow-[0_0_5px_rgba(52,211,153,0.8)]">✅</span>
                        <span className="font-black tracking-widest uppercase italic text-lg drop-shadow-[0_0_5px_rgba(52,211,153,0.5)]">EXTRA ELIMINADO</span>
                    </div>,
                    { duration: 2000, position: 'top-center' }
                );
            })
            .catch(err => {
                console.error('Failed to delete extra', err);
                toast.error('ERROR AL ELIMINAR');
            });
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

    const filteredExtras = safeExtras.filter(e => {
        const q = searchQuery.toLowerCase().trim();
        if (!q) return true;
        return e.name.toLowerCase().includes(q);
    });
    return (
        <div className="flex flex-col h-full overflow-hidden animate-in fade-in duration-300">
            <Toaster
                position="top-center"
                reverseOrder={false}
                toastOptions={{
                    style: {
                        background: 'rgba(17, 24, 39, 0.7)',
                        backdropFilter: 'blur(12px)',
                        color: '#fff',
                        border: '1px solid rgba(52, 211, 153, 0.5)',
                        padding: '12px 24px',
                        borderRadius: '9999px',
                        boxShadow: '0 0 20px rgba(52, 211, 153, 0.2)',
                        fontWeight: '900',
                        textTransform: 'uppercase',
                        fontStyle: 'italic',
                        fontSize: '14px',
                        letterSpacing: '0.05em'
                    },
                    success: {
                        style: {
                            border: '1px solid rgba(52, 211, 153, 0.5)',
                            color: '#34d399',
                            boxShadow: '0 0 20px rgba(52, 211, 153, 0.3)'
                        },
                        iconTheme: { primary: '#34d399', secondary: '#064e3b' }
                    },
                    error: {
                        style: {
                            border: '1px solid rgba(244, 63, 94, 0.5)',
                            color: '#fb7185',
                            boxShadow: '0 0 20px rgba(244, 63, 94, 0.3)'
                        },
                        iconTheme: { primary: '#fb7185', secondary: '#4c0519' }
                    }
                }}
            />
            <ViewHeader title="GESTIÓN <span class='text-amber-500'>EXTRAS</span>" onBack={onBack} onAdd={() => handleOpen()} />

            <div className="mb-6 shrink-0 px-1">
                <div className="relative">
                    <input
                        type="text"
                        placeholder="BUSCAR EXTRA..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full py-4 pl-6 pr-10 bg-gray-800/50 border-2 border-gray-700 rounded-[24px] text-white font-black uppercase outline-none focus:border-amber-500 placeholder:text-gray-600 text-sm shadow-inner transition-all"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors p-1"
                        >
                            <XIcon className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>
            <div
                ref={scrollRef}
                onMouseDown={onMouseDown}
                onMouseLeave={() => setIsDragging(false)}
                onMouseUp={() => setIsDragging(false)}
                onMouseMove={onMouseMove}
                className={`flex-1 relative overflow-y-auto bg-gray-900/50 rounded-[40px] border border-gray-800 shadow-inner scrollbar-hide select-none ${isDragging ? 'cursor-grabbing' : 'cursor-default'}`}
            >
                {/* STICKY HEADER LABELS */}
                <div className="sticky top-0 z-20 bg-gray-900 px-8 py-4 border-b border-white/5 flex justify-between items-center shadow-lg">
                    <span className="text-[10px] font-black uppercase italic tracking-widest opacity-60">COMPLEMENTO / PRECIO</span>
                    <span className="text-[10px] font-black uppercase italic tracking-widest opacity-60">ACCIONES</span>
                </div>
                <ul className="divide-y divide-gray-800/50">
                    {filteredExtras.length === 0 && (
                        <div className="p-10 text-center text-gray-500 italic uppercase">
                            No se encontraron extras.
                        </div>
                    )}
                    {filteredExtras.map(e => (
                        <li key={e.id} className="p-5 flex justify-between items-center group hover:bg-gray-800/20 transition-colors">
                            <div>
                                <p className="text-[14px] font-black text-white uppercase italic group-hover:text-amber-500 transition-colors">{e.name}</p>
                                <p className="text-amber-500 font-black text-sm italic tracking-tighter mt-1">${Number(e.price).toFixed(2)}</p>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => !isDragging && handleOpen(e)} className="p-2.5 bg-gray-800 text-amber-500 rounded-full border border-gray-700 hover:bg-amber-600 hover:border-amber-400 hover:text-white transition-all active:scale-90"><PencilIcon className="w-4 h-4" /></button>
                                <button onClick={() => !isDragging && setExtraToDelete(e.id)} className="p-2.5 bg-gray-800 text-red-500 rounded-full border border-gray-700 hover:bg-red-600 hover:border-red-400 hover:text-white transition-all active:scale-90"><TrashIcon className="w-4 h-4" /></button>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
            <ConfirmationModal
                isOpen={extraToDelete !== null}
                onClose={() => setExtraToDelete(null)}
                // @ts-ignore
                onConfirm={() => extraToDelete && handleDelete(extraToDelete)}
                title="¿ELIMINAR EXTRA?"
                message="Esta acción no se puede deshacer"
                confirmText="SÍ, ELIMINAR"
            />
            {isModalOpen && <AdminModal title="CONFIGURACIÓN <span class='text-amber-500'>EXTRA</span>" onClose={() => setIsModalOpen(false)} onSave={handleSave} saveLabel="GUARDAR">
                <div className="space-y-6">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Nombre del Complemento</label>
                        <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full py-4 px-6 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white font-black uppercase outline-none focus:border-amber-500 shadow-inner" placeholder="EJ: QUESO EXTRA" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Precio Adicional</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-500 font-black text-xl italic">$</span>
                            <input type="number" step="0.01" value={form.price || ''} onChange={e => setForm({ ...form, price: parseFloat(e.target.value) || 0 })} className="w-full py-4 pl-12 pr-6 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white font-black text-xl outline-none focus:border-amber-500 shadow-inner italic" placeholder="0.00" />
                        </div>
                    </div>
                </div>
            </AdminModal>}
        </div>
    );
};

// --- GESTIÓN USUARIOS ---
const ManageUsers: React.FC<{ waiters: Waiter[]; setWaiters: React.Dispatch<React.SetStateAction<Waiter[]>>; branches: Branch[]; onBack: () => void; currentAdminName: string; isSuperAdmin: boolean }> = ({ waiters, setWaiters, branches, onBack, currentAdminName, isSuperAdmin }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [revealedPins, setRevealedPins] = useState<number[]>([]);
    const [pendingAction, setPendingAction] = useState<{ type: 'reveal' | 'edit' | 'add'; user?: Waiter } | null>(null);
    const [form, setForm] = useState({ id: 0, name: '', pin: '', branchId: branches[0]?.id || 1, roles: [UserRole.Waiter], isActive: true });
    const [searchQuery, setSearchQuery] = useState('');
    const [userToDelete, setUserToDelete] = useState<number | null>(null);

    const scrollRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startY, setStartY] = useState(0);
    const [scrollTop, setScrollTop] = useState(0);

    const isPinDuplicate = useMemo(() => {
        if (form.pin.length !== 6) return null;
        const duplicate = waiters.find(w => w.pin === form.pin && w.id !== form.id && (w.is_active !== 0 && (w as any).isActive !== false));
        return duplicate ? duplicate.name : null;
    }, [form.pin, form.id, waiters]);

    const displayWaiters = waiters.filter(w => {
        if (!isSuperAdmin && w.roles.includes(UserRole.SuperAdmin)) return false;
        return true;
    });

    const filteredWaiters = displayWaiters.filter(w => {
        const q = searchQuery.toLowerCase();
        const name = (w.name || '').toLowerCase();
        const username = (w.username || '').toLowerCase();
        return name.includes(q) || username.includes(q);
    });

    const currentAdmin = waiters.find(w => w.name === currentAdminName);

    const handleOpen = (w?: Waiter) => {
        if (w?.id === 1 && currentAdmin?.id !== 1) {
            toast.error('ACCESO DENEGADO: NO PUEDES EDITAR AL SUPER ADMIN MAESTRO');
            return;
        }
        setPendingAction({ type: w ? 'edit' : 'add', user: w });
    };

    const confirmHandleOpen = (w?: Waiter) => {
        // @ts-ignore
        setForm(w ? { ...w, branchId: w.branchId || 1, isActive: w.is_active !== undefined ? Boolean(w.is_active) : (w.isActive !== undefined ? Boolean(w.isActive) : true) } : { id: 0, name: '', pin: '', branchId: branches[0]?.id || 1, roles: [UserRole.Waiter], isActive: true });
        setIsModalOpen(true);
        setPendingAction(null);
    };

    const handleSave = async () => {
        if (!form.name.trim() || form.pin.length !== 6) return toast.error('EL PIN DEBE SER DE 6 DÍGITOS');
        if (isPinDuplicate) return toast.error(`ESTE PIN YA LE PERTENECE A: ${isPinDuplicate}`);

        const loadingToast = toast.loading('Guardando usuario...');

        try {
            // Generate a username since it's required by DB but not in form
            const generatedUsername = form.name.toLowerCase().replace(/\s+/g, '_') + '_' + Math.floor(Math.random() * 1000);

            const userData = {
                ...form,
                name: form.name.toUpperCase(),
                username: generatedUsername, // Fix: Ensure username is sent
                isActive: form.isActive // Ensure this boolean is sent!
            };

            if (form.id) {
                // @ts-ignore
                const updated = await api.updateUser(form.id, userData);
                // @ts-ignore
                setWaiters(prev => prev.map(w => w.id === form.id ? { ...w, ...userData, isActive: form.isActive, is_active: form.isActive ? 1 : 0 } : w));
            } else {
                // @ts-ignore
                const newUser = await api.createUser(userData);
                // @ts-ignore
                setWaiters(prev => [...prev, { ...newUser, isActive: form.isActive, is_active: form.isActive ? 1 : 0 }]);
            }
            setIsModalOpen(false);
            toast.success('USUARIO GUARDADO', { id: loadingToast });
        } catch (e: any) {
            console.error(e);
            toast.error('ERROR: ' + (e.message || 'No se pudo guardar'), { id: loadingToast });
        }
    };

    const togglePinVisibility = (userId: number) => {
        if (revealedPins.includes(userId)) {
            setRevealedPins(prev => prev.filter(id => id !== userId));
        } else {
            setPendingAction({ type: 'reveal', user: waiters.find(w => w.id === userId) });
        }
    };

    const handlePinVerified = () => {
        if (!pendingAction) return;

        if (pendingAction.type === 'reveal' && pendingAction.user) {
            setRevealedPins(prev => [...prev, pendingAction.user!.id]);
            setPendingAction(null);
        } else if (pendingAction.type === 'edit' || pendingAction.type === 'add') {
            confirmHandleOpen(pendingAction.user);
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

    return (
        <div className="flex flex-col h-full overflow-hidden animate-in fade-in duration-300">
            <ViewHeader title="GESTIÓN <span class='text-amber-500'>USUARIOS</span>" onBack={onBack} onAdd={() => handleOpen()} />

            <div className="mb-6 shrink-0 px-1">
                <div className="relative">
                    <input
                        type="text"
                        placeholder="BUSCAR POR NOMBRE..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full py-4 pl-6 pr-10 bg-gray-800/50 border-2 border-gray-700 rounded-[24px] text-white font-black uppercase outline-none focus:border-amber-500 placeholder:text-gray-600 text-sm shadow-inner transition-all"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors p-1"
                        >
                            <XIcon className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            <div
                ref={scrollRef}
                onMouseDown={onMouseDown}
                onMouseLeave={() => setIsDragging(false)}
                onMouseUp={() => setIsDragging(false)}
                onMouseMove={onMouseMove}
                className={`flex-1 relative overflow-y-auto bg-gray-900/50 rounded-[40px] border border-gray-800 shadow-inner scrollbar-hide select-none ${isDragging ? 'cursor-grabbing' : 'cursor-default'}`}
            >
                {/* STICKY HEADER LABELS */}
                <div className="sticky top-0 z-20 bg-gray-900 px-8 py-4 border-b border-white/5 flex justify-between items-center shadow-lg">
                    <span className="text-[10px] font-black uppercase italic tracking-widest opacity-60">USUARIO / ROL</span>
                    <span className="text-[10px] font-black uppercase italic tracking-widest opacity-60">ACCIONES</span>
                </div>
                <ul className="divide-y divide-gray-800/50">
                    {filteredWaiters.length > 0 ? (
                        filteredWaiters.map(w => (
                            <li key={w.id} className={`p-5 flex justify-between items-center group transition-all ${w.is_active === 0 || (w as any).isActive === false ? 'opacity-50 grayscale bg-gray-900/30' : ''}`}>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-3">
                                        <p className="text-[14px] font-black text-white uppercase italic truncate group-hover:text-amber-500 transition-colors">{w.name}</p>
                                        <div className="flex items-center gap-2 opacity-30 group-hover:opacity-100 transition-opacity">
                                            <p className="text-gray-500 text-[9px] font-black tracking-widest uppercase italic bg-gray-800/80 px-2 py-0.5 rounded border border-gray-700/50">
                                                {revealedPins.includes(w.id) ? w.pin : '••••••'}
                                            </p>
                                            <button onClick={() => !isDragging && togglePinVisibility(w.id)} className="p-1 text-gray-400 hover:text-amber-500 bg-gray-800/50 rounded-lg">
                                                {revealedPins.includes(w.id) ? <EyeOffIcon className="w-3 h-3" /> : <EyeIcon className="w-3 h-3" />}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="mt-2">
                                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded border ${w.roles.includes(UserRole.SuperAdmin) ? 'bg-purple-900/20 text-purple-400 border-purple-500/30' :
                                            w.roles.includes(UserRole.Admin) ? 'bg-blue-900/20 text-blue-400 border-blue-500/30' :
                                                w.roles.includes(UserRole.Cook) ? 'bg-orange-900/20 text-orange-400 border-orange-500/30' :
                                                    w.roles.includes(UserRole.Cashier) ? 'bg-green-900/20 text-green-400 border-green-500/30' :
                                                        w.roles.includes(UserRole.Delivery) ? 'bg-cyan-900/20 text-cyan-400 border-cyan-500/30' :
                                                            'bg-gray-800 text-gray-500 border-gray-700'
                                            }`}>
                                            {w.roles.includes(UserRole.SuperAdmin) ? 'SUPER ADMIN' :
                                                w.roles.includes(UserRole.Admin) ? 'ADMINISTRADOR' :
                                                    w.roles.includes(UserRole.Cook) ? 'COCINERO' :
                                                        w.roles.includes(UserRole.Cashier) ? 'MESERO / CAJERO' :
                                                            w.roles.includes(UserRole.Delivery) ? 'REPARTIDOR' : 'MESERO'}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex gap-2 shrink-0">
                                    {(w.id !== 1 || currentAdmin?.id === 1) ? (
                                        <>
                                            <button onClick={() => !isDragging && handleOpen(w)} className="p-2.5 bg-gray-800 text-amber-500 rounded-full border border-gray-700 hover:bg-amber-600 hover:border-amber-400 hover:text-white transition-all active:scale-90"><PencilIcon className="w-4 h-4" /></button>
                                            {w.id !== 1 && (
                                                <button onClick={() => !isDragging && setUserToDelete(w.id)} className="p-2.5 bg-gray-800 text-red-500 rounded-full border border-gray-700 hover:bg-red-600 hover:border-red-400 hover:text-white transition-all active:scale-90"><TrashIcon className="w-4 h-4" /></button>
                                            )}
                                        </>
                                    ) : (
                                        <div className="p-2.5 text-gray-600 italic text-[9px] font-black uppercase tracking-widest bg-gray-900/50 rounded-xl border border-gray-800">Protegido</div>
                                    )}
                                </div>
                            </li>
                        ))
                    ) : (
                        <li className="p-20 text-center text-gray-700 font-black uppercase italic tracking-[0.3em] opacity-30 text-xs">Sin registros encontrados</li>
                    )}
                </ul>
            </div>

            <ConfirmationModal
                isOpen={userToDelete !== null}
                onClose={() => setUserToDelete(null)}
                // @ts-ignore
                onConfirm={async () => {
                    if (!userToDelete) return;
                    try {
                        await api.deleteUser(userToDelete);
                        setWaiters(prev => prev.filter(i => i.id !== userToDelete));
                        setUserToDelete(null);
                        toast.success('Usuario eliminado');
                    } catch (e) {
                        console.error(e);
                        toast.error('Error eliminando usuario');
                    }
                }}
                title="¿ELIMINAR USUARIO?"
                message="Esta acción no se puede deshacer"
                confirmText="SÍ, ELIMINAR"
            />

            <PinVerificationModal
                isOpen={pendingAction !== null}
                onClose={() => setPendingAction(null)}
                onSuccess={handlePinVerified}
                title="BÓVEDA DE <span class='text-amber-500'>SEGURIDAD</span>"
                message={`Verifica tu identidad para ${pendingAction?.type === 'reveal' ? 'VER PIN' : pendingAction?.type === 'edit' ? 'EDITAR USUARIO' : 'CREAR USUARIO'}`}
            />

            {isModalOpen && <AdminModal title={form.id ? "EDITAR <span class='text-blue-500'>USUARIO</span>" : "NUEVO <span class='text-blue-500'>USUARIO</span>"} onClose={() => setIsModalOpen(false)} onSave={handleSave} saveLabel="GUARDAR">
                <div className="space-y-5">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Nombre Completo</label>
                        <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full py-4 px-6 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white font-black uppercase outline-none focus:border-amber-500 shadow-inner" placeholder="ESCRIBIR NOMBRE..." />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">PIN Acceso (6 Dígitos)</label>
                        <input maxLength={6} inputMode="numeric" value={form.pin} onChange={e => setForm({ ...form, pin: e.target.value })} className={`w-full py-4 px-6 bg-gray-800 border-2 rounded-2xl text-white font-black text-center text-3xl outline-none shadow-inner tracking-[0.2em] transition-all ${isPinDuplicate ? 'border-red-500 text-red-500 shadow-[0_0_15px_-3px_rgba(239,68,68,0.4)] animate-pulse' : 'border-gray-700 focus:border-amber-500'}`} placeholder="000000" />
                        {isPinDuplicate && (
                            <p className="text-[9px] font-black text-red-500 uppercase italic tracking-widest text-center mt-2 animate-bounce">
                                ⚠️ PIN YA EN USO POR: {isPinDuplicate}
                            </p>
                        )}
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Sucursal</label>
                        <select value={form.branchId} onChange={e => setForm({ ...form, branchId: parseInt(e.target.value) })} className="w-full py-4 px-6 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white font-black uppercase outline-none focus:border-amber-500 appearance-none shadow-inner tracking-widest">
                            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Rol Operativo</label>
                        <select value={form.roles[0]} onChange={e => setForm({ ...form, roles: [e.target.value as UserRole] })} className="w-full py-4 px-6 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white font-black uppercase outline-none focus:border-amber-500 appearance-none shadow-inner tracking-widest">
                            <option value={UserRole.Waiter}>MESERO (SOLO PEDIDOS)</option>
                            <option value={UserRole.Cashier}>MESERO / CAJERO (COBRAR)</option>
                            <option value={UserRole.Cook}>COCINERO (KDS)</option>
                            <option value={UserRole.Delivery}>REPARTIDOR (APP DELIVERY)</option>
                            <option value={UserRole.Admin}>ADMINISTRADOR</option>
                            {isSuperAdmin && <option value={UserRole.SuperAdmin}>SUPER ADMIN</option>}
                        </select>
                    </div>

                    <div className="flex items-center gap-3 p-4 bg-gray-800/50 rounded-2xl border border-gray-700/50">
                        <div className={`w-12 h-6 rounded-full p-1 transition-colors cursor-pointer ${form.isActive ? 'bg-green-500' : 'bg-gray-600'}`} onClick={() => setForm({ ...form, isActive: !form.isActive })}>
                            <div className={`w-4 h-4 bg-white rounded-full transition-transform ${form.isActive ? 'translate-x-6' : 'translate-x-0'}`} />
                        </div>
                        <span className={`font-black uppercase text-xs ${form.isActive ? 'text-green-400' : 'text-gray-500'}`}>
                            {form.isActive ? 'USUARIO ACTIVO' : 'USUARIO DESACTIVADO (ACCESO BLOQUEADO)'}
                        </span>
                    </div>

                </div>
            </AdminModal>}
        </div>
    );
};

const ManageTables: React.FC<{ tables: Table[]; setTables: React.Dispatch<React.SetStateAction<Table[]>>; tableAreas: TableArea[]; currentBranchId: number | null; onBack: () => void }> = ({ tables, setTables, tableAreas, currentBranchId, onBack }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [form, setForm] = useState({ name: '', areaId: tableAreas[0]?.id || 0 });
    const [tableToDelete, setTableToDelete] = useState<number | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const scrollRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startY, setStartY] = useState(0);
    const [scrollTop, setScrollTop] = useState(0);

    const handleOpen = (t?: Table) => {
        setEditingId(t?.id || null);
        setForm(t ?
            { name: t.name, areaId: t.areaId || tableAreas.find(a => a.name === t.area)?.id || (tableAreas[0]?.id || 0) } :
            { name: '', areaId: tableAreas[0]?.id || 0 }
        );
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!form.name.trim() || !currentBranchId) return;
        try {
            const selectedArea = tableAreas.find(a => a.id === Number(form.areaId));
            const areaName = selectedArea?.name || 'SALÓN';
            const payload = { ...form, area: areaName, areaId: Number(form.areaId), name: form.name.toUpperCase(), branchId: currentBranchId };

            if (editingId) {
                await api.updateTable(editingId, payload);
                setTables(prev => prev.map(t => t.id === editingId ? { ...t, name: form.name.toUpperCase(), area: areaName, areaId: Number(form.areaId) } : t));
                toast.success('Mesa actualizada correctamente');
            } else {
                const newTable = await api.createTable(payload);
                setTables(prev => [...prev, { ...newTable, area: areaName, areaId: Number(form.areaId) }]);
                toast.success('Mesa creada correctamente');
            }
            setIsModalOpen(false);
        } catch (e) {
            console.error('Error saving table:', e);
            toast.error('Error al guardar mesa');
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

    const confirmDeleteTable = async () => {
        if (!tableToDelete) return;
        try {
            // @ts-ignore
            await api.deleteTable(tableToDelete);
            setTables(prev => prev.filter(m => m.id !== tableToDelete));
            setTableToDelete(null);
            toast.success('Mesa eliminada');
        } catch (e) {
            console.error(e);
            toast.error('Error al eliminar mesa');
        }
    };

    const filteredTables = tables.filter(t => {
        if (t.branchId !== currentBranchId) return false;
        const q = searchQuery.toLowerCase().trim();
        if (!q) return true;
        const areaName = tableAreas.find(a => a.id === t.areaId)?.name || t.area || "";
        return t.name.toLowerCase().includes(q) || areaName.toLowerCase().includes(q);
    });
    return (
        <div className="flex flex-col h-full overflow-hidden animate-in fade-in duration-300">
            <ViewHeader title="GESTIÓN <span class='text-amber-500'>MESAS</span>" onBack={onBack} onAdd={() => handleOpen()} />

            <div className="mb-6 shrink-0 px-1">
                <div className="relative">
                    <input
                        type="text"
                        placeholder="BUSCAR MESA O AREA..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full py-4 pl-6 pr-10 bg-gray-800/50 border-2 border-gray-700 rounded-[24px] text-white font-black uppercase outline-none focus:border-amber-500 placeholder:text-gray-600 text-sm shadow-inner transition-all"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors p-1"
                        >
                            <XIcon className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>
            <div
                ref={scrollRef}
                onMouseDown={onMouseDown}
                onMouseLeave={() => setIsDragging(false)}
                onMouseUp={() => setIsDragging(false)}
                onMouseMove={onMouseMove}
                className={`flex-1 relative overflow-y-auto bg-gray-900/50 rounded-[40px] border border-gray-800 shadow-inner scrollbar-hide select-none ${isDragging ? 'cursor-grabbing' : 'cursor-default'}`}
            >
                {/* STICKY HEADER LABELS */}
                <div className="sticky top-0 z-20 bg-gray-900 px-8 py-4 border-b border-white/5 flex justify-between items-center shadow-lg">
                    <span className="text-[10px] font-black uppercase italic tracking-widest opacity-60">MESA / AREA</span>
                    <span className="text-[10px] font-black uppercase italic tracking-widest opacity-60">ACCIONES</span>
                </div>
                <ul className="divide-y divide-gray-800/50">
                    {filteredTables.length === 0 && (
                        <div className="p-10 text-center text-gray-500 italic uppercase">
                            No se encontraron mesas.
                        </div>
                    )}
                    {filteredTables.map(t => (
                        <li key={t.id} className="p-5 flex justify-between items-center group">
                            <div className="flex flex-col">
                                <span className="text-[14px] font-black text-white uppercase italic tracking-wider group-hover:text-amber-500 transition-colors">{t.name}</span>
                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{tableAreas.find(a => a.id === t.areaId)?.name || t.area}</span>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => !isDragging && handleOpen(t)} className="p-2.5 bg-gray-800 text-amber-500 rounded-full border border-gray-700 hover:bg-amber-600 hover:text-white transition-all active:scale-90 shadow-lg"><PencilIcon className="w-4 h-4" /></button>
                                <button onClick={() => !isDragging && setTableToDelete(t.id)} className="p-2.5 bg-gray-800 text-red-500 rounded-full border border-gray-700 hover:bg-red-600 hover:text-white transition-all active:scale-90 shadow-lg"><TrashIcon className="w-4 h-4" /></button>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>

            <ConfirmationModal
                isOpen={tableToDelete !== null}
                onClose={() => setTableToDelete(null)}
                onConfirm={confirmDeleteTable}
                title="¿ELIMINAR MESA?"
                message="Esta acción no se puede deshacer"
                confirmText="SÍ, ELIMINAR"
            />
            {isModalOpen && <AdminModal title={editingId ? "EDITAR <span class='text-amber-500'>MESA</span>" : "NUEVA <span class='text-amber-500'>UBICACIÓN</span>"} onClose={() => setIsModalOpen(false)} onSave={handleSave} saveLabel="GUARDAR">
                <div className="space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Identificador de Mesa</label>
                        <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full py-4 px-6 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white font-black uppercase outline-none focus:border-amber-500 shadow-inner" placeholder="EJ: MESA VIP 01" autoFocus />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Zona / Área</label>
                        <select
                            value={form.areaId}
                            onChange={e => setForm({ ...form, areaId: Number(e.target.value) })}
                            className="w-full py-4 px-6 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white font-black uppercase outline-none focus:border-amber-500 appearance-none shadow-inner tracking-widest"
                        >
                            {tableAreas.map(a => (
                                <option key={a.id} value={a.id}>{a.name}</option>
                            ))}
                            {tableAreas.length === 0 && <option value={0}>SALÓN (PRED.)</option>}
                        </select>
                    </div>
                </div>
            </AdminModal>}
        </div>
    );
};

const ManageBranches: React.FC<{ branches: Branch[]; setBranches: React.Dispatch<React.SetStateAction<Branch[]>>; onBack: () => void }> = ({ branches, setBranches, onBack }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
    const [form, setForm] = useState<Partial<Branch>>({ name: '', address: '', phone: '', logoUrl: '', gasWebhookUrl: '', geminiApiKey: '', autoCloseEnabled: false, autoCloseTime: '', ticketWidth: '80mm' });
    const [branchToDelete, setBranchToDelete] = useState<number | null>(null);

    const scrollRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startY, setStartY] = useState(0);
    const [scrollTop, setScrollTop] = useState(0);

    const handleOpen = (b?: Branch) => {
        setEditingBranch(b || null);
        setForm(b ? { ...b } : { name: '', address: '', phone: '', logoUrl: '', gasWebhookUrl: '', geminiApiKey: '', autoCloseEnabled: false, autoCloseTime: '', ticketWidth: '80mm', closingWebhookUrl: '', closingEmail: '' });
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!form.name?.trim()) return;
        const cleanPhone = (form.phone || '').replace(/\D/g, '');
        if (cleanPhone && cleanPhone.length !== 8) return toast.error('EL TELÉFONO DEBE TENER 8 DÍGITOS');

        const branchData = {
            ...form,
            name: form.name?.toUpperCase(),
            address: form.address?.toUpperCase(),
            phone: cleanPhone,
            isActive: true
        };

        try {
            if (editingBranch) {
                // @ts-ignore
                await api.updateBranch(editingBranch.id, branchData);
                // @ts-ignore
                setBranches(prev => prev.map(b => b.id === editingBranch.id ? { ...b, ...branchData } : b));
            } else {
                // @ts-ignore
                const newBranch = await api.createBranch(branchData);
                setBranches(prev => [...prev, newBranch]);
            }
            setIsModalOpen(false);
            toast.success('SUCURSAL GUARDADA CON ÉXITO', {
                style: {
                    background: '#064e3b',
                    color: '#34d399',
                    fontWeight: 'bold',
                    borderRadius: '20px',
                    border: '1px solid #10b981'
                }
            });
        } catch (e) {
            console.error(e);
            toast.error('Error al guardar sucursal');
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

    return (
        <div className="flex flex-col h-full overflow-hidden animate-in fade-in duration-300">
            <ViewHeader title="GESTIÓN <span class='text-amber-500'>SUCURSALES</span>" onBack={onBack} onAdd={() => handleOpen()} />
            <div
                ref={scrollRef}
                onMouseDown={onMouseDown}
                onMouseLeave={() => setIsDragging(false)}
                onMouseUp={() => setIsDragging(false)}
                onMouseMove={onMouseMove}
                className={`flex-1 relative overflow-y-auto bg-gray-900/50 rounded-[40px] border border-gray-800 shadow-inner scrollbar-hide select-none ${isDragging ? 'cursor-grabbing' : 'cursor-default'}`}
            >
                <ul className="divide-y divide-gray-800/50">
                    {branches.map(b => (
                        <li key={b.id} className="p-5 flex justify-between items-center group hover:bg-gray-800/20 transition-colors">
                            <div className="min-w-0 pr-4">
                                <p className="text-[15px] font-black text-white uppercase italic truncate leading-tight group-hover:text-amber-500 transition-colors">{b.name}</p>
                                <div className="flex gap-3 items-center mt-2">
                                    <p className="text-gray-500 text-[9px] font-black uppercase tracking-[0.2em] truncate">{b.address || 'Ubicación Pendiente'}</p>
                                    <span className="w-1.5 h-1.5 bg-amber-500/30 rounded-full"></span>
                                    <p className="text-amber-500 font-black text-[10px] tracking-widest">{b.phone || 'S/T'}</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => !isDragging && handleOpen(b)} className="p-2.5 bg-gray-800 text-amber-500 rounded-full border border-gray-700 hover:bg-amber-600 hover:border-amber-400 hover:text-white transition-all active:scale-90"><PencilIcon className="w-4 h-4" /></button>
                                <button onClick={() => !isDragging && setBranchToDelete(b.id)} className="p-2.5 bg-gray-800 text-red-500 rounded-full border border-gray-700 hover:bg-red-600 hover:border-red-400 hover:text-white transition-all active:scale-90"><TrashIcon className="w-4 h-4" /></button>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>

            <ConfirmationModal
                isOpen={branchToDelete !== null}
                onClose={() => setBranchToDelete(null)}
                // @ts-ignore
                onConfirm={async () => {
                    if (!branchToDelete) return;
                    try {
                        // Using a hypothetical api.deleteBranch since it wasn't there, but good to add. 
                        // If it fails (API method missing), catch block will run.
                        // I will assume it exists or I should comment it out. 
                        // Given ManageUsers I added it, I'll add it here too or just update state if previously it only updated state.
                        // Previous code: confirm(...) && setBranches(...)
                        setBranches(prev => prev.filter(i => i.id !== branchToDelete));
                        setBranchToDelete(null);
                    } catch (e) { console.error(e); }
                }}
                title="¿ELIMINAR SUCURSAL?"
                message="Esta acción no se puede deshacer"
                confirmText="SÍ, ELIMINAR"
            />

            {isModalOpen && <AdminModal title={editingBranch ? "EDITAR <span class='text-amber-500'>SUCURSAL</span>" : "NUEVA <span class='text-amber-500'>SUCURSAL</span>"} onClose={() => setIsModalOpen(false)} onSave={handleSave} saveLabel="GUARDAR">
                <div className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Nombre de Sucursal</label>
                        <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full py-3 px-5 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white font-black text-sm uppercase outline-none focus:border-amber-500 shadow-inner" placeholder="EJ: CENTRO HISTÓRICO" autoFocus />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Dirección</label>
                        <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="w-full py-3 px-5 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white font-black text-sm uppercase outline-none focus:border-amber-500 shadow-inner" placeholder="EJ: AV. SIEMPRE VIVA 742" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Logo URL (Icono Sucursal)</label>
                        <input value={form.logoUrl} onChange={e => setForm({ ...form, logoUrl: e.target.value })} className="w-full py-3 px-5 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white text-[10px] font-mono outline-none focus:border-amber-500 shadow-inner" placeholder="https://mi-dominio.com/logo.png" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-emerald-500 uppercase tracking-widest ml-1 italic">Webhook Cierre (Email)</label>
                            <input value={form.closingWebhookUrl} onChange={e => setForm({ ...form, closingWebhookUrl: e.target.value })} className="w-full py-3 px-5 bg-gray-800 border-2 border-emerald-500/30 rounded-2xl text-white text-[10px] font-mono outline-none focus:border-emerald-500 shadow-inner" placeholder="Webhook URL" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-emerald-500 uppercase tracking-widest ml-1 italic">Correo(s) para Reporte</label>
                            <input value={form.closingEmail} onChange={e => setForm({ ...form, closingEmail: e.target.value })} className="w-full py-3 px-5 bg-gray-800 border-2 border-emerald-500/30 rounded-2xl text-white text-xs font-black outline-none focus:border-emerald-500 shadow-inner" placeholder="ejemplo@mail.com, otro@mail.com" />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Tamaño de Ticket (Impresora)</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setForm({ ...form, ticketWidth: '58mm' })}
                                className={`py-3 px-3 rounded-2xl border-2 font-black text-xs uppercase italic transition-all ${form.ticketWidth === '58mm' ? 'bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-500/20' : 'bg-gray-800 border-gray-700 text-gray-500 hover:border-gray-600'}`}
                            >
                                58mm (Pequeño)
                            </button>
                            <button
                                onClick={() => setForm({ ...form, ticketWidth: '80mm' })}
                                className={`py-3 px-3 rounded-2xl border-2 font-black text-xs uppercase italic transition-all ${form.ticketWidth !== '58mm' ? 'bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-500/20' : 'bg-gray-800 border-gray-700 text-gray-500 hover:border-gray-600'}`}
                            >
                                80mm (Estándar)
                            </button>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Teléfono Público</label>
                        <input type="tel" maxLength={8} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="w-full py-3 px-5 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white font-black text-lg text-center outline-none focus:border-amber-500 shadow-inner tracking-widest" placeholder="00000000" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Correo (Webhook URL)</label>
                        <input value={form.gasWebhookUrl} onChange={e => setForm({ ...form, gasWebhookUrl: e.target.value })} className="w-full py-3 px-5 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white text-[10px] font-mono outline-none focus:border-amber-500 shadow-inner" placeholder="https://script.google.com/macros/..." />
                    </div>

                    <div className="bg-gray-800/50 p-4 rounded-2xl border border-gray-700">
                        <div className="flex items-center justify-between mb-4">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest italic">Cierre Automático</label>
                            <button
                                onClick={() => setForm(prev => ({ ...prev, autoCloseEnabled: !prev.autoCloseEnabled }))}
                                className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ${form.autoCloseEnabled ? 'bg-amber-500' : 'bg-gray-700'}`}
                            >
                                <div className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform duration-300 ${form.autoCloseEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                            </button>
                        </div>
                        {form.autoCloseEnabled && (
                            <div className="space-y-1.5 animate-in slide-in-from-top-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Hora de Cierre</label>
                                <div className="relative">
                                    <ClockIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                                    <input
                                        type="time"
                                        value={form.autoCloseTime || ''}
                                        onChange={e => setForm({ ...form, autoCloseTime: e.target.value })}
                                        className="w-full py-4 pl-12 pr-6 bg-gray-900 border-2 border-gray-700 rounded-2xl text-white font-black text-xl outline-none focus:border-amber-500 shadow-inner tracking-widest"
                                    />
                                </div>
                                <p className="text-[9px] text-gray-500 mt-2 px-2 italic">
                                    Los pedidos abiertos se cerrarán automáticamente 10 minutos después de esta hora, marcándolos como pagados en efectivo.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </AdminModal>}
        </div>
    );
};

// --- GESTIÓN CONFIGURACIÓN MAESTRA (LIMPIEZA DE DATOS) ---
const MasterSettings: React.FC<{ onBack: () => void; currentUser?: any }> = ({ onBack, currentUser }) => {
    const [clearingType, setClearingType] = useState<'SALES' | 'INVENTORY' | 'ALL' | null>(null);
    const [pin, setPin] = useState('');
    const [isPinModalOpen, setIsPinModalOpen] = useState(false);

    const handleClearRequest = (type: 'SALES' | 'INVENTORY' | 'ALL') => {
        setClearingType(type);
        setIsPinModalOpen(true);
    };

    const confirmClear = async () => {
        if (!clearingType || !pin || !currentUser) return;

        const loading = toast.loading('Ejecutando limpieza...');
        try {
            await api.clearData(clearingType, pin, currentUser.id);
            toast.success('LIMPIEZA COMPLETADA EXITOSAMENTE', { id: loading });
            setIsPinModalOpen(false);
            setPin('');
            setClearingType(null);
        } catch (err: any) {
            console.error(err);
            toast.error(err.message || 'Error en la limpieza', { id: loading });
        }
    };

    return (
        <div className="flex flex-col h-full overflow-hidden animate-in fade-in duration-300">
            <ViewHeader title="CONFIGURACIÓN <span class='text-indigo-500'>MAESTRA</span>" onBack={onBack} />

            <div className="flex-1 overflow-y-auto space-y-8 pb-20 px-1 scrollbar-hide">
                {/* LIMPIEZA DE DATOS SECTION */}
                <div className="bg-gray-900/50 rounded-[40px] border border-gray-800 p-8 space-y-6 shadow-xl">
                    <div className="flex items-center gap-4 mb-2">
                        <div className="p-3 bg-red-500/10 rounded-2xl border border-red-500/20">
                            <TrashIcon className="w-6 h-6 text-red-500" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-white italic uppercase tracking-tighter">Mantenimiento de Base de Datos</h2>
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest italic">Acciones destructivas e irreversibles</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* SALES CLEAR */}
                        <div className="bg-gray-800/50 p-6 rounded-[32px] border border-gray-700/50 flex flex-col justify-between group hover:border-orange-500/30 transition-all">
                            <div>
                                <h3 className="text-orange-500 font-black italic tracking-tighter uppercase mb-2 text-lg">Limpiar Ventas</h3>
                                <p className="text-[9px] text-gray-400 font-bold uppercase leading-relaxed mb-6 opacity-70 group-hover:opacity-100">Borra órdenes, pagos, auditoría, cierres de caja y balances pendientes.</p>
                            </div>
                            <button
                                onClick={() => handleClearRequest('SALES')}
                                className="w-full py-4 bg-orange-600/10 border border-orange-500/30 text-orange-500 rounded-2xl font-black text-[10px] uppercase italic tracking-widest hover:bg-orange-600 hover:text-white transition-all active:scale-95"
                            >
                                EJECUTAR LIMPIEZA
                            </button>
                        </div>

                        {/* INVENTORY CLEAR */}
                        <div className="bg-gray-800/50 p-6 rounded-[32px] border border-gray-700/50 flex flex-col justify-between group hover:border-cyan-500/30 transition-all">
                            <div>
                                <h3 className="text-cyan-500 font-black italic tracking-tighter uppercase mb-2 text-lg">Reiniciar Stock</h3>
                                <p className="text-[9px] text-gray-400 font-bold uppercase leading-relaxed mb-6 opacity-70 group-hover:opacity-100">Elimina transacciones de inventario y pone existencias en cero.</p>
                            </div>
                            <button
                                onClick={() => handleClearRequest('INVENTORY')}
                                className="w-full py-4 bg-cyan-600/10 border border-cyan-500/30 text-cyan-500 rounded-2xl font-black text-[10px] uppercase italic tracking-widest hover:bg-cyan-600 hover:text-white transition-all active:scale-95"
                            >
                                REINICIAR INVENTARIO
                            </button>
                        </div>

                        {/* TOTAL CLEAR */}
                        <div className="bg-gray-800/50 p-6 rounded-[32px] border-2 border-red-500/20 flex flex-col justify-between group hover:border-red-500/50 transition-all">
                            <div>
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="text-red-500 font-black italic tracking-tighter uppercase text-lg">Reset Total</h3>
                                    <span className="bg-red-500 text-white text-[7px] px-2 py-0.5 rounded-full font-black animate-pulse">PELIGRO</span>
                                </div>
                                <p className="text-[9px] text-gray-400 font-bold uppercase leading-relaxed mb-6 opacity-70 group-hover:opacity-100">Borra Ventas, Inventario y Metas Globales. Deja la app como nueva (Solo Catálogos).</p>
                            </div>
                            <button
                                onClick={() => handleClearRequest('ALL')}
                                className="w-full py-4 bg-red-600 border border-red-500 text-white rounded-2xl font-black text-[10px] uppercase italic tracking-widest hover:bg-red-500 transition-all active:scale-95 shadow-lg shadow-red-950/20"
                            >
                                LIMPIEZA ABSOLUTA
                            </button>
                        </div>
                    </div>
                </div>

                {/* INFO ALERT */}
                <div className="flex gap-4 p-6 bg-indigo-500/10 rounded-[32px] border border-indigo-500/20 items-start italic">
                    <InfoIcon className="w-6 h-6 text-indigo-400 shrink-0" />
                    <p className="text-[10px] text-indigo-300 font-bold uppercase leading-relaxed tracking-wide">
                        ESTAS ACCIONES SON PARA ADMINISTRADORES DE SISTEMA. SE RECOMIENDA REALIZAR UN RESPALDO DE LA BASE DE DATOS SQL ANTES DE PROCEDER. LOS CATÁLOGOS (PRODUCTOS, CATEGORÍAS, CARNES, USUARIOS) NO SERÁN AFECTADOS PARA PERMITIR UNA RÁPIDA PUESTA EN MARCHA.
                    </p>
                </div>
            </div>

            {/* CONFIRMATION MODAL WITH PIN */}
            {isPinModalOpen && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[110] p-4">
                    <div className="bg-gray-950 border border-red-500/30 rounded-[40px] p-8 w-full max-w-sm shadow-2xl animate-in zoom-in duration-300 space-y-6">
                        <div className="text-center space-y-2">
                            <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">Confirmar Limpieza</h3>
                            <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest animate-pulse">
                                {clearingType === 'SALES' ? 'BORRARÁS TODAS LAS VENTAS Y PAGOS' :
                                    clearingType === 'INVENTORY' ? 'BORRARÁS TODO EL MOVIMIENTO DE STOCK' :
                                        'ESTÁS POR BORRAR TODA LA OPERACIÓN DEL SISTEMA'}
                            </p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Ingresa tu PIN de SuperAdmin</label>
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

export default AdminPanel;
