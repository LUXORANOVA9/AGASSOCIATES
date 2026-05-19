import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useAssignedCases } from '../../../hooks/useCases';
import { useDocumentCapture } from '../../../hooks/useDocumentCapture';
import { useQueueStore } from '../../../lib/stores/useQueueStore';
import { CameraButton } from '../../../components/scanner/CameraButton';
import { UploadQueueList } from '../../../components/scanner/UploadQueueList';
import {
    EmptyState,
    ErrorState,
    SkeletonList,
} from '../../../components/ui';

// Two responsibilities, kept separate via sub-components: choose a case to
// attach the capture to, then capture + see the queue. Picking-the-case UX
// is a simple top-of-list selector; Phase 3 will swap in a "current case"
// concept tied to the active route.
export default function Scanner() {
    const casesQuery = useAssignedCases();
    const [activeCaseId, setActiveCaseId] = useState<string | undefined>();
    const { capture, busy, lastError } = useDocumentCapture();
    const queueItems = useQueueStore((s) => s.items);

    return (
        <ScrollView className="flex-1 bg-slate-50" contentContainerStyle={{ padding: 16 }}>
            <View className="gap-4">
                <CaseSelector
                    casesQuery={casesQuery}
                    activeCaseId={activeCaseId}
                    onSelect={setActiveCaseId}
                />
                <CameraButton
                    busy={busy}
                    disabled={!activeCaseId}
                    onPress={() => {
                        if (!activeCaseId) return;
                        void capture({ caseId: activeCaseId });
                    }}
                />
                {lastError && (
                    <ErrorState title="Capture failed" message={lastError} />
                )}
                <View className="gap-2">
                    <Text className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Upload Queue
                    </Text>
                    <UploadQueueList items={queueItems} />
                </View>
            </View>
        </ScrollView>
    );
}

interface CaseSelectorProps {
    casesQuery: ReturnType<typeof useAssignedCases>;
    activeCaseId: string | undefined;
    onSelect: (id: string) => void;
}

function CaseSelector({ casesQuery, activeCaseId, onSelect }: CaseSelectorProps) {
    if (casesQuery.isPending) return <SkeletonList rows={2} />;
    if (casesQuery.isError) {
        return (
            <ErrorState
                title="Couldn't load cases"
                onRetry={() => void casesQuery.refetch()}
            />
        );
    }
    const cases = casesQuery.data ?? [];
    if (cases.length === 0) {
        return (
            <EmptyState
                title="No cases assigned"
                message="You need at least one assigned case before you can scan."
            />
        );
    }
    return (
        <View className="gap-2">
            <Text className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Active Case
            </Text>
            {cases.map((c) => (
                <Pressable
                    key={c.id}
                    onPress={() => onSelect(c.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: c.id === activeCaseId }}
                    className={
                        'border rounded-lg p-3 ' +
                        (c.id === activeCaseId
                            ? 'bg-indigo-50 border-indigo-300'
                            : 'bg-white border-slate-200 active:bg-slate-50')
                    }
                >
                    <Text className="text-sm font-medium text-slate-900">
                        {c.case_type}
                    </Text>
                    <Text className="text-xs text-slate-500 mt-0.5">
                        {c.bank_name} · {c.status}
                    </Text>
                </Pressable>
            ))}
        </View>
    );
}
