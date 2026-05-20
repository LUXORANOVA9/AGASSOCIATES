import { Pressable, Text, View } from 'react-native';
import type { DbCaseStatus } from '@ag/types';

interface CaseListItemProps {
    id: string;
    caseNumber?: string | null;
    bankName: string;
    caseType: string;
    status: DbCaseStatus;
    assignedAt: string | null;
    onPress: () => void;
}

const STATUS_TONE: Record<DbCaseStatus, string> = {
    'Pending Intake': 'bg-amber-100 text-amber-700',
    'Under Review': 'bg-blue-100 text-blue-700',
    'In Progress': 'bg-indigo-100 text-indigo-700',
    'Action Required': 'bg-rose-100 text-rose-700',
    Completed: 'bg-emerald-100 text-emerald-700',
};

export function CaseListItem({
    caseNumber,
    bankName,
    caseType,
    status,
    assignedAt,
    onPress,
}: CaseListItemProps) {
    const tone = STATUS_TONE[status] ?? 'bg-slate-100 text-slate-700';
    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            className="bg-white border border-slate-200 rounded-xl p-4 active:bg-slate-50"
        >
            <View className="flex-row items-center justify-between">
                <Text className="text-base font-semibold text-slate-900">
                    {caseNumber ?? caseType}
                </Text>
                <View className={`px-2 py-0.5 rounded ${tone}`}>
                    <Text className="text-xs font-medium">{status}</Text>
                </View>
            </View>
            <Text className="text-sm text-slate-600 mt-1">
                {bankName} · {caseType}
            </Text>
            {assignedAt && (
                <Text className="text-xs text-slate-500 mt-2">
                    Assigned {formatRelative(assignedAt)}
                </Text>
            )}
        </Pressable>
    );
}

function formatRelative(iso: string): string {
    const then = new Date(iso).getTime();
    const diffMin = Math.floor((Date.now() - then) / 60_000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d ago`;
}
