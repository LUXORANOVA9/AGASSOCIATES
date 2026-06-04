import { ScrollView, Text, View } from 'react-native';
import { useTodayActivity } from '../../hooks/useTodayActivity';
import { ActivityToggle } from '../../components/activity/ActivityToggle';
import { RouteMap } from '../../components/activity/RouteMap';
import { EmptyState, ErrorState, SkeletonList } from '../../components/ui';

export default function Activity() {
    const { data, isPending, isError, refetch } = useTodayActivity();

    return (
        <ScrollView className="flex-1 bg-slate-50" contentContainerStyle={{ padding: 16 }}>
            <View className="gap-4">
                <ActivityToggle />
                <Text className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Today&apos;s Route
                </Text>
                {isPending ? (
                    <SkeletonList rows={2} />
                ) : isError ? (
                    <ErrorState
                        title="Couldn't load route"
                        onRetry={() => void refetch()}
                    />
                ) : !data || data.length === 0 ? (
                    <EmptyState
                        title="No samples yet"
                        message="Toggle On Duty to start recording your route."
                    />
                ) : (
                    <>
                        <RouteMap breadcrumbs={data} />
                        <Text className="text-xs text-slate-500 text-center">
                            {data.length} sample{data.length === 1 ? '' : 's'} recorded
                        </Text>
                    </>
                )}
            </View>
        </ScrollView>
    );
}
