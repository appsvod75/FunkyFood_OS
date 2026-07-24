import React from 'react';
import { createPortal } from 'react-dom';
import { LogoutIcon } from './icons';

interface ExitConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
}

const ExitConfirmationModal: React.FC<ExitConfirmationModalProps> = ({ isOpen, onClose, onConfirm }) => {
    if (!isOpen) return null;

    const portalRoot = document.getElementById('portal-root');
    if (!portalRoot) return null;

    return createPortal(
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[999] p-6 animate-in fade-in duration-200">
            <div className="bg-gray-900 w-full max-w-sm rounded-[32px] p-6 border border-gray-800 shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
                <div className="flex flex-col items-center text-center space-y-4">
                    <div className="bg-amber-500/10 p-4 rounded-full border border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                        <LogoutIcon className="w-8 h-8 text-amber-500" />
                    </div>

                    <div className="space-y-2">
                        <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">
                            ¿SALIR DE LA APLICACIÓN?
                        </h3>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide leading-relaxed">
                            Volverás a la pantalla de inicio de sesión.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 w-full pt-2">
                        <button
                            onClick={onClose}
                            className="p-4 bg-gray-800 hover:bg-gray-700 text-gray-400 font-black rounded-2xl uppercase text-xs active:scale-95 transition-all tracking-widest"
                        >
                            CANCELAR
                        </button>
                        <button
                            onClick={onConfirm}
                            className="p-4 bg-amber-500 hover:bg-amber-400 text-white font-black rounded-2xl uppercase text-xs shadow-lg shadow-amber-900/20 active:scale-95 transition-all italic tracking-widest"
                        >
                            SALIR
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        portalRoot
    );
};

export default ExitConfirmationModal;
