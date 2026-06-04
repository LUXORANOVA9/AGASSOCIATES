import { ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useCase, useCaseDocuments } from '../../../hooks/useCase';
import { useStatusUpdate } from '../../../hooks/useStatusUpdate';
import { CaseDetailHeader } from '../../../components/cases/CaseDetailHeader';
import { CaseDocuments } from '../../../components/cases/CaseDocuments';
import { StatusBoard } from '../../../components/status/StatusBoard';
import {
    EmptyState,
    ErrorState,
    SkeletonList,
    withErrorBoundary,
} from '../../../components/ui';

// Thin orchestrator. Body is sectioned: header, status board, documents list.
// Each section is its own component so it stays under the 200-line ceiling
// and so reordering doesn't ripple through.
function CaseDetail() {
    const params = useLocalSearchParams<{ caseId: string }>();
    const caseId = typeof params.caseId === 'string' ? params.caseId : undefined;

    const caseQuery = useCase(caseId);
    const docsQuery = useCaseDocuments(caseId);
    const enqueueStatus = useStatusUpdate();

    if (!caseId) {
        return (
            <View className="flex-1 p-4 bg-slate-50">
                <EmptyState title="Missing case id" />
            </View>
        );
    }

    if (caseQuery.isPending) {
        return (
            <View className="flex-1 p-4 bg-slate-50">
                <SkeletonList rows={3} />
            </View>
        );
    }
    if (caseQuery.isError || !caseQuery.data) {
        return (
            <View className="flex-1 p-4 bg-slate-50">
                <ErrorState
                    title="Couldn't load case"
                    onRetry={() => void caseQuery.refetch()}
                />
            </View>
        );
    }
    const c = caseQuery.data;

    return (
        <ScrollView className="flex-1 bg-slate-50">
            <View className="p-4 gap-4">
                <CaseDetailHeader
                    bankName={c.bank_name}
                    caseType={c.case_type}
                    status={c.status}
                    assignedAt={c.assigned_at}
                />
                <View className="gap-2">
                    <Text className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Update Status
                    </Text>
                    <StatusBoard
                        current={c.status}
                        onSelect={(toStatus) => {
                            enqueueStatus({
                                caseId: c.id,
                                fromStatus: c.status,
                                toStatus,
                            });
                        }}
                    />
                </View>
                <View className="gap-2">
                    <Text className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Documents
                    </Text>
                    {docsQuery.isPending ? (
                        <SkeletonList rows={2} />
                    ) : docsQuery.isError ? (
                        <ErrorState
                            title="Couldn't load documents"
                            onRetry={() => void docsQuery.refetch()}
                        />
                    ) : (
                        <CaseDocuments documents={docsQuery.data ?? []} />
                    )}
                </View>
            </View>
        </ScrollView>
    );
}

export default withErrorBoundary(CaseDetail);
