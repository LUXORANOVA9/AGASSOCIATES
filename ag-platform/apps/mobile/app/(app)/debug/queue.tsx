import { Pressable, ScrollView, Text, View } from 'react-native';
import { useQueueStore } from '../../../lib/stores/useQueueStore';

// Dev-only queue inspector. Surfaces the raw mutation queue so we can verify
// FIFO order, idempotency, and retry counts during smoke testing. Don't link
// to it from a user-facing surface — settings only.
export default function QueueDebug() {
    const items = useQueueStore((s) => s.items);
    const reset = useQueueStore((s) => s.reset);

    return (
        <ScrollView className="flex-1 bg-slate-50" contentContainerStyle={{ padding: 16 }}>
            <View className="gap-3">
                <Text className="text-sm text-slate-600">
                    {items.length} item{items.length === 1 ? '' : 's'} in queue
                </Text>
                {items.map((item, idx) => (
                    <View
                        key={item.eventId}
                        className="bg-white border border-slate-200 rounded-lg p-3"
                    >
                        <Text className="text-xs font-mono text-slate-500">
                            #{idx + 1} · {item.eventId.slice(0, 8)} · {item.status}
                        </Text>
                        <Text className="text-sm font-medium text-slate-900 mt-1">
                            {item.intent}
                        </Text>
                        <Text
                            className="text-xs text-slate-500 mt-1 font-mono"
                            numberOfLines={6}
                        >
                            {JSON.stringify(item.payload, null, 2)}
                        </Text>
                        {item.lastError && (
                            <Text className="text-xs text-rose-600 mt-1">
                                {item.lastError}
                            </Text>
                        )}
                    </View>
                ))}
                <Pressable
                    onPress={reset}
                    className="border border-rose-300 rounded-md p-3 active:bg-rose-50"
                >
                    <Text className="text-rose-600 text-sm text-center">
                        Reset queue (dev only)
                    </Text>
                </Pressable>
            </View>
        </ScrollView>
    );
}
