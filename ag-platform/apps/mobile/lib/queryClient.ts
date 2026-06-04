import { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
            // Phase 2 will route writes through useMutationQueue; the QC
            // defaults stay conservative until then.
            retry: 0,
        },
    },
});

export const queryPersister = createAsyncStoragePersister({
    storage: AsyncStorage,
    key: 'ag-mobile-rq-cache-v1',
    throttleTime: 1000,
});
