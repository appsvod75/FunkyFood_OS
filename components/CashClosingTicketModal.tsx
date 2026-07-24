import React from 'react';
import { createPortal } from 'react-dom';
import { CashClosingReport, PaymentMethod } from '../types';

interface CashClosingTicketModalProps {
    onClose: () => void;
    report: CashClosingReport;
    branchName?: string;
}

const CashClosingTicketContent: React.FC<{ report: CashClosingReport, branchName?: string }> = ({ report, branchName }) => (
    <div className="bg-white text-black p-4 rounded-md font-mono text-xs w-[80mm]">
        <div className="text-center">
            <h2 className="text-base font-bold">CIERRE DE CAJA</h2>
            {branchName && <p className="text-[11px] font-black uppercase tracking-widest text-gray-700 mt-1">SUCURSAL: {branchName}</p>}
            <div className="text-[10px] mt-1">
                <p>CORRESPONDE AL: <span className="font-bold underline">{report.date}</span></p>
                <p>Impreso el: {new Date().toLocaleString()}</p>
            </div>
        </div>
        <hr className="my-2 border-black border-dashed" />
        <div className="space-y-1">
            <p className="font-bold">VENTAS POR MÉTODO:</p>
            {Array.isArray(report.summary) ? report.summary.map(item => {
                const displayTotal = Number(item.total);
                
                return (
                    <div key={item.method} className="flex justify-between">
                        <span>{item.method}:</span>
                        <span>${displayTotal.toFixed(2)}</span>
                    </div>
                );
            }) : <p className="italic text-gray-500">Sin datos de desglose</p>}
        </div>
        <hr className="my-2 border-black border-dashed" />
        <div className="flex justify-between font-bold">
            <span>TOTAL FACTURADO:</span>
            <span>${(Number(report.totalSales) || 0).toFixed(2)}</span>
        </div>
        <hr className="my-2 border-black border-dashed" />
        <div className="space-y-1">
            <p className="font-bold">CUADRE DE GAVETA:</p>
            <div className="flex justify-between">
                <span>Ventas Efectivo (Neto):</span>
                <span>${(Number(report.totalCashIn) || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
                <span>Fondo Inicial:</span>
                <span>${(Number(report.initialCash) || 0).toFixed(2)}</span>
            </div>
        </div>
        <hr className="my-2 border-black border-dashed" />
        <div className="flex justify-between font-bold text-sm">
            <span>TOTAL EN GAVETA:</span>
            <span>${(Number(report.expectedCash) || 0).toFixed(2)}</span>
        </div>
    </div>
);

const CashClosingTicketModal: React.FC<CashClosingTicketModalProps> = ({ onClose, report, branchName }) => {
    const handlePrint = () => {
        window.print();
    };

    return (
        <>
            <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4 no-print">
                <div className="bg-gray-800 rounded-xl p-4 sm:p-6 w-full max-w-sm mx-auto flex flex-col max-h-[90vh]">
                    <div className="flex-1 overflow-y-auto bg-gray-100 p-4 rounded-xl flex flex-col items-center">
                        <CashClosingTicketContent report={report} branchName={branchName} />
                    </div>

                    <div className="mt-4 flex flex-col sm:flex-row gap-3">
                        <button onClick={handlePrint} className="w-full p-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors">Imprimir</button>
                        <button onClick={onClose} className="w-full sm:w-auto p-3 bg-gray-600 text-white font-bold rounded-lg hover:bg-gray-700 transition-colors">Cerrar</button>
                    </div>
                </div>
            </div>

            {/* Hidden Print Portal at Body Root */}
            {createPortal(
                <div className="print-area">
                    <CashClosingTicketContent report={report} branchName={branchName} />
                </div>,
                document.body
            )}
        </>
    );
};

export default CashClosingTicketModal;