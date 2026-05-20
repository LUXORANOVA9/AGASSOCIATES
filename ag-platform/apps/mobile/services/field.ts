import { supabase } from '../lib/supabase';
import type { FieldActivityLogInsert } from '@ag/types';

// Batch-insert field activity rows. RLS enforces executive_id = auth.uid()
// and org_id = get_app_org_id() (see migration 20260518000000_field_app.sql),
// so we only need to assemble the payload and ship it.
export async function flushActivityBatch(
    rows: FieldActivityLogInsert[],
): Promise<void> {
    if (rows.length === 0) return;
    const { error } = await supabase.from('field_activity_logs').insert(rows);
    if (error) {
        // 23505 (unique_violation) means the batch overlapped with a previous
        // attempt's client_event_id — safe to ignore: nothing was lost.
        const code = (error as { code?: string }).code;
        if (code !== '23505') throw error;
    }
}
