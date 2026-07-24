import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { TrashIcon } from './icons';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title?: string;
    message?: string;
    confirmText?: string;
    cancelText?: string;
    isDestructive?: boolean;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title = '¿ESTÁS SEGURO?',
    message = 'Esta acción no se puede deshacer',
    confirmText = 'SÍ, CONFIRMAR',
    cancelText = 'CANCELAR',
    isDestructive = true
}) => {
    const [isVisible, setIsVisible] = useState(false);
    const portalRoot = document.getElementById('portal-root');

    useEffect(() => {
        if (isOpen) {
            setIsVisible(true);
        } else {
            const timer = setTimeout(() => setIsVisible(false), 200); // Allow exit animation
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    if (!isVisible || !portalRoot) return null;

    return createPortal(
        <div className={`fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[200] p-4 transition-all duration-200 ${isOpen ? 'opacity-100' : 'opacity-0'}`}>
            <div className={`bg-gray-900 rounded-[32px] p-6 w-full max-w-sm shadow-2xl border border-gray-800 transition-all duration-200 transform ${isOpen ? 'scale-100' : 'scale-95'}`}>
                <div className="flex flex-col items-center text-center space-y-4">
                    <div className={`p-4 rounded-full border mb-2 ${isDestructive ? 'bg-red-500/10 border-red-500/20' : 'bg-amber-500/10 border-amber-500/20'}`}>
                        <TrashIcon className={`w-8 h-8 ${isDestructive ? 'text-red-500' : 'text-amber-500'}`} />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-white italic uppercase tracking-tighter" dangerouslySetInnerHTML={{ __html: title }}></h3>
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">{message}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 w-full pt-2">
                        <button
                            onClick={onClose}
                            className="p-4 bg-gray-800 hover:bg-gray-700 text-gray-400 font-black rounded-2xl uppercase text-xs transition-colors active:scale-95"
                        >
                            {cancelText}
                        </button>
                        <button
                            onClick={onConfirm}
                            className={`p-4 font-black rounded-2xl uppercase text-xs shadow-lg active:scale-95 transition-all ${isDestructive ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-900/20' : 'bg-green-600 hover:bg-green-500 text-white shadow-green-900/20'}`}
                        >
                            {confirmText}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        portalRoot
    );
};

export default ConfirmationModal;
