import { useCallback } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAssignedCases } from '../../../hooks/useCases';
import { useRealtimeCases } from '../../../hooks/useRealtimeCases';
import { CaseListItem } from '../../../components/cases/CaseListItem';
import { EmptyState, ErrorState, SkeletonList } from '../../../components/ui';

// Thin orchestrator: subscribe to realtime, wire query state to UI primitives,
// render the list. All business logic lives in hooks/, all UI in components/.
export default function Dashboard() {
    const router = useRouter();
    const { data, isPending, isError, refetch, isRefetching } = useAssignedCases();
    useRealtimeCases();

    const onItemPress = useCallback(
        (id: string) => router.push(`/cases/${id}` as never),
        [router],
    );

    if (isPending) {
        return (
            <View className="flex-1 bg-slate-50 p-4">
                <SkeletonList rows={4} />
            </View>
        );
    }
    if (isError) {
        return (
            <View className="flex-1 bg-slate-50 p-4">
                <ErrorState
                    title="Couldn't load your cases"
                    message="Check your connection. Last-known cases will appear when reconnected."
                    onRetry={() => void refetch()}
                />
            </View>
        );
    }
    if (!data || data.length === 0) {
        return (
            <View className="flex-1 bg-slate-50 p-4">
                <EmptyState
                    title="No cases assigned to you"
                    message="When a case is routed your way, it'll appear here automatically."
                    action={{ label: 'Refresh', onPress: () => void refetch() }}
                />
            </View>
        );
    }

    return (
        <FlatList
            data={data}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 16, gap: 12 }}
            renderItem={({ item }) => (
                <CaseListItem
                    id={item.id}
                    caseNumber={null}
                    bankName={item.bank_name}
                    caseType={item.case_type}
                    status={item.status}
                    assignedAt={item.assigned_at}
                    onPress={() => onItemPress(item.id)}
                />
            )}
            refreshControl={
                <RefreshControl
                    refreshing={isRefetching}
                    onRefresh={() => void refetch()}
                    tintColor="#4338ca"
                />
            }
        />
    );
}
