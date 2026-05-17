import { useEffect } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { useAuthStore } from '../lib/stores/useAuthStore';
import { upsertPushToken } from '../services/devices';

// Register this device for Expo push notifications and persist the token to
// device_push_tokens. Runs once per signed-in session — re-registration on
// every launch is intentional so token rotation (Expo can invalidate) gets
// picked up promptly.

const ANDROID_CHANNEL = 'default';

export function usePushRegistration() {
    const userId = useAuthStore((s) => s.user?.id);
    const orgId = useAuthStore((s) => s.orgId);

    useEffect(() => {
        if (!userId || !orgId) return;
        let cancelled = false;

        (async () => {
            const perm = await Notifications.getPermissionsAsync();
            let status = perm.status;
            if (status !== 'granted') {
                const ask = await Notifications.requestPermissionsAsync();
                status = ask.status;
            }
            if (status !== 'granted' || cancelled) return;

            if (Platform.OS === 'android') {
                await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL, {
                    name: 'Default',
                    importance: Notifications.AndroidImportance.HIGH,
                });
            }

            const projectId =
                Constants.expoConfig?.extra?.eas?.projectId ??
                (Constants.easConfig as { projectId?: string } | undefined)?.projectId;
            if (!projectId) return; // EAS not initialised yet; skip silently in dev

            const tokenResult = await Notifications.getExpoPushTokenAsync({
                projectId,
            });
            if (cancelled) return;

            const deviceId =
                Constants.deviceId ??
                Constants.sessionId ??
                `${Platform.OS}-${Date.now()}`;

            await upsertPushToken({
                user_id: userId,
                org_id: orgId,
                expo_push_token: tokenResult.data,
                device_id: deviceId,
                platform: Platform.OS === 'ios' ? 'ios' : 'android',
                app_version: Constants.expoConfig?.version ?? null,
            });
        })().catch(() => {
            // Push is best-effort. Log via Sentry once that's wired up;
            // never throw from this hook.
        });

        return () => {
            cancelled = true;
        };
    }, [userId, orgId]);
}
