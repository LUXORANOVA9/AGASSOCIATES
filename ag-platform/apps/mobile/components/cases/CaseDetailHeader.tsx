import { Text, View } from 'react-native';
import type { DbCaseStatus } from '@ag/types';

interface CaseDetailHeaderProps {
    bankName: string;
    caseType: string;
    status: DbCaseStatus;
    assignedAt: string | null;
}

const STATUS_TONE: Record<DbCaseStatus, string> = {
    'Pending Intake': 'bg-amber-100 text-amber-700',
    'Under Review': 'bg-blue-100 text-blue-700',
    'In Progress': 'bg-indigo-100 text-indigo-700',
    'Action Required': 'bg-rose-100 text-rose-700',
    Completed: 'bg-emerald-100 text-emerald-700',
};

export function CaseDetailHeader({
    bankName,
    caseType,
    status,
    assignedAt,
}: CaseDetailHeaderProps) {
    const tone = STATUS_TONE[status];
    return (
        <View className="bg-white border border-slate-200 rounded-2xl p-4">
            <View className="flex-row items-center justify-between mb-1">
                <Text className="text-lg font-semibold text-slate-900">
                    {caseType}
                </Text>
                <View className={`px-2 py-0.5 rounded ${tone}`}>
                    <Text className="text-xs font-medium">{status}</Text>
                </View>
            </View>
            <Text className="text-sm text-slate-600">{bankName}</Text>
            {assignedAt && (
                <Text className="text-xs text-slate-500 mt-2">
                    Assigned {new Date(assignedAt).toLocaleString()}
                </Text>
            )}
        </View>
    );
}
