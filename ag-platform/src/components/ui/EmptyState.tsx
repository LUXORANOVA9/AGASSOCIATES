import React from 'react';
import { Inbox, type LucideIcon } from 'lucide-react';

interface EmptyStateProps {
    title: string;
    message?: string;
    icon?: LucideIcon;
    action?: { label: string; onClick: () => void };
}

export function EmptyState({
    title,
    message,
    icon: Icon = Inbox,
    action,
}: EmptyStateProps) {
    return (
        <div
            role="status"
            className="flex flex-col items-center justify-center p-10 text-center bg-white border border-dashed border-slate-200 rounded-2xl"
        >
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mb-3">
                <Icon size={24} />
            </div>
            <h3 className="text-base font-semibold text-slate-900 mb-1">{title}</h3>
            {message && <p className="text-sm text-slate-600 max-w-md">{message}</p>}
            {action && (
                <button
                    onClick={action.onClick}
                    className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 transition"
                >
                    {action.label}
                </button>
            )}
        </div>
    );
}
