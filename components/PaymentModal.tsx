import React, { useState, useMemo, useEffect } from 'react';
import { PaymentMethod, Payment, UserRole, CompanySettings } from '../types';
import { PlusIcon, TrashIcon } from './icons';
import PinVerificationModal from './PinVerificationModal';

interface PaymentModalProps {
    orderTotal: number;
    manualDiscount: number;
    onManualDiscountChange: (amount: number) => void;
    onClose: () => void;
    onConfirmPayment: (payments: Payment[], changeGiven: number, serviceCharge?: number, cardCommission?: number) => void;
    waiters: any[];
    settings: CompanySettings;
    orderType: string;
}

const PaymentModal: React.FC<PaymentModalProps> = ({
    orderTotal,
    manualDiscount,
    onManualDiscountChange,
    onClose,
    onConfirmPayment,
    waiters,
    settings,
    orderType
}) => {
    const [payments, setPayments] = useState<Payment[]>([]);
    const [currentPaymentMethod, setCurrentPaymentMethod] = useState<PaymentMethod>(PaymentMethod.Cash);
    const [currentAmount, setCurrentAmount] = useState('');
    const [isPinModalVisible, setIsPinModalVisible] = useState(false);
    const [pinPurpose, setPinPurpose] = useState<'DISCOUNT' | 'CREDIT' | 'EMPLOYEE'>('DISCOUNT');
    const [isDiscountInputVisible, setIsDiscountInputVisible] = useState(false);
    const [isEmployeeSelectVisible, setIsEmployeeSelectVisible] = useState(false);
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
    const [discountValue, setDiscountValue] = useState(manualDiscount > 0 ? manualDiscount.toString() : '');
    const [pendingMethod, setPendingMethod] = useState<PaymentMethod | null>(null);

    // Dynamic Charges Calculations
    const serviceCharge = useMemo(() => {
        if (!settings.enableServiceCharge) return 0;
        // Solo aplicar propina si es servicio de Restaurante
        if (orderType !== 'Restaurant') return 0;
        return (Number(orderTotal) * (settings.serviceChargePercentage || 0)) / 100;
    }, [orderTotal, settings.enableServiceCharge, settings.serviceChargePercentage, orderType]);

    const cardCommission = useMemo(() => {
        if (!settings.enableCommission) return 0;

        const baseTotal = (Number(orderTotal) || 0) - manualDiscount + serviceCharge;
        const cardPayments = payments.filter(p => p.method === PaymentMethod.Card);
        const totalCardPaid = cardPayments.reduce((sum, p) => sum + p.amount, 0);
        const totalNonCardPaid = payments
            .filter(p => p.method !== PaymentMethod.Card)
            .reduce((sum, p) => sum + p.amount, 0);

        const perc = (settings.commissionPercentage || 0) / 100;

        // 1. Commission from EXISTING card payments
        let commission = (totalCardPaid * perc);

        // 2. PROJECTED commission if we finish with Card
        if (currentPaymentMethod === PaymentMethod.Card) {
            const currentBaseCoveredByCard = totalCardPaid * (1 - perc);
            const remainingBase = baseTotal - totalNonCardPaid - currentBaseCoveredByCard;
            if (remainingBase > 0) {
                const projectedCardPayment = remainingBase / (1 - perc);
                commission += (projectedCardPayment * perc);
            }
        }

        return commission;
    }, [payments, settings.enableCommission, settings.commissionPercentage, currentPaymentMethod, orderTotal, manualDiscount, serviceCharge]);

    const safeOrderTotal = useMemo(() => {
        const val = Number(orderTotal);
        const totalBase = (isNaN(val) ? 0 : val) - manualDiscount;
        return totalBase + serviceCharge + cardCommission;
    }, [orderTotal, manualDiscount, serviceCharge, cardCommission]);

    const totalPaid = useMemo(() => payments.reduce((sum, p) => sum + p.amount, 0), [payments]);

    const remainingAmount = useMemo(() => {
        if (totalPaid >= safeOrderTotal - 0.009) return 0;
        return safeOrderTotal - totalPaid;
    }, [safeOrderTotal, totalPaid]);

    const isCashOnlyPayment = useMemo(() => {
        return payments.every(p => p.method === PaymentMethod.Cash);
    }, [payments]);

    const changeAmount = useMemo(() => {
        if (isCashOnlyPayment && totalPaid > safeOrderTotal) {
            return totalPaid - safeOrderTotal;
        }
        return 0;
    }, [totalPaid, safeOrderTotal, isCashOnlyPayment]);

    useEffect(() => {
        setCurrentAmount(remainingAmount > 0 ? remainingAmount.toFixed(2) : '');
    }, [remainingAmount]);


    const handleAddPayment = () => {
        const amount = parseFloat(currentAmount);
        if (isNaN(amount) || amount <= 0) return;

        // Validation for Credit/Employee - Now handled at selection
        // BUT if it's Employee, we still need to show the selector if not set
        if (currentPaymentMethod === PaymentMethod.Employee && !selectedEmployeeId) {
            setIsEmployeeSelectVisible(true);
            return;
        }

        if (!isCashOnlyPayment && (totalPaid + amount > safeOrderTotal + 0.009)) {
            alert('El monto no puede exceder el total para esta forma de pago.');
            return;
        }

        setPayments(prev => [...prev, {
            method: currentPaymentMethod,
            amount,
            userId: selectedEmployeeId || undefined
        }]);
        setCurrentAmount('');
        setSelectedEmployeeId(null);
    };

    const confirmAddSpecialPayment = (forcedEmployeeId?: number) => {
        const amount = parseFloat(currentAmount);
        const employeeId = forcedEmployeeId || selectedEmployeeId;

        if (currentPaymentMethod === PaymentMethod.Employee && !employeeId) {
            setIsEmployeeSelectVisible(true);
            return;
        }

        setPayments(prev => [...prev, {
            method: currentPaymentMethod,
            amount,
            userId: employeeId || undefined // Pass userId for Employee balance
        }]);
        setCurrentAmount('');
        setIsEmployeeSelectVisible(false);
        setSelectedEmployeeId(null);
    };

    const handleApplyManualDiscount = () => {
        const discount = parseFloat(discountValue);
        if (isNaN(discount) || discount < 0) {
            onManualDiscountChange(0);
        } else if (discount > orderTotal) {
            alert('El descuento no puede ser mayor al total.');
        } else {
            onManualDiscountChange(discount);
        }
        setIsDiscountInputVisible(false);
    };

    const handleRemovePayment = (index: number) => {
        setPayments(prev => prev.filter((_, i) => i !== index));
    };

    const canConfirm = totalPaid >= safeOrderTotal - 0.009;

    const handleConfirm = () => {
        if (!canConfirm) return;
        onConfirmPayment(payments, changeAmount, serviceCharge, cardCommission);
    };

    const handleMethodClick = (method: PaymentMethod) => {
        if (method === PaymentMethod.Credit || method === PaymentMethod.Employee) {
            setPinPurpose(method === PaymentMethod.Credit ? 'CREDIT' : 'EMPLOYEE');
            setPendingMethod(method);
            setIsPinModalVisible(true);
        } else {
            setCurrentPaymentMethod(method);
        }
    };

    return (
        <>
            <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
                <div className="bg-gray-800 rounded-xl p-6 w-full max-w-lg shadow-2xl flex flex-col max-h-[95vh] overflow-y-auto touch-pan-y">
                    <form autoComplete="off" onSubmit={(e) => { e.preventDefault(); if (canConfirm) handleConfirm(); }} className="flex flex-col flex-1">
                        <h3 className="text-2xl md:text-3xl font-bold text-amber-400 text-center mb-2">Procesar Pago</h3>

                        <div className="text-center py-2 mb-1 bg-gray-900 rounded-lg relative overflow-hidden">
                            <p className="text-base md:text-lg text-gray-400">Total a Pagar</p>
                            <p className="text-4xl md:text-5xl font-bold text-white">${safeOrderTotal.toFixed(2)}</p>

                            {/* Desglose de Cargos Extra */}
                            <div className="flex flex-wrap justify-center gap-1.5 mt-2 px-4 pb-1">
                                {manualDiscount > 0 && (
                                    <div className="flex items-center gap-1 bg-cyan-500/20 text-cyan-400 px-2.5 py-1 rounded-full border border-cyan-500/30 shadow-sm">
                                        <span className="text-[9px] font-black uppercase tracking-tight">Cortesía: -${manualDiscount.toFixed(2)}</span>
                                        <button
                                            type="button"
                                            onClick={() => onManualDiscountChange(0)}
                                            className="text-cyan-400/50 hover:text-red-400 transition-colors"
                                        >
                                            <TrashIcon className="w-2.5 h-2.5" />
                                        </button>
                                    </div>
                                )}
                                {serviceCharge > 0 && (
                                    <span className="text-[9px] bg-blue-500/20 text-blue-400 px-2.5 py-1 rounded-full font-black uppercase tracking-tight border border-blue-500/30">
                                        Propina ({settings.serviceChargePercentage}%): +${serviceCharge.toFixed(2)}
                                    </span>
                                )}
                                {cardCommission > 0 && (
                                    <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-full font-black uppercase tracking-tight border border-emerald-500/30">
                                        Comisión Bancaria ({settings.commissionPercentage}%): +${cardCommission.toFixed(2)}
                                    </span>
                                )}
                            </div>
                        </div>

                        {!isDiscountInputVisible && (
                            <button
                                type="button"
                                onClick={() => setIsPinModalVisible(true)}
                                className="mb-1 py-1 px-4 self-center bg-cyan-500/10 border border-cyan-500/30 text-cyan-500 rounded-full text-[10px] font-black uppercase tracking-[0.2em] hover:bg-cyan-500/20 transition-all flex items-center gap-2"
                            >
                                <span className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse" />
                                DESC. ADMIN
                            </button>
                        )}

                        {isDiscountInputVisible && (
                            <div className="mb-4 p-4 bg-cyan-950/30 border border-cyan-500/30 rounded-xl animate-in zoom-in-95 duration-200">
                                <label className="block text-cyan-400 text-[10px] font-black uppercase tracking-widest mb-2">Monto de Descuento Especial</label>
                                <div className="flex gap-2">
                                    <input
                                        autoFocus
                                        type="number"
                                        step="0.01"
                                        value={discountValue}
                                        onChange={(e) => setDiscountValue(e.target.value)}
                                        className="flex-1 bg-gray-900 border border-cyan-500/50 rounded-lg p-2 text-white font-bold focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                                        placeholder="0.00"
                                        onKeyDown={(e) => e.key === 'Enter' && handleApplyManualDiscount()}
                                    />
                                    <button
                                        type="button"
                                        onClick={handleApplyManualDiscount}
                                        className="px-4 bg-cyan-600 text-white font-black text-xs rounded-lg hover:bg-cyan-500 uppercase"
                                    >
                                        Aplicar
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="min-h-[100px] flex-shrink-0 pr-2 space-y-2">
                            {payments.map((payment, index) => (
                                <div key={index} className="bg-gray-900/50 border border-gray-700/50 p-3 rounded-xl flex justify-between items-center group transition-all hover:bg-gray-900">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-amber-500/10 text-amber-500 px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border border-amber-500/20">
                                            {payment.method}
                                        </div>
                                        <p className="font-black text-white text-lg font-mono">
                                            ${payment.amount.toFixed(2)}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleRemovePayment(index)}
                                        className="p-2 text-gray-500 hover:text-rose-500 bg-gray-800/50 hover:bg-rose-500/10 rounded-full transition-all border border-transparent hover:border-rose-500/20"
                                    >
                                        <TrashIcon className="w-5 h-5 flex-shrink-0" />
                                    </button>
                                </div>
                            ))}
                        </div>

                        {(!canConfirm || (isCashOnlyPayment && changeAmount === 0)) ? (
                            <div className="bg-gray-900 p-4 rounded-lg space-y-3 mt-1">
                                <div>
                                    <label className="block text-gray-400 text-sm font-bold mb-2">Forma de Pago</label>
                                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                                        {Object.values(PaymentMethod).map(method => (
                                            <button
                                                type="button"
                                                key={method}
                                                onClick={() => handleMethodClick(method)}
                                                className={`p-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${currentPaymentMethod === method ? 'bg-amber-500 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}
                                            >
                                                {method}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex items-end gap-2">
                                    <div className="flex-1">
                                        <label className="block text-gray-400 text-sm font-bold mb-2" htmlFor="amount">Monto</label>
                                        <input
                                            id="amount"
                                            type="number"
                                            value={currentAmount}
                                            onChange={(e) => setCurrentAmount(e.target.value)}
                                            onFocus={() => setCurrentAmount('')}
                                            placeholder={remainingAmount > 0 ? remainingAmount.toFixed(2) : '0.00'}
                                            autoComplete="new-password"
                                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddPayment(); } }}
                                            className="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                                        />
                                    </div>
                                    <button type="button" onClick={handleAddPayment} className="p-3 bg-green-600 rounded-lg text-white hover:bg-green-700">
                                        <PlusIcon className="w-6 h-6" />
                                    </button>
                                </div>
                            </div>
                        ) : null}

                        <div className={`mt-1 text-center py-2 rounded-lg transition-colors ${canConfirm ? 'bg-green-800' : 'bg-red-800'}`}>
                            <p className="text-base md:text-lg text-gray-300">
                                {canConfirm ? 'Total Recibido' : 'Faltan'}
                            </p>
                            <p className="text-3xl md:text-4xl font-bold text-white">
                                ${canConfirm ? totalPaid.toFixed(2) : remainingAmount.toFixed(2)}
                            </p>
                        </div>

                        {changeAmount > 0 && (
                            <div className="mt-4 text-center py-2 rounded-lg bg-cyan-800">
                                <p className="text-base md:text-lg text-cyan-200">Cambio</p>
                                <p className="text-3xl md:text-4xl font-bold text-white">${changeAmount.toFixed(2)}</p>
                            </div>
                        )}

                        <div className="flex gap-4 pt-4">
                            <button type="button" onClick={onClose} className="w-full p-3 bg-gray-600 text-white font-bold rounded-lg hover:bg-gray-700 transition-colors">Cancelar</button>
                            <button type="submit" disabled={!canConfirm} className="w-full p-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors">Confirmar Pago</button>
                        </div>
                    </form>
                </div>
            </div>

            <PinVerificationModal
                isOpen={isPinModalVisible}
                onClose={() => setIsPinModalVisible(false)}
                onSuccess={() => {
                    setIsPinModalVisible(false);
                    if (pinPurpose === 'DISCOUNT') {
                        setIsDiscountInputVisible(true);
                    } else if (pendingMethod) {
                        setCurrentPaymentMethod(pendingMethod);
                        if (pendingMethod === PaymentMethod.Employee) {
                            setIsEmployeeSelectVisible(true);
                        }
                        setPendingMethod(null);
                    }
                }}
                requiredRole={UserRole.Admin}
                title={pinPurpose === 'DISCOUNT' ? "AUTORIZACIÓN DE DESCUENTO" : (pinPurpose === 'CREDIT' ? "AUTORIZACIÓN DE CRÉDITO" : "AUTORIZACIÓN PAGO EMPLEADO")}
                message={pinPurpose === 'DISCOUNT' ? "PIN de Administrador para cortesía" : "PIN de Administrador para autorizar el saldo pendiente"}
            />

            {isEmployeeSelectVisible && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4">
                    <div className="bg-gray-800 border border-amber-500/30 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
                        <h4 className="text-xl font-bold text-amber-500 mb-4 text-center">Seleccionar Empleado</h4>
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                            {waiters.filter(w => w.isActive).map(w => (
                                <button
                                    key={w.id}
                                    onClick={() => {
                                        setSelectedEmployeeId(w.id);
                                        confirmAddSpecialPayment(w.id);
                                    }}
                                    className="w-full p-3 bg-gray-900 border border-gray-700 rounded-xl text-left hover:border-amber-500 transition-colors text-white font-bold"
                                >
                                    {w.name}
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={() => setIsEmployeeSelectVisible(false)}
                            className="w-full mt-4 p-2 bg-gray-700 text-gray-300 rounded-lg text-sm font-bold"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};

export default PaymentModal;