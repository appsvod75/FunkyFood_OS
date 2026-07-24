import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { PlusIcon } from './icons';

export const ViewHeader: React.FC<{ title: string; onBack: () => void; onAdd?: () => void }> = ({ title, onBack, onAdd }) => (
    <div className="flex justify-between items-center gap-4 mb-6 shrink-0 px-1">
        <div className="flex items-center gap-3">
            <button onClick={onBack} className="bg-gray-800 p-2.5 rounded-full hover:bg-gray-700 active:scale-90 transition-all shadow-lg border border-gray-700/50">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <h1 className="text-2xl font-black text-white italic uppercase tracking-tighter leading-none" dangerouslySetInnerHTML={{ __html: title }}></h1>
        </div>
        {onAdd && (
            <button onClick={onAdd} className="flex items-center gap-2 bg-green-600 text-white font-black py-2.5 px-6 rounded-2xl active:scale-95 transition-all text-[11px] uppercase shadow-xl shadow-green-900/20 italic tracking-widest">
                <PlusIcon className="w-5 h-5" /> AGREGAR
            </button>
        )}
    </div>
);

export const AdminModal: React.FC<{ title: string; onClose: () => void; onSave?: () => void; saveLabel?: string; children: React.ReactNode }> = ({ title, onClose, onSave, saveLabel = "Confirmar", children }) => {
    const portal = document.getElementById('portal-root');
    const scrollRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startY, setStartY] = useState(0);
    const [scrollTop, setScrollTop] = useState(0);

    const onMouseDown = (e: React.MouseEvent) => {
        if (!scrollRef.current) return;
        setIsDragging(true);
        setStartY(e.pageY - scrollRef.current.offsetTop);
        setScrollTop(scrollRef.current.scrollTop);
    };

    const onMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !scrollRef.current) return;
        e.preventDefault();
        const y = e.pageY - scrollRef.current.offsetTop;
        const walk = (y - startY) * 2;
        scrollRef.current.scrollTop = scrollTop - walk;
    };

    const onMouseUp = () => setIsDragging(false);

    if (!portal) return null;
    return createPortal(
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-gray-900 rounded-[32px] p-6 w-full max-w-sm border border-gray-800 shadow-2xl animate-in zoom-in duration-300 overflow-hidden flex flex-col max-h-[85vh]">
                <h3 className="text-xl font-black text-white italic uppercase mb-6 tracking-tighter leading-none shrink-0" dangerouslySetInnerHTML={{ __html: title }}></h3>
                <div
                    ref={scrollRef}
                    onMouseDown={onMouseDown}
                    onMouseLeave={onMouseUp}
                    onMouseUp={onMouseUp}
                    onMouseMove={onMouseMove}
                    className={`space-y-4 flex-1 overflow-y-auto scrollbar-hide pr-1 pb-4 select-none ${isDragging ? 'cursor-grabbing' : 'cursor-default'}`}
                >
                    {children}
                </div>
                <div className="grid grid-cols-2 gap-3 mt-6 shrink-0">
                    <button onClick={onClose} className="p-3.5 bg-gray-800 text-gray-400 font-black rounded-2xl uppercase text-[10px] tracking-widest active:scale-95">Cerrar</button>
                    {onSave && <button onClick={onSave} className="p-3.5 bg-green-600 text-white font-black rounded-2xl uppercase text-[10px] shadow-lg active:scale-95 transition-transform tracking-widest italic">{saveLabel.toUpperCase()}</button>}
                </div>
            </div>
        </div>, portal
    );
};
