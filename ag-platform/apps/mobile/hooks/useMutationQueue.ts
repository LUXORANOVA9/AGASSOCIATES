import { useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useQueueStore } from '../lib/stores/useQueueStore';
import { useOnlineStatus } from './useOnlineStatus';
import { drainQueue } from '../lib/queue/drain';
import type { Mutation } from '../lib/queue/types';
import { applyStatusUpdate } from '../services/cases';
import { applyDocumentUpload } from '../services/documents';

// The funnel every write goes through. Components call `enqueue(mutation)`
// and the drain loop fires on the next tick if online, or on the next
// NetInfo `isConnected → true` event otherwise.
//
// IMPORTANT: this hook must be mounted exactly once (currently inside the
// root `(app)/_layout.tsx`) so the singleton store + the listener don't
// double-up.

export function useMutationQueue() {
    const enqueue = useQueueStore((s) => s.enqueue);
    const markStatus = useQueueStore((s) => s.markStatus);
    const remove = useQueueStore((s) => s.remove);
    const markFlushed = useQueueStore((s) => s.markFlushed);
    const items = useQueueStore((s) => s.items);
    const online = useOnlineStatus();
    const queryClient = useQueryClient();

    const draining = useRef(false);
    // Always holds the latest drain closure so the retry timer doesn't
    // capture a stale one after a dependency change.
    const drainRef = useRef<() => Promise<void>>(async () => {});
    const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const drain = useCallback(async () => {
        if (draining.current) return;
        if (!online) return;
        const snapshot = useQueueStore.getState().items;
        if (!snapshot.some((i) => i.status === 'pending')) return;
        draining.current = true;
        if (retryTimerRef.current) {
            clearTimeout(retryTimerRef.current);
            retryTimerRef.current = null;
        }
        try {
            await drainQueue(snapshot, {
                execute: (m) => execute(m),
                onAttempt: (eventId, attempts) =>
                    markStatus(eventId, 'in_flight', { attempts }),
                onSuccess: (eventId) => {
                    remove(eventId);
                    markFlushed();
                    queryClient.invalidateQueries({ queryKey: ['cases'] });
                    queryClient.invalidateQueries({ queryKey: ['case'] });
                    queryClient.invalidateQueries({ queryKey: ['case-documents'] });
                },
                onRetry: (eventId, lastError, attempts) => {
                    markStatus(eventId, 'pending', { lastError, attempts });
                    // Re-trigger drain after exponential backoff. Without this,
                    // items stay stuck in 'pending' because items.length is
                    // unchanged by the status flip and the useEffect won't fire.
                    const backoffMs = Math.min(30_000, 2_000 * 2 ** (attempts - 1));
                    retryTimerRef.current = setTimeout(
                        () => void drainRef.current(),
                        backoffMs,
                    );
                },
                onFail: (eventId, lastError, attempts) =>
                    markStatus(eventId, 'failed', { lastError, attempts }),
            });
        } finally {
            draining.current = false;
        }
    }, [online, markStatus, remove, markFlushed, queryClient]);

    // Keep drainRef current so the retry timer always calls the latest closure.
    useEffect(() => {
        drainRef.current = drain;
    }, [drain]);

    useEffect(() => {
        void drain();
    }, [drain, items.length, online]);

    // Clean up any pending retry timer on unmount.
    useEffect(() => {
        return () => {
            if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
        };
    }, []);

    return { enqueue, items, online };
}

function execute(m: Mutation) {
    switch (m.intent) {
        case 'status_update':
            return applyStatusUpdate(m);
        case 'document_upload':
            return applyDocumentUpload(m);
    }
}
