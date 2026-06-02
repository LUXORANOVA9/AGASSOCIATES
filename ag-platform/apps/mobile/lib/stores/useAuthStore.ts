import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { zustandMmkvStorage } from '../storage/zustandAdapter';
import type { Session, User } from '@supabase/supabase-js';
import type { DbUserRole } from '@ag/types';
import { supabase } from '../supabase';

interface AuthState {
    user: User | null;
    session: Session | null;
    role: DbUserRole | null;
    orgId: string | null;
    initialised: boolean;
    initialise: () => Promise<void>;
    signOut: () => Promise<void>;
    setSession: (session: Session | null) => void;
}

function extractRole(session: Session | null): DbUserRole | null {
    const raw = session?.user.app_metadata?.role as string | undefined;
    if (!raw) return null;
    if (raw === 'admin' || raw === 'staff' || raw === 'applicant' || raw === 'executive') {
        return raw;
    }
    return null;
}

function extractOrgId(session: Session | null): string | null {
    return (session?.user.app_metadata?.app_org_id as string) ?? null;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            session: null,
            role: null,
            orgId: null,
            initialised: false,

            initialise: async () => {
                const { data } = await supabase.auth.getSession();
                set({
                    session: data.session,
                    user: data.session?.user ?? null,
                    role: extractRole(data.session),
                    orgId: extractOrgId(data.session),
                    initialised: true,
                });
                supabase.auth.onAuthStateChange((_event, session) => {
                    set({
                        session,
                        user: session?.user ?? null,
                        role: extractRole(session),
                        orgId: extractOrgId(session),
                    });
                });
            },

            signOut: async () => {
                await supabase.auth.signOut();
                set({ session: null, user: null, role: null, orgId: null });
            },

            setSession: (session) => {
                set({
                    session,
                    user: session?.user ?? null,
                    role: extractRole(session),
                    orgId: extractOrgId(session),
                });
            },
        }),
        {
            name: 'ag-mobile-auth-v1',
            storage: createJSONStorage(() => zustandMmkvStorage),
            // Only persist non-sensitive scaffolding so the UI can render an
            // optimistic shell before Supabase rehydrates the real session
            // from encrypted MMKV (see lib/storage/supabaseAdapter.ts).
            partialize: (state) => ({
                role: state.role,
                orgId: state.orgId,
            }),
        },
    ),
);
