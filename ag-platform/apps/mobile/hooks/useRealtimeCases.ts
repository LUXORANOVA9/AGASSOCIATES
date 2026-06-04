import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/stores/useAuthStore';
import { casesQueryKey } from './useCases';

// Subscribe to row-level changes on cases where executive_id matches the
// current user. On any insert/update/delete, invalidate the assigned-cases
// query so TanStack Query refetches and the dashboard updates live.
export function useRealtimeCases() {
    const userId = useAuthStore((s) => s.user?.id);
    const orgId = useAuthStore((s) => s.orgId);
    const queryClient = useQueryClient();

    useEffect(() => {
        if (!userId) return;
        const channel = supabase
            .channel(`cases:executive:${userId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'cases',
                    filter: `executive_id=eq.${userId}`,
                },
                () => {
                    queryClient.invalidateQueries({
                        queryKey: casesQueryKey(userId, orgId),
                    });
                },
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [userId, orgId, queryClient]);
}
