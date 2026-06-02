import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface AuthUser {
  id: string;
  email?: string;
  app_metadata: { role?: string };
}

interface AuthSession {
  user: AuthUser;
  access_token: string;
}

interface AuthState {
  user: AuthUser | null;
  session: AuthSession | null;
  role: 'admin' | 'staff' | 'applicant' | null;
  loading: boolean;
  signOut: () => Promise<void>;
  initialize: () => Promise<void>;
  devLogin: (role: 'admin' | 'staff' | 'applicant') => Promise<void>;
}

const DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true' || !import.meta.env.VITE_SUPABASE_URL;

function makeDevSession(role: 'admin' | 'staff' | 'applicant'): { session: AuthSession; role: 'admin' | 'staff' | 'applicant' } {
  return {
    session: {
      user: { id: 'dev-user-001', email: 'dev@agassociates.local', app_metadata: { role } },
      access_token: 'dev-token',
    },
    role,
  };
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  role: null,
  loading: true,

  devLogin: async (role) => {
    const { session } = makeDevSession(role);
    set({ user: session.user, session, role });
  },

  signOut: async () => {
    if (!DEV_MODE) {
      await supabase.auth.signOut();
    }
    set({ user: null, session: null, role: null });
  },

  initialize: async () => {
    try {
      if (DEV_MODE) {
        const saved = localStorage.getItem('ag_dev_role');
        const role = (saved as 'admin' | 'staff' | 'applicant') || 'admin';
        const { session } = makeDevSession(role);
        set({ user: session.user, session, role, loading: false });
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        set({ session, user: session.user as unknown as AuthUser });
        const role = session.user.app_metadata?.role || 'applicant';
        set({ role });
      }
    } catch (error) {
      console.error('Auth init error:', error);
    } finally {
      set({ loading: false });
    }

    if (!DEV_MODE) {
      supabase.auth.onAuthStateChange((_event, session) => {
        set({ session, user: session?.user ? (session.user as unknown as AuthUser) : null });
        if (session) {
          const role = session.user.app_metadata?.role || 'applicant';
          set({ role });
        } else {
          set({ role: null });
        }
      });
    }
  },
}));
