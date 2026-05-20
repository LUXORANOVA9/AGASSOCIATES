import Constants from 'expo-constants';

// Runtime-validated env. If something is missing in production we want to fail
// loudly at startup, not get a cryptic Supabase 401 three screens deep.

interface Env {
    SUPABASE_URL: string;
    SUPABASE_ANON_KEY: string;
    API_BASE_URL: string;
    SENTRY_DSN: string;
    PRIVACY_POLICY_URL: string;
}

function read(key: keyof Env, required: boolean): string {
    const extras = (Constants.expoConfig?.extra ?? {}) as Record<string, string>;
    const value = extras[`EXPO_PUBLIC_${key}`] ?? '';
    if (required && !value) {
        throw new Error(
            `Missing required env var EXPO_PUBLIC_${key}. ` +
                `Set it in apps/mobile/.env (dev) or EAS Secrets (build).`,
        );
    }
    return value;
}

export const env: Env = {
    SUPABASE_URL: read('SUPABASE_URL', true),
    SUPABASE_ANON_KEY: read('SUPABASE_ANON_KEY', true),
    API_BASE_URL: read('API_BASE_URL', false),
    SENTRY_DSN: read('SENTRY_DSN', false),
    PRIVACY_POLICY_URL: read('PRIVACY_POLICY_URL', false),
};
