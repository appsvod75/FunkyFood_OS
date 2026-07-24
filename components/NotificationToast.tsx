
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { BellIcon, CheckCircleSolidIcon, InfoIcon, AlertTriangleIcon } from './icons';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface NotificationToastProps {
    title?: string;
    message: string | null;
    type?: ToastType;
    onClose: () => void;
    persistent?: boolean;
    position?: 'top' | 'bottom' | 'center';
    duration?: number;
}

const NotificationToast: React.FC<NotificationToastProps> = ({
    title,
    message,
    type = 'success',
    onClose,
    persistent = false,
    position = 'bottom',
    duration = 5000
}) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (message) {
            setIsVisible(true);

            if (persistent && navigator.vibrate) {
                const triggerVibration = () => {
                    navigator.vibrate([400, 200, 400]);
                };
                triggerVibration();
                const vibInterval = setInterval(triggerVibration, 4000);
                return () => {
                    clearInterval(vibInterval);
                    navigator.vibrate(0);
                };
            }

            if (!persistent) {
                const timer = setTimeout(() => {
                    setIsVisible(false);
                    setTimeout(onClose, 300);
                }, duration);
                return () => clearTimeout(timer);
            }
        } else {
            setIsVisible(false);
        }
    }, [message, onClose, persistent, duration]);

    const handleClose = () => {
        setIsVisible(false);
        setTimeout(onClose, 300);
    };

    if (!message && !isVisible) return null;

    const portalRoot = document.getElementById('portal-root') || document.body;

    const typeConfig = {
        success: {
            bg: 'bg-emerald-950/80',
            text: 'text-emerald-400',
            border: 'border-emerald-500/50',
            shadow: 'shadow-[0_0_20px_rgba(52,211,153,0.3)]',
            icon: <CheckCircleSolidIcon className="w-6 h-6 drop-shadow-[0_0_5px_rgba(52,211,153,0.8)]" />,
            glow: 'drop-shadow-[0_0_5px_rgba(52,211,153,0.5)]'
        },
        error: {
            bg: 'bg-rose-950/80',
            text: 'text-rose-400',
            border: 'border-rose-500/50',
            shadow: 'shadow-[0_0_20px_rgba(244,63,94,0.3)]',
            icon: <AlertTriangleIcon className="w-6 h-6 drop-shadow-[0_0_5px_rgba(244,63,94,0.8)]" />,
            glow: 'drop-shadow-[0_0_5px_rgba(244,63,94,0.5)]'
        },
        warning: {
            bg: 'bg-amber-950/80',
            text: 'text-amber-400',
            border: 'border-amber-500/50',
            shadow: 'shadow-[0_0_20px_rgba(245,158,11,0.3)]',
            icon: <AlertTriangleIcon className="w-6 h-6 drop-shadow-[0_0_5px_rgba(245,158,11,0.8)]" />,
            glow: 'drop-shadow-[0_0_5px_rgba(245,158,11,0.5)]'
        },
        info: {
            bg: 'bg-blue-950/80',
            text: 'text-blue-400',
            border: 'border-blue-500/50',
            shadow: 'shadow-[0_0_20px_rgba(59,130,246,0.3)]',
            icon: <InfoIcon className="w-6 h-6 drop-shadow-[0_0_5px_rgba(59,130,246,0.8)]" />,
            glow: 'drop-shadow-[0_0_5px_rgba(59,130,246,0.5)]'
        }
    };

    const config = typeConfig[type];

    const isCenter = position === 'center';

    const positionClasses = position === 'top'
        ? `top-20 ${isVisible ? 'translate-y-0' : '-translate-y-12'}`
        : position === 'bottom'
            ? `bottom-8 ${isVisible ? 'translate-y-0' : 'translate-y-12'}`
            : ''; // Center is handled by parent container

    const toastContent = (
        <div className={`w-[90%] max-w-md ${isCenter ? '' : 'fixed left-1/2 transform -translate-x-1/2'} z-[99999] transition-all duration-500 ease-out flex flex-col items-center pointer-events-none ${positionClasses} ${isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
            <div className={`w-full ${config.bg} backdrop-blur-xl ${config.text} ${config.border} border ${config.shadow} px-6 py-4 rounded-3xl flex items-center gap-4 pointer-events-auto`}>
                <div className="flex-shrink-0">
                    {config.icon}
                </div>
                <div className="flex-1 min-w-0">
                    {title && (
                        <p className={`text-[10px] font-black uppercase tracking-widest leading-none mb-1 opacity-70 ${config.glow}`}>
                            {title}
                        </p>
                    )}
                    <p className={`font-black tracking-tight uppercase italic text-base leading-tight break-words ${config.glow}`}>
                        {message}
                    </p>
                </div>
                {!persistent && (
                    <button
                        onClick={handleClose}
                        className="p-1.5 hover:bg-white/10 rounded-full transition-colors opacity-50 hover:opacity-100"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                )}
                {persistent && (
                    <button
                        onClick={handleClose}
                        className={`px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 border ${config.border}`}
                    >
                        OK
                    </button>
                )}
            </div>
        </div>
    );

    return createPortal(
        isCenter ? (
            <div className={`fixed inset-0 z-[99999] flex items-center justify-center bg-black/20 backdrop-blur-sm transition-opacity duration-500 ${isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                {toastContent}
            </div>
        ) : toastContent,
        portalRoot
    );
};

export default NotificationToast;
