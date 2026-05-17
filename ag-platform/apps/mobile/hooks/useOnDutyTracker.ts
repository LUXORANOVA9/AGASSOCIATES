import { useEffect, useRef } from 'react';
import * as Crypto from 'expo-crypto';
import * as Location from 'expo-location';
import type { FieldActivityLogInsert } from '@ag/types';
import { useAuthStore } from '../lib/stores/useAuthStore';
import { useDutyStore } from '../lib/stores/useDutyStore';
import { flushActivityBatch } from '../services/field';

// Foreground-only GPS while on-duty. Background tracking is deferred — it
// requires a foreground-service notification on Android 14+ and a separate
// store-review motivation; not worth shipping until field staff actually
// need it.
//
// Sampling policy:
//   - Subscribe via Location.watchPositionAsync at Balanced accuracy
//   - distanceInterval = 10m, timeInterval = 30s → buffer breadcrumb
//   - Flush buffer every 60s or on duty toggle off
//   - Each breadcrumb gets its own client_event_id for offline replay safety

const FLUSH_INTERVAL_MS = 60_000;
const DISTANCE_INTERVAL_M = 10;
const TIME_INTERVAL_MS = 30_000;

export function useOnDutyTracker() {
    const onDuty = useDutyStore((s) => s.onDuty);
    const executiveId = useAuthStore((s) => s.user?.id);
    const orgId = useAuthStore((s) => s.orgId);

    const bufferRef = useRef<FieldActivityLogInsert[]>([]);
    const subscriptionRef = useRef<Location.LocationSubscription | null>(null);
    const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (!onDuty || !executiveId || !orgId) {
            void teardown(subscriptionRef, flushTimerRef, bufferRef, executiveId, orgId);
            return;
        }

        let cancelled = false;
        (async () => {
            const perm = await Location.requestForegroundPermissionsAsync();
            if (!perm.granted || cancelled) return;

            subscriptionRef.current = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.Balanced,
                    distanceInterval: DISTANCE_INTERVAL_M,
                    timeInterval: TIME_INTERVAL_MS,
                },
                (loc) => {
                    bufferRef.current.push({
                        client_event_id: Crypto.randomUUID(),
                        executive_id: executiveId,
                        org_id: orgId,
                        recorded_at: new Date(loc.timestamp).toISOString(),
                        lat: loc.coords.latitude,
                        lon: loc.coords.longitude,
                        accuracy_m: loc.coords.accuracy ?? null,
                    });
                },
            );

            flushTimerRef.current = setInterval(() => {
                void flush(bufferRef);
            }, FLUSH_INTERVAL_MS);
        })();

        return () => {
            cancelled = true;
            void teardown(subscriptionRef, flushTimerRef, bufferRef, executiveId, orgId);
        };
    }, [onDuty, executiveId, orgId]);
}

async function flush(bufferRef: React.MutableRefObject<FieldActivityLogInsert[]>) {
    const batch = bufferRef.current;
    if (batch.length === 0) return;
    bufferRef.current = [];
    try {
        await flushActivityBatch(batch);
    } catch {
        // Put the batch back at the head; next flush attempt will retry.
        bufferRef.current = [...batch, ...bufferRef.current];
    }
}

async function teardown(
    subscriptionRef: React.MutableRefObject<Location.LocationSubscription | null>,
    flushTimerRef: React.MutableRefObject<ReturnType<typeof setInterval> | null>,
    bufferRef: React.MutableRefObject<FieldActivityLogInsert[]>,
    _executiveId: string | undefined,
    _orgId: string | null,
) {
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
    if (flushTimerRef.current) {
        clearInterval(flushTimerRef.current);
        flushTimerRef.current = null;
    }
    await flush(bufferRef);
}
