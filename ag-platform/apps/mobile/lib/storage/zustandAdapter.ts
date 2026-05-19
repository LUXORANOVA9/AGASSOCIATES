import type { StateStorage } from 'zustand/middleware';
import { storage } from '../mmkv';

// Sync MMKV bridge for Zustand's persist middleware. Hydration runs in the
// same tick as store creation, so a screen rendered on cold start sees the
// persisted queue / duty state immediately — no flicker, no race against
// the drain loop.
export const zustandMmkvStorage: StateStorage = {
    getItem: (name) => storage.getString(name) ?? null,
    setItem: (name, value) => {
        storage.set(name, value);
    },
    removeItem: (name) => {
        storage.delete(name);
    },
};
