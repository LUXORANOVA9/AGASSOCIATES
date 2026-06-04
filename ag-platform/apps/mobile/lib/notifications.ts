import * as Notifications from 'expo-notifications';

let configured = false;

// Show push alerts even when the app is in the foreground. Without this
// Expo silently drops them.
export function configureNotifications() {
    if (configured) return;
    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
        }),
    });
    configured = true;
}
