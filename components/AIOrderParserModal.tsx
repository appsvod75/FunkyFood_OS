
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { RobotIcon } from './icons';

interface AIOrderParserModalProps {
    onClose: () => void;
    onParse: (text: string) => Promise<void>;
}

const AIOrderParserModal: React.FC<AIOrderParserModalProps> = ({ onClose, onParse }) => {
    const [text, setText] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async () => {
        if (!text.trim()) return;
        setIsLoading(true);
        await onParse(text);
        setIsLoading(false);
    };

    return createPortal(
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[300] p-4">
            <div className="bg-gray-900 w-full max-w-lg rounded-[40px] p-8 border border-gray-800 shadow-2xl flex flex-col relative overflow-hidden">

                <div className="flex items-center gap-4 mb-6 relative z-10">
                    <div className="bg-gradient-to-br from-purple-600 to-indigo-600 p-3 rounded-2xl shadow-lg shadow-purple-900/50">
                        <RobotIcon className="w-8 h-8 text-white" />
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-white uppercase italic leading-none tracking-tighter">ASISTENTE <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400">VIRTUAL</span></h3>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Pegar pedido de WhatsApp / Texto</p>
                    </div>
                </div>

                <textarea
                    autoFocus
                    value={text}
                    onChange={e => setText(e.target.value)}
                    placeholder="Ej: 2 Tacos de Asada sin cebolla, 1 Coca Cola..."
                    className="w-full h-48 bg-gray-950 border-2 border-gray-800 rounded-[24px] p-6 text-white font-medium text-sm outline-none focus:border-purple-500 transition-colors resize-none placeholder:text-gray-700 mb-8 shadow-inner"
                />

                <div className="grid grid-cols-2 gap-4 relative z-10">
                    <button onClick={onClose} disabled={isLoading} className="p-4 bg-gray-800 text-gray-400 font-black rounded-2xl uppercase text-xs active:scale-95 tracking-widest hover:bg-gray-750 transition-colors">Cancelar</button>
                    <button
                        onClick={handleSubmit}
                        disabled={isLoading || !text.trim()}
                        className="p-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black rounded-2xl uppercase text-xs shadow-lg shadow-purple-900/40 active:scale-95 transition-all flex items-center justify-center gap-2 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed tracking-widest"
                    >
                        {isLoading ? <>
                            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>PROCESANDO...</span>
                        </> : <>
                            <span>✨ INTERPRETAR</span>
                        </>}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default AIOrderParserModal;
