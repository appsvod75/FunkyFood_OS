import React, { ReactNode } from 'react';

interface DeliveryLayoutProps {
    children: ReactNode;
    onLogout?: () => void;
}

const DeliveryLayout: React.FC<DeliveryLayoutProps> = ({ children, onLogout }) => {
    return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col font-sans">
            {/* Minimal Mobile Header */}
            <div className="bg-slate-800 p-4 border-b border-slate-700 flex justify-between items-center sticky top-0 z-10 shadow-lg">
                <div className="flex items-center space-x-2">
                    <span className="text-2xl">🏍️</span>
                    <h1 className="font-bold text-lg tracking-wide text-orange-500">Delivery<span className="text-white">OS</span></h1>
                </div>
                <div>
                    <button onClick={onLogout} className="text-xs font-bold text-red-500 uppercase border border-red-500 px-3 py-1 rounded-full hover:bg-red-500 hover:text-white transition-colors">
                        SALIR
                    </button>
                </div>
            </div>

            <main className="flex-1 p-2 overflow-y-auto">
                {children}
            </main>
        </div>
    );
};

export default DeliveryLayout;
