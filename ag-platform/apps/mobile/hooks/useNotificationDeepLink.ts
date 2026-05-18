import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';

// Wire push payloads to in-app navigation. The Edge Function send-push-on-
// case-assigned attaches `data: { caseId }`; tapping the notification
// brings the user straight to the case detail screen.
//
// Also handles the "cold start from notification" case via
// getLastNotificationResponseAsync — required because the response
// listener only fires for taps received while the JS runtime is alive.
export function useNotificationDeepLink() {
    const router = useRouter();

    useEffect(() => {
        let cancelled = false;

        const navigateFromResponse = (
            response: Notifications.NotificationResponse | null,
        ) => {
            if (cancelled || !response) return;
            const data = response.notification.request.content.data as
                | Record<string, unknown>
                | undefined;
            const caseId = typeof data?.caseId === 'string' ? data.caseId : null;
            if (caseId) {
                router.push(`/cases/${caseId}` as never);
            }
        };

        // Cold start: notification opened the app
        Notifications.getLastNotificationResponseAsync()
            .then(navigateFromResponse)
            .catch(() => {});

        // Warm path: user tapped a notification while app is running
        const sub = Notifications.addNotificationResponseReceivedListener(
            navigateFromResponse,
        );

        return () => {
            cancelled = true;
            sub.remove();
        };
    }, [router]);
}
