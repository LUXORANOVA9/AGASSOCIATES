import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { env } from './env';
import { supabaseSecureStorage } from './storage/supabaseAdapter';

// One singleton client. The session JWT lives in OS-keystore-backed
// encrypted MMKV (see lib/mmkv.ts); everything else (case data, documents)
// goes through RLS-protected reads at fetch time, NOT a local copy of the
// database.
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: {
        storage: supabaseSecureStorage,
        autoRefreshToken: true,
        persistSession: true,
        // No URL detection — Expo Router handles magic-link callbacks via
        // expo-linking and feeds the token fragment to supabase.auth.setSession.
        detectSessionInUrl: false,
    },
});
