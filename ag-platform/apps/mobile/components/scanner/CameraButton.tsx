import { Pressable, Text, View } from 'react-native';

interface CameraButtonProps {
    busy?: boolean;
    disabled?: boolean;
    onPress: () => void;
}

export function CameraButton({ busy, disabled, onPress }: CameraButtonProps) {
    return (
        <Pressable
            onPress={onPress}
            disabled={busy || disabled}
            accessibilityRole="button"
            accessibilityLabel="Scan document"
            className={
                'rounded-2xl items-center justify-center py-12 ' +
                (disabled
                    ? 'bg-slate-300'
                    : 'bg-indigo-600 active:bg-indigo-700')
            }
        >
            <View className="items-center gap-2">
                <Text className="text-white text-lg font-semibold">
                    {busy ? 'Opening camera…' : 'Scan Document'}
                </Text>
                {!busy && (
                    <Text className="text-indigo-200 text-sm">
                        {disabled
                            ? 'Pick a case first'
                            : 'Captures save offline if no signal'}
                    </Text>
                )}
            </View>
        </Pressable>
    );
}
