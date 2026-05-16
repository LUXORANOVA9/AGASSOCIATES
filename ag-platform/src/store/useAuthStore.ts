import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { User, Session } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  session: Session | null;
  role: 'admin' | 'staff' | 'applicant' | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setRole: (role: AuthState['role']) => void;
  signOut: () => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  role: null,
  loading: true,
  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),
  setRole: (role) => set({ role }),
  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, session: null, role: null });
  },
  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        set({ session, user: session.user });
        // Fetch role from user metadata or a roles table
        const role = session.user.app_metadata?.role || 'applicant';
        set({ role });
      }
    } catch (error) {
      console.error('Error initializing auth:', error);
    } finally {
      set({ loading: false });
    }

    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, user: session?.user ?? null });
      if (session) {
        const role = session.user.app_metadata?.role || 'applicant';
        set({ role });
      } else {
        set({ role: null });
      }
    });
  },
}));
