import { Text, View } from 'react-native';
import type { Mutation } from '../../lib/queue/types';

interface UploadQueueListProps {
    items: Mutation[];
}

const STATUS_TONE = {
    pending: 'bg-amber-100 text-amber-700',
    in_flight: 'bg-blue-100 text-blue-700',
    failed: 'bg-rose-100 text-rose-700',
} as const;

export function UploadQueueList({ items }: UploadQueueListProps) {
    if (items.length === 0) {
        return (
            <View className="p-6 items-center bg-slate-100 rounded-xl">
                <Text className="text-sm text-slate-500">Queue is empty</Text>
            </View>
        );
    }
    return (
        <View className="gap-2">
            {items.map((item) => (
                <Row key={item.eventId} item={item} />
            ))}
        </View>
    );
}

function Row({ item }: { item: Mutation }) {
    const tone = STATUS_TONE[item.status];
    const summary = describe(item);
    return (
        <View className="bg-white border border-slate-200 rounded-lg p-3">
            <View className="flex-row items-center justify-between">
                <Text className="text-sm font-medium text-slate-900" numberOfLines={1}>
                    {summary}
                </Text>
                <View className={`px-2 py-0.5 rounded ${tone}`}>
                    <Text className="text-xs font-medium capitalize">{item.status}</Text>
                </View>
            </View>
            <Text className="text-xs text-slate-500 mt-1">
                {item.attempts > 0 ? `Attempt ${item.attempts}` : 'Queued'}
                {item.lastError ? ` · ${item.lastError}` : ''}
            </Text>
        </View>
    );
}

function describe(m: Mutation): string {
    switch (m.intent) {
        case 'status_update':
            return `Status → ${m.payload.toStatus}`;
        case 'document_upload':
            return `Document for case ${m.payload.caseId.slice(0, 8)}`;
    }
}
