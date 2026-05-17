import { useQuery } from '@tanstack/react-query';
import type { FieldActivityLogRow } from '@ag/types';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/stores/useAuthStore';

async function fetchTodayActivity(
    executiveId: string,
): Promise<FieldActivityLogRow[]> {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const { data, error } = await supabase
        .from('field_activity_logs')
        .select(
            'id, client_event_id, executive_id, org_id, recorded_at, lat, lon, accuracy_m, battery_pct, created_at',
        )
        .eq('executive_id', executiveId)
        .gte('recorded_at', start.toISOString())
        .order('recorded_at', { ascending: true });
    if (error) throw error;
    return (data ?? []) as FieldActivityLogRow[];
}

export function useTodayActivity() {
    const executiveId = useAuthStore((s) => s.user?.id);
    return useQuery({
        queryKey: ['field-activity', 'today', executiveId],
        queryFn: () => fetchTodayActivity(executiveId!),
        enabled: Boolean(executiveId),
        refetchInterval: 60_000,
    });
}
