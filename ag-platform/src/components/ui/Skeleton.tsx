import React from 'react';

interface SkeletonProps {
    className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
    return (
        <div
            aria-hidden="true"
            className={`animate-pulse rounded-md bg-slate-200 ${className}`}
        />
    );
}

export function SkeletonList({ rows = 3 }: { rows?: number }) {
    return (
        <div className="space-y-3" role="status" aria-label="Loading">
            {Array.from({ length: rows }).map((_, i) => (
                <div
                    key={i}
                    className="bg-white border border-slate-200 rounded-xl p-4 space-y-3"
                >
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-2/3" />
                    <Skeleton className="h-3 w-1/2" />
                </div>
            ))}
        </div>
    );
}
