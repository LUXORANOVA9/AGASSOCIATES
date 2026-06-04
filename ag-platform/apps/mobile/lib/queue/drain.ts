import type { DrainResult, Mutation } from './types';

const MAX_ATTEMPTS = 5;

export interface DrainCallbacks {
    /** Server-side replay of a single mutation. Returns whether to retry. */
    execute: (m: Mutation) => Promise<DrainResult>;
    /** Mark a mutation as in-flight in the store before execute runs. */
    onAttempt: (eventId: string, attempts: number) => void;
    /** Remove from queue on permanent success. */
    onSuccess: (eventId: string) => void;
    /** Move back to pending for next drain pass. */
    onRetry: (eventId: string, lastError: string, attempts: number) => void;
    /** Mark permanently failed — user must intervene. */
    onFail: (eventId: string, lastError: string, attempts: number) => void;
}

// Drain the queue FIFO. Bails out on first error so ordering is preserved —
// e.g. a queued status_update for the same case stays behind a queued
// document_upload that came before it. This matters for state machines.
export async function drainQueue(
    snapshot: Mutation[],
    cb: DrainCallbacks,
): Promise<void> {
    const pending = snapshot.filter((m) => m.status === 'pending');
    for (const item of pending) {
        const attempts = item.attempts + 1;
        cb.onAttempt(item.eventId, attempts);
        let result: DrainResult;
        try {
            result = await cb.execute(item);
        } catch (e) {
            result = {
                ok: false,
                error: e instanceof Error ? e.message : String(e),
                retriable: true,
            };
        }

        if (result.ok) {
            cb.onSuccess(item.eventId);
            continue;
        }

        const error = result.error ?? 'unknown';
        const exhaustedRetries = attempts >= MAX_ATTEMPTS;
        if (result.retriable === false || exhaustedRetries) {
            cb.onFail(item.eventId, error, attempts);
            // Don't continue past a hard failure — the next queued item
            // may depend on this one (e.g. status update referencing a
            // case that just failed to upload its document).
            return;
        }
        cb.onRetry(item.eventId, error, attempts);
        return;
    }
}

export { MAX_ATTEMPTS };
