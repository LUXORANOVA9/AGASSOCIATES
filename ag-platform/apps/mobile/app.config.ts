import type { ExpoConfig, ConfigContext } from 'expo/config';

// Read non-secret config from .env (development) or EAS Secrets (build). The
// SUPABASE_ANON_KEY is fine to ship — it's bounded by RLS. The service role
// key MUST NEVER end up here.
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';
const PRIVACY_POLICY_URL =
    process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL ??
    'https://agassociates.example.com/privacy';

export default ({ config }: ConfigContext): ExpoConfig => ({
    ...config,
    name: 'AG Associates Field',
    slug: 'ag-associates-field',
    version: '0.1.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    scheme: 'agfield',
    userInterfaceStyle: 'automatic',
    splash: {
        image: './assets/splash.png',
        resizeMode: 'contain',
        backgroundColor: '#0f172a',
    },
    ios: {
        supportsTablet: false,
        bundleIdentifier: 'com.agassociates.field',
        infoPlist: {
            NSCameraUsageDescription:
                'AG Associates uses the camera to capture property documents in the field.',
            NSLocationWhenInUseUsageDescription:
                'AG Associates tags case status updates and document captures with your location while you are on duty.',
            NSPhotoLibraryUsageDescription:
                'Optional: select existing photos as document evidence.',
        },
    },
    android: {
        package: 'com.agassociates.field',
        adaptiveIcon: {
            foregroundImage: './assets/adaptive-icon.png',
            backgroundColor: '#0f172a',
        },
        permissions: [
            'CAMERA',
            'ACCESS_FINE_LOCATION',
            'ACCESS_COARSE_LOCATION',
            'POST_NOTIFICATIONS',
        ],
    },
    plugins: [
        'expo-router',
        [
            'expo-location',
            {
                locationAlwaysAndWhenInUsePermission:
                    'AG Associates tags case status updates and document captures with your location while you are on duty.',
            },
        ],
        [
            'expo-notifications',
            {
                color: '#4f46e5',
            },
        ],
    ],
    experiments: {
        typedRoutes: true,
    },
    extra: {
        EXPO_PUBLIC_SUPABASE_URL: SUPABASE_URL,
        EXPO_PUBLIC_SUPABASE_ANON_KEY: SUPABASE_ANON_KEY,
        EXPO_PUBLIC_API_BASE_URL: API_BASE_URL,
        EXPO_PUBLIC_SENTRY_DSN: SENTRY_DSN,
        EXPO_PUBLIC_PRIVACY_POLICY_URL: PRIVACY_POLICY_URL,
        eas: {
            // populated by `eas init`
        },
    },
});
