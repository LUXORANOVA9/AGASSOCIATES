// Field-app database types — mirrors migration 20260518000000_field_app.sql.
//
// NOTE: packages/types/src/domain.ts declares aspirational UserRole + CaseStatus
// enums that do NOT match the current SQL ('admin'|'staff'|'applicant'|'executive'
// for roles; 5-value case_status enum from core_schema.sql). Until those are
// reconciled in a follow-up migration, use the literal unions below for any code
// that talks to Supabase directly.

export type DbUserRole = 'admin' | 'staff' | 'applicant' | 'executive';

export type DbCaseStatus =
    | 'Pending Intake'
    | 'Under Review'
    | 'In Progress'
    | 'Action Required'
    | 'Completed';

export type DocumentReceivedStatus =
    | 'received'
    | 'pending_review'
    | 'accepted'
    | 'rejected';

export type DevicePlatform = 'ios' | 'android';

export interface DocumentRow {
    id: string;
    client_event_id: string;
    case_id: string;
    org_id: string;
    uploader_id: string;
    storage_path: string;
    bucket_id: string;
    received_status: DocumentReceivedStatus;
    size_bytes: number | null;
    content_type: string | null;
    captured_at: string | null;
    captured_lat: number | null;
    captured_lon: number | null;
    created_at: string;
}

export interface CaseAuditLogRow {
    id: string;
    client_event_id: string;
    case_id: string;
    org_id: string;
    actor_id: string;
    from_status: DbCaseStatus | null;
    to_status: DbCaseStatus;
    note: string | null;
    gps_lat: number | null;
    gps_lon: number | null;
    occurred_at: string;
    created_at: string;
}

export interface FieldActivityLogRow {
    id: string;
    client_event_id: string;
    executive_id: string;
    org_id: string;
    recorded_at: string;
    lat: number;
    lon: number;
    accuracy_m: number | null;
    battery_pct: number | null;
    created_at: string;
}

export interface DevicePushTokenRow {
    id: string;
    user_id: string;
    org_id: string;
    expo_push_token: string;
    device_id: string;
    platform: DevicePlatform;
    app_version: string | null;
    revoked_at: string | null;
    last_seen_at: string;
    created_at: string;
}

// Insert payloads — client-side shapes for the mobile mutation queue.
// `client_event_id` is REQUIRED on the client; the server enforces UNIQUE.
export type DocumentInsert = Pick<
    DocumentRow,
    | 'client_event_id'
    | 'case_id'
    | 'org_id'
    | 'uploader_id'
    | 'storage_path'
> &
    Partial<
        Pick<
            DocumentRow,
            | 'bucket_id'
            | 'received_status'
            | 'size_bytes'
            | 'content_type'
            | 'captured_at'
            | 'captured_lat'
            | 'captured_lon'
        >
    >;

export type CaseAuditLogInsert = Pick<
    CaseAuditLogRow,
    'client_event_id' | 'case_id' | 'org_id' | 'actor_id' | 'to_status'
> &
    Partial<
        Pick<
            CaseAuditLogRow,
            'from_status' | 'note' | 'gps_lat' | 'gps_lon' | 'occurred_at'
        >
    >;

export type FieldActivityLogInsert = Pick<
    FieldActivityLogRow,
    'client_event_id' | 'executive_id' | 'org_id' | 'recorded_at' | 'lat' | 'lon'
> &
    Partial<Pick<FieldActivityLogRow, 'accuracy_m' | 'battery_pct'>>;

export type DevicePushTokenInsert = Pick<
    DevicePushTokenRow,
    'user_id' | 'org_id' | 'expo_push_token' | 'device_id' | 'platform'
> &
    Partial<Pick<DevicePushTokenRow, 'app_version'>>;
