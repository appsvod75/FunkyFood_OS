import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { toast } from 'react-hot-toast';

// Inline Icons
const Star: React.FC<{ className?: string, fill?: string }> = ({ className, fill }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill={fill || "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
);
const Send: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
);
const Smile: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" /></svg>
);
const Frown: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10" /><path d="M16 16s-1.5-2-4-2-4 2-4 2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" /></svg>
);

interface FeedbackScreenProps {
    companyName?: string;
}

export const FeedbackScreen: React.FC<FeedbackScreenProps> = ({ companyName }) => {
    const [rating, setRating] = useState<number>(0);
    const [comment, setComment] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [hoverRating, setHoverRating] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        console.log('Submit clicked', { rating, comment });
        if (rating === 0) return;

        setIsSubmitting(true);
        // Extract branchId from URL search params if present
        const params = new URLSearchParams(window.location.search);
        const branchId = params.get('branchId') || 1;

        try {
            await api.post('/feedback', {
                branchId,
                rating,
                comment
            });
            setSubmitted(true);
        } catch (error: any) {
            console.error('Failed to submit feedback', error);
            const msg = error.message || 'Error desconocido';
            toast.error(`Error: ${msg}`);
            setIsSubmitting(false);
        }
    };

    // ... render check ... 

    // Return (abbreviated, keeping context)
    // ...
    <button
        onClick={handleSubmit}
        disabled={rating === 0 || isSubmitting}
        className={`w-full mt-6 bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-bold py-4 rounded-xl transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${isSubmitting ? 'opacity-70 cursor-wait' : ''}`}
    >
        {isSubmitting ? (
            <span>Enviando...</span>
        ) : (
            <>
                <span>Enviar Calificación</span>
                <Send className="w-5 h-5" />
            </>
        )}
    </button>

    if (submitted) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 text-center">
                <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl max-w-md w-full border border-slate-700 animate-fade-in-up">
                    <div className="flex justify-center mb-6">
                        {rating >= 4 ? (
                            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center">
                                <Smile className="w-12 h-12 text-green-400" />
                            </div>
                        ) : (
                            <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center">
                                <Send className="w-12 h-12 text-blue-400" />
                            </div>
                        )}
                    </div>

                    <h2 className="text-3xl font-bold text-white mb-4">
                        {rating >= 4 ? '¡Gracias Totales!' : '¡Gracias por tu Opinión!'}
                    </h2>

                    <p className="text-slate-400 mb-8 text-lg">
                        {rating >= 4
                            ? 'Nos alegra mucho que hayas disfrutado la experiencia. ¡Esperamos verte pronto!'
                            : 'Tomamos muy en serio tus comentarios y trabajaremos duro para mejorar.'}
                    </p>

                    <button
                        onClick={() => window.location.href = 'https://www.google.com'}
                        className="text-slate-500 hover:text-white underline transition-colors"
                    >
                        Salir
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
            <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl max-w-md w-full border border-slate-700">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-black text-amber-500 mb-2 uppercase tracking-wide">{companyName || 'TU OPINIÓN'}</h1>
                    <h2 className="text-xl font-bold text-white mb-2">Ayúdanos a Mejorar</h2>
                    <p className="text-slate-400">¿Cómo calificarías tu experiencia hoy?</p>
                </div>

                {/* Stars */}
                <div className="flex justify-center gap-2 mb-8">
                    {[1, 2, 3, 4, 5].map((star) => (
                        <button
                            key={star}
                            className="transition-transform hover:scale-110 focus:outline-none"
                            onMouseEnter={() => setHoverRating(star)}
                            onMouseLeave={() => setHoverRating(0)}
                            onClick={() => setRating(star)}
                        >
                            <Star
                                className={`w-10 h-10 ${star <= (hoverRating || rating)
                                    ? 'text-yellow-400 fill-yellow-400'
                                    : 'text-slate-600'
                                    } transition-colors duration-200`}
                            />
                        </button>
                    ))}
                </div>

                {/* Dynamic Question */}
                <div className={`transition-all duration-500 overflow-hidden ${rating > 0 ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                    <label className="block text-slate-300 mb-2 font-medium">
                        {rating >= 4 ? '¿Qué fue lo que más te gustó? 🤩' : '¿Qué podemos mejorar? 🤔'}
                    </label>
                    <textarea
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-white focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none resize-none h-32"
                        placeholder={rating >= 4 ? "La comida, el servicio, el ambiente..." : "Cuéntanos qué pasó..."}
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                    />

                    <button
                        onClick={handleSubmit}
                        disabled={rating === 0 || isSubmitting}
                        className={`w-full mt-6 bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-bold py-4 rounded-xl transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${isSubmitting ? 'opacity-70 cursor-wait' : ''}`}
                    >
                        {isSubmitting ? (
                            <span>Enviando...</span>
                        ) : (
                            <>
                                <span>Enviar Calificación</span>
                                <Send className="w-5 h-5" />
                            </>
                        )}
                    </button>
                </div>
            </div>

            <div className="mt-8 text-slate-600 text-sm">
                Powered by RestauranteOS
            </div>
        </div>
    );
};
