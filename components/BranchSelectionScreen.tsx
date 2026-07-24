import React, { useState } from 'react';
import { Branch } from '../types';
import { StoreIcon } from './icons';

interface BranchSelectionScreenProps {
    branches: Branch[];
    onSelectBranch: (branchId: number) => void;
    onLogout: () => void;
}

const BranchSelectionScreen: React.FC<BranchSelectionScreenProps> = ({ branches, onSelectBranch, onLogout }) => {
    const [selectedId, setSelectedId] = useState<number | null>(null);

    const handleSelect = (id: number) => {
        setSelectedId(id);
        // Pequeño delay para que se vea la animación antes de que la app principal tome el control
        setTimeout(() => {
            onSelectBranch(id);
        }, 800);
    };

    return (
        <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6 sm:p-12 relative overflow-hidden">
            {/* Background Decor */}
            <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                <div className={`absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-amber-500 rounded-full blur-[120px] transition-all duration-1000 ${selectedId ? 'scale-150 opacity-20' : ''}`}></div>
                <div className={`absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600 rounded-full blur-[120px] transition-all duration-1000 ${selectedId ? 'scale-150 opacity-20' : ''}`}></div>
            </div>

            <div className="relative z-10 w-full max-w-3xl flex flex-col items-center">
                <div className={`mb-10 text-center transition-all duration-500 ${selectedId ? 'opacity-0 -translate-y-4' : 'opacity-100'}`}>
                    <h1 className="text-2xl sm:text-4xl font-black text-white italic uppercase tracking-tighter mb-2">
                        SELECCIONAR <span className="text-amber-500">SUCURSAL</span>
                    </h1>
                    <p className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-widest italic">
                        Elige tu zona de operación para hoy
                    </p>
                </div>
                
                <div className="relative w-full flex flex-col items-center gap-4">
                    {branches.filter(b => b.isActive).map(branch => {
                        const isSelected = selectedId === branch.id;
                        const isSomethingSelected = selectedId !== null;

                        return (
                            <button
                                key={branch.id}
                                onClick={() => !isSomethingSelected && handleSelect(branch.id)}
                                className={`
                                    w-full max-w-lg bg-gray-900/60 backdrop-blur-md border rounded-2xl p-5 flex items-center gap-5 transition-all duration-500 shadow-xl
                                    ${isSelected ? 'border-amber-500 scale-105 bg-gray-800/90 z-20' : 'border-gray-800'}
                                    ${isSomethingSelected && !isSelected ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100'}
                                    ${!isSomethingSelected ? 'hover:bg-gray-800/80 hover:border-amber-500/50 active:scale-95 group' : ''}
                                `}
                            >
                                <div className={`p-3 rounded-xl transition-all duration-500 border ${isSelected ? 'bg-amber-600 border-amber-400' : 'bg-gray-800 border-gray-700 group-hover:border-amber-500/30'}`}>
                                    {isSelected ? (
                                        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    ) : (
                                        <StoreIcon className="w-6 h-6 text-amber-500" />
                                    )}
                                </div>
                                <div className="text-left overflow-hidden flex-1">
                                    <h3 className="text-sm sm:text-base font-black text-white uppercase italic tracking-tight truncate">
                                        {branch.name}
                                    </h3>
                                    <p className={`text-[9px] uppercase font-bold truncate tracking-tighter transition-colors ${isSelected ? 'text-amber-200' : 'text-gray-500'}`}>
                                        {isSelected ? 'Sincronizando datos de la sede...' : (branch.address || 'Ubicación activa')}
                                    </p>
                                </div>
                            </button>
                        );
                    })}
                </div>

                <div className={`mt-12 transition-all duration-500 ${selectedId ? 'opacity-0' : 'opacity-100'}`}>
                    <button 
                        onClick={onLogout}
                        className="text-[10px] font-black text-gray-600 hover:text-white uppercase tracking-[0.2em] transition-colors border-b border-transparent hover:border-gray-500 pb-1 italic"
                    >
                        CAMBIAR USUARIO
                    </button>
                </div>

                {selectedId && (
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mt-32 text-center animate-pulse">
                        <span className="text-[10px] font-black text-amber-500 uppercase tracking-[0.3em] italic">
                            Preparando entorno de trabajo...
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BranchSelectionScreen;
