import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import '../global.css';

import { ErrorBoundary } from '../components/ui';
import { queryClient, queryPersister } from '../lib/queryClient';
import { useAuthStore } from '../lib/stores/useAuthStore';
import { initSentry } from '../lib/sentry';
import { configureNotifications } from '../lib/notifications';

export default function RootLayout() {
    const initialise = useAuthStore((s) => s.initialise);

    useEffect(() => {
        initSentry();
        configureNotifications();
        initialise();
    }, [initialise]);

    return (
        <ErrorBoundary>
            <SafeAreaProvider>
                <GestureHandlerRootView style={{ flex: 1 }}>
                    <PersistQueryClientProvider
                        client={queryClient}
                        persistOptions={{ persister: queryPersister }}
                    >
                        <QueryClientProvider client={queryClient}>
                            <StatusBar style="auto" />
                            <Stack
                                screenOptions={{
                                    headerShown: false,
                                    contentStyle: { backgroundColor: '#f8fafc' },
                                }}
                            />
                        </QueryClientProvider>
                    </PersistQueryClientProvider>
                </GestureHandlerRootView>
            </SafeAreaProvider>
        </ErrorBoundary>
    );
}
