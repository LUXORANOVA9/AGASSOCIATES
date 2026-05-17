import { drainQueue, MAX_ATTEMPTS } from '../lib/queue/drain';
import type { DrainResult, Mutation } from '../lib/queue/types';

const mk = (eventId: string, overrides: Partial<Mutation> = {}): Mutation => ({
    eventId,
    intent: 'status_update',
    createdAt: '2026-05-17T00:00:00Z',
    attempts: 0,
    status: 'pending',
    payload: {
        caseId: 'c1',
        orgId: 'o1',
        actorId: 'u1',
        toStatus: 'In Progress',
        occurredAt: '2026-05-17T00:00:00Z',
    },
    ...overrides,
} as Mutation);

interface Recorder {
    attempts: string[];
    successes: string[];
    retries: string[];
    failures: string[];
}

function makeCallbacks(
    execute: (m: Mutation) => Promise<DrainResult>,
    rec: Recorder,
) {
    return {
        execute,
        onAttempt: (eventId: string) => rec.attempts.push(eventId),
        onSuccess: (eventId: string) => rec.successes.push(eventId),
        onRetry: (eventId: string) => rec.retries.push(eventId),
        onFail: (eventId: string) => rec.failures.push(eventId),
    };
}

describe('drainQueue', () => {
    it('processes pending items FIFO and removes on success', async () => {
        const rec: Recorder = { attempts: [], successes: [], retries: [], failures: [] };
        const items = [mk('a'), mk('b'), mk('c')];
        await drainQueue(
            items,
            makeCallbacks(async () => ({ ok: true }), rec),
        );
        expect(rec.attempts).toEqual(['a', 'b', 'c']);
        expect(rec.successes).toEqual(['a', 'b', 'c']);
        expect(rec.retries).toEqual([]);
        expect(rec.failures).toEqual([]);
    });

    it('stops at first retriable failure to preserve ordering', async () => {
        const rec: Recorder = { attempts: [], successes: [], retries: [], failures: [] };
        const items = [mk('a'), mk('b'), mk('c')];
        await drainQueue(
            items,
            makeCallbacks(async (m) => {
                if (m.eventId === 'b') return { ok: false, error: 'flake', retriable: true };
                return { ok: true };
            }, rec),
        );
        expect(rec.attempts).toEqual(['a', 'b']);
        expect(rec.successes).toEqual(['a']);
        expect(rec.retries).toEqual(['b']);
        expect(rec.failures).toEqual([]);
    });

    it('marks non-retriable failures permanently and halts', async () => {
        const rec: Recorder = { attempts: [], successes: [], retries: [], failures: [] };
        const items = [mk('a'), mk('b'), mk('c')];
        await drainQueue(
            items,
            makeCallbacks(async (m) => {
                if (m.eventId === 'a') return { ok: false, error: 'bad', retriable: false };
                return { ok: true };
            }, rec),
        );
        expect(rec.failures).toEqual(['a']);
        expect(rec.attempts).toEqual(['a']);
        expect(rec.successes).toEqual([]);
    });

    it('treats thrown errors as retriable failures', async () => {
        const rec: Recorder = { attempts: [], successes: [], retries: [], failures: [] };
        await drainQueue(
            [mk('a')],
            makeCallbacks(async () => {
                throw new Error('network down');
            }, rec),
        );
        expect(rec.retries).toEqual(['a']);
    });

    it('skips items already in flight or failed', async () => {
        const rec: Recorder = { attempts: [], successes: [], retries: [], failures: [] };
        const items = [
            mk('a', { status: 'in_flight' }),
            mk('b', { status: 'failed' }),
            mk('c'),
        ];
        await drainQueue(items, makeCallbacks(async () => ({ ok: true }), rec));
        expect(rec.attempts).toEqual(['c']);
        expect(rec.successes).toEqual(['c']);
    });

    it('flips to permanent failure once MAX_ATTEMPTS is exhausted', async () => {
        const rec: Recorder = { attempts: [], successes: [], retries: [], failures: [] };
        const items = [mk('a', { attempts: MAX_ATTEMPTS - 1 })];
        await drainQueue(
            items,
            makeCallbacks(async () => ({ ok: false, error: 'flake', retriable: true }), rec),
        );
        expect(rec.failures).toEqual(['a']);
        expect(rec.retries).toEqual([]);
    });
});
