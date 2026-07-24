import React, { Component, ErrorInfo, ReactNode } from 'react';

type Props = {
    children: ReactNode;
    fallback?: ReactNode;
    name?: string;
};

type State = {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
};

class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null
        };
    }

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, errorInfo: null };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error(`Uncaught error in ErrorBoundary (${this.props.name || 'Component'}):`, error, errorInfo);
        this.setState({ error, errorInfo });
    }

    public render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }
            return (
                <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center p-4 bg-red-950/95 backdrop-blur-md text-white overflow-auto">
                    <div className="max-w-3xl w-full bg-black/80 border border-red-500 rounded-3xl p-8 shadow-2xl">
                        <h2 className="text-3xl font-black mb-4 text-red-500 uppercase italic tracking-tighter">
                            🚀 CRASH DETECTADO en {this.props.name || 'Componente'}
                        </h2>
                        <p className="text-sm font-bold text-gray-300 mb-6">
                            La vista ha colapsado. Por favor toma una foto de este mensaje y envíala a soporte técnico:
                        </p>
                        
                        <div className="space-y-4">
                            <div className="bg-red-900/30 p-4 rounded-xl border border-red-500/50">
                                <h3 className="text-xs font-black text-red-400 uppercase tracking-widest mb-2">Mensaje de Error</h3>
                                <pre className="whitespace-pre-wrap text-sm font-mono text-red-100 break-all">
                                    {this.state.error && this.state.error.toString()}
                                </pre>
                            </div>
                            
                            <div className="bg-amber-900/30 p-4 rounded-xl border border-amber-500/50">
                                <h3 className="text-xs font-black text-amber-500 uppercase tracking-widest mb-2">Pila de Componentes (Stack)</h3>
                                <pre className="whitespace-pre-wrap text-[10px] font-mono text-amber-100 break-all max-h-[40vh] overflow-y-auto">
                                    {this.state.errorInfo && this.state.errorInfo.componentStack}
                                </pre>
                            </div>
                        </div>

                        <button
                            onClick={() => window.location.reload()}
                            className="mt-8 w-full py-4 bg-red-600 hover:bg-red-500 rounded-2xl text-white font-black uppercase tracking-widest transition-all shadow-lg active:scale-95"
                        >
                            RECARGAR APLICACIÓN
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
