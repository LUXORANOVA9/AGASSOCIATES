import React from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';

interface ErrorStateProps {
    title?: string;
    message?: string;
    onRetry?: () => void;
}

export function ErrorState({
    title = "Couldn't load",
    message = 'Check your connection and try again.',
    onRetry,
}: ErrorStateProps) {
    return (
        <div
            role="alert"
            className="flex flex-col items-center justify-center p-8 text-center bg-rose-50 border border-rose-200 rounded-2xl"
        >
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-3">
                <WifiOff size={24} />
            </div>
            <h3 className="text-base font-semibold text-slate-900 mb-1">{title}</h3>
            <p className="text-sm text-slate-600 max-w-md">{message}</p>
            {onRetry && (
                <button
                    onClick={onRetry}
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-md text-sm font-medium hover:bg-slate-50 transition"
                >
                    <RefreshCw size={16} /> Try again
                </button>
            )}
        </div>
    );
}
