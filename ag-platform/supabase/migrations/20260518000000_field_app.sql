-- Phase 0: field-app foundation
--
-- Adds the schema surface the React Native field app depends on:
--   1. cases.executive_id        — who's assigned in the field
--   2. user_roles + 'executive'  — fourth role; existing app uses admin/staff/applicant
--   3. documents                 — per-case vault (was referenced but never created)
--   4. case_audit_logs           — state machine transitions (was referenced)
--   5. field_activity_logs       — GPS breadcrumbs
--   6. device_push_tokens        — Expo push token registry
--
-- Every mutation-eligible table carries client_event_id UUID UNIQUE so the
-- mobile offline queue can replay safely (server-side dedup, not client).

-- 1. Allow 'executive' as a fourth role on user_roles
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check;
ALTER TABLE public.user_roles
    ADD CONSTRAINT user_roles_role_check
    CHECK (role IN ('admin', 'staff', 'applicant', 'executive'));

-- 2. Augment cases with executive assignment
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS executive_id UUID REFERENCES auth.users(id);
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS assigned_at  TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_cases_executive_id ON public.cases(executive_id);

CREATE POLICY "Executive can read assigned cases"
    ON public.cases
    FOR SELECT
    USING (executive_id = auth.uid() AND org_id = public.get_app_org_id());

-- 3. documents — per-case vault
CREATE TABLE IF NOT EXISTS public.documents (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_event_id  UUID UNIQUE NOT NULL,
    case_id          UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
    org_id           UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    uploader_id      UUID NOT NULL REFERENCES auth.users(id),
    storage_path     TEXT NOT NULL,
    bucket_id        TEXT NOT NULL DEFAULT 'documents',
    received_status  TEXT NOT NULL DEFAULT 'received'
        CHECK (received_status IN ('received', 'pending_review', 'accepted', 'rejected')),
    size_bytes       BIGINT,
    content_type     TEXT,
    captured_at      TIMESTAMPTZ,
    captured_lat     NUMERIC(9, 6),
    captured_lon     NUMERIC(9, 6),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_documents_case_id ON public.documents(case_id);
CREATE INDEX IF NOT EXISTS idx_documents_org_id  ON public.documents(org_id);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read documents in own org"
    ON public.documents FOR SELECT
    USING (org_id = public.get_app_org_id());

CREATE POLICY "Insert documents in own org as uploader"
    ON public.documents FOR INSERT
    WITH CHECK (org_id = public.get_app_org_id() AND uploader_id = auth.uid());

-- 4. case_audit_logs — state machine transitions
CREATE TABLE IF NOT EXISTS public.case_audit_logs (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_event_id  UUID UNIQUE NOT NULL,
    case_id          UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
    org_id           UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    actor_id         UUID NOT NULL REFERENCES auth.users(id),
    from_status      case_status,
    to_status        case_status NOT NULL,
    note             TEXT,
    gps_lat          NUMERIC(9, 6),
    gps_lon          NUMERIC(9, 6),
    occurred_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_case_audit_logs_case_time
    ON public.case_audit_logs(case_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_case_audit_logs_org_id
    ON public.case_audit_logs(org_id);

ALTER TABLE public.case_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read audit logs in own org"
    ON public.case_audit_logs FOR SELECT
    USING (org_id = public.get_app_org_id());

CREATE POLICY "Insert audit logs as self in own org"
    ON public.case_audit_logs FOR INSERT
    WITH CHECK (actor_id = auth.uid() AND org_id = public.get_app_org_id());

-- 5. field_activity_logs — GPS breadcrumbs while "on duty"
CREATE TABLE IF NOT EXISTS public.field_activity_logs (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_event_id  UUID UNIQUE NOT NULL,
    executive_id     UUID NOT NULL REFERENCES auth.users(id),
    org_id           UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    recorded_at      TIMESTAMPTZ NOT NULL,
    lat              NUMERIC(9, 6) NOT NULL,
    lon              NUMERIC(9, 6) NOT NULL,
    accuracy_m       NUMERIC(7, 2),
    battery_pct      SMALLINT CHECK (battery_pct BETWEEN 0 AND 100),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_field_activity_logs_exec_time
    ON public.field_activity_logs(executive_id, recorded_at DESC);

ALTER TABLE public.field_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read own activity logs"
    ON public.field_activity_logs FOR SELECT
    USING (executive_id = auth.uid());

CREATE POLICY "Insert own activity logs"
    ON public.field_activity_logs FOR INSERT
    WITH CHECK (executive_id = auth.uid() AND org_id = public.get_app_org_id());

-- 6. device_push_tokens — Expo push registry
CREATE TABLE IF NOT EXISTS public.device_push_tokens (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    org_id           UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    expo_push_token  TEXT UNIQUE NOT NULL,
    device_id        TEXT NOT NULL,
    platform         TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
    app_version      TEXT,
    revoked_at       TIMESTAMPTZ,
    last_seen_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, device_id)
);
CREATE INDEX IF NOT EXISTS idx_device_push_tokens_active_user
    ON public.device_push_tokens(user_id)
    WHERE revoked_at IS NULL;

ALTER TABLE public.device_push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Manage own push tokens"
    ON public.device_push_tokens
    FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
