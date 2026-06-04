import { Text, View } from 'react-native';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { useQueueStore } from '../../lib/stores/useQueueStore';

// Persistent header chip that surfaces connectivity + queue depth so the
// executive always knows whether their last action made it server-side.
export function OfflineIndicator() {
    const online = useOnlineStatus();
    const pendingCount = useQueueStore((s) =>
        s.items.filter((i) => i.status !== 'failed').length,
    );

    if (online && pendingCount === 0) return null;

    const message = !online
        ? `Offline${pendingCount > 0 ? ` · ${pendingCount} queued` : ''}`
        : `Syncing · ${pendingCount} queued`;
    const tone = !online
        ? 'bg-rose-100 border-rose-200'
        : 'bg-amber-100 border-amber-200';
    const textTone = !online ? 'text-rose-700' : 'text-amber-700';

    return (
        <View
            className={`px-4 py-2 border-b ${tone}`}
            accessibilityLiveRegion="polite"
        >
            <Text className={`text-xs font-medium ${textTone}`}>{message}</Text>
        </View>
    );
}
