import React from 'react';
import { Order, PaymentMethod } from '../types';
import { formatCurrency } from '../utils/formatCurrency';
import moment from 'moment';
import 'moment/locale/es';
import { MapPin } from 'lucide-react';

moment.locale('es');

interface DeliveryCardProps {
    order: Order;
    onTake: () => void;
    onDeliver: () => void;
    isAssigned: boolean;
    companyName?: string;
    isDelivered?: boolean;
    driverName?: string;
}

const DeliveryCard: React.FC<DeliveryCardProps> = ({ order, onTake, onDeliver, isAssigned, companyName, isDelivered, driverName }) => {
    const customer = order.customer;
    const address = order.deliveryAddress?.street || customer?.addresses?.[0]?.street || 'Dirección no especificada'; // Fallback
    const phone = customer?.phone;

    // Calculate if there is change needed (if user note says "Pago con 500") 
    // Usually this info is in notes or we don't have it structured. 
    // We can show "Total" clearly.

    const timeAgo = moment(order.createdAt).fromNow(true);

    const whatsappUrl = phone
        ? `https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hola ${customer?.name || ''}, su pedido de *${companyName || window.location.hostname}* va en camino 🏍️`)}`
        : '#';

    const selectedAddress = order.deliveryAddress || customer?.addresses?.[0];

    const mapUrl = (selectedAddress?.latitude && selectedAddress?.longitude)
        ? `https://www.google.com/maps/search/?api=1&query=${selectedAddress.latitude},${selectedAddress.longitude}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((selectedAddress?.street || address) + ', San Salvador')}`;

    return (
        <div className="bg-slate-800 rounded-xl p-4 shadow-md border-l-4 border-l-orange-500">
            {/* Header */}
            <div className="flex justify-between items-start mb-3">
                <div>
                    <span className="text-2xl font-bold text-white">#{order.dailyOrderNumber}</span>
                    <div className="text-xs text-slate-400">Hace {timeAgo}</div>
                </div>
                <div className="text-right flex flex-col items-end">
                    {/* KITCHEN/DELIVERY STATUS BADGE */}
                    {isAssigned && !isDelivered ? (
                        <div className="bg-purple-600 text-white text-xs font-black uppercase px-3 py-1 rounded-lg mb-1 animate-pulse shadow-[0_0_15px_rgba(147,51,234,0.8)] border border-purple-400 flex items-center gap-1">
                            <span>📍</span> LISTO PARA ENTREGAR
                        </div>
                    ) : (
                        // PENDING (Unassigned)
                        order.kitchenStatus === 'ready' ? (
                            <div className="bg-green-600 text-white text-xs font-black uppercase px-3 py-1 rounded-lg mb-1 animate-pulse shadow-[0_0_15px_rgba(34,197,94,0.8)] border border-green-400 flex items-center gap-1">
                                <span>🔔</span> LISTO PARA RECOGER
                            </div>
                        ) : (
                            !isAssigned &&
                            <div className="bg-blue-600 text-white text-xs font-black uppercase px-3 py-1 rounded-lg mb-1 animate-pulse shadow-[0_0_15px_rgba(37,99,235,0.8)] border border-blue-400 flex items-center gap-1">
                                <span>🔵</span> NUEVO PEDIDO
                            </div>
                        )
                    )}

                    {/* Driver Name Display */}
                    {isAssigned && driverName && (
                        <div className="text-xs font-bold text-slate-300 mt-1 mb-1 flex items-center justify-end gap-1">
                            <span>🏍️</span> {driverName}
                        </div>
                    )}

                    <div className="text-2xl font-bold text-green-400">{formatCurrency(order.total)}</div>
                    <div className="text-xs text-slate-400 uppercase">{order.payments?.length > 0 ? 'PAGADO' : 'PENDIENTE PAGO'}</div>
                </div>
            </div>

            {/* Customer Info */}
            <div className="mb-4 p-3 bg-slate-700/50 rounded-lg">
                <div className="flex items-start gap-3 mb-2">
                    <MapPin className="w-5 h-5 text-orange-400 mt-0.5 flex-shrink-0" />
                    <div>
                        <div className="font-bold text-white text-base leading-tight">{address}</div>
                        {customer?.name && <div className="text-slate-400 text-sm">{customer.name}</div>}
                    </div>
                </div>
                {order.customer?.notes && (
                    <div className="text-yellow-400 text-sm italic mt-2 p-2 bg-yellow-500/10 rounded border border-yellow-500/20">
                        📝 Nota: {order.customer.notes}
                    </div>
                )}
                <div className="flex gap-2 mt-3">
                    <a href={mapUrl} target="_blank" rel="noreferrer" className="flex-1 bg-slate-600 hover:bg-slate-500 text-white text-xs font-bold py-2 rounded-lg text-center flex items-center justify-center gap-2 transition-colors">
                        🗺️ VER MAPA
                    </a>
                    <a href={whatsappUrl} target="_blank" rel="noreferrer" className="flex-1 bg-green-600 hover:bg-green-500 text-white text-xs font-bold py-2 rounded-lg text-center flex items-center justify-center gap-2 transition-colors">
                        💬 WHATSAPP
                    </a>
                </div>
            </div>

            {/* Items List - LARGER TEXT */}
            {/* Items List - REVERTED TO LINEAR STYLE */}
            <div className="space-y-4 mb-4 px-2">
                {order.items.map((item, idx) => (
                    <div key={idx} className="flex flex-col border-b border-slate-700/50 pb-3 last:border-0 last:pb-0">
                        <div className="flex items-baseline gap-2">
                            <span className="text-slate-400 font-bold text-lg whitespace-nowrap">{item.quantity}x</span>
                            <span className="text-white font-bold text-lg leading-tight">{item.productName || item.product?.name}</span>
                        </div>

                        {/* Meat / Term / Variant Details */}
                        {item.meat && (
                            <div className="text-slate-300 text-sm pl-8 mt-0.5">
                                + {item.meat.name} {item.meatTerm ? `(${item.meatTerm})` : ''}
                            </div>
                        )}

                        {/* Notes */}
                        {item.notes && <div className="text-orange-300 text-sm pl-8 mt-0.5 italic">"{item.notes}"</div>}

                        {/* Extras/Subitems */}
                        {item.subItems && item.subItems.length > 0 && (
                            <div className="text-slate-400 text-sm pl-8 mt-0.5">
                                {item.subItems.map(s => s.name).join(', ')}
                            </div>
                        )}
                        {/* Extras (Manual) */}
                        {item.extras && item.extras.length > 0 && (
                            <div className="text-slate-400 text-sm pl-8 mt-0.5">
                                {item.extras.map(e => e.name).join(', ')}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Actions */}
            <div className="grid grid-cols-1 gap-2">
                {!isAssigned ? (
                    <button
                        onClick={onTake}
                        className="bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-xl uppercase shadow-lg shadow-blue-900/50 active:scale-95 transition-all w-full text-lg"
                    >
                        ✋ Tomar Pedido
                    </button>
                ) : (
                    <button
                        onClick={onDeliver}
                        disabled={isDelivered}
                        className={`${isDelivered ? 'bg-slate-600' : 'bg-purple-600 hover:bg-purple-500'} text-white font-black py-4 rounded-xl uppercase shadow-lg active:scale-95 transition-all w-full text-lg flex justify-center gap-2 items-center`}
                    >
                        {isDelivered ? '✅ Entregado' : '🏁 Marcar Entregado'}
                    </button>
                )}
            </div>
        </div>
    );
};

export default DeliveryCard;
