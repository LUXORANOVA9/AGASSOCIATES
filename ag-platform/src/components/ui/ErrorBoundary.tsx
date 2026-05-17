import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
    children: React.ReactNode;
    fallback?: (args: { error: Error; reset: () => void }) => React.ReactNode;
}

interface ErrorBoundaryState {
    error: Error | null;
}

export class ErrorBoundary extends React.Component<
    ErrorBoundaryProps,
    ErrorBoundaryState
> {
    state: ErrorBoundaryState = { error: null };

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        // Sentry capture goes here once the platform initialises Sentry on the
        // web client; intentionally a no-op until then so the boundary keeps
        // working even before that integration lands.
        if (typeof console !== 'undefined') {
            console.error('ErrorBoundary caught:', error, info.componentStack);
        }
    }

    reset = () => this.setState({ error: null });

    render() {
        if (this.state.error) {
            if (this.props.fallback) {
                return this.props.fallback({
                    error: this.state.error,
                    reset: this.reset,
                });
            }
            return <DefaultFallback error={this.state.error} onReset={this.reset} />;
        }
        return this.props.children;
    }
}

function DefaultFallback({
    error,
    onReset,
}: {
    error: Error;
    onReset: () => void;
}) {
    return (
        <div
            role="alert"
            className="min-h-[50vh] flex flex-col items-center justify-center p-8 bg-slate-50"
        >
            <div className="max-w-md w-full bg-white border border-rose-200 rounded-2xl shadow-sm p-6 text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
                    <AlertTriangle size={28} />
                </div>
                <h2 className="text-lg font-semibold text-slate-900 mb-2">
                    Something went wrong
                </h2>
                <p className="text-sm text-slate-600 mb-4">
                    We hit an unexpected error and stopped here so nothing gets corrupted.
                    Try again — if it keeps happening, refresh the page.
                </p>
                <details className="text-left mb-4 text-xs text-slate-500 bg-slate-50 rounded p-2">
                    <summary className="cursor-pointer">Technical details</summary>
                    <pre className="mt-2 whitespace-pre-wrap break-words">
                        {error.message}
                    </pre>
                </details>
                <button
                    onClick={onReset}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 transition"
                >
                    <RefreshCw size={16} /> Try again
                </button>
            </div>
        </div>
    );
}
