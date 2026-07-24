
export enum OrderType {
    Restaurant = 'Restaurante',
    Delivery = 'Delivery',
    Pickup = 'Cliente Retira',
    Takeaway = 'Para Llevar',
}

export enum UserRole {
    SuperAdmin = 'SuperAdmin',
    Admin = 'Administrador',
    Waiter = 'Mesero',
    Cook = 'Cocinero',
    Cashier = 'Cajero',
    Delivery = 'Repartidor',
}

export enum PaymentMethod {
    Cash = 'Efectivo',
    Transfer = 'Transfer',
    Card = 'Tarjeta',
    Check = 'Cheque',
    Bitcoin = 'Bitcoin',
    Credit = 'Crédito',
    Employee = 'Empleado',
}

export type PromoType = 'QUANTITY' | 'HAPPY_HOUR' | 'EVENT' | 'COMBO' | 'CATEGORY' | 'BIRTHDAY' | 'GLOBAL';
export type DiscountType = 'PERCENTAGE' | 'FIXED_PRICE' | 'FIXED_AMOUNT_OFF';
export type TargetType = 'PRODUCT' | 'CATEGORY' | 'GLOBAL' | 'COMBO_SET';

export interface PromotionRule {
    id: number;
    name: string;
    type: PromoType;
    start_date?: string;
    end_date?: string;
    days_of_week?: number[];
    start_time?: string;
    end_time?: string;
    discount_type: DiscountType;
    discount_value: number;
    target_type: TargetType;
    target_ids?: number[];
    trigger_quantity?: number;
    combo_items?: { categoryId?: number; productId?: number; qty: number }[];
    isActive: boolean;
    priority: number;
}

export enum PromotionType {
    Quantity = 'Por Cantidad',
}

export interface Promotion {
    type: PromotionType;
    requiredQuantity: number;
    promoPrice: number;
    activeDays?: number[]; // 0=Domingo, 1=Lunes, etc.
}

export interface Branch {
    id: number;
    name: string;
    isActive: boolean;
    autoCloseTime?: string; // HH:mm
    autoCloseEnabled?: boolean;
    address?: string;
    phone?: string;
    gasWebhookUrl?: string; // Webhook specific to this branch for email sending
    geminiApiKey?: string; // AI Key
    ticketWidth?: '58mm' | '80mm';
    logoUrl?: string; // New: logo override per branch
    closingWebhookUrl?: string; // Webhook for automated cash closing reports
    closingEmail?: string; // Email(s) for cash closing reports (comma separated)
}

export interface User {
    id: number;
    username: string;
    role: UserRole;
    allRoles: UserRole[]; // For multi-role support
    currentRole: UserRole;
}

export interface Waiter {
    id: number;
    name: string;
    username?: string;
    pin: string; // Acceso rápido por PIN de 6 dígitos
    isActive: boolean;
    roles: UserRole[];
    branchId?: number;
}

export interface TableArea {
    id: number;
    name: string;
    branch_id?: number;
}

export interface Table {
    id: number;
    name: string;
    area: string; // Nombre el área (Jardín, Terraza, etc.) - Backup/Legacy
    areaId: number; // Relación por ID (NUEVO)
    branchId: number;
}

export interface Meat {
    id: number;
    name: string;
    type?: 'meat' | 'masa';
    isActive?: boolean;
}

export interface Category {
    id: number;
    name: string;
    isActive?: boolean;
    sort_order?: number;
}

export interface ProductExtra {
    id: number;
    name: string;
    price: number;
    isActive?: boolean;
    categoryId?: number;
    requiresMeat?: boolean;
}

export interface Product {
    id: number;
    name: string;
    imageUrl?: string;
    description?: string;
    price: number;
    cost?: number;
    categoryId: number;
    requiresMeat: boolean;
    requiresMasa?: boolean;
    availableExtraIds?: number[];
    promotion?: Promotion;
    isActive: boolean;
    isCombo?: boolean;
    comboDefinition?: string | {
        type: 'fixed' | 'dynamic';
        slots?: { categoryId: number; qty: number }[];
        items?: { productId: number; qty: number }[]
    };
    trackStock?: boolean;
    availableMeatIds?: number[];
    showInKds?: boolean;
}

export interface OrderItem {
    id: string;
    product: Product;
    quantity: number;
    meat?: Meat;
    masa?: Meat;
    extras?: ProductExtra[];
    comboSelections?: { productId: number; productName: string; quantity: number; meat?: Meat; masa?: Meat; meatName?: string; masaName?: string }[];
    total: number;
    observations?: string;
    completed?: boolean; // New field for KDS item checking
}

export interface Address {
    id: string;
    customerId?: number; // Added to link back to customer
    street: string;
    city: string;
    details?: string;
    latitude?: number;
    longitude?: number;
}

export interface Customer {
    id: number;
    name: string;
    phone: string;
    email?: string; // Added email field
    birthDate?: string; // YYYY-MM-DD
    addresses: Address[];
}

export interface OrderDetails {
    type: OrderType;
    waiter?: Waiter;
    table?: Table;
    customer?: Customer;
    deliveryAddress?: Address;
    initialItems?: OrderItem[]; // Payload for AI Parser from Start Screen
    waiterId?: number;
    tableId?: number;
    customerId?: number;
    deliveryDriverId?: number;
}

export interface Payment {
    method: PaymentMethod;
    amount: number;
    receivedBy?: string; // Username of who processed the payment
}

export type KitchenStatus = 'pending' | 'in_process' | 'ready' | 'served';

export interface Order extends OrderDetails {
    id: string;
    branchId: number; // Linked to a specific branch
    dailyOrderNumber: number;
    items: OrderItem[];
    subtotal: number;
    tax: number;
    discount: number;
    manualDiscount?: number;
    deliveryFee?: number;
    serviceCharge?: number;
    cardCommission?: number;
    total: number;
    createdAt: Date;
    completedAt?: Date;
    readyAt?: Date; // Hora en que cocina marcó como listo
    status: 'active' | 'completed';
    kitchenStatus?: KitchenStatus;
    chef?: string; // New field to assign a cook
    payments: Payment[];
    amountPaid: number;
    changeGiven: number;
    createdByUserId?: number;
    deliveryDriverId?: number;
    deliveryStatus?: 'pending' | 'assigned' | 'delivered';
    deliveryAddressId?: string;
    cashReportId?: number; // Vínculo con la sesión de caja
}

export interface CashClosingReport {
    id?: number;
    date: string; // YYYY-MM-DD
    branchId: number; // Linked to a specific branch
    createdAt: Date;
    initialCash: number;
    summary: { method: PaymentMethod; total: number }[];
    totalSales: number;
    totalCashIn: number;
    totalChangeOut: number;
    expectedCash: number;
    totalOrders?: number;
    totalServiceCharge?: number;
    totalCardCommission?: number;
    status?: 'OPEN' | 'CLOSED';
    opening_timestamp?: Date;
    closing_timestamp?: Date;
}

export interface CompanySettings {
    name: string;
    address: string;
    phone: string;
    logoUrl?: string; // URL or Base64
    gasWebhookUrl?: string; // Google Apps Script Webhook URL for emails
    geminiApiKey?: string; // Google Gemini API Key
    enableCommission?: boolean;
    commissionPercentage?: number;
    enableServiceCharge?: boolean;
    serviceChargePercentage?: number;
    paymentDueDate?: string; // Day of month (1-31) for payment due
    paymentGraceDays?: number; // Grace days before blocking orders
    paymentPending?: boolean; // Whether payment is pending
}

export enum TransactionType {
    Initial = 'INITIAL',
    Purchase = 'PURCHASE',
    AdjustmentAdd = 'ADJUSTMENT_ADD',
    AdjustmentSub = 'ADJUSTMENT_SUB',
    Sale = 'SALE',
    TransferIn = 'TRANSFER_IN',
    TransferOut = 'TRANSFER_OUT',
}

export interface InventoryItem {
    productId: number;
    productName: string;
    sellingPrice?: number;
    categoryId: number;
    categoryName: string;
    quantity: number;
    minStock: number;
    branchId: number;
    averageCost?: number;
}

export interface InventoryTransaction {
    id: number;
    productId: number;
    branchId: number;
    transactionType: TransactionType;
    quantity: number;
    unitCost?: number;
    previousStock: number;
    newStock: number;
    relatedBranchId?: number | null;
    reason?: string;
    createdAt: string;
    userId?: number;
    userName?: string; // Added
    orderId?: string;
}
export interface PendingBalance {
    id: number;
    orderId: string;
    branchId: number;
    type: 'CUSTOMER' | 'EMPLOYEE';
    customerId?: number;
    userId?: number;
    totalAmount: number;
    balance: number;
    status: 'PENDING' | 'PAID' | 'CANCELLED';
    createdAt: string;
    updatedAt: string;
    customerName?: string;
    userName?: string;
    dailyOrderNumber?: number;
}
