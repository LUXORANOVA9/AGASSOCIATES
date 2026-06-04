import { Pressable, Text, View } from 'react-native';

interface ErrorStateProps {
    title?: string;
    message?: string;
    onRetry?: () => void;
}

export function ErrorState({
    title = "Couldn't load",
    message = 'Check your connection and try again.',
    onRetry,
}: ErrorStateProps) {
    return (
        <View
            accessibilityRole="alert"
            className="items-center p-6 bg-rose-50 border border-rose-200 rounded-2xl"
        >
            <Text className="text-base font-semibold text-slate-900 text-center">
                {title}
            </Text>
            <Text className="text-sm text-slate-600 text-center mt-1">{message}</Text>
            {onRetry && (
                <Pressable
                    onPress={onRetry}
                    className="mt-4 bg-white border border-slate-300 px-4 py-2 rounded-md active:opacity-80"
                >
                    <Text className="text-slate-700 text-sm font-medium">
                        Try again
                    </Text>
                </Pressable>
            )}
        </View>
    );
}
