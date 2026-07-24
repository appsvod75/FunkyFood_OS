
import React, { useEffect, useState } from 'react';
import { CheckCircleIcon, TrashIcon } from './icons';

interface ToastProps {
    message: string;
    type?: 'success' | 'error';
    onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, type = 'success', onClose }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 2000);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[200] pointer-events-none animate-in fade-in slide-in-from-top-6 duration-300">
            <div className={`
                px-6 py-3 rounded-[20px] shadow-2xl flex items-center gap-3 border ring-1 ring-black/5 backdrop-blur-xl
                ${type === 'error' ? 'bg-red-600/90 text-white border-red-500/50' : 'bg-green-600/15 text-white border-green-400/10'}
            `}>
                {type === 'success' ? <CheckCircleIcon className="w-5 h-5 text-green-400/80" /> : <TrashIcon className="w-5 h-5 text-white/80" />}
                <span className={`font-black text-[10px] uppercase italic tracking-[0.15em] leading-none ${type === 'error' ? 'text-white' : 'text-green-100/90'}`}>
                    {message}
                </span>
            </div>
        </div>
    );
};

interface ConfirmationModalProps {
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    isDestructive?: boolean;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ title, message, onConfirm, onCancel, isDestructive = false }) => {
    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
            <div className="bg-gray-900 w-full max-w-sm rounded-[32px] p-6 border border-gray-800 shadow-2xl animate-in zoom-in duration-200">
                <div className="mb-6 text-center">
                    <h3 className="text-xl font-black text-white mb-2 uppercase italic leading-none">{title}</h3>
                    <p className="text-xs text-gray-400 font-medium leading-relaxed">{message}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={onCancel}
                        className="p-3 bg-gray-800 text-gray-400 font-black rounded-2xl uppercase text-[10px] active:scale-95 tracking-widest hover:bg-gray-750 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`
                            p-3 font-black rounded-2xl uppercase text-[10px] shadow-lg active:scale-95 transition-all tracking-widest text-white
                            ${isDestructive ? 'bg-red-600 hover:bg-red-500' : 'bg-cyan-600 hover:bg-cyan-500'}
                        `}
                    >
                        Confirmar
                    </button>
                </div>
            </div>
        </div>
    );
};
