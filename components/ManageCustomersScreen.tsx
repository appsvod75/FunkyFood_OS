
import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Customer, Address } from '../types';
import { api } from '../api';
import NotificationToast from './NotificationToast';
import ConfirmationModal from './ConfirmationModal';
import { PencilIcon, TrashIcon, PlusIcon, UploadIcon, UserGroupIcon, ClipboardListIcon, CheckCircleIcon, TableIcon, MapIcon } from './icons';

interface ManageCustomersScreenProps {
    customers: Customer[];
    setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
    onBack: () => void;
}

const formatPhone = (phone: string | null | undefined) => {
    if (!phone) return '';
    const clean = phone.replace(/\D/g, '');
    if (clean.length === 8) {
        return `${clean.slice(0, 4)}-${clean.slice(4)}`;
    }
    return phone;
};

const ManageCustomersScreen: React.FC<ManageCustomersScreenProps> = ({ customers, setCustomers, onBack }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
    const [customerToDelete, setCustomerToDelete] = useState<number | null>(null);
    const [toast, setToast] = useState<{ message: string | null; title?: string; type?: 'error' | 'success' | 'warning' | 'info' }>({ message: null });

    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
    const [formState, setFormState] = useState<{ name: string, phone: string, email: string, birthDate: string, addresses: Address[] }>({
        name: '',
        phone: '',
        email: '',
        birthDate: '',
        addresses: []
    });

    const [editingAddress, setEditingAddress] = useState<Address | null>(null);
    const [addressForm, setAddressForm] = useState({ street: '', city: 'SAN SALVADOR', details: '', latitude: undefined as number | undefined, longitude: undefined as number | undefined });
    const [isSaving, setIsSaving] = useState(false);
    const [displayLimit, setDisplayLimit] = useState(100);

    // Reset limit when searching
    React.useEffect(() => {
        setDisplayLimit(100);
    }, [searchQuery]);

    const filteredCustomers = customers.filter(c => {
        if (!c || !c.name || typeof c.phone !== 'string') return false;
        const q = searchQuery.toLowerCase().trim();
        const hasLetters = /[a-z]/i.test(searchQuery);
        const searchDigits = q.replace(/\D/g, '');
        
        const nameMatch = c.name.toLowerCase().includes(q);
        
        // Solo buscamos por teléfono si NO hay letras en la búsqueda
        let phoneMatch = false;
        if (!hasLetters && searchDigits) {
            const customerDigits = c.phone.replace(/\D/g, '');
            phoneMatch = customerDigits.includes(searchDigits);
        }
        
        return nameMatch || phoneMatch;
    });

    const openModal = (customer: Customer | null = null) => {
        setEditingCustomer(customer);
        if (customer) {
            setFormState({
                name: customer.name.toUpperCase(),
                phone: customer.phone,
                email: customer.email || '',
                birthDate: customer.birthDate || '',
                addresses: customer.addresses || []
            });
        } else {
            setFormState({ name: '', phone: '', email: '', birthDate: '', addresses: [] });
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingCustomer(null);
    };

    const handleSaveCustomer = async () => {
        if (!formState.name.trim()) return;
        let cleanPhone = formState.phone.replace(/\D/g, '');

        // Si está vacío, usamos el default de 8 ceros
        if (cleanPhone === '') {
            cleanPhone = '00000000';
        } else if (cleanPhone.length !== 8) {
            setToast({ message: 'EL TELÉFONO DEBE TENER EXACTAMENTE 8 DÍGITOS', title: 'TELÉFONO INVÁLIDO', type: 'error' });
            return;
        }

        const customerPayload: Partial<Customer> = {
            name: formState.name.trim().toUpperCase(),
            phone: cleanPhone,
            email: formState.email.trim().toLowerCase() || undefined,
            birthDate: (formState.birthDate && formState.birthDate.trim() !== '') ? formState.birthDate : undefined,
            addresses: formState.addresses
        };

        setIsSaving(true);
        try {
            if (editingCustomer) {
                await api.updateCustomer(editingCustomer.id, customerPayload);
                setCustomers(prev => prev.map(c => c.id === editingCustomer.id ? { ...c, ...customerPayload } : c));
                setToast({ message: 'CLIENTE ACTUALIZADO CORRECTAMENTE', title: '¡ÉXITO!', type: 'success' });
            } else {
                const newCustomer = await api.createCustomer(customerPayload);
                setCustomers(prev => [...prev, newCustomer]);
                setToast({ message: 'CLIENTE CREADO CORRECTAMENTE', title: '¡ÉXITO!', type: 'success' });
            }
            closeModal();
        } catch (e: any) {
            console.error("Error saving customer", e);
            setToast({ message: e.message || 'ERROR AL GUARDAR CLIENTE', title: 'ERROR', type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteCustomer = (id: number) => {
        setCustomerToDelete(id);
    };

    const handleToggleActive = async (customer: Customer) => {
        const nextActive = !(customer.isActive === undefined || customer.isActive);
        try {
            await api.setCustomerStatus(customer.id, nextActive);
            setCustomers(prev => prev.map(c => c.id === customer.id ? { ...c, isActive: nextActive } : c));
            setToast({
                message: nextActive ? 'CLIENTE ACTIVADO' : 'CLIENTE DESACTIVADO',
                title: '¡ÉXITO!',
                type: 'success'
            });
        } catch (e) {
            console.error("Error toggling customer status", e);
            setToast({ message: 'ERROR AL CAMBIAR ESTADO', title: 'ERROR', type: 'error' });
        }
    };

    const confirmDeleteCustomer = async () => {
        if (!customerToDelete) return;
        const id = customerToDelete;

        try {
            await api.deleteCustomer(id);
            setCustomers(prev => prev.filter(c => c.id !== id));
            setToast({ message: 'CLIENTE ELIMINADO', title: '¡ÉXITO!', type: 'success' });
            setCustomerToDelete(null);
        } catch (e) {
            console.error("Error deleting customer", e);
            setToast({ message: 'ERROR AL ELIMINAR CLIENTE', title: 'ERROR', type: 'error' });
        }
    };

    // --- LOGICA DIRECCIONES ---
    const openAddressModal = (addr: Address | null = null) => {
        setEditingAddress(addr);
        if (addr) {
            setAddressForm({
                street: addr.street,
                city: addr.city,
                details: addr.details || '',
                latitude: addr.latitude,
                longitude: addr.longitude
            });
        } else {
            setAddressForm({ street: '', city: 'SAN SALVADOR', details: '', latitude: undefined, longitude: undefined });
        }
        setIsAddressModalOpen(true);
    };

    const handleSaveAddress = () => {
        if (!addressForm.street.trim()) return;
        const newAddr: Address = {
            id: editingAddress ? editingAddress.id : `addr-${Date.now()}`,
            street: addressForm.street.toUpperCase(),
            city: addressForm.city.toUpperCase(),
            details: addressForm.details.toUpperCase(),
            latitude: addressForm.latitude,
            longitude: addressForm.longitude
        };

        if (editingAddress) {
            setFormState(s => ({ ...s, addresses: s.addresses.map(a => a.id === editingAddress.id ? newAddr : a) }));
        } else {
            setFormState(s => ({ ...s, addresses: [...s.addresses, newAddr] }));
        }
        setIsAddressModalOpen(false);
    };

    const portalRoot = document.getElementById('portal-root');

    return (
        <div className="h-full flex flex-col max-w-7xl mx-auto p-4 sm:p-6 overflow-hidden animate-in fade-in duration-500 w-full">
            <div className="flex justify-between items-center gap-4 mb-4 shrink-0">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="bg-gray-800 p-2.5 rounded-full hover:bg-gray-700 active:scale-90 transition-all shadow-lg border border-gray-700/50">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <h1 className="text-2xl font-black text-white italic uppercase tracking-tighter leading-none">GESTIÓN <span className="text-amber-500">CLIENTES</span></h1>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setIsImportModalOpen(true)} className="p-2.5 bg-blue-600 text-white rounded-xl active:scale-95 transition-all shadow-lg shadow-blue-900/20">
                        <UploadIcon className="w-5 h-5" />
                    </button>
                    <button onClick={() => openModal()} className="flex items-center gap-2 bg-green-600 text-white font-black py-2.5 px-4 rounded-xl active:scale-95 transition-all text-[10px] uppercase shadow-lg shadow-green-900/20">
                        <PlusIcon className="w-5 h-5" /> AGREGAR
                    </button>
                </div>
            </div>

            <div className="mb-4 shrink-0 px-1">
                <input
                    type="text"
                    placeholder="BUSCAR NOMBRE O TELÉFONO..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full py-4 px-6 bg-gray-800/50 border-2 border-gray-700 rounded-[24px] text-white font-black uppercase outline-none focus:border-amber-500 placeholder:text-gray-600 text-sm shadow-inner transition-all"
                />
            </div>

            <div className="flex-1 relative overflow-y-auto scrollbar-hide bg-gray-900/50 rounded-[32px] border border-gray-800 shadow-inner mb-4">
                {/* STICKY HEADER LABELS */}
                <div className="sticky top-0 z-20 bg-gray-900 px-6 py-4 border-b border-white/5 flex justify-between items-center shadow-lg">
                    <span className="text-[10px] font-black uppercase italic tracking-widest opacity-60">CLIENTE / DATOS</span>
                    <span className="text-[10px] font-black uppercase italic tracking-widest opacity-60">ACCIONES</span>
                </div>
                <ul className="divide-y divide-gray-800">
                    {filteredCustomers.slice(0, displayLimit).map(customer => (
                        <li key={customer.id} className="p-4 flex justify-between items-center hover:bg-gray-800/30 gap-4 group transition-colors">
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-black text-white uppercase italic truncate leading-tight group-hover:text-amber-500 transition-colors">{customer.name}</p>
                                <div className="flex items-center gap-3 mt-0.5">
                                    <p className="text-gray-400 font-black text-[10px] tracking-widest">{formatPhone(customer.phone)}</p>
                                    <span className="text-gray-600 text-[9px] font-black uppercase tracking-widest bg-gray-800 px-1.5 py-0.5 rounded border border-gray-700/50">{customer.addresses?.length || 0} DIR</span>
                                    {(customer.isActive === undefined || customer.isActive) ? (
                                        <span className="text-green-600/80 text-[9px] font-black uppercase tracking-widest bg-green-900/10 px-1.5 py-0.5 rounded border border-green-700/30">ACTIVO</span>
                                    ) : (
                                        <span className="text-red-500/90 text-[9px] font-black uppercase tracking-widest bg-red-900/10 px-1.5 py-0.5 rounded border border-red-700/40">INACTIVO</span>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <button
                                    onClick={() => handleToggleActive(customer)}
                                    className={`relative w-11 h-6 rounded-full transition-colors active:scale-90 ${(customer.isActive === undefined || customer.isActive) ? 'bg-green-600' : 'bg-gray-700'}`}
                                    title={(customer.isActive === undefined || customer.isActive) ? 'Desactivar' : 'Activar'}
                                >
                                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${(customer.isActive === undefined || customer.isActive) ? 'left-[22px]' : 'left-0.5'}`} />
                                </button>
                                <button onClick={() => openModal(customer)} className="p-2 bg-gray-800 text-amber-500 rounded-xl border border-gray-700 hover:bg-amber-600 hover:border-amber-400 hover:text-white transition-all active:scale-90">
                                    <PencilIcon className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleDeleteCustomer(customer.id)} className="p-2 bg-gray-800 text-red-500 rounded-xl border border-gray-700 hover:bg-red-600 hover:border-red-400 hover:text-white transition-all active:scale-90">
                                    <TrashIcon className="w-4 h-4" />
                                </button>
                            </div>
                        </li>
                    ))}
                    {filteredCustomers.length > displayLimit && (
                        <li className="p-4 text-center">
                            <button
                                onClick={() => setDisplayLimit(prev => prev + 100)}
                                className="w-full py-4 text-[10px] font-black text-amber-500 uppercase tracking-widest border-2 border-dashed border-gray-800 rounded-2xl hover:bg-gray-800/50 transition-all active:scale-95"
                            >
                                CARGAR MÁS ({filteredCustomers.length - displayLimit} RESTANTES)
                            </button>
                        </li>
                    )}
                    {filteredCustomers.length === 0 && (
                        <li className="p-16 text-center text-gray-700 font-black uppercase italic tracking-widest opacity-20 text-xs">Sin coincidencias</li>
                    )}
                </ul>
            </div>

            {/* Modal Principal de Edición/Creación */}
            {isModalOpen && portalRoot && createPortal(
                <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[100] p-4">
                    <div className="bg-gray-900 rounded-[32px] p-6 w-full max-w-md shadow-2xl border border-gray-800 flex flex-col max-h-[90vh] animate-in zoom-in fade-in duration-300">
                        <div className="flex items-center gap-3 mb-6 shrink-0">
                            <div className="bg-amber-500 p-2 rounded-xl shadow-lg shadow-amber-900/20">
                                <UserGroupIcon className="w-6 h-6 text-white" />
                            </div>
                            <h3 className="text-xl font-black text-white italic uppercase tracking-tighter leading-none">
                                {editingCustomer ? 'EDITAR' : 'NUEVO'} <span className="text-amber-500">CLIENTE</span>
                            </h3>
                        </div>

                        <div className="flex-1 overflow-y-auto scrollbar-hide space-y-6 pr-1">
                            {/* Información Básica */}
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Nombre Completo</label>
                                    <input
                                        type="text"
                                        value={formState.name}
                                        onChange={(e) => setFormState(s => ({ ...s, name: e.target.value }))}
                                        className="w-full py-4 px-6 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white font-black uppercase outline-none focus:border-amber-500 shadow-inner transition-all"
                                        placeholder="EJ: JUAN PEREZ"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Teléfono (8 Dígitos)</label>
                                    <input
                                        type="tel"
                                        maxLength={8}
                                        inputMode="tel"
                                        value={formState.phone}
                                        onChange={(e) => setFormState(s => ({ ...s, phone: e.target.value }))}
                                        className="w-full py-4 px-6 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white font-black text-2xl text-center outline-none focus:border-amber-500 shadow-inner tracking-widest transition-all"
                                        placeholder="00000000"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Correo Electrónico (Opcional)</label>
                                    <input
                                        type="email"
                                        value={formState.email}
                                        onChange={(e) => setFormState(s => ({ ...s, email: e.target.value }))}
                                        className="w-full py-4 px-6 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white font-black outline-none focus:border-amber-500 shadow-inner transition-all"
                                        placeholder="EJ: CLIENTE@MAIL.COM"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Fecha de Nacimiento (Opcional)</label>
                                    <input
                                        type="date"
                                        value={formState.birthDate}
                                        onChange={(e) => setFormState(s => ({ ...s, birthDate: e.target.value }))}
                                        className="w-full py-4 px-6 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white font-black uppercase outline-none focus:border-amber-500 shadow-inner transition-all calendar-picker-indicator-white"
                                    />
                                </div>
                            </div>

                            {/* Gestión de Direcciones */}
                            <div className="pt-4 border-t border-gray-800 space-y-4">
                                <div className="flex justify-between items-center px-1">
                                    <div className="flex items-center gap-2">
                                        <TableIcon className="w-4 h-4 text-amber-500" />
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest italic">Direcciones Guardadas</label>
                                    </div>
                                    <button onClick={() => openAddressModal()} className="px-3 py-1.5 bg-gray-800 border border-amber-500/30 text-amber-500 rounded-xl text-[9px] font-black uppercase active:scale-95 transition-all">
                                        + AGREGAR
                                    </button>
                                </div>

                                <div className="space-y-2">
                                    {formState.addresses.length > 0 ? formState.addresses.map(addr => (
                                        <div key={addr.id} className="flex justify-between items-center p-3 bg-gray-950 border border-gray-800 rounded-2xl group">
                                            <div className="min-w-0 pr-2">
                                                <p className="text-[10px] font-black text-white uppercase italic truncate">{addr.street}</p>
                                                {addr.details && <p className="text-[8px] text-gray-600 italic uppercase truncate">{addr.details}</p>}
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => openAddressModal(addr)} className="p-1.5 text-gray-600 hover:text-amber-500"><PencilIcon className="w-3.5 h-3.5" /></button>
                                                <button onClick={() => setFormState(s => ({ ...s, addresses: s.addresses.filter(a => a.id !== addr.id) }))} className="p-1.5 text-gray-600 hover:text-red-500"><TrashIcon className="w-3.5 h-3.5" /></button>
                                            </div>
                                        </div>
                                    )) : (
                                        <div className="py-6 text-center border-2 border-dashed border-gray-800 rounded-3xl">
                                            <p className="text-[9px] font-black text-gray-700 uppercase italic">Sin direcciones registradas</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-6 mt-4 border-t border-gray-800 shrink-0">
                            <button type="button" disabled={isSaving} onClick={closeModal} className="p-4 bg-gray-800 text-gray-400 font-black rounded-2xl uppercase text-xs active:scale-95 transition-transform disabled:opacity-50">CANCELAR</button>
                            <button type="button" disabled={isSaving} onClick={handleSaveCustomer} className="p-4 bg-green-600 text-white font-black rounded-2xl uppercase text-xs shadow-lg active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2">
                                {isSaving ? (
                                    <>
                                        <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        GUARDANDO...
                                    </>
                                ) : 'GUARDAR CLIENTE'}
                            </button>
                        </div>
                    </div>
                </div>,
                portalRoot
            )}

            {/* Sub-Modal para Agregar Dirección */}
            {isAddressModalOpen && portalRoot && createPortal(
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[110] p-4">
                    <div className="bg-gray-900 rounded-[32px] p-6 w-full max-w-sm shadow-2xl border border-gray-800 animate-in zoom-in duration-300">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="bg-blue-600 p-2 rounded-xl">
                                <TableIcon className="w-6 h-6 text-white" />
                            </div>
                            <h3 className="text-xl font-black text-white italic uppercase tracking-tighter leading-none">
                                {editingAddress ? 'EDITAR' : 'NUEVA'} <span className="text-blue-500">DIRECCIÓN</span>
                            </h3>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Calle / Pasaje / Block</label>
                                <input
                                    type="text"
                                    value={addressForm.street}
                                    onChange={(e) => setAddressForm(s => ({ ...s, street: e.target.value }))}
                                    className="w-full py-4 px-6 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white font-black uppercase outline-none focus:border-blue-500 shadow-inner transition-all"
                                    placeholder="EJ: CALLE FALSA 123"
                                    autoFocus
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Ciudad / Municipio</label>
                                <input
                                    type="text"
                                    value={addressForm.city}
                                    onChange={(e) => setAddressForm(s => ({ ...s, city: e.target.value }))}
                                    className="w-full py-4 px-6 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white font-black uppercase outline-none focus:border-blue-500 shadow-inner transition-all"
                                    placeholder="EJ: SAN SALVADOR"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Puntos de Referencia</label>
                                <textarea
                                    value={addressForm.details}
                                    onChange={(e) => setAddressForm(s => ({ ...s, details: e.target.value }))}
                                    className="w-full py-4 px-6 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white font-black uppercase outline-none focus:border-blue-500 shadow-inner h-20 resize-none transition-all"
                                    placeholder="EJ: PORTON NEGRO, FRENTE A TIENDA..."
                                />
                            </div>

                            <div className="pt-2 border-t border-gray-800 space-y-4">
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                        <label className="text-[8px] font-black text-gray-600 uppercase tracking-widest ml-1">Latitud</label>
                                        <input
                                            type="number"
                                            value={addressForm.latitude || ''}
                                            onChange={(e) => setAddressForm(s => ({ ...s, latitude: parseFloat(e.target.value) || undefined }))}
                                            className="w-full py-3 px-4 bg-gray-950 border border-gray-800 rounded-xl text-white font-mono text-[10px] outline-none focus:border-blue-500 shadow-inner"
                                            placeholder="13.XXXXXX"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[8px] font-black text-gray-600 uppercase tracking-widest ml-1">Longitud</label>
                                        <input
                                            type="number"
                                            value={addressForm.longitude || ''}
                                            onChange={(e) => setAddressForm(s => ({ ...s, longitude: parseFloat(e.target.value) || undefined }))}
                                            className="w-full py-3 px-4 bg-gray-950 border border-gray-800 rounded-xl text-white font-mono text-[10px] outline-none focus:border-blue-500 shadow-inner"
                                            placeholder="-89.XXXXXX"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 pt-4">
                                <button type="button" onClick={() => setIsAddressModalOpen(false)} className="p-4 bg-gray-800 text-gray-400 font-black rounded-2xl uppercase text-xs active:scale-95">DESCARTAR</button>
                                <button type="button" onClick={handleSaveAddress} className="p-4 bg-blue-600 text-white font-black rounded-2xl uppercase text-xs shadow-lg active:scale-95">CONFIRMAR</button>
                            </div>
                        </div>
                    </div>
                </div>,
                portalRoot
            )}

            {/* Modal de Importación Masiva */}
            {isImportModalOpen && portalRoot && createPortal(
                <ImportCustomersModal
                    onClose={() => setIsImportModalOpen(false)}
                    onImport={async (newOnes) => {
                        const CHUNK_SIZE = 20;
                        let successCount = 0;

                        for (let i = 0; i < newOnes.length; i += CHUNK_SIZE) {
                            const chunk = newOnes.slice(i, i + CHUNK_SIZE);

                            // Progress feedback
                            setToast({
                                message: `IMPORTANDO: ${i} DE ${newOnes.length} PROCESADOS...`,
                                type: undefined
                            });

                            await Promise.all(chunk.map(async (c) => {
                                try {
                                    const saved = await api.createCustomer({
                                        name: c.name,
                                        phone: c.phone,
                                        email: c.email
                                    });
                                    setCustomers(prev => [...prev, saved]);
                                    successCount++;
                                } catch (e) {
                                    console.error("Failed to import", c.name, e);
                                }
                            }));
                        }

                        if (successCount > 0) {
                            setToast({
                                message: `✅ SE IMPORTARON ${successCount} CLIENTES EXITOSAMENTE`,
                                type: 'success'
                            });
                        } else {
                            setToast({
                                message: '❌ FALLÓ LA IMPORTACIÓN',
                                type: 'error'
                            });
                        }
                        setIsImportModalOpen(false);
                    }}
                />,
                portalRoot
            )}

            {/* Modal de Confirmación de Eliminación */}
            <ConfirmationModal
                isOpen={customerToDelete !== null}
                onClose={() => setCustomerToDelete(null)}
                onConfirm={confirmDeleteCustomer}
                title="¿ELIMINAR CLIENTE?"
                message="Esta acción no se puede deshacer"
                confirmText="SÍ, ELIMINAR"
            />

            <NotificationToast
                message={toast.message}
                title={toast.title}
                type={toast.type}
                onClose={() => setToast({ ...toast, message: null })}
                persistent={toast.type === 'error'}
                position="top"
            />
        </div>
    );
};

// --- SUBCOMPONENTE: MODAL DE IMPORTACIÓN ---
const ImportCustomersModal: React.FC<{ onClose: () => void, onImport: (c: Customer[]) => Promise<void> }> = ({ onClose, onImport }) => {
    const [rawText, setRawText] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result;
            if (typeof content === 'string') {
                setRawText(content);
            }
        };
        reader.readAsText(file);
    };

    const parseVCF = (text: string): Customer[] => {
        const cards = text.split(/END:VCARD/i).filter(c => c.includes('BEGIN:VCARD'));
        return cards.map(card => {
            const fnMatch = card.match(/FN:(.*)/i);
            const nMatch = card.match(/N:(.*)/i);
            let name = 'SIN NOMBRE';

            if (fnMatch && fnMatch[1]) {
                name = fnMatch[1].trim();
            } else if (nMatch && nMatch[1]) {
                const parts = nMatch[1].split(';').map(p => p.trim());
                const given = parts[1] || '';
                const surname = parts[0] || '';
                name = `${given} ${surname}`.trim() || 'SIN NOMBRE';
            }

            const telLines = card.split('\n').filter(l => l.toUpperCase().startsWith('TEL'));
            let phone = '';
            if (telLines.length > 0) {
                const telLine = telLines[0];
                const colonIndex = telLine.lastIndexOf(':');
                if (colonIndex !== -1) {
                    phone = telLine.substring(colonIndex + 1).trim();
                }
            }

            return {
                id: Date.now() + Math.random(),
                name: name.toUpperCase(),
                phone: phone.replace(/\D/g, '').slice(-8),
                addresses: []
            };
        }).filter(c => c.phone.length === 8);
    };

    const handleProcess = async () => {
        let processed: Customer[] = [];

        if (rawText.includes('BEGIN:VCARD')) {
            processed = parseVCF(rawText);
        } else {
            const lines = rawText.split('\n').filter(l => l.trim().length > 0);
            processed = lines.map(line => {
                const parts = line.split(',').map(p => p.trim());
                return {
                    id: Date.now() + Math.random(),
                    name: (parts[0] || 'SIN NOMBRE').toUpperCase(),
                    phone: (parts[1] || '').replace(/\D/g, '').slice(-8),
                    email: parts[2]?.toUpperCase() || undefined,
                    addresses: []
                };
            }).filter(c => c.phone.length === 8);
        }

        if (processed.length === 0) {
            alert('❌ NO SE ENCONTRARON REGISTROS VÁLIDOS (8 DÍGITOS EN TELÉFONO)');
            return;
        }

        setIsProcessing(true);
        try {
            await onImport(processed);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xl flex items-center justify-center z-[110] p-4">
            <div className="bg-gray-900 rounded-[40px] p-6 w-full max-w-lg shadow-2xl border border-gray-800 flex flex-col max-h-[90vh] animate-in zoom-in duration-300">
                <div className="flex items-center gap-4 mb-6">
                    <div className="bg-blue-600 p-3 rounded-2xl shadow-lg shadow-blue-900/20">
                        <UploadIcon className="w-6 h-6 text-white" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-xl font-black text-white italic uppercase tracking-tighter leading-none">IMPORTACIÓN <span className="text-blue-500">MASIVA</span></h3>
                        <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest mt-1">Carga de base de datos externa</p>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto space-y-6 pr-2 scrollbar-hide">
                    {/* Instrucciones */}
                    <div className="bg-gray-950/50 p-4 rounded-3xl border border-gray-800">
                        <div className="flex justify-between items-start mb-3">
                            <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-2">
                                <ClipboardListIcon className="w-4 h-4" /> Instrucciones de Formato:
                            </p>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white text-[9px] font-black uppercase px-3 py-2 rounded-xl border border-gray-700 transition-all active:scale-95"
                            >
                                <UploadIcon className="w-3 h-3 text-blue-400" />
                                Importar Archivo
                            </button>
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept=".csv,.txt,.vcf"
                                onChange={handleFileChange}
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="bg-gray-900 p-3 rounded-2xl border border-gray-800/50">
                                <code className="text-[10px] font-mono text-gray-300 block">VCF (Contactos), CSV (Nombre, Tel)</code>
                                <code className="text-[10px] font-mono text-gray-500 mt-1 block">Soporta exportaciones de Android/iPhone</code>
                            </div>
                            <p className="text-[8px] text-gray-600 font-bold uppercase italic">* Una línea por cada cliente. El teléfono debe tener 8 dígitos.</p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Pegar Datos o Contenido del Archivo</label>
                        <textarea
                            value={rawText}
                            onChange={(e) => setRawText(e.target.value)}
                            className="w-full h-48 py-4 px-6 bg-gray-950 border-2 border-gray-800 rounded-3xl text-white font-mono text-[10px] outline-none focus:border-blue-500 shadow-inner transition-all"
                            placeholder="PEGA TUS LÍNEAS AQUÍ O SUBE UN ARCHIVO..."
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-8">
                    <button onClick={onClose} disabled={isProcessing} className="p-4 bg-gray-800 text-gray-400 font-black rounded-2xl uppercase text-xs active:scale-95 disabled:opacity-50">DESCARTAR</button>
                    <button
                        onClick={handleProcess}
                        disabled={isProcessing || !rawText.trim()}
                        className="p-4 bg-blue-600 text-white font-black rounded-2xl uppercase text-xs shadow-lg active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isProcessing ? (
                            <>
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                PROCESANDO...
                            </>
                        ) : 'PROCESAR CARGA'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ManageCustomersScreen;
