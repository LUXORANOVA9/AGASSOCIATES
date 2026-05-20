import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// "On duty" is a deliberate, user-toggled state. GPS sampling only runs
// while it's true. Persisted so a crash mid-shift doesn't silently turn
// tracking off.
interface DutyState {
    onDuty: boolean;
    sinceIso: string | null;
    toggle: (next: boolean) => void;
}

export const useDutyStore = create<DutyState>()(
    persist(
        (set) => ({
            onDuty: false,
            sinceIso: null,
            toggle: (next) =>
                set({
                    onDuty: next,
                    sinceIso: next ? new Date().toISOString() : null,
                }),
        }),
        {
            name: 'ag-mobile-duty-v1',
            storage: createJSONStorage(() => AsyncStorage),
        },
    ),
);
