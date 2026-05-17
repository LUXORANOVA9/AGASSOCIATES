import { Pressable, Text, View } from 'react-native';
import type { DbCaseStatus } from '@ag/types';

interface StatusButtonProps {
    label: string;
    toStatus: DbCaseStatus;
    active: boolean;
    onPress: () => void;
}

export function StatusButton({ label, active, onPress }: StatusButtonProps) {
    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            className={
                'rounded-xl px-4 py-4 border ' +
                (active
                    ? 'bg-indigo-600 border-indigo-700'
                    : 'bg-white border-slate-300 active:bg-slate-50')
            }
        >
            <View className="flex-row items-center justify-between">
                <Text
                    className={
                        'text-sm font-medium ' +
                        (active ? 'text-white' : 'text-slate-900')
                    }
                >
                    {label}
                </Text>
                {active && (
                    <Text className="text-xs text-indigo-100">Current</Text>
                )}
            </View>
        </Pressable>
    );
}
