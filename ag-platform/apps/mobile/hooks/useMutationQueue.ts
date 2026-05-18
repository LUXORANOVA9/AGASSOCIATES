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

    const drain = useCallback(async () => {
        if (draining.current) return;
        if (!online) return;
        const snapshot = useQueueStore.getState().items;
        if (!snapshot.some((i) => i.status === 'pending')) return;
        draining.current = true;
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
                onRetry: (eventId, lastError, attempts) =>
                    markStatus(eventId, 'pending', { lastError, attempts }),
                onFail: (eventId, lastError, attempts) =>
                    markStatus(eventId, 'failed', { lastError, attempts }),
            });
        } finally {
            draining.current = false;
        }
    }, [online, markStatus, remove, markFlushed, queryClient]);

    useEffect(() => {
        void drain();
    }, [drain, items.length, online]);

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
