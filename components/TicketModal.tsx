
import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import html2canvas from 'html2canvas';
import { Order, CompanySettings, Branch } from '../types';
import NotificationToast from './NotificationToast';
import { CheckCircleIcon, PrintIcon, ShareIcon } from './icons';

interface TicketModalProps {
    order: Order;
    onClose: () => void;
    onNewOrder: () => void;
    isViewingCompleted?: boolean;
    companySettings?: CompanySettings;
    onUpdateCustomerEmail: (customerId: number, email: string) => void;
    branches?: Branch[];
}

const formatPhone = (phone: string | null | undefined) => {
    if (!phone) return '';
    const clean = String(phone).replace(/\D/g, '');
    if (clean.length === 8) {
        return `${clean.slice(0, 4)}-${clean.slice(4)}`;
    }
    return phone;
};

const TicketContent: React.FC<{
    order: Order;
    companySettings?: CompanySettings;
    branch?: Branch;
    isSmallTicket: boolean;
    paymentMethodDisplay: string;
}> = ({ order, companySettings, branch, isSmallTicket, paymentMethodDisplay }) => {
    const displayName = branch?.name || companySettings?.name || 'RESTAURANTE';
    const displayAddress = branch?.address || companySettings?.address || 'DIRECCIÓN NO CONFIGURADA';
    const displayPhone = branch?.phone || companySettings?.phone || '';
    const displayLogo = (branch?.logoUrl && branch.logoUrl.trim() !== '') ? branch.logoUrl : companySettings?.logoUrl;

    return (
        <div className={`bg-white text-black p-4 ${isSmallTicket ? 'w-[58mm] text-[9px]' : 'w-[80mm] text-[10px]'}`} style={{ minHeight: 'fit-content' }}>
            <div className="text-center">
                {displayLogo ? (
                    <img src={displayLogo} alt="Logo" className="w-16 h-16 mx-auto mb-2 object-contain" />
                ) : (
                    <div className="text-xl font-black mb-1">{displayName}</div>
                )}
                <p className="text-[10px] mt-1">{displayAddress}</p>
                <p className="text-[10px]">Tel: {formatPhone(displayPhone)}</p>
                <hr className="my-2 border-black border-dashed" />
                <div className="text-[10px] text-left">
                    <p>Pedido: {order.dailyOrderNumber ? `P-${String(order.dailyOrderNumber).padStart(3, '0')}` : order.id}</p>
                    <p>Fecha: {(() => {
                        const d = order.completedAt || order.createdAt;
                        const dateObj = d instanceof Date ? d : new Date(d);
                        return isNaN(dateObj.getTime()) ? '---' : dateObj.toLocaleString();
                    })()}</p>
                    <p>Tipo: {order.type}</p>
                    <p>Mesero: {order.waiter?.name || order.user_name || 'Admin'}</p>
                    {order.table && (
                        <p>Mesa: {order.table.area ? `${order.table.area} > ${order.table.name}` : order.table.name}</p>
                    )}
                </div>
            </div>

            {order.customer && (
                <>
                    <hr className="my-2 border-black border-dashed" />
                    <div className="text-[10px]">
                        <p className="font-bold">CLIENTE:</p>
                        <p>{order.customer.name}</p>
                        <p>{formatPhone(order.customer.phone)}</p>
                        {order.customer.email && <p className="break-all">{order.customer.email}</p>}
                    </div>
                </>
            )}

            <hr className="my-2 border-black border-dashed" />

            <div className="text-[10px] space-y-1">
                {order.items.map(item => (
                    <div key={item.id}>
                        <div className="flex justify-between">
                            <span className="break-words w-4/6 pr-1">
                                {item.quantity}x {item.product?.name || 'Producto Desconocido'}
                            </span>
                            <span className="w-2/6 text-right">
                                ${(item.total || 0).toFixed(2)}
                            </span>
                        </div>
                        {item.comboSelections && item.comboSelections.length > 0 && (
                            <div className="pl-2 space-y-0.5 mb-1">
                                {item.comboSelections.map((s, idx) => (
                                    <div key={idx} className="flex justify-between w-4/6 text-[9px] text-gray-800 font-bold uppercase tracking-tight">
                                        <span>• {s.productName} {s.meatName ? `[${s.meatName}]` : ''} {s.masaName ? `[${s.masaName}]` : ''}</span>
                                        <span>x{s.quantity}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        {item.meat && <div className="pl-4 text-gray-600 italic">- {item.meat.name}</div>}
                        {item.masa && <div className="pl-4 text-gray-600 italic">- {item.masa.name}</div>}
                        {item.extras?.map(extra => <div key={extra.id} className="pl-4 text-gray-600">+ {extra.name}</div>)}
                        {item.observations && <div className="pl-4 text-black font-bold italic leading-none">"{item.observations}"</div>}
                    </div>
                ))}
            </div>

            <hr className="my-2 border-black border-dashed" />

            <div className="text-[10px] space-y-1">
                {Number(order.discount || 0) > 0 && <div className="flex justify-between"><span>Dcto. x Promoción:</span><span>-${Number(order.discount).toFixed(2)}</span></div>}
                {Number(order.manualDiscount || 0) > 0 && (
                    <div className="flex justify-between text-blue-800 font-bold">
                        <span>Cortesía Admin:</span>
                        <span>-${Number(order.manual_discount || order.manualDiscount).toFixed(2)}</span>
                    </div>
                )}
                {Number(order.deliveryFee || 0) > 0 && <div className="flex justify-between"><span>Envío:</span><span>${Number(order.deliveryFee).toFixed(2)}</span></div>}
                {Number(order.serviceCharge || 0) > 0 && <div className="flex justify-between"><span>Propina Sugerida:</span><span>${Number(order.serviceCharge).toFixed(2)}</span></div>}
                {Number(order.cardCommission || 0) > 0 && <div className="flex justify-between"><span>Comisión Tarjeta:</span><span>${Number(order.cardCommission).toFixed(2)}</span></div>}
                <div className="flex justify-between font-bold text-sm pt-1 border-t border-black/10">
                    <span>TOTAL:</span>
                    <span>${(Number(order.total || 0) - (Number(order.manual_discount || order.manualDiscount || 0)) + (Number(order.serviceCharge || 0)) + (Number(order.cardCommission || 0))).toFixed(2)}</span>
                </div>
            </div>

            {order.payments && (
                <>
                    <hr className="my-2 border-black border-dashed" />
                    <div className="text-[10px] space-y-1">
                        <div className="flex justify-between"><span>Pago:</span><span>{paymentMethodDisplay}</span></div>
                        <div className="flex justify-between"><span>Recibido:</span><span>${Number(order.amountPaid || 0).toFixed(2)}</span></div>
                        {(() => {
                            const adjustedTotal = (Number(order.total || 0) - (Number(order.manual_discount || order.manualDiscount || 0)) + (Number(order.serviceCharge || 0)) + (Number(order.cardCommission || 0)));
                            const change = Number(order.changeGiven || 0) > 0
                                ? Number(order.changeGiven)
                                : (order.payments && order.payments.length === 1 && order.payments[0].method === 'Tarjeta')
                                    ? 0
                                    : Math.max(0, Number(order.amountPaid || 0) - adjustedTotal);

                            if (change > 0.01) {
                                return (
                                    <div className="flex justify-between font-bold">
                                        <span>Cambio:</span>
                                        <span>${change.toFixed(2)}</span>
                                    </div>
                                );
                            }
                            return null;
                        })()}
                    </div>
                </>
            )}

            <p className="text-center text-[10px] font-bold mt-4 italic">¡Gracias por su preferencia!</p>
        </div>
    );
};

const TicketModal: React.FC<TicketModalProps> = ({ order, onClose, onNewOrder, isViewingCompleted = false, companySettings, onUpdateCustomerEmail, branches }) => {
    const [sendingEmail, setSendingEmail] = useState(false);
    const [emailInput, setEmailInput] = useState('');
    const [toast, setToast] = useState<{ message: string | null; title?: string; type?: 'success' | 'error' | 'warning' | 'info'; persistent?: boolean }>({ message: null });

    // Drag-to-Scroll logic
    const scrollRef = useRef<HTMLDivElement>(null);
    const ticketRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startY, setStartY] = useState(0);
    const [scrollTopState, setScrollTopState] = useState(0);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!scrollRef.current) return;
        setIsDragging(true);
        setStartY(e.pageY - scrollRef.current.offsetTop);
        setScrollTopState(scrollRef.current.scrollTop);
    };

    const handleMouseLeave = () => setIsDragging(false);
    const handleMouseUp = () => setIsDragging(false);
    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !scrollRef.current) return;
        e.preventDefault();
        const y = e.pageY - scrollRef.current.offsetTop;
        const walk = (y - startY) * 2;
        scrollRef.current.scrollTop = scrollTopState - walk;
    };

    const existingEmail = order.customer?.email;
    const currentBranch = branches?.find(b => b.id === (order.branchId || 1));
    const ticketWidth = currentBranch?.ticketWidth || '80mm';
    const isSmallTicket = ticketWidth === '58mm';

    const handlePrint = () => {
        window.print();
    };

    const handleShare = async () => {
        try {
            const canvas = await html2canvas(ticketRef.current!, { scale: 2, useCORS: true });
            const blob = await new Promise<Blob>(resolve => canvas.toBlob(b => resolve(b!), 'image/png'));
            const file = new File([blob], `ticket_${order.dailyOrderNumber || order.id}.png`, { type: 'image/png' });

            if (navigator.share && navigator.canShare?.({ files: [file] })) {
                await navigator.share({ files: [file], title: 'Ticket' });
            } else {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `ticket_${order.dailyOrderNumber || order.id}.png`;
                a.click();
                URL.revokeObjectURL(url);
            }
        } catch (e: any) {
            if (e.name !== 'AbortError') {
                console.error('Share failed:', e);
            }
        }
    };

    const handleSendEmail = async () => {
        let targetEmail = existingEmail;
        if (!targetEmail) {
            if (!emailInput.trim()) {
                setToast({ message: 'Ingrese un correo electrónico.', title: 'CORREO REQUERIDO', type: 'warning' });
                return;
            }
            targetEmail = emailInput.trim().toLowerCase();
            if (order.customer && order.customer.id !== 999) {
                onUpdateCustomerEmail(order.customer.id, targetEmail);
                order.customer.email = targetEmail;
            }
        }

        const branchWebhook = currentBranch?.gasWebhookUrl;
        const globalWebhook = companySettings?.gasWebhookUrl;
        const webhookUrl = branchWebhook || globalWebhook;

        if (!webhookUrl) {
            setToast({ message: 'Correo registrado, pero falta configurar la URL del Webhook.', title: 'CONFIGURACIÓN INCOMPLETA', persistent: true, type: 'warning' });
            return;
        }

        console.log('[DEBUG-EMAIL] Iniciando envío...', { webhookUrl, targetEmail });
        setSendingEmail(true);
        try {
            const webhookData = {
                type: 'ticket',
                order: { ...order, customer: { ...order.customer, email: targetEmail } },
                company: {
                    name: currentBranch?.name || companySettings?.name || 'RESTAURANTE',
                    address: currentBranch?.address || companySettings?.address || '',
                    phone: currentBranch?.phone || companySettings?.phone || '',
                    logoUrl: (currentBranch?.logoUrl && currentBranch.logoUrl.trim() !== '') ? currentBranch.logoUrl : companySettings?.logoUrl
                }
            };

            const response = await fetch(webhookUrl, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(webhookData)
            });
            console.log('[DEBUG-EMAIL] Petición realizada (no-cors). Check network tab.');
            setToast({ message: `¡TICKET ENVIADO A ${targetEmail.toUpperCase()}!`, type: 'success' });
            setEmailInput('');
            setTimeout(() => setToast({ message: null }), 3000);
        } catch (error) {
            console.error('Error enviando correo:', error);
            setToast({ message: 'ERROR AL INTENTAR ENVIAR EL CORREO', type: 'error' });
            setTimeout(() => setToast({ message: null }), 3000);
        } finally {
            setSendingEmail(false);
        }
    };

    const paymentMethodDisplay = order.payments
        ? order.payments.length > 1 ? 'Pago Múltiple' : order.payments[0]?.method || 'N/A'
        : 'N/A';

    return (
        <>
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 no-print">
                <div className="bg-gray-800 rounded-3xl p-0 w-full max-w-sm mx-auto flex flex-col h-[92vh] overflow-hidden border border-gray-700 shadow-2xl relative">
                    {/* Contenido del Ticket Deslizable */}
                    <div
                        ref={scrollRef}
                        onMouseDown={handleMouseDown}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseLeave}
                        onMouseMove={handleMouseMove}
                        className={`flex-1 overflow-y-auto p-4 flex flex-col items-center bg-gray-100 scrollbar-hide select-none pt-8 pb-4 ${isDragging ? 'cursor-grabbing' : 'cursor-default'}`}
                    >
                        <div ref={ticketRef}>
                            <TicketContent
                                order={order}
                                companySettings={companySettings}
                                branch={currentBranch}
                                isSmallTicket={isSmallTicket}
                                paymentMethodDisplay={paymentMethodDisplay}
                            />
                        </div>
                    </div>

                    {/* Botonera Sticky */}
                    <div className="bg-gray-800 p-4 pt-3 border-t border-gray-700 shadow-[0_-10px_20px_rgba(0,0,0,0.5)] z-10 shrink-0">
                        <div className="space-y-2 w-full animate-in slide-in-from-bottom duration-300">
                            <div className="flex gap-1.5">
                                <button onClick={handlePrint} className="flex-1 p-2.5 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-1 text-[9px] leading-tight uppercase shadow-lg active:scale-95">
                                    <PrintIcon className="w-3.5 h-3.5" /> Imprimir
                                </button>
                                <button onClick={handleShare} className="flex-1 p-2.5 bg-amber-600 text-white font-black rounded-xl hover:bg-amber-700 transition-all flex items-center justify-center gap-1 text-[9px] leading-tight uppercase shadow-lg active:scale-95">
                                    <ShareIcon className="w-3.5 h-3.5" /> Compartir
                                </button>
                                {!isViewingCompleted && (
                                    <button onClick={onNewOrder} className="flex-1 p-2.5 bg-green-600 text-white font-black rounded-xl hover:bg-green-700 transition-all text-[9px] leading-tight uppercase shadow-lg active:scale-95">
                                        Nuevo Pedido
                                    </button>
                                )}
                            </div>

                            <div className="bg-gray-900/40 p-2.5 rounded-xl border border-gray-700/50 shadow-inner">
                                <p className="text-[8px] font-black text-gray-500 mb-1.5 uppercase tracking-widest text-center">Enviar Ticket Digital</p>
                                {existingEmail ? (
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 flex items-center bg-gray-900/80 p-2 rounded-lg border border-gray-700 overflow-hidden">
                                            <span className="text-[9px] text-white truncate font-mono font-bold">{existingEmail}</span>
                                            <CheckCircleIcon className="w-3.5 h-3.5 text-green-500 shrink-0 ml-2" />
                                        </div>
                                        <button onClick={handleSendEmail} disabled={sendingEmail} className={`shrink-0 px-3 py-2 text-white font-black rounded-lg transition-all flex items-center justify-center gap-1 shadow-lg text-[9px] leading-tight uppercase active:scale-[0.98] ${sendingEmail ? 'bg-purple-800 cursor-wait' : 'bg-purple-600 hover:bg-purple-700'}`}>
                                            {sendingEmail ? <span className="animate-pulse">...</span> : 'RE-ENVIAR'}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <input type="email" placeholder="CORREO DEL CLIENTE..." value={emailInput} onChange={(e) => setEmailInput(e.target.value)} className="flex-1 p-2 bg-gray-950 border border-gray-700 rounded-lg text-[10px] text-white font-black outline-none focus:border-amber-500 placeholder:text-gray-600 shadow-inner" />
                                        <button onClick={handleSendEmail} disabled={sendingEmail} className={`shrink-0 px-3 py-2 text-white font-black rounded-lg transition-all flex items-center justify-center gap-1 shadow-lg text-[9px] leading-tight uppercase active:scale-[0.98] ${sendingEmail ? 'bg-purple-800 cursor-wait' : 'bg-purple-600 hover:bg-purple-700'}`}>
                                            {sendingEmail ? <span className="animate-pulse">...</span> : 'ENVIAR'}
                                        </button>
                                    </div>
                                )}
                            </div>

                            <button onClick={onClose} className="w-full p-2.5 bg-gray-700 text-gray-300 font-black rounded-xl hover:bg-gray-600 transition-all text-[9px] leading-tight uppercase">Cerrar</button>
                        </div>
                    </div>
                </div>

                <NotificationToast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast({ ...toast, message: null })}
                    persistent={toast.persistent}
                    position="top"
                />
            </div>

            {/* Hidden Print Portal at Body Root */}
            {createPortal(
                <div className="print-area">
                    <TicketContent
                        order={order}
                        companySettings={companySettings}
                        branch={currentBranch}
                        isSmallTicket={isSmallTicket}
                        paymentMethodDisplay={paymentMethodDisplay}
                    />
                </div>,
                document.body
            )}
        </>
    );
};

export default TicketModal;
