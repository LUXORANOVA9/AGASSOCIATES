import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { env } from './env';

// One singleton client. AsyncStorage holds the refresh token across app
// launches; everything else (case data, documents) goes through RLS-protected
// reads at fetch time, NOT a local copy of the database.
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        // No URL detection — Expo Router handles magic-link callbacks via
        // expo-linking and feeds the token fragment to supabase.auth.setSession.
        detectSessionInUrl: false,
    },
});
