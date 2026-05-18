import { ComponentType } from 'react';
import { ErrorBoundary } from './ErrorBoundary';

// HOC for per-route error boundaries. A render error inside one screen falls
// back gracefully without taking down the rest of the app — the root
// ErrorBoundary in App.tsx stays as the final safety net.
export function withErrorBoundary<P extends object>(
    Inner: ComponentType<P>,
): ComponentType<P> {
    const Wrapped = (props: P) => (
        <ErrorBoundary>
            <Inner {...props} />
        </ErrorBoundary>
    );
    Wrapped.displayName = `withErrorBoundary(${Inner.displayName ?? Inner.name ?? 'Component'})`;
    return Wrapped;
}
