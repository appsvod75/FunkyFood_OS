import React, { useState, useEffect } from 'react';
import { AdminIcon, LogoutIcon, ReceiptIcon, KdsIcon, UploadIcon, TableIcon, ArrowsExpandIcon } from './icons';
import { UserRole, CompanySettings, Branch } from '../types';
import { useHorizontalDragScroll } from '../hooks/useHorizontalDragScroll';

interface HeaderProps {
    currentView: string;
    onNavigate: (view: 'start' | 'admin' | 'kds' | 'tables') => void;
    onLogout: () => void;
    allUserRoles: UserRole[];
    branchName?: string;
    onInstallApp?: () => void;
    companySettings: CompanySettings;
    // New props for branch management
    branches?: Branch[];
    currentBranchId?: number | null;
    onBranchChange?: (id: number) => void;
}

const Header: React.FC<HeaderProps> = ({ 
    currentView, 
    onNavigate, 
    onLogout, 
    allUserRoles, 
    branchName, 
    onInstallApp, 
    companySettings,
    branches = [],
    currentBranchId,
    onBranchChange
}) => {
    const [isFullscreen, setIsFullscreen] = useState(false);
    const dragScroll = useHorizontalDragScroll();

    useEffect(() => {
        const handleFSChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handleFSChange);
        return () => document.removeEventListener('fullscreenchange', handleFSChange);
    }, []);

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.error(`Error: ${err.message}`);
            });
        } else {
            if (document.exitFullscreen) document.exitFullscreen();
        }
    };

    if (currentView === 'select_branch') return null;

    const isPosView = ['start', 'order', 'completed', 'active_orders_mobile', 'manage_customers', 'tables'].includes(currentView);
    const isAdminView = currentView === 'admin' || currentView === 'master_settings';
    const isTablesView = currentView === 'tables';
    const isKdsView = currentView === 'kds';

    const isSuperAdmin = allUserRoles.includes(UserRole.SuperAdmin);
    const hasAdminRole = allUserRoles.includes(UserRole.Admin) || isSuperAdmin;

    return (
        <header className="bg-gray-900/95 backdrop-blur-md text-white border-b border-gray-800 shadow-2xl fixed top-0 left-0 right-0 z-40 h-14 sm:h-16 flex items-center safe-top">
            <div className="w-full px-4 flex justify-between items-center overflow-hidden">
                <div className="flex flex-col flex-shrink-0 mr-4">
                    <h1 className="text-base sm:text-lg font-black text-amber-500 tracking-tighter uppercase italic leading-none">
                        {companySettings.name.toUpperCase() || 'SISTEMA POS'}
                    </h1>
                    
                    {isSuperAdmin && branches.length > 0 ? (
                        <select 
                            value={currentBranchId || ''} 
                            onChange={(e) => onBranchChange?.(Number(e.target.value))}
                            className="bg-transparent text-[10px] text-gray-400 font-black uppercase outline-none cursor-pointer hover:text-amber-500 transition-colors border-none p-0 h-auto w-full max-w-[120px]"
                        >
                            {branches.map(b => (
                                <option key={b.id} value={b.id} className="bg-gray-900 text-white">
                                    {b.name}
                                </option>
                            ))}
                        </select>
                    ) : (
                        branchName && <span className="text-[10px] text-gray-500 font-black uppercase truncate max-w-[100px]">{branchName}</span>
                    )}
                </div>

                <div 
                    ref={dragScroll.ref}
                    onMouseDown={dragScroll.onMouseDown}
                    onMouseMove={dragScroll.onMouseMove}
                    onMouseUp={dragScroll.onMouseUp}
                    onMouseLeave={dragScroll.onMouseLeave}
                    onTouchStart={dragScroll.onTouchStart}
                    onTouchMove={dragScroll.onTouchMove}
                    onTouchEnd={dragScroll.onTouchEnd}
                    className="flex-1 overflow-x-auto scrollbar-hide select-none active:cursor-grabbing"
                >
                    <nav className="flex items-center gap-2 min-w-max pr-2">
                        {onInstallApp && (
                            <button
                                onClick={onInstallApp}
                                className="p-2 bg-amber-500/10 text-amber-500 rounded-xl border border-amber-500/20 animate-pulse flex-shrink-0"
                                title="Instalar App"
                            >
                                <UploadIcon className="w-5 h-5" />
                            </button>
                        )}

                        {(isPosView || hasAdminRole) && (
                            <div className="flex items-center gap-1.5 bg-gray-800/50 p-1 rounded-xl border border-white/5 flex-shrink-0">
                                <button
                                    onClick={() => onNavigate('start')}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all flex-shrink-0 ${isPosView && !isTablesView ? 'bg-amber-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'
                                        }`}
                                >
                                    <ReceiptIcon className="w-4 h-4" />
                                    <span className="text-[9px] font-black uppercase tracking-tight leading-none">ORDENES</span>
                                </button>
                                <button
                                    onClick={() => onNavigate('tables')}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all flex-shrink-0 ${isTablesView ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'
                                        }`}
                                >
                                    <TableIcon className="w-4 h-4" />
                                    <span className="text-[9px] font-black uppercase tracking-tight leading-none">MONITOR</span>
                                </button>
                            </div>
                        )}

                        {(isKdsView || hasAdminRole) && (
                            <button
                                onClick={() => onNavigate('kds')}
                                className={`p-2 rounded-xl transition-all flex-shrink-0 ${isKdsView ? 'bg-indigo-600 text-white shadow-lg' : 'bg-gray-800 text-gray-400'
                                    }`}
                            >
                                <KdsIcon className="w-5 h-5" />
                            </button>
                        )}

                        {hasAdminRole && (
                            <button
                                onClick={() => onNavigate('admin')}
                                className={`p-2 rounded-xl transition-all flex-shrink-0 ${isAdminView ? 'bg-purple-600 text-white shadow-lg' : 'bg-gray-800 text-gray-400'
                                    }`}
                            >
                                <AdminIcon className="w-5 h-5" />
                            </button>
                        )}

                        {hasAdminRole && (
                            <button
                                onClick={onLogout}
                                className="p-2 rounded-xl bg-red-600/10 text-red-500 border border-red-500/20 active:bg-red-600 active:text-white transition-all flex-shrink-0"
                                title="Cerrar Sesión"
                            >
                                <LogoutIcon className="w-5 h-5" />
                            </button>
                        )}

                        <div className="w-px h-6 bg-gray-800 mx-1 flex-shrink-0"></div>

                        {isKdsView && !window.matchMedia('(display-mode: standalone)').matches && (
                            <button
                                onClick={toggleFullscreen}
                                className={`p-2 rounded-xl transition-all flex-shrink-0 ${isFullscreen ? 'bg-amber-600 text-white shadow-lg' : 'bg-gray-800 text-gray-400'}`}
                                title="Pantalla Completa"
                            >
                                <ArrowsExpandIcon className="w-5 h-5" />
                            </button>
                        )}

                        {!hasAdminRole && (
                            <button
                                onClick={onLogout}
                                className="p-2 rounded-xl bg-red-600/10 text-red-500 border border-red-500/20 active:bg-red-600 active:text-white transition-all flex-shrink-0"
                                title="Cerrar Sesión"
                            >
                                <LogoutIcon className="w-5 h-5" />
                            </button>
                        )}
                    </nav>
                </div>
            </div>
        </header>
    );
};

export default Header;
