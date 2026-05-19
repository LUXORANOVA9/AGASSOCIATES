import { useCallback } from 'react';
import * as Crypto from 'expo-crypto';
import { useQueryClient } from '@tanstack/react-query';
import type { DbCaseStatus } from '@ag/types';
import { useAuthStore } from '../lib/stores/useAuthStore';
import { useQueueStore } from '../lib/stores/useQueueStore';
import type { StatusUpdateMutation } from '../lib/queue/types';

interface EnqueueArgs {
    caseId: string;
    fromStatus?: DbCaseStatus;
    toStatus: DbCaseStatus;
    note?: string;
    gps?: { lat: number; lon: number };
}

// Enqueue a status transition. Returns immediately; the caller doesn't need
// to await server confirmation. The queue's drain loop carries it forward.
//
// Optimistic update: we patch the cached case + cases list so the UI reflects
// the new status right away. If the mutation eventually fails (rare — RLS
// or expired session), the next refetch will reconcile.
export function useStatusUpdate() {
    const enqueue = useQueueStore((s) => s.enqueue);
    const orgId = useAuthStore((s) => s.orgId);
    const actorId = useAuthStore((s) => s.user?.id);
    const queryClient = useQueryClient();

    return useCallback(
        ({ caseId, fromStatus, toStatus, note, gps }: EnqueueArgs) => {
            if (!orgId || !actorId) {
                throw new Error('Cannot enqueue status update: missing auth');
            }
            const eventId = Crypto.randomUUID();
            const now = new Date().toISOString();
            const mutation: StatusUpdateMutation = {
                eventId,
                intent: 'status_update',
                createdAt: now,
                attempts: 0,
                status: 'pending',
                payload: {
                    caseId,
                    orgId,
                    actorId,
                    toStatus,
                    fromStatus,
                    note,
                    gpsLat: gps?.lat,
                    gpsLon: gps?.lon,
                    occurredAt: now,
                },
            };
            enqueue(mutation);

            // Optimistic patch — both single-case and lists.
            queryClient.setQueryData(['case', caseId], (prev: unknown) =>
                prev && typeof prev === 'object'
                    ? { ...(prev as Record<string, unknown>), status: toStatus }
                    : prev,
            );
            queryClient.setQueriesData<unknown[]>({ queryKey: ['cases'] }, (prev) =>
                Array.isArray(prev)
                    ? prev.map((row) => {
                          if (
                              typeof row === 'object' &&
                              row !== null &&
                              (row as { id?: string }).id === caseId
                          ) {
                              return { ...row, status: toStatus };
                          }
                          return row;
                      })
                    : prev,
            );

            return eventId;
        },
        [enqueue, orgId, actorId, queryClient],
    );
}
