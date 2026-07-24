
import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { CompanySettings } from '../types';

interface LoginScreenProps {
    onLogin: (pin: string) => void;
    loginErrorCount: number;
    companySettings: CompanySettings;
    successName?: string;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, loginErrorCount, companySettings, successName }) => {
    const [pin, setPin] = useState('');
    const [attempts, setAttempts] = useState(0);
    const [lockoutTime, setLockoutTime] = useState(0);
    const [isShaking, setIsShaking] = useState(false);
    const [status, setStatus] = useState<'idle' | 'verifying' | 'error' | 'success'>('idle');
    const inputRef = useRef<HTMLInputElement>(null);

    // --- PULL TO REFRESH LOGIC ---
    const [startY, setStartY] = useState(0);
    const [pullOffset, setPullOffset] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const PULL_THRESHOLD = 80;

    const handleTouchStart = (e: React.TouchEvent) => {
        if (window.scrollY === 0) {
            setStartY(e.touches[0].pageY);
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (startY === 0 || isRefreshing) return;
        const currentY = e.touches[0].pageY;
        const diff = currentY - startY;
        if (diff > 0) {
            setPullOffset(Math.min(diff * 0.5, PULL_THRESHOLD + 20));
        }
    };

    const handleTouchEnd = async () => {
        if (pullOffset >= PULL_THRESHOLD) {
            setIsRefreshing(true);
            setPullOffset(PULL_THRESHOLD);

            // Lógica de Force Update Profunda
            try {
                toast('Actualizando aplicación...', { icon: '🔄' });
                if ('caches' in window) {
                    const cacheNames = await caches.keys();
                    await Promise.all(cacheNames.map(name => caches.delete(name)));
                }
                if (navigator.serviceWorker) {
                    const regs = await navigator.serviceWorker.getRegistrations();
                    for (let reg of regs) { await reg.unregister(); }
                }
                // Clear state for brand refresh
                localStorage.removeItem('company_settings');
                localStorage.removeItem('app_version');

                setTimeout(() => window.location.reload(), 800);
            } catch (err) {
                console.error("Refresh failed", err);
                setIsRefreshing(false);
                setPullOffset(0);
            }
        } else {
            setPullOffset(0);
        }
        setStartY(0);
    };

    // Auto-focus al inicio y tras el bloqueo
    useEffect(() => {
        if (lockoutTime === 0) {
            inputRef.current?.focus();
            setAttempts(0);
            setStatus('idle');
        }
    }, [lockoutTime]);

    // Lógica de Reacción a Errores
    useEffect(() => {
        if (loginErrorCount > 0) {
            setStatus('error');
            setIsShaking(true);

            setAttempts(prev => {
                const next = prev + 1;
                // Al llegar al 3er intento fallido real, bloqueamos
                if (next >= 3) {
                    setLockoutTime(60);
                }
                return next;
            });

            const timer = setTimeout(() => {
                setIsShaking(false);
                if (lockoutTime === 0) {
                    setPin('');
                    setStatus('idle');
                    inputRef.current?.focus();
                }
            }, 800);

            return () => clearTimeout(timer);
        }
    }, [loginErrorCount]);

    // Cronómetro de Bloqueo
    useEffect(() => {
        let interval: any;
        if (lockoutTime > 0) {
            interval = setInterval(() => {
                setLockoutTime(prev => (prev <= 1 ? 0 : prev - 1));
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [lockoutTime]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (status === 'verifying' || lockoutTime > 0) return;

        const val = e.target.value.replace(/\D/g, '').slice(0, 6);
        setPin(val);

        if (val.length === 6) {
            setStatus('verifying');
            // Delay para feedback visual
            setTimeout(() => onLogin(val), 200);
        }
    };

    const isLocked = lockoutTime > 0;

    // Helper to render the company name with two colors (split by words or just the last part)
    const renderCompanyName = () => {
        const name = companySettings.name || 'SISTEMA POS';
        const words = name.split(' ');
        if (words.length > 1) {
            const lastWord = words.pop();
            const rest = words.join(' ');
            return (
                <>
                    {rest} <span className="text-red-600">{lastWord}</span>
                </>
            );
        }

        // If single word, split at halfway point
        const mid = Math.ceil(name.length / 2);
        return (
            <>
                {name.slice(0, mid)}<span className="text-red-600">{name.slice(mid)}</span>
            </>
        );
    };

    return (
        <div
            className="min-h-screen flex items-center justify-center bg-gray-950 p-4 font-sans overflow-y-auto cursor-text relative"
            onClick={() => inputRef.current?.focus()}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {/* Indicador de Pull-to-refresh */}
            <div
                className="absolute top-0 left-0 right-0 flex justify-center pointer-events-none transition-transform"
                style={{ transform: `translateY(${pullOffset - 40}px)`, opacity: pullOffset / PULL_THRESHOLD }}
            >
                <div className={`bg-red-600 p-2 rounded-full shadow-lg ${isRefreshing ? 'animate-spin' : ''}`}>
                    <svg viewBox="0 0 24 24" className="w-5 h-5 text-gray-900" fill="none" stroke="currentColor" strokeWidth="3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                    </svg>
                </div>
            </div>

            <input
                ref={inputRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={pin}
                onChange={handleInputChange}
                className="absolute opacity-0 pointer-events-none"
                disabled={isLocked || status === 'verifying' || !!successName}
            />

            {/* Overlay de Bienvenida */}
            {successName && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-gray-950 animate-in fade-in duration-500">
                    <div className="flex flex-col items-center space-y-4 animate-in zoom-in slide-in-from-bottom-8 duration-700">
                        <div className="w-32 h-32 bg-red-600/10 rounded-full flex items-center justify-center border border-red-600/30 shadow-[0_0_50px_rgba(220,38,38,0.2)]">
                            <span className="text-6xl animate-pulse">👋</span>
                        </div>
                        <div className="text-center">
                            <h2 className="text-gray-400 text-xs font-black uppercase tracking-[0.5em] italic mb-1 opacity-70">Bienvenido de nuevo</h2>
                            <h1 className="text-4xl font-black italic uppercase tracking-tighter drop-shadow-2xl text-center px-4 name-shimmer-pro">
                                {successName}
                            </h1>
                        </div>
                        <div className="flex gap-1.5 pt-4">
                            <div className="w-1.5 h-1.5 bg-red-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                            <div className="w-1.5 h-1.5 bg-red-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                            <div className="w-1.5 h-1.5 bg-red-600 rounded-full animate-bounce"></div>
                        </div>
                    </div>
                </div>
            )}

            {/* Card Principal Compacta */}
            <div
                className={`w-full max-w-[300px] bg-gray-900 rounded-[32px] p-5 pb-7 shadow-2xl border border-gray-800/50 flex flex-col items-center space-y-5 transition-all duration-500 ${isShaking ? 'animate-shake' : ''}`}
                style={{ transform: pullOffset > 0 ? `translateY(${pullOffset * 0.2}px)` : undefined }}
            >

                {/* Branding Dinámico Circular */}
                <div className="flex flex-col items-center space-y-3 pt-1">
                    {/* Contenedor con Efecto de Luz Giratoria Circular */}
                    <div className="relative group p-[1.5px] rounded-full overflow-hidden transition-all duration-500 shadow-[0_20px_50px_rgba(0,0,0,0.5),0_0_30_rgba(245,158,11,0.1)]">
                        {/* El "Spinning Light" - Gradiente Cónico Giratorio */}
                        <div className="absolute inset-[-100%] bg-[conic-gradient(from_0deg,transparent_20%,#dc2626_50%,transparent_80%)] animate-[spin_4s_linear_infinite] opacity-40 group-hover:opacity-100 group-hover:animate-[spin_2s_linear_infinite] transition-all duration-500 rounded-full"></div>

                        {/* Contenido Real del Logo - Circular */}
                        <div className="relative w-40 h-40 flex items-center justify-center bg-gray-900/90 backdrop-blur-xl rounded-full p-2 border border-white/5 overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-br from-red-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                            {companySettings.logoUrl ? (
                                <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center bg-black/20">
                                    <img src={companySettings.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                                </div>
                            ) : (
                                <svg viewBox="0 0 24 24" className={`w-24 h-24 transition-all duration-300 ${status === 'error' ? 'text-red-500' : 'text-red-600'}`} fill="none" stroke="currentColor" strokeWidth="2">
                                    {status === 'error' ? (
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                                    ) : (
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6.119c-.035.505-.053 1.015-.053 1.528 0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-.513-.017-1.023-.053-1.527a11.959 11.959 0 01-8.402-3.37z" />
                                    )}
                                </svg>
                            )}
                        </div>
                    </div>
                    <div className="text-center">
                        <h1 className="text-2xl font-black text-white italic uppercase tracking-tighter leading-none">
                            {renderCompanyName()}
                        </h1>
                        <p className="text-[9px] text-gray-400 font-bold uppercase tracking-[0.4em] mt-2 opacity-80">Acceso Seguro</p>
                    </div>
                </div>

                {/* PIN Display Compacto */}
                <div
                    onClick={() => inputRef.current?.focus()}
                    className={`w-full bg-gray-950 rounded-[24px] border py-8 flex justify-center gap-3.5 shadow-inner transition-colors duration-300 cursor-text ${status === 'error' ? 'border-red-500/30 bg-red-500/5' : 'border-gray-800'}`}
                >
                    {[...Array(6)].map((_, i) => (
                        <div
                            key={i}
                            className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${pin.length > i
                                ? 'bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.5)] scale-110'
                                : status === 'error' ? 'bg-red-900/40' : 'bg-gray-700'
                                }`}
                        />
                    ))}
                </div>

                {/* Zona de Feedback Inteligente */}
                <div className="w-full flex flex-col items-center justify-center min-h-[60px]">
                    {isLocked ? (
                        <div className="flex flex-col items-center space-y-1.5 animate-in fade-in zoom-in duration-300">
                            <div className="flex items-center gap-2 px-3 py-1 bg-red-500/10 rounded-full border border-red-500/20">
                                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
                                <span className="text-red-500 font-mono text-[10px] font-bold">REINTENTO EN {lockoutTime}S</span>
                            </div>
                            <p className="text-red-400 text-[8px] font-black uppercase tracking-widest italic">Sistema Protegido</p>
                        </div>
                    ) : status === 'error' ? (
                        <div className="flex flex-col items-center space-y-1 animate-in slide-in-from-top-1">
                            <p className="text-red-500 text-[10px] font-black uppercase tracking-widest italic">
                                PIN INCORRECTO ({attempts}/3)
                            </p>
                            <div className="flex gap-0.5">
                                {[...Array(3)].map((_, i) => (
                                    <div key={i} className={`h-1 w-4 rounded-full ${i < attempts ? 'bg-red-500' : 'bg-gray-800'}`}></div>
                                ))}
                            </div>
                        </div>
                    ) : status === 'verifying' ? (
                        <div className="flex flex-col items-center space-y-2">
                            <div className="flex gap-1">
                                <div className="w-1 h-1 bg-red-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                <div className="w-1 h-1 bg-red-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                <div className="w-1 h-1 bg-red-600 rounded-full animate-bounce"></div>
                            </div>
                            <p className="text-gray-400 text-[8px] font-black uppercase tracking-[0.2em]">Verificando...</p>
                        </div>
                    ) : (
                        <p className="text-gray-400 text-[9px] font-bold uppercase tracking-[0.2em] italic opacity-80 animate-pulse">
                            Digita tu clave
                        </p>
                    )}
                </div>

                {/* Footer Ultra-Mini */}
                <div className="pt-4 border-t border-gray-800/40 w-full text-center">
                    <p className="text-[8px] text-gray-500 font-bold uppercase tracking-[0.1em]">
                        FunkyFood &reg;2026 - V.1
                    </p>
                </div>
            </div>

            <style>{`
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    20%, 60% { transform: translateX(-6px); }
                    40%, 80% { transform: translateX(6px); }
                }
                .animate-shake {
                    animation: shake 0.35s cubic-bezier(.36,.07,.19,.97) both;
                }
                @keyframes shimmer-sweep {
                    0% { background-position: -200% 0; }
                    100% { background-position: 200% 0; }
                }
                .name-shimmer-pro {
                    background: linear-gradient(110deg, #fff 35%, #dc2626 50%, #fff 65%);
                    background-size: 200% 100%;
                    -webkit-background-clip: text;
                    background-clip: text;
                    -webkit-text-fill-color: transparent;
                    color: transparent;
                    animation: shimmer-sweep 2s linear infinite;
                    display: inline-block;
                }
            `}</style>
        </div >
    );
};

export default LoginScreen;
