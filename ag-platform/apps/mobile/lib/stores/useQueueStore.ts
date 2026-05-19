import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Mutation, MutationStatus } from '../queue/types';

interface QueueState {
    items: Mutation[];
    enqueue: (m: Mutation) => void;
    markStatus: (
        eventId: string,
        status: MutationStatus,
        patch?: { lastError?: string; attempts?: number },
    ) => void;
    remove: (eventId: string) => void;
    clearCompleted: () => void;
    reset: () => void;
}

export const useQueueStore = create<QueueState>()(
    persist(
        (set) => ({
            items: [],
            enqueue: (m) =>
                set((s) =>
                    s.items.some((x) => x.eventId === m.eventId)
                        ? s
                        : { items: [...s.items, m] },
                ),
            markStatus: (eventId, status, patch) =>
                set((s) => ({
                    items: s.items.map((item) =>
                        item.eventId === eventId
                            ? {
                                  ...item,
                                  status,
                                  attempts: patch?.attempts ?? item.attempts,
                                  lastError: patch?.lastError ?? item.lastError,
                              }
                            : item,
                    ),
                })),
            remove: (eventId) =>
                set((s) => ({ items: s.items.filter((i) => i.eventId !== eventId) })),
            clearCompleted: () =>
                set((s) => ({ items: s.items.filter((i) => i.status !== 'in_flight') })),
            reset: () => set({ items: [] }),
        }),
        {
            name: 'ag-mobile-mutation-queue-v1',
            storage: createJSONStorage(() => AsyncStorage),
        },
    ),
);
