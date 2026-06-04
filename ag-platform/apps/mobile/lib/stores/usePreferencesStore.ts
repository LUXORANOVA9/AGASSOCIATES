import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// User-controlled preferences. Diagnostic opt-out is required by the DPDP
// Act 2023 / our published privacy policy — when off, no crash reports go
// to Sentry. Default: on, because field-app reliability depends on it.
interface PreferencesState {
    diagnosticsEnabled: boolean;
    setDiagnosticsEnabled: (enabled: boolean) => void;
}

export const usePreferencesStore = create<PreferencesState>()(
    persist(
        (set) => ({
            diagnosticsEnabled: true,
            setDiagnosticsEnabled: (enabled) =>
                set({ diagnosticsEnabled: enabled }),
        }),
        {
            name: 'ag-mobile-prefs-v1',
            storage: createJSONStorage(() => AsyncStorage),
        },
    ),
);
