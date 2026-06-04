import { supabase } from '../lib/supabase';
import type {
    CaseAuditLogInsert,
    DbCaseStatus,
} from '@ag/types';
import type { DrainResult, StatusUpdateMutation } from '../lib/queue/types';

// 23-code Postgres error for unique_violation. The client_event_id UNIQUE
// constraint on case_audit_logs means a duplicate is a successful replay,
// not an error — treat it as ok.
const PG_UNIQUE_VIOLATION = '23505';

export async function applyStatusUpdate(
    m: StatusUpdateMutation,
): Promise<DrainResult> {
    const audit: CaseAuditLogInsert = {
        client_event_id: m.eventId,
        case_id: m.payload.caseId,
        org_id: m.payload.orgId,
        actor_id: m.payload.actorId,
        to_status: m.payload.toStatus as DbCaseStatus,
        from_status: (m.payload.fromStatus ?? null) as DbCaseStatus | null,
        note: m.payload.note ?? null,
        gps_lat: m.payload.gpsLat ?? null,
        gps_lon: m.payload.gpsLon ?? null,
        occurred_at: m.payload.occurredAt,
    };

    const insert = await supabase.from('case_audit_logs').insert(audit);
    if (insert.error) {
        const code = (insert.error as { code?: string }).code;
        if (code === PG_UNIQUE_VIOLATION) {
            // Already filed in a previous attempt — fall through to ensure
            // the cases.status row catches up (idempotent update).
        } else {
            return {
                ok: false,
                error: insert.error.message,
                retriable: !isAuthOrPermissionError(insert.error.message),
            };
        }
    }

    const update = await supabase
        .from('cases')
        .update({ status: m.payload.toStatus })
        .eq('id', m.payload.caseId);
    if (update.error) {
        return {
            ok: false,
            error: update.error.message,
            retriable: !isAuthOrPermissionError(update.error.message),
        };
    }
    return { ok: true };
}

function isAuthOrPermissionError(msg: string): boolean {
    const lower = msg.toLowerCase();
    return (
        lower.includes('jwt') ||
        lower.includes('permission') ||
        lower.includes('rls') ||
        lower.includes('row-level security') ||
        lower.includes('not authenticated')
    );
}
