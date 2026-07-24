
import { Waiter, Table, Meat, Category, Product, Customer, ProductExtra, UserRole, PromotionType, CompanySettings, Branch } from './types';

// Database con PINs de 6 dígitos
export const INITIAL_WAITERS: Waiter[] = [
    { id: 1, name: 'Super Admin', username: 'superadmin', pin: '020518', isActive: true, roles: [UserRole.SuperAdmin], branchId: 1 },
    { id: 2, name: 'Administrador', username: 'admin', pin: '222222', isActive: true, roles: [UserRole.Admin], branchId: 1 },
    { id: 3, name: 'Carlos', username: 'mesero', pin: '333333', isActive: true, roles: [UserRole.Waiter], branchId: 1 },
    { id: 4, name: 'Ana', username: 'ana', pin: '444444', isActive: true, roles: [UserRole.Waiter], branchId: 1 },
    { id: 5, name: 'Luis', username: 'luis', pin: '555555', isActive: true, roles: [UserRole.Waiter, UserRole.Cook], branchId: 1 },
    { id: 6, name: 'Parrilla 1', username: 'cocinero', pin: '666666', isActive: true, roles: [UserRole.Cook], branchId: 1 },
];

export const INITIAL_BRANCHES: Branch[] = [];

export const INITIAL_TABLES: Table[] = [
    // JARDÍN (5) - areaId: 1
    ...Array.from({ length: 5 }, (_, i) => ({ id: i + 1, name: `J${i + 1}`, area: 'JARDÍN', areaId: 1, branchId: 1 })),
    // TERRAZA (3) - areaId: 2
    ...Array.from({ length: 3 }, (_, i) => ({ id: i + 6, name: `T${i + 1}`, area: 'TERRAZA', areaId: 2, branchId: 1 })),
    // SALÓN (4) + BARRA - areaId: 3
    ...Array.from({ length: 4 }, (_, i) => ({ id: i + 9, name: `S${i + 1}`, area: 'SALÓN', areaId: 3, branchId: 1 })),
    { id: 13, name: 'BARRA', area: 'SALÓN', areaId: 3, branchId: 1 }
];

export const INITIAL_MEATS: Meat[] = [
    { id: 1, name: 'Res' },
    { id: 2, name: 'Pollo' },
    { id: 3, name: 'Pastor' },
    { id: 4, name: 'Mixta' },
    { id: 5, name: 'Chorizo' },
];

export const INITIAL_CATEGORIES: Category[] = [
    { id: 1, name: 'Entradas' },
    { id: 2, name: 'Tacos' },
    { id: 3, name: 'Burritos' },
    { id: 4, name: 'Tortas' },
    { id: 5, name: 'Especiales' },
    { id: 6, name: 'Asados' },
    { id: 7, name: 'Birria' },
    { id: 8, name: 'Bebidas' },
];

export const INITIAL_PRODUCT_EXTRAS: ProductExtra[] = [
];

export const INITIAL_PRODUCTS: Product[] = [
    { id: 101, name: 'Pan con Ajo', price: 3.00, categoryId: 1, requiresMeat: false, isActive: true },
    { id: 102, name: 'Nachos', price: 5.00, categoryId: 1, requiresMeat: false, isActive: true },
    { id: 103, name: 'Jalapeño Relleno', price: 1.00, categoryId: 1, requiresMeat: false, isActive: true },
    { id: 104, name: 'Jalapeño Especial', price: 1.50, categoryId: 1, requiresMeat: false, isActive: true },
    { id: 105, name: 'Sopa de Tortilla', price: 3.00, categoryId: 1, requiresMeat: false, isActive: true },
    { id: 106, name: 'Sopa de Tortilla XL', price: 5.00, categoryId: 1, requiresMeat: false, isActive: true },
    { id: 201, name: '3 Tacos', price: 3.75, categoryId: 2, requiresMeat: true, isActive: true },
    { id: 202, name: '4 Tacos', price: 4.50, categoryId: 2, requiresMeat: true, isActive: true },
    { id: 203, name: '5 Tacos', price: 5.50, categoryId: 2, requiresMeat: true, isActive: true },
    { id: 204, name: '6 Tacos', price: 7.00, categoryId: 2, requiresMeat: true, isActive: true },
    { id: 205, name: '3 Tacos Dorados', price: 4.50, categoryId: 2, requiresMeat: true, isActive: true },
    { id: 206, name: '4 Tacos Dorados', price: 5.50, categoryId: 2, requiresMeat: true, isActive: true },
    { id: 207, name: '5 Tacos Dorados', price: 6.50, categoryId: 2, requiresMeat: true, isActive: true },
    { id: 301, name: 'Burrito', price: 4.50, categoryId: 3, requiresMeat: true, isActive: true },
    { id: 302, name: 'Burrito 3 Quesos', price: 6.00, categoryId: 3, requiresMeat: true, isActive: true },
    { id: 303, name: 'Burrito Pizza', price: 6.00, categoryId: 3, requiresMeat: true, isActive: true },
    { id: 304, name: 'Burrito XL', price: 6.50, categoryId: 3, requiresMeat: true, isActive: true },
    { id: 401, name: 'Torta', price: 4.50, categoryId: 4, requiresMeat: true, isActive: true },
    { id: 402, name: 'Torta de Jamon', price: 4.50, categoryId: 4, requiresMeat: false, isActive: true },
    { id: 403, name: 'Torta de Tocino', price: 5.00, categoryId: 4, requiresMeat: false, isActive: true },
    { id: 404, name: 'Torta Pizza', price: 6.00, categoryId: 4, requiresMeat: true, isActive: true },
    { id: 405, name: 'Torta Cubana', price: 6.00, categoryId: 4, requiresMeat: false, isActive: true },
    { id: 406, name: 'Torta 3 Quesos', price: 6.00, categoryId: 4, requiresMeat: true, isActive: true },
    { id: 407, name: 'Torta Tapa Arterias', price: 10.00, categoryId: 4, requiresMeat: false, isActive: true },
    { id: 501, name: 'Gringas', price: 3.75, categoryId: 5, requiresMeat: true, isActive: true },
    { id: 502, name: 'Alambre', price: 5.75, categoryId: 5, requiresMeat: true, isActive: true },
    { id: 503, name: 'Pizza Mexicana', price: 9.00, categoryId: 5, requiresMeat: false, isActive: true },
    { id: 504, name: 'Hamburguesa (sin papas)', price: 3.50, categoryId: 5, requiresMeat: false, isActive: true },
    { id: 505, name: 'Quesadillas XL', price: 6.00, categoryId: 5, requiresMeat: true, isActive: true },
    { id: 506, name: 'Burrito 3 Quesos XL', price: 9.50, categoryId: 5, requiresMeat: true, isActive: true },
    { id: 507, name: 'Taquiza', price: 20.00, categoryId: 5, requiresMeat: false, isActive: true },
    { id: 508, name: 'Taquiza de Res', price: 22.00, categoryId: 5, requiresMeat: false, isActive: true },
    { id: 601, name: 'Carne Asada', price: 5.50, categoryId: 6, requiresMeat: false, isActive: true },
    { id: 602, name: 'Pechuga Asada', price: 5.50, categoryId: 6, requiresMeat: false, isActive: true },
    { id: 603, name: 'Lomito Asado', price: 5.50, categoryId: 6, requiresMeat: false, isActive: true },
    { id: 604, name: 'Camarones', price: 6.50, categoryId: 6, requiresMeat: false, isActive: true },
    { id: 605, name: 'Costilla Ahumada', price: 6.50, categoryId: 6, requiresMeat: false, isActive: true },
    { id: 606, name: 'Mar y Tierra', price: 8.00, categoryId: 6, requiresMeat: false, isActive: true },
    { id: 701, name: '3 Tacos Birria', price: 4.25, categoryId: 7, requiresMeat: false, isActive: true },
    { id: 702, name: '4 Tacos Birria', price: 5.25, categoryId: 7, requiresMeat: false, isActive: true },
    { id: 703, name: '5 Tacos Birria', price: 6.25, categoryId: 7, requiresMeat: false, isActive: true },
    { id: 704, name: '6 Tacos Birria', price: 8.50, categoryId: 7, requiresMeat: false, isActive: true },
    { id: 705, name: '3 Tacos Dorados Birria', price: 5.25, categoryId: 7, requiresMeat: false, isActive: true },
    { id: 706, name: '4 Tacos Dorados Birria', price: 6.50, categoryId: 7, requiresMeat: false, isActive: true },
    { id: 707, name: '5 Tacos Dorados Birria', price: 7.25, categoryId: 7, requiresMeat: false, isActive: true },
    { id: 708, name: 'Burrito Birria', price: 5.50, categoryId: 7, requiresMeat: false, isActive: true },
    { id: 709, name: 'Burrito 3 Quesos (Birria)', price: 7.00, categoryId: 7, requiresMeat: false, isActive: true },
    { id: 710, name: 'Burrito XL (Birria)', price: 8.00, categoryId: 7, requiresMeat: false, isActive: true },
    { id: 711, name: 'Torta Birria', price: 5.50, categoryId: 7, requiresMeat: false, isActive: true },
    { id: 712, name: 'Torta Pizza (Birria)', price: 7.25, categoryId: 7, requiresMeat: false, isActive: true },
    { id: 713, name: 'Torta 3 Quesos (Birria)', price: 7.00, categoryId: 7, requiresMeat: false, isActive: true },
    { id: 714, name: 'Nachos (Birria)', price: 6.00, categoryId: 7, requiresMeat: false, isActive: true },
    { id: 715, name: 'Alambre (Birria)', price: 6.75, categoryId: 7, requiresMeat: false, isActive: true },
    { id: 716, name: 'Pizza Birria', price: 10.50, categoryId: 7, requiresMeat: false, isActive: true },
    { id: 717, name: 'Quesabirria', price: 4.25, categoryId: 7, requiresMeat: false, isActive: true },
    { id: 718, name: 'Quesabirria XL', price: 8.00, categoryId: 7, requiresMeat: false, isActive: true },
    { id: 719, name: 'Taquiza de Birria', price: 25.00, categoryId: 7, requiresMeat: false, isActive: true },
    { id: 801, name: 'Refresco', price: 1.50, categoryId: 8, requiresMeat: false, isActive: true },
    { id: 802, name: 'Agua Fresca', price: 1.25, categoryId: 8, requiresMeat: false, isActive: true },
    { id: 803, name: 'Cerveza', price: 2.50, categoryId: 8, requiresMeat: false, isActive: true },
];

export const CLIENTE_VARIOS: Customer = {
    id: 999,
    name: 'CLIENTES VARIOS',
    phone: '00000000',
    addresses: [],
};

export const INITIAL_CUSTOMERS: Customer[] = [
    {
        id: 1,
        name: 'Juan Pérez',
        phone: '77889900',
        email: 'juan@example.com',
        addresses: [
            { id: 'addr1', street: 'Calle Falsa 123', city: 'Ciudad' },
        ],
    },
    {
        id: 2,
        name: 'Maria Garcia',
        phone: '66554433',
        addresses: [],
    },
];

export const INITIAL_COMPANY_SETTINGS: CompanySettings = {
    name: 'FunkyFood',
    address: '',
    phone: '',
    paymentDueDate: '',
    paymentGraceDays: 3,
    paymentPending: false
};
