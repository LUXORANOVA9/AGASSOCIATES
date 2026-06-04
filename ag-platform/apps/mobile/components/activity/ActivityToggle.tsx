import { Pressable, Text, View } from 'react-native';
import { useDutyStore } from '../../lib/stores/useDutyStore';

export function ActivityToggle() {
    const onDuty = useDutyStore((s) => s.onDuty);
    const sinceIso = useDutyStore((s) => s.sinceIso);
    const toggle = useDutyStore((s) => s.toggle);

    return (
        <Pressable
            onPress={() => toggle(!onDuty)}
            accessibilityRole="switch"
            accessibilityState={{ checked: onDuty }}
            className={
                'rounded-2xl p-5 border ' +
                (onDuty
                    ? 'bg-emerald-50 border-emerald-300'
                    : 'bg-white border-slate-300 active:bg-slate-50')
            }
        >
            <View className="flex-row items-center justify-between">
                <View className="flex-1">
                    <Text
                        className={
                            'text-base font-semibold ' +
                            (onDuty ? 'text-emerald-700' : 'text-slate-900')
                        }
                    >
                        {onDuty ? 'On Duty' : 'Off Duty'}
                    </Text>
                    <Text className="text-xs text-slate-600 mt-1">
                        {onDuty
                            ? `Recording GPS since ${formatTime(sinceIso)}`
                            : 'Tap to start tracking field activity'}
                    </Text>
                </View>
                <View
                    className={
                        'w-12 h-7 rounded-full ' +
                        (onDuty ? 'bg-emerald-500' : 'bg-slate-300')
                    }
                >
                    <View
                        className={
                            'w-6 h-6 rounded-full bg-white shadow mt-0.5 ' +
                            (onDuty ? 'ml-6' : 'ml-0.5')
                        }
                    />
                </View>
            </View>
        </Pressable>
    );
}

function formatTime(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
    });
}
