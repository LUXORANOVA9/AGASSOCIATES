import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

interface Props {
    children: React.ReactNode;
}

interface State {
    error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
    state: State = { error: null };

    static getDerivedStateFromError(error: Error): State {
        return { error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        if (typeof console !== 'undefined') {
            console.error('ErrorBoundary caught:', error, info.componentStack);
        }
    }

    reset = () => this.setState({ error: null });

    render() {
        if (!this.state.error) return this.props.children;
        const message = this.state.error.message;
        return (
            <ScrollView
                contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
                className="bg-slate-50 p-6"
            >
                <View
                    accessibilityRole="alert"
                    className="bg-white border border-rose-200 rounded-2xl p-6"
                >
                    <Text className="text-lg font-semibold text-slate-900 mb-2">
                        Something went wrong
                    </Text>
                    <Text className="text-sm text-slate-600 mb-4">
                        We hit an unexpected error and stopped here so nothing gets
                        corrupted. Pull to refresh, or try again.
                    </Text>
                    <View className="bg-slate-50 rounded p-2 mb-4">
                        <Text className="text-xs text-slate-500" numberOfLines={6}>
                            {message}
                        </Text>
                    </View>
                    <Pressable
                        onPress={this.reset}
                        className="bg-indigo-600 px-4 py-3 rounded-md active:opacity-80"
                    >
                        <Text className="text-white text-center text-sm font-medium">
                            Try again
                        </Text>
                    </Pressable>
                </View>
            </ScrollView>
        );
    }
}
