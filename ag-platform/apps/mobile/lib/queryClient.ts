import { QueryClient } from '@tanstack/react-query';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { storage } from './mmkv';

// Sync MMKV bridge for TanStack Query persistence. The cache is non-critical
// (loss degrades to a one-session cache, not data loss) but sync writes
// avoid the promise churn of the previous AsyncStorage persister.
const querySyncStorage = {
    getItem: (key: string) => storage.getString(key) ?? null,
    setItem: (key: string, value: string) => {
        storage.set(key, value);
    },
    removeItem: (key: string) => {
        storage.delete(key);
    },
};

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // Last-known-good data shows while we refetch — offline-first by
            // default. Tighten per-query if a screen needs fresh truth.
            staleTime: 30_000,
            gcTime: 24 * 60 * 60 * 1000,
            retry: 2,
            refetchOnWindowFocus: false,
        },
        mutations: {
            // Writes go through useMutationQueue, not React Query retries.
            retry: 0,
        },
    },
});

export const queryPersister = createSyncStoragePersister({
    storage: querySyncStorage,
    key: 'ag-mobile-rq-cache-v1',
    throttleTime: 1000,
});
