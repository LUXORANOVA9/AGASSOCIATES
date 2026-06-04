// Single source of truth for the offline mutation queue. Every write the
// mobile app performs goes through this funnel so we get:
//   1. Optimistic UI (immediate cache mutation)
//   2. AsyncStorage persistence across cold starts
//   3. FIFO replay when NetInfo flips to connected
//   4. Server-side idempotency via client_event_id UNIQUE constraints
//      (see migration 20260518000000_field_app.sql)

export type MutationStatus = 'pending' | 'in_flight' | 'failed';

export interface BaseMutation {
    eventId: string;     // == server-side client_event_id; generated up front
    intent: MutationIntent;
    createdAt: string;   // ISO
    attempts: number;    // increments on each failure
    lastError?: string;
    status: MutationStatus;
}

export interface StatusUpdateMutation extends BaseMutation {
    intent: 'status_update';
    payload: {
        caseId: string;
        orgId: string;
        actorId: string;
        toStatus: string;    // DbCaseStatus, kept as string so queue persistence stays loose
        fromStatus?: string;
        note?: string;
        gpsLat?: number;
        gpsLon?: number;
        occurredAt: string;
    };
}

export interface DocumentUploadMutation extends BaseMutation {
    intent: 'document_upload';
    payload: {
        caseId: string;
        orgId: string;
        uploaderId: string;
        localUri: string;       // expo-file-system path in the cache dir
        contentType: string;
        sizeBytes?: number;
        capturedAt?: string;
        capturedLat?: number;
        capturedLon?: number;
    };
}

export type Mutation = StatusUpdateMutation | DocumentUploadMutation;

export type MutationIntent = 'status_update' | 'document_upload';

export interface DrainResult {
    ok: boolean;
    error?: string;
    // If true, mark the mutation as completed/persisted server-side. If false
    // and `retriable` is true, the mutation goes back to pending for retry.
    // If false and `retriable` is false, it's marked permanently failed.
    retriable?: boolean;
}
