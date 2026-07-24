import React, { useState, useRef, useEffect } from 'react';
import { api } from '../api';
import { User, UserRole } from '../types';
import { toast } from 'react-hot-toast';

interface PinVerificationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (adminUser: User) => void;
    title?: string;
    message?: string;
    requiredRole?: UserRole;
}

const PinVerificationModal: React.FC<PinVerificationModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    title = "AUTORIZACIÓN REQUERIDA",
    message = "Esta acción requiere permisos de Administrador",
    requiredRole = UserRole.Admin
}) => {
    const [pin, setPin] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setPin('');
            setError(null);
            // Give enough time for animation to finish
            setTimeout(() => inputRef.current?.focus(), 300);
            setTimeout(() => inputRef.current?.focus(), 600); // Assurance check
        }
    }, [isOpen]);

    const handleVerify = async (inputPin: string) => {
        if (!inputPin) return;
        setIsLoading(true);
        setError(null);

        try {
            const user = await api.login(inputPin);

            // Check Role
            const roles = user.roles || [];
            const hasPermission = roles.includes(UserRole.SuperAdmin) || roles.includes(requiredRole);

            if (hasPermission) {
                onSuccess(user);
            } else {
                setError('ACCESO DENEGADO: Permisos nsuficientes');
                toast.error('No tienes permisos de Administrador');
                setPin('');
            }
        } catch (err) {
            console.error(err);
            setError('PIN INCORRECTO');
            setPin('');
        } finally {
            setIsLoading(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.replace(/\D/g, '').slice(0, 6);
        setPin(val);
        setError(null);

        if (val.length === 6) {
            handleVerify(val);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className="bg-gray-900 border border-gray-800 w-full max-w-sm rounded-3xl p-8 shadow-2xl relative overflow-hidden"
                onClick={() => inputRef.current?.focus()}
            >

                {/* Close Button */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onClose();
                    }}
                    className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors z-10"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                <div className="text-center space-y-6">
                    <div className="mx-auto w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center border border-red-500/20 mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>

                    <div>
                        <h3 className="text-xl font-black text-white uppercase tracking-tight" dangerouslySetInnerHTML={{ __html: title }} />
                        <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-2">{message}</p>
                    </div>

                    <div className="relative">
                        <input
                            ref={inputRef}
                            type="tel"
                            inputMode="numeric"
                            autoComplete="off"
                            className="opacity-0 absolute inset-0 w-full h-full cursor-pointer z-0"
                            value={pin}
                            onChange={handleInputChange}
                            disabled={isLoading}
                            onBlur={() => {
                                // Optional: force keep focus? No, might take over browser.
                                // Just allow easy refocus.
                            }}
                        />

                        <div className={`flex justify-center gap-3 ${error ? 'animate-shake' : ''} pointer-events-none`}>
                            {[...Array(6)].map((_, i) => (
                                <div
                                    key={i}
                                    className={`w-3 h-3 rounded-full transition-all duration-300 ${pin.length > i
                                        ? 'bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.5)] scale-125'
                                        : 'bg-gray-800 border border-gray-700'
                                        }`}
                                />
                            ))}
                        </div>
                    </div>

                    {error && (
                        <div className="p-2 bg-red-500/10 border border-red-500/20 rounded-lg animate-in slide-in-from-bottom-2">
                            <p className="text-red-500 text-[10px] font-black uppercase tracking-widest">{error}</p>
                        </div>
                    )}

                    {isLoading && (
                        <p className="text-red-600 text-[10px] font-black uppercase tracking-widest animate-pulse">VERIFICANDO...</p>
                    )}
                </div>
            </div>

            <style>{`
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-5px); }
                    75% { transform: translateX(5px); }
                }
                .animate-shake {
                    animation: shake 0.3s ease-in-out;
                }
            `}</style>
        </div>
    );
};

export default PinVerificationModal;
