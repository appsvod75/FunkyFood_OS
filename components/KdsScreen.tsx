import React, { useState, useEffect, useMemo } from 'react';
import { Order, KitchenStatus, OrderType, Waiter, UserRole } from '../types';
import KdsHistoryModal from './KdsHistoryModal';
import ChefStatsModal from './ChefStatsModal';
import { ClipboardListIcon, ChartBarIcon } from './icons';

interface KdsScreenProps {
    activeOrders: Order[];
    completedOrders: Order[];
    updateOrderKitchenStatus: (orderId: string, status: KitchenStatus, chef?: string) => void;
    toggleOrderItemCompletion: (orderId: string, itemId: string) => void;
    waiters: Waiter[];
}

const KdsScreen: React.FC<KdsScreenProps> = ({ activeOrders, completedOrders, updateOrderKitchenStatus, toggleOrderItemCompletion, waiters }) => {
    const [currentTime, setCurrentTime] = useState(new Date());
    // Initialize from localStorage if available
    const [selectedChef, setSelectedChef] = useState<string | null>(() => {
        return localStorage.getItem('kds_selected_chef');
    });

    const scrollContainerRef = React.useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startY, setStartY] = useState(0);
    const [scrollTop, setScrollTop] = useState(0);

    const [showHistory, setShowHistory] = useState(false);
    const [showStats, setShowStats] = useState(false);
    const [wakeLock, setWakeLock] = useState<any>(null);

    // Screen Wake Lock & Orientation Implementation
    useEffect(() => {
        let lock: any = null;
        const requestWakeLock = async () => {
            try {
                if ('wakeLock' in navigator) {
                    lock = await (navigator as any).wakeLock.request('screen');
                    setWakeLock(lock);
                    console.log('Wake Lock is active');
                }
            } catch (err) {
                console.error('Wake Lock error:', err);
            }
        };

        // Attempt to lock orientation to landscape for KDS
        const lockOrientation = async () => {
            try {
                // screen.orientation.lock is only available on some mobile browsers and PWAs
                if (window.screen && window.screen.orientation && (window.screen.orientation as any).lock) {
                    await (window.screen.orientation as any).lock('landscape');
                    console.log('Orientation locked to landscape');
                }
            } catch (err) {
                // Fail silently as this is a progressive enhancement 
                // and may fail if not in standalone mode or on desktop
                console.warn('Could not lock orientation:', err);
            }
        };

        requestWakeLock();
        lockOrientation();

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                if (!wakeLock) requestWakeLock();
                lockOrientation();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            if (lock) lock.release();
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            // Attempt to unlock orientation when leaving KDS
            try {
                if (window.screen && window.screen.orientation && window.screen.orientation.unlock) {
                    window.screen.orientation.unlock();
                }
            } catch (e) {
                console.warn('Error unlocking orientation:', e);
            }
        };
    }, []);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Persist selected chef to localStorage
    useEffect(() => {
        if (selectedChef) {
            localStorage.setItem('kds_selected_chef', selectedChef);
        } else {
            localStorage.removeItem('kds_selected_chef');
        }
    }, [selectedChef]);

    const kdsOrders = useMemo(() => {
        return activeOrders
            .filter(o => (o.kitchenStatus || 'pending') !== 'served')
            .sort((a, b) => {
                const statusA = a.kitchenStatus || 'pending';
                const statusB = b.kitchenStatus || 'pending';

                // Priority: In Process > Pending > Ready
                const priorityMap: Record<string, number> = {
                    'in_process': 0,
                    'pending': 1,
                    'ready': 2
                };

                if (priorityMap[statusA] !== priorityMap[statusB]) {
                    return priorityMap[statusA] - priorityMap[statusB];
                }

                // Secondary sort: Daily Order Number (Ascending) 
                // Fallback to createdAt if number missing
                const numA = a.dailyOrderNumber || 999999;
                const numB = b.dailyOrderNumber || 999999;

                if (numA !== numB) return numA - numB;

                return a.createdAt.getTime() - b.createdAt.getTime();
            });
    }, [activeOrders]);

    const pendingCount = kdsOrders.filter(o => (o.kitchenStatus || 'pending') === 'pending').length;
    const inProcessCount = kdsOrders.filter(o => o.kitchenStatus === 'in_process').length;
    const totalQueue = pendingCount + inProcessCount;

    // Calculate Average Preparation Time for today's orders (using readyAt)
    const avgPrepTime = useMemo(() => {
        const today = new Date();
        const isToday = (date: Date) =>
            date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear();

        // Combine active and completed orders to get full picture of kitchen performance
        const allOrders = [...activeOrders, ...completedOrders];

        // Filter for orders that have been marked ready by kitchen TODAY
        const ordersWithPrepTime = allOrders.filter(o => o.readyAt && isToday(o.readyAt));

        if (ordersWithPrepTime.length === 0) return 0; // Return 0 to indicate no data yet

        const totalTimeMs = ordersWithPrepTime.reduce((acc, o) => {
            return acc + (o.readyAt!.getTime() - o.createdAt.getTime());
        }, 0);

        const avgMs = totalTimeMs / ordersWithPrepTime.length;
        return Math.round(avgMs / 60000); // Convert to minutes
    }, [activeOrders, completedOrders, currentTime]);

    // Calculate Estimated Wait Time
    const estimatedWaitTime = useMemo(() => {
        if (totalQueue === 0) return 0;
        // Use 15 mins as fallback if no average yet
        const baseTime = avgPrepTime > 0 ? avgPrepTime : 15;
        return baseTime * totalQueue;
    }, [avgPrepTime, totalQueue]);


    const historyOrders = useMemo(() => {
        // Show orders that are 'served' (even if unpaid) OR 'completed' (paid)
        const servedActive = activeOrders.filter(o => o.kitchenStatus === 'served');
        return [...servedActive, ...completedOrders];
    }, [activeOrders, completedOrders]);


    const staffList = useMemo(() => {
        return waiters.filter(w => {
            // Check for isActive (boolean) or is_active (number 0/1)
            const isActive = w.isActive !== undefined ? w.isActive : (w as any).is_active === 1;
            // Ensure roles is an array, default to empty array if not
            const roles = Array.isArray(w.roles) ? w.roles : [];
            return isActive && roles.includes(UserRole.Cook);
        });
    }, [waiters]);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!scrollContainerRef.current) return;
        setIsDragging(true);
        setStartY(e.pageY - scrollContainerRef.current.offsetTop);
        setScrollTop(scrollContainerRef.current.scrollTop);
    };

    const handleMouseLeave = () => setIsDragging(false);
    const handleMouseUp = () => setIsDragging(false);

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !scrollContainerRef.current) return;
        e.preventDefault();
        const y = e.pageY - scrollContainerRef.current.offsetTop;
        const walk = (y - startY) * 2;
        scrollContainerRef.current.scrollTop = scrollTop - walk;
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        if (!scrollContainerRef.current) return;
        setIsDragging(true);
        setStartY(e.touches[0].pageY - scrollContainerRef.current.offsetTop);
        setScrollTop(scrollContainerRef.current.scrollTop);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isDragging || !scrollContainerRef.current) return;
        const y = e.touches[0].pageY - scrollContainerRef.current.offsetTop;
        const walk = (y - startY) * 2;
        // Scroll the container manually for the "grab" feel
        scrollContainerRef.current.scrollTop = scrollTop - walk;
    };

    const handleTouchEnd = () => setIsDragging(false);

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] bg-gray-900 text-white overflow-hidden">
            {/* KDS Header & Controls */}
            <header className="bg-gray-800 shadow-md border-b border-gray-700 z-10 flex-shrink-0">
                <div className="p-3 flex flex-wrap gap-4 justify-between items-center">
                    <div className="flex items-center gap-4 overflow-hidden">
                        <h1 className="text-2xl font-black italic uppercase tracking-tighter leading-none hidden md:block">
                            CONTROL <span className="text-amber-500">KDS</span>
                        </h1>
                        {/* Chef Selection Toolbar */}
                        <div className="flex bg-gray-900 rounded-lg p-1 gap-1 overflow-x-auto max-w-full scrollbar-hide">
                            {staffList.length > 0 ? (
                                staffList.map(staff => (
                                    <button
                                        key={staff.id}
                                        onClick={() => setSelectedChef(staff.name === selectedChef ? null : staff.name)}
                                        className={`px-3 sm:px-4 py-2 rounded-md text-sm font-bold whitespace-nowrap transition-all ${selectedChef === staff.name
                                            ? 'bg-blue-600 text-white shadow-lg ring-2 ring-blue-400'
                                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                            }`}
                                    >
                                        {staff.name}
                                    </button>
                                ))
                            ) : (
                                <div className="px-4 py-2 text-sm text-gray-500 italic">No hay cocineros registrados</div>
                            )}
                        </div>
                        {!selectedChef && staffList.length > 0 && (
                            <span className="text-amber-500 text-xs md:text-sm animate-pulse font-semibold whitespace-nowrap">
                                &larr; ¿Quién eres?
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-4 flex-shrink-0">
                        <div className="flex gap-4 text-sm font-mono bg-gray-900/50 p-1.5 rounded-lg border border-gray-700">
                            <div className="flex flex-col items-center px-2 border-r border-gray-700">
                                <span className="text-xs text-purple-400 font-semibold uppercase">T. Prom</span>
                                <span className="text-purple-200 font-bold">{avgPrepTime > 0 ? `${avgPrepTime}m` : '--'}</span>
                            </div>
                            <div className="flex flex-col items-center px-2">
                                <span className="text-xs text-pink-400 font-semibold uppercase">Estimado</span>
                                <span className="text-pink-200 font-bold">{estimatedWaitTime > 0 ? `${estimatedWaitTime}m` : '--'}</span>
                            </div>
                        </div>

                        <div className="flex gap-4 text-sm font-mono">
                            <span className="text-gray-400">Pend: <b className="text-white">{pendingCount}</b></span>
                            <span className="text-gray-400">Proc: <b className="text-blue-400">{inProcessCount}</b></span>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowHistory(true)}
                                className="p-2 bg-gray-900/50 hover:bg-gray-700 rounded-lg border border-gray-700 text-gray-400 hover:text-white transition-colors flex items-center gap-2"
                                title="Historial"
                            >
                                <ClipboardListIcon className="w-5 h-5" />
                                <span className="hidden lg:block text-[10px] font-bold uppercase tracking-widest">Historial</span>
                            </button>
                            <button
                                onClick={() => setShowStats(true)}
                                className="p-2 bg-gray-900/50 hover:bg-gray-700 rounded-lg border border-gray-700 text-gray-400 hover:text-white transition-colors flex items-center gap-2"
                                title="Estadísticas"
                            >
                                <ChartBarIcon className="w-5 h-5" />
                                <span className="hidden lg:block text-[10px] font-bold uppercase tracking-widest">Estadísticas</span>
                            </button>
                        </div>

                        <div className="text-xl sm:text-2xl font-mono font-bold text-gray-300 hidden sm:block">
                            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                    </div>
                </div>
            </header>

            {/* KDS Grid - Changed from Grid to Columns for Masonry effect */}
            <div
                ref={scrollContainerRef}
                onMouseDown={handleMouseDown}
                onMouseLeave={handleMouseLeave}
                onMouseUp={handleMouseUp}
                onMouseMove={handleMouseMove}
                className={`flex-1 overflow-y-auto p-3 md:p-4 bg-gray-900 select-none touch-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                {kdsOrders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500 opacity-50">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-2xl font-semibold">Todo limpio, Chef.</p>
                        <div className="mt-4 text-sm text-gray-600">
                            Promedio de hoy: {avgPrepTime > 0 ? `${avgPrepTime} min` : 'Sin datos'}
                        </div>
                    </div>
                ) : (
                    /* Masonry Layout: CSS Columns - Reduced columns to make cards ~25% wider */
                    <div className="columns-1 sm:columns-1 md:columns-2 lg:columns-4 xl:columns-5 screen-2xl:columns-6 gap-4">
                        {kdsOrders.map(order => (
                            <KdsTicket
                                key={order.id}
                                order={order}
                                currentTime={currentTime}
                                onUpdateStatus={updateOrderKitchenStatus}
                                currentChef={selectedChef}
                                onToggleItem={toggleOrderItemCompletion}
                            />
                        ))}
                    </div>
                )}
            </div>

            <KdsHistoryModal
                isOpen={showHistory}
                onClose={() => setShowHistory(false)}
                orders={historyOrders}
            />

            <ChefStatsModal
                isOpen={showStats}
                onClose={() => setShowStats(false)}
                branchId={activeOrders[0]?.branchId || 0}
            />
        </div>
    );
};

interface KdsTicketProps {
    order: Order;
    currentTime: Date;
    onUpdateStatus: (orderId: string, status: KitchenStatus, chef?: string) => void;
    currentChef: string | null;
    onToggleItem: (orderId: string, itemId: string) => void;
}

const KdsTicket: React.FC<KdsTicketProps> = ({ order, currentTime, onUpdateStatus, currentChef, onToggleItem }) => {
    // Calculate elapsed time
    const elapsedMs = currentTime.getTime() - order.createdAt.getTime();
    const elapsedMinutes = Math.floor(elapsedMs / 60000);
    const formattedTime = `${elapsedMinutes}m`;

    const status = order.kitchenStatus || 'pending';
    const isAssignedToMe = currentChef && order.chef === currentChef;
    const isAssignedToOther = order.chef && order.chef !== currentChef;

    // Styles based on status
    let containerClass = 'border-gray-600';
    let headerClass = 'bg-gray-800 text-gray-300';
    let timeClass = 'text-gray-400';

    if (status === 'ready') {
        containerClass = 'border-green-500 ring-4 ring-green-500/30';
        headerClass = 'bg-green-900/40 text-green-100';
        timeClass = 'text-green-300';
    } else if (status === 'in_process') {
        if (isAssignedToOther) {
            containerClass = 'border-gray-700 opacity-60 grayscale-[0.5]';
            headerClass = 'bg-gray-800 text-gray-500';
        } else {
            containerClass = 'border-blue-500 ring-2 ring-blue-500/50';
            headerClass = 'bg-blue-900/40 text-blue-100';
            timeClass = 'text-blue-300';
        }
    } else if (status === 'pending') {
        if (elapsedMinutes >= 10) {
            containerClass = 'border-red-600 animate-pulse ring-2 ring-red-600/20';
            headerClass = 'bg-red-900/20 text-white';
            timeClass = 'text-red-400';
        } else if (elapsedMinutes >= 5) {
            containerClass = 'border-yellow-500 ring-2 ring-yellow-500/20';
            headerClass = 'bg-yellow-900/10 text-white';
            timeClass = 'text-yellow-500';
        }
    }

    const handleMainAction = () => {
        if (status === 'pending') {
            if (!currentChef) {
                return; // Button disabled state handles UX
            }
            onUpdateStatus(order.id, 'in_process', currentChef);
        } else if (status === 'in_process') {
            onUpdateStatus(order.id, 'ready');
        } else if (status === 'ready') {
            onUpdateStatus(order.id, 'served');
        }
    };

    const getOrderTypeBadgeColor = (type: OrderType) => {
        switch (type) {
            case OrderType.Restaurant:
                return 'bg-blue-600 border-blue-400';
            case OrderType.Delivery:
                return 'bg-orange-600 border-orange-400';
            case OrderType.Pickup:
                return 'bg-purple-600 border-purple-400';
            case OrderType.Takeaway:
                return 'bg-pink-600 border-pink-400';
            default:
                return 'bg-gray-600 border-gray-400';
        }
    };

    const visibleItems = order.items.filter(item => item.product.showInKds !== false);
    const allVisibleItemsDone = visibleItems.length > 0 && visibleItems.every(item => item.completed);

    // Removed h-full and flex-1 to allow natural height growth
    return (
        <div className={`bg-gray-800 rounded-lg flex flex-col border-t-4 shadow-lg transition-all duration-300 ${containerClass} relative mb-4 break-inside-avoid w-full ${allVisibleItemsDone && status === 'in_process' ? 'ring-4 ring-amber-500/50' : ''}`}>

            {/* Locked Overlay for other chefs */}
            {status === 'in_process' && isAssignedToOther && (
                <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
                    <div className="bg-black/60 text-white px-3 py-1 rounded-full text-xs font-bold border border-white/20 transform -rotate-12 backdrop-blur-sm shadow-2xl">
                        COCINANDO: {order.chef}
                    </div>
                </div>
            )}

            {/* Header */}
            <div className={`p-3 border-b border-gray-700 flex justify-between items-start ${headerClass}`}>
                <div className="overflow-hidden flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-3 flex-wrap mb-1">
                        <span className="font-black text-2xl">#{String(order.dailyOrderNumber).padStart(3, '0')}</span>
                        <span className={`${getOrderTypeBadgeColor(order.type)} text-white text-xs sm:text-sm px-2 py-1 rounded border shadow-sm font-black uppercase tracking-widest whitespace-nowrap`}>
                            {order.type}
                        </span>
                    </div>
                    <div className="text-sm sm:text-base truncate font-black uppercase tracking-tight opacity-90">
                        {order.table ? order.table.name : order.customer?.name || 'Cliente'}
                    </div>
                    {status === 'in_process' && order.chef && (
                        <div className="text-xs font-black uppercase bg-blue-900/50 px-2 py-0.5 rounded w-fit mt-1 border border-blue-500/30 text-blue-200 tracking-tighter">
                            Chef: {order.chef}
                        </div>
                    )}
                </div>
                <div className={`font-mono text-2xl font-black leading-none flex-shrink-0 ${timeClass}`}>
                    {formattedTime}
                </div>
            </div>

            {/* Items List */}
            <div className="p-3 text-base space-y-3 relative">
                {order.items.map((item, idx) => {
                    // FIX: Solo permitir marcar items si la orden YA está tomada por mí (in_process)
                    // Antes permitía 'pending', lo que causaba bugs visuales o de estado.
                    const canInteract = status === 'in_process' && isAssignedToMe;

                    return (
                        <div
                            key={idx}
                            onClick={() => canInteract && onToggleItem(order.id, item.id)}
                            className={`
                                flex items-start gap-2 p-1 rounded transition-all select-none
                                ${canInteract ? 'cursor-pointer hover:bg-white/5 active:bg-white/10' : 'cursor-default opacity-90'}
                                ${item.completed ? 'opacity-40 grayscale' : ''}
                            `}
                        >
                            <div className={`
                                w-7 h-7 flex items-center justify-center rounded-lg text-sm font-black flex-shrink-0 mt-0.5
                                ${item.completed ? 'bg-green-600 text-white' : 'bg-gray-700 text-white'}
                            `}>
                                {item.completed ? '✓' : item.quantity}
                            </div>

                            <div className="leading-tight flex-1">
                                <span className={`font-black text-lg ${item.completed ? 'line-through' : 'text-gray-100'}`}>
                                    {item.product.name}
                                </span>
                                {item.product.isCombo && item.comboSelections && item.comboSelections.length > 0 && (
                                    <div className="pl-3 mt-1.5 space-y-1 border-l-4 border-purple-500/30">
                                        {item.comboSelections.map((s, sIdx) => (
                                            <div key={sIdx} className="text-xs font-black uppercase text-purple-300 leading-none py-1">
                                                • {s.quantity}x {s.productName}
                                                {s.meatName && <span className="text-amber-500 ml-1">[{s.meatName}]</span>}
                                                {s.masaName && <span className="text-fuchsia-400 ml-1">[{s.masaName}]</span>}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {item.meat && <span className="text-amber-500 font-black text-sm uppercase block mt-1.5">{item.meat.name}</span>}
                                {item.masa && <span className="text-fuchsia-400 font-black text-sm uppercase block mt-1.5">{item.masa.name}</span>}
                                {item.extras && item.extras.map(e => (
                                    <span key={e.id} className="text-green-400 text-sm font-black block mt-1">+ {e.name}</span>
                                ))}
                                {item.observations && (
                                    <div className="text-cyan-300 text-sm font-black italic bg-cyan-900/40 px-3 py-1.5 rounded-lg mt-2 inline-block border border-cyan-500/50 shadow-sm leading-tight">
                                        "{item.observations}"
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Actions */}
            <div className="p-2 bg-gray-800/50 border-t border-gray-700">
                {status === 'pending' && (
                    <button
                        onClick={handleMainAction}
                        disabled={!currentChef}
                        className={`w-full py-3 font-bold rounded text-sm transition-colors ${currentChef
                            ? 'bg-gray-700 hover:bg-blue-600 hover:text-white text-gray-300'
                            : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
                            }`}
                    >
                        {currentChef ? 'EMPEZAR' : 'SELECCIONA ROL'}
                    </button>
                )}
                {status === 'in_process' && (
                    isAssignedToMe ? (
                        <button
                            onClick={handleMainAction}
                            className={`w-full py-3 font-bold rounded text-sm shadow-lg transition-all transform active:scale-95 ${allVisibleItemsDone
                                ? 'bg-amber-500 hover:bg-amber-400 text-gray-900 animate-pulse ring-4 ring-amber-500/30'
                                : 'bg-green-600 hover:bg-green-500 text-white'
                                }`}
                        >
                            {allVisibleItemsDone ? '¡LISTO! TERMINAR' : 'TERMINAR'}
                        </button>
                    ) : (
                        <div className="w-full py-2 text-center text-xs text-gray-500 font-mono border border-gray-700 rounded border-dashed">
                            En preparación...
                        </div>
                    )
                )}
                {status === 'ready' && (
                    <button onClick={handleMainAction} className="w-full py-2 bg-gray-700 hover:bg-gray-600 text-green-400 font-bold rounded text-sm border border-green-900/50 transition-colors">
                        ENTREGAR
                    </button>
                )}
            </div>
        </div>
    );
};

export default KdsScreen;
