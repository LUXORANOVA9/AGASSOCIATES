import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuthStore } from '../lib/stores/useAuthStore';

// Entry point — wait for the initial Supabase getSession() round-trip, then
// route to dashboard or login. No content of its own.
export default function Index() {
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
    return <Redirect href={user ? '/dashboard' : '/login'} />;
}
