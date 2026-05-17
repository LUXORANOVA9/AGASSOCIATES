import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuthStore } from '../../lib/stores/useAuthStore';

// Auth guard for everything under /(app). Anonymous users get bounced to
// /login. Phase 2/3 will swap this Stack for a tab navigator once there are
// multiple authenticated screens to switch between.
export default function AppLayout() {
    const { initialised, user } = useAuthStore((s) => ({
        initialised: s.initialised,
        user: s.user,
    }));

    if (!initialised) {
        return (
            <View className="flex-1 items-center justify-center bg-slate-50">
                <ActivityIndicator color="#4338ca" />
            </View>
        );
    }
    if (!user) return <Redirect href="/login" />;

    return (
        <Stack
            screenOptions={{
                headerStyle: { backgroundColor: '#0f172a' },
                headerTintColor: '#f8fafc',
                headerTitleStyle: { fontWeight: '600' },
            }}
        >
            <Stack.Screen name="dashboard" options={{ title: 'My Cases' }} />
            <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        </Stack>
    );
}
