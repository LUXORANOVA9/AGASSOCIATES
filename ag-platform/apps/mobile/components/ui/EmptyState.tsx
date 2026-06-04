import { Pressable, Text, View } from 'react-native';

interface EmptyStateProps {
    title: string;
    message?: string;
    action?: { label: string; onPress: () => void };
}

export function EmptyState({ title, message, action }: EmptyStateProps) {
    return (
        <View
            accessibilityRole="text"
            className="items-center p-8 bg-white border border-dashed border-slate-200 rounded-2xl"
        >
            <Text className="text-base font-semibold text-slate-900 text-center">
                {title}
            </Text>
            {message && (
                <Text className="text-sm text-slate-600 text-center mt-1">
                    {message}
                </Text>
            )}
            {action && (
                <Pressable
                    onPress={action.onPress}
                    className="mt-4 bg-indigo-600 px-4 py-2 rounded-md active:opacity-80"
                >
                    <Text className="text-white text-sm font-medium">
                        {action.label}
                    </Text>
                </Pressable>
            )}
        </View>
    );
}
