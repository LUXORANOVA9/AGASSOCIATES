import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuthStore } from '../../lib/stores/useAuthStore';
import { useMutationQueue } from '../../hooks/useMutationQueue';
import { OfflineIndicator } from '../../components/system/OfflineIndicator';

// Auth guard for everything under /(app). Mounts the mutation queue exactly
// once and renders the OfflineIndicator so connectivity + queue depth are
// always visible.
export default function AppLayout() {
    const { initialised, user } = useAuthStore((s) => ({
        initialised: s.initialised,
        user: s.user,
    }));

    // The queue hook MUST mount once on the auth-protected tree so it has
    // access to QueryClient and only runs for signed-in users.
    useMutationQueue();

    if (!initialised) {
        return (
            <View className="flex-1 items-center justify-center bg-slate-50">
                <ActivityIndicator color="#4338ca" />
            </View>
        );
    }
    if (!user) return <Redirect href="/login" />;

    return (
        <View className="flex-1">
            <OfflineIndicator />
            <Stack
                screenOptions={{
                    headerStyle: { backgroundColor: '#0f172a' },
                    headerTintColor: '#f8fafc',
                    headerTitleStyle: { fontWeight: '600' },
                }}
            >
                <Stack.Screen name="dashboard" options={{ title: 'My Cases' }} />
                <Stack.Screen name="scanner" options={{ title: 'Scan' }} />
                <Stack.Screen
                    name="cases/[caseId]"
                    options={{ title: 'Case' }}
                />
                <Stack.Screen name="settings" options={{ title: 'Settings' }} />
                <Stack.Screen
                    name="debug/queue"
                    options={{ title: 'Queue (dev)' }}
                />
            </Stack>
        </View>
    );
}
