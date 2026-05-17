import { useQuery } from '@tanstack/react-query';
import type { DbCaseStatus } from '@ag/types';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/stores/useAuthStore';

// Shape pulled from the actual cases table (see migrations
// 20260514000000_core_schema.sql + 20260518000000_field_app.sql).
export interface CaseRow {
    id: string;
    org_id: string;
    bank_name: string;
    case_type: string;
    status: DbCaseStatus;
    executive_id: string | null;
    assigned_at: string | null;
    created_at: string;
    updated_at: string;
}

const SELECT_COLS =
    'id, org_id, bank_name, case_type, status, executive_id, assigned_at, created_at, updated_at';

async function fetchAssignedCases(userId: string): Promise<CaseRow[]> {
    const { data, error } = await supabase
        .from('cases')
        .select(SELECT_COLS)
        .eq('executive_id', userId)
        .order('assigned_at', { ascending: false, nullsFirst: false });
    if (error) throw error;
    return (data ?? []) as CaseRow[];
}

export function casesQueryKey(userId: string | undefined, orgId: string | null) {
    return ['cases', 'assigned', orgId ?? 'no-org', userId ?? 'anon'] as const;
}

export function useAssignedCases() {
    const userId = useAuthStore((s) => s.user?.id);
    const orgId = useAuthStore((s) => s.orgId);
    return useQuery({
        queryKey: casesQueryKey(userId, orgId),
        queryFn: () => fetchAssignedCases(userId!),
        enabled: Boolean(userId),
    });
}
