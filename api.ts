import io from 'socket.io-client';
import { Order, OrderDetails, User, Customer, CashClosingReport } from './types';

const API_URL = import.meta.env.VITE_API_URL || '/api'; // Changed from localhost to relative for production safety
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || ''; // Relative for socket too usually works if same origin

export const socket = io(SOCKET_URL);

const normalizeProduct = (p: any) => {
    if (!p) return p;

    const getIds = (prop: string, alt1: string, alt2: string) => {
        const raw = p[prop] ?? p[alt1] ?? p[alt2] ?? '[]';
        if (Array.isArray(raw)) return raw.map((id: any) => Number(id));
        try {
            const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
            return Array.isArray(parsed) ? parsed.map((id: any) => Number(id)) : [];
        } catch { return []; }
    };

    return {
        id: p.id,
        name: p.name,
        price: Number(p.price || 0),
        description: p.description ?? null,
        categoryId: Number(p.categoryId ?? p.category_id ?? 0),
        imageUrl: p.imageUrl ?? p.image_url ?? null,
        isActive: !!(p.isActive ?? (p.is_active === 1 || p.is_active === true)),
        requiresMeat: !!(p.requiresMeat ?? p.requires_meat === 1),
        requiresMasa: !!(p.requiresMasa ?? p.requires_masa === 1),
        trackStock: !!(p.trackStock ?? p.track_stock === 1),
        isCombo: !!(p.isCombo ?? p.is_combo === 1),
        comboDefinition: p.comboDefinition ?? p.combo_definition ?? null,
        availableExtraIds: getIds('availableExtraIds', 'available_extras', 'available_extra_ids'),
        availableMeatIds: getIds('availableMeatIds', 'available_meats', 'available_meat_ids'),
        showInKds: !!(p.showInKds ?? (p.show_in_kds === 1 || p.show_in_kds === true || p.show_in_kds === undefined))
    };
};

const normalizeSimpleEntity = (item: any) => {
    if (!item) return item;
    return {
        ...item,
        id: Number(item.id),
        isActive: !!(item.isActive ?? (item.is_active === 1 || item.is_active === true))
    };
};

export const api = {
    async login(pin: string) {
        try {
            const res = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pin })
            });
            if (!res.ok) {
                const text = await res.text();
                throw new Error(`Login failed: ${res.status} ${text}`);
            }
            return res.json();
        } catch (e: any) {
            throw new Error(e.message || 'Network Error during Login');
        }
    },

    async getInitialData(t?: number, branchId?: number, isSuperAdmin?: boolean) {
        const params = new URLSearchParams();
        if (t) params.append('t', t.toString());
        if (branchId) params.append('branchId', branchId.toString());
        if (isSuperAdmin) params.append('isSuperAdmin', 'true');
        const res = await fetch(`${API_URL}/initial-data?${params}`);
        if (!res.ok) throw new Error('Failed to fetch data');
        const data = await res.json();
        if (data.products && data.products.length > 0) {
            // console.log('[API] RAW P1 from server:', JSON.stringify(data.products[0]));
            data.products = data.products.map(normalizeProduct);
        }
        if (data.categories) data.categories = data.categories.map(normalizeSimpleEntity);
        if (data.meats) data.meats = data.meats.map(normalizeSimpleEntity);
        if (data.observationTags) data.observationTags = data.observationTags.map(normalizeSimpleEntity);
        return data;
    },


    async getOrders(branchId?: number, status?: string) {
        const params = new URLSearchParams();
        if (branchId) params.append('branchId', branchId.toString());
        if (status) params.append('status', status);
        const res = await fetch(`${API_URL}/orders?${params}`);
        return res.json();
    },

    async getHistory(filters: { startDate?: string, endDate?: string, search?: string, limit?: number, offset?: number, branchId?: number, includeActive?: boolean, cashReportId?: number, isSuperAdmin?: boolean }) {
        const params = new URLSearchParams();
        if (filters.startDate) params.append('startDate', filters.startDate);
        if (filters.endDate) params.append('endDate', filters.endDate);
        if (filters.search) params.append('search', filters.search);
        if (filters.limit) params.append('limit', filters.limit.toString());
        if (filters.offset) params.append('offset', filters.offset.toString());
        if (filters.branchId) params.append('branchId', filters.branchId.toString());
        if (filters.includeActive) params.append('includeActive', 'true');
        if (filters.cashReportId) params.append('cashReportId', filters.cashReportId.toString());
        if (filters.isSuperAdmin) params.append('isSuperAdmin', 'true');

        const res = await fetch(`${API_URL}/orders/history?${params}`);
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Error ${res.status}: ${text}`);
        }
        return res.json();
    },

    async getDeliveryHistory(filters: { startDate?: string, endDate?: string, branchId?: number }) {
        const params = new URLSearchParams();
        if (filters.startDate) params.append('startDate', filters.startDate);
        if (filters.endDate) params.append('endDate', filters.endDate);
        if (filters.branchId) params.append('branchId', filters.branchId.toString());

        const res = await fetch(`${API_URL}/delivery/history?${params}`);
        return res.json();
    },

    async createOrder(order: Order) {
        const res = await fetch(`${API_URL}/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(order)
        });
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.sqlMessage || errData.error || 'Failed to create order');
        }
        return res.json();
    },

    async updateOrder(id: string, updates: Partial<Order> & { userId?: number }) {
        const res = await fetch(`${API_URL}/orders/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Failed to update order: ${text}`);
        }
        return res.json();
    },

    async saveCashClosing(report: CashClosingReport, shouldSendEmail: boolean = true) {
        const res = await fetch(`${API_URL}/cash-closing`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...report, shouldSendEmail })
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Failed to save cash closing: ${text}`);
        }
        return res.json();
    },

    async deleteCashClosing(id: number) {
        const res = await fetch(`${API_URL}/cash-closing/${id}`, {
            method: 'DELETE',
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Failed to delete cash closing: ${text}`);
        }
        return res.json();
    },

    async deleteOrder(id: string, userId?: number, reason?: string) {
        const res = await fetch(`${API_URL}/orders/${id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, reason })
        });
        if (!res.ok) throw new Error('Failed to delete order');
        return res.json();
    },

    async logItemDeletion(orderId: string, data: { branchId: number, dailyOrderNumber?: number, customerName?: string, itemData: any, userId: number, reason?: string }) {
        return this._post(`/orders/${orderId}/log-item-deletion`, data);
    },

    async createCustomer(customer: Partial<Customer>) {
        const res = await fetch(`${API_URL}/customers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(customer)
        });
        if (!res.ok) {
            const txt = await res.text();
            throw new Error(`Failed to create customer: ${txt}`);
        }
        return res.json();
    },

    async updateCustomer(id: number, data: Partial<Customer>) {
        const res = await fetch(`${API_URL}/customers/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            const txt = await res.text();
            throw new Error(`Failed to update customer: ${txt}`);
        }
        return res.json();
    },

    async saveGPSAddress(customerId: number, latitude: number, longitude: number, addressId?: string) {
        const res = await fetch(`${API_URL}/customers/${customerId}/gps_address`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ latitude, longitude, addressId })
        });
        if (!res.ok) {
            const txt = await res.text();
            throw new Error(`Failed to save GPS address: ${txt}`);
        }
        return res.json();
    },

    async notifyDelivery(orderId: string) {
        const res = await fetch(`${API_URL}/orders/${orderId}/notify_delivery`, {
            method: 'POST'
        });
        return res.json();
    },

    async deleteCustomer(id: number) {
        return this._delete(`/customers/${id}`);
    },

    async setCustomerStatus(id: number, isActive: boolean) {
        const res = await fetch(`${API_URL}/customers/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isActive })
        });
        if (!res.ok) {
            const txt = await res.text();
            throw new Error(`Failed to update customer status: ${txt}`);
        }
        return res.json();
    },

    async searchCustomers(query: string) {
        const res = await fetch(`${API_URL}/customers?search=${encodeURIComponent(query)}`);
        if (!res.ok) throw new Error('Search failed');
        return res.json();
    },

    // --- GENERIC CRUD HELPERS (Typed) ---
    async getTables() {
        const res = await fetch(`${API_URL}/tables`);
        if (!res.ok) throw new Error('Failed to fetch tables');
        return res.json();
    },

    async createTable(data: any) {
        const res = await fetch(`${API_URL}/tables`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('Failed to create table');
        return res.json();
    },

    async updateTable(id: number, data: any) {
        const res = await fetch(`${API_URL}/tables/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('Failed to update table');
        return res.json();
    },

    async deleteTable(id: number) {
        const res = await fetch(`${API_URL}/tables/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete table');
        return res.json();
    },

    async getTableAreas() {
        const res = await fetch(`${API_URL}/table-areas`);
        if (!res.ok) throw new Error('Failed to fetch table areas');
        return res.json();
    },

    async createTableArea(data: any) {
        const res = await fetch(`${API_URL}/table-areas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('Failed to create table area');
        return res.json();
    },

    async deleteTableArea(id: number) {
        const res = await fetch(`${API_URL}/table-areas/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete table area');
        return res.json();
    },

    async createUser(data: any) { return this._post('/users', data); },
    async updateUser(id: number, data: any) { return this._put(`/users/${id}`, data); },
    async deleteUser(id: number) { return this._delete(`/users/${id}`); },

    async createCategory(data: any) { return this.post('/categories', data).then(normalizeSimpleEntity); },
    async updateCategory(id: number, data: any) { return this._put(`/categories/${id}`, data).then(normalizeSimpleEntity); },
    async deleteCategory(id: number) { return this._delete(`/categories/${id}`); },
    async createBranch(data: any) {
        const res = await fetch(`${API_URL}/branches`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return res.json();
    },
    async updateBranch(id: number, data: any) {
        const res = await fetch(`${API_URL}/branches/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return res.json();
    },
    async deleteBranch(id: number) {
        const res = await fetch(`${API_URL}/branches/${id}`, { method: 'DELETE' });
        return res.json();
    },

    async createMeat(data: any) { return this.post('/meats', data).then(normalizeSimpleEntity); },
    async updateMeat(id: number, data: any) { return this._put(`/meats/${id}`, data).then(normalizeSimpleEntity); },
    async deleteMeat(id: number) { return this._delete(`/meats/${id}`); },

    async createProductExtra(data: any) { return this._post('/product_extras', data); },
    async updateProductExtra(id: number, data: any) { return this._put(`/product_extras/${id}`, data); },
    async deleteProductExtra(id: number) { return this._delete(`/product_extras/${id}`); },

    async createProduct(data: any) {
        const res = await this._post('/products', data);
        return normalizeProduct(res);
    },
    async updateProduct(id: number, data: any) {
        const res = await this._put(`/products/${id}`, data);
        return normalizeProduct(res);
    },
    async deleteProduct(id: number) { return this._delete(`/products/${id}`); },

    async createPromotion(data: any) { return this._post('/promotions', data); },
    async updatePromotion(id: number, data: any) { return this._post('/promotions', { ...data, id }); },
    async deletePromotion(id: number) { return this._delete(`/promotions/${id}`); },

    async aiParseOrder(text: string, branchId: number) { return this._post('/ai/parse-order', { text, branchId }); },

    async getObservationTags(admin = false) {
        return this.get(admin ? '/admin/observation-tags' : '/observation-tags');
    },

    async createObservationTag(data: any) {
        return this.post('/observation-tags', data).then(normalizeSimpleEntity);
    },
    async updateObservationTag(id: number, data: any) {
        return this._put(`/observation-tags/${id}`, data).then(normalizeSimpleEntity);
    },

    async deleteObservationTag(id: number) {
        return this._delete(`/observation-tags/${id}`);
    },

    async getSettings() { return this.get('/settings'); },
    async getProductPopularity() { return this.get('/product-popularity'); },
    async updateSettings(settings: Record<string, any>) { return this.post('/settings', settings); },

    async getAuditLogs(filters?: { startDate?: string, endDate?: string }) {
        const params = new URLSearchParams();
        if (filters?.startDate) params.append('startDate', filters.startDate);
        if (filters?.endDate) params.append('endDate', filters.endDate);
        return this.get(`/audit-logs?${params}`);
    },

    async getPendingBalances(filters: { branchId?: number, status?: string, type?: string, search?: string, startDate?: string, endDate?: string }) {
        const params = new URLSearchParams();
        if (filters.branchId) params.append('branchId', filters.branchId.toString());
        if (filters.status) params.append('status', filters.status);
        if (filters.type) params.append('type', filters.type);
        if (filters.search) params.append('search', filters.search);
        if (filters.startDate) params.append('startDate', filters.startDate);
        if (filters.endDate) params.append('endDate', filters.endDate);
        return this.get(`/pending-balances?${params}`);
    },

    async payPendingBalance(id: number, amount: number) {
        return this._post(`/pending-balances/${id}/pay`, { amount });
    },

    async getChefPerformance(filters: { startDate?: string, endDate?: string, branchId?: number }) {
        const params = new URLSearchParams();
        if (filters.startDate) params.append('startDate', filters.startDate);
        if (filters.endDate) params.append('endDate', filters.endDate);
        if (filters.branchId) params.append('branchId', filters.branchId.toString());
        return this.get(`/reports/chef-performance?${params}`);
    },

    async getInventory() {
        return this.get('/inventory');
    },

    async getInventoryAvailability(branchId: number, orderId?: string) {
        let url = `/inventory/availability?branchId=${branchId}`;
        if (orderId) url += `&excludeOrderId=${orderId}`;
        return this.get(url);
    },

    async adjustInventory(data: {
        productId: number,
        branchId: number,
        type: string,
        quantity: number,
        reason: string,
        userId?: number,
        unitCost?: number,
        relatedBranchId?: number
    }) {
        return this._post('/inventory/adjust', data);
    },

    async getInventoryKardex(productId: number, branchId?: number) {
        const params = new URLSearchParams();
        if (branchId) params.append('branchId', branchId.toString());
        return this.get(`/inventory/kardex/${productId}?${params}`);
    },

    async getCashSessions(branchId: number, startDate: string, endDate: string) {
        const params = new URLSearchParams();
        params.append('branchId', branchId.toString());
        params.append('startDate', startDate);
        params.append('endDate', endDate);
        return this.get(`/admin/cash-sessions?${params}`);
    },

    async getRedigitateSessions(branchId: number) {
        return this.get(`/admin/redigitate-sessions?branchId=${branchId}`);
    },

    async clearData(type: 'SALES' | 'INVENTORY' | 'ALL', pin: string, userId: number, filters?: { branchId?: number, startDate?: string, endDate?: string, cashReportIds?: number[] }) {
        return this._post('/admin/clear-data', { type, pin, userId, ...filters });
    },

    async updateCashClosingDate(id: number, newDate: string, branchId: number) {
        return this._put(`/cash-closing/${id}/date`, { newDate, branchId });
    },

    async backupDatabase() {
        const res = await fetch(`${API_URL}/admin/backup-database`);
        if (!res.ok) {
            const text = await res.text();
            throw new Error(text || 'Error al generar respaldo');
        }
        return res.blob();
    },

    // Helpers
    async get(url: string) {
        const res = await fetch(`${API_URL}${url}`);
        if (!res.ok) throw new Error(`GET ${url} failed`);
        return res.json();
    },

    async post(url: string, data: any) {
        const res = await fetch(`${API_URL}${url}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            const txt = await res.text();
            throw new Error(`POST ${url} failed: ${txt}`);
        }
        return res.json();
    },

    // Alias for backward compatibility if needed, or just use post
    async _post(url: string, data: any) {
        return this.post(url, data);
    },

    async _put(url: string, data: any) {
        const res = await fetch(`${API_URL}${url}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error(`PUT ${url} failed`);
        return res.json();
    },

    async _delete(url: string) {
        const res = await fetch(`${API_URL}${url}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(`DELETE ${url} failed`);
        return res.json();
    },
};
