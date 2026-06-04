-- AG Associates Workforce Control Plane
--
-- Unifies AI agents (Aisha, Vyasa, Drafter, Executor, Auditor, Accountant,
-- Vox) and offline humans (field executives, advocates, clerks) under one
-- roster + one activity ledger so an admin can manage everything from a
-- single panel.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$ BEGIN
    CREATE TYPE staff_kind AS ENUM ('agent', 'human');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE staff_state AS ENUM ('online', 'idle', 'offline', 'disabled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE activity_source AS ENUM ('agent', 'human', 'voice', 'system');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1. Unified roster ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS staff (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kind            staff_kind NOT NULL,
    display_name    TEXT NOT NULL,
    short_name      TEXT,              -- 'aisha', 'suresh' — used in logs
    -- agent-specific:
    agent_module    TEXT,              -- python import path, e.g. 'agents.aisha'
    -- human-specific:
    auth_user_id    UUID,              -- Supabase auth.users.id when known
    phone           TEXT,
    email           TEXT,
    -- status:
    state           staff_state NOT NULL DEFAULT 'idle',
    last_heartbeat  TIMESTAMPTZ,
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (kind, short_name)
);

CREATE INDEX IF NOT EXISTS idx_staff_state ON staff(state);
CREATE INDEX IF NOT EXISTS idx_staff_kind  ON staff(kind);

-- 2. Capability registry ----------------------------------------------------
-- One row per atomic capability. Tools, case-state transitions, voice tools,
-- mobile actions — all normalized here so the admin sees one matrix.
CREATE TABLE IF NOT EXISTS capability (
    code        TEXT PRIMARY KEY,           -- e.g. 'case.transition.deliver'
    label       TEXT NOT NULL,
    category    TEXT NOT NULL,              -- 'agent_tool' | 'case' | 'voice' | 'mobile'
    risk        TEXT NOT NULL DEFAULT 'low' -- 'low' | 'med' | 'high'
);

-- 3. Role bindings (staff × capability) -------------------------------------
CREATE TABLE IF NOT EXISTS staff_capability (
    staff_id        UUID NOT NULL REFERENCES staff(id)      ON DELETE CASCADE,
    capability_code TEXT NOT NULL REFERENCES capability(code) ON DELETE CASCADE,
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    granted_by      TEXT,                   -- admin user_id who toggled it
    granted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (staff_id, capability_code)
);

-- 4. Unified activity ledger ------------------------------------------------
-- Every agentic step AND every human action lands here. The existing
-- voice_command_logs / case_audit_logs / mobile sync writers should also
-- mirror into this table (or be replaced by it over time).
CREATE TABLE IF NOT EXISTS staff_activity (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    staff_id        UUID REFERENCES staff(id) ON DELETE SET NULL,
    source          activity_source NOT NULL,
    capability_code TEXT REFERENCES capability(code) ON DELETE SET NULL,
    case_id         UUID,                   -- nullable — not every action is case-bound
    summary         TEXT NOT NULL,          -- "Generated draft v3", "Cheque deposited @ ICICI Vashi"
    payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
    status          TEXT NOT NULL DEFAULT 'ok',  -- ok | warn | error
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_activity_staff_time
    ON staff_activity(staff_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_staff_activity_case
    ON staff_activity(case_id);
CREATE INDEX IF NOT EXISTS idx_staff_activity_source
    ON staff_activity(source, occurred_at DESC);

-- 5. RLS (admins see everything, staff see their own activity) -------------
ALTER TABLE staff           ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_activity  ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_capability ENABLE ROW LEVEL SECURITY;
ALTER TABLE capability      ENABLE ROW LEVEL SECURITY;

-- Helper: who is the caller staff record?
CREATE OR REPLACE FUNCTION public.current_staff_id()
RETURNS UUID
LANGUAGE sql STABLE AS $$
    SELECT id FROM staff WHERE auth_user_id = auth.uid() LIMIT 1
$$;

CREATE POLICY "staff_self_read"      ON staff
    FOR SELECT USING (auth_user_id = auth.uid() OR auth.role() = 'service_role');
CREATE POLICY "staff_admin_all"      ON staff
    FOR ALL    USING (auth.role() = 'service_role');

CREATE POLICY "capability_read"      ON capability
    FOR SELECT USING (true);

CREATE POLICY "staff_cap_self_read"  ON staff_capability
    FOR SELECT USING (staff_id = public.current_staff_id() OR auth.role() = 'service_role');
CREATE POLICY "staff_cap_admin_all"  ON staff_capability
    FOR ALL    USING (auth.role() = 'service_role');

CREATE POLICY "activity_self_read"   ON staff_activity
    FOR SELECT USING (staff_id = public.current_staff_id() OR auth.role() = 'service_role');
CREATE POLICY "activity_admin_all"   ON staff_activity
    FOR ALL    USING (auth.role() = 'service_role');

-- 6. Seed agents and capabilities ------------------------------------------
INSERT INTO staff (kind, display_name, short_name, agent_module) VALUES
    ('agent', 'Aisha (Intake)',     'aisha',      'agents.aisha_intake_node'),
    ('agent', 'Vyasa (Research)',   'vyasa',      'vyasa_agent.vyasa_agent'),
    ('agent', 'Drafter',            'drafter',    'agents.drafter_node'),
    ('agent', 'Executor (RPA)',     'executor',   'executor_agent.executor_agent'),
    ('agent', 'Auditor',            'auditor',    'agents.auditor_node'),
    ('agent', 'Accountant',         'accountant', 'accountant_agent.AccountantAgent'),
    ('agent', 'V.O.X. (Voice)',     'vox',        'voice.voice_api')
ON CONFLICT (kind, short_name) DO NOTHING;

INSERT INTO capability (code, label, category, risk) VALUES
    ('case.intake',                  'Process new intake',          'agent_tool', 'low'),
    ('case.research',                'Run legal opinion',           'agent_tool', 'low'),
    ('case.draft',                   'Draft agreement',             'agent_tool', 'med'),
    ('case.audit',                   'Audit drafted document',      'agent_tool', 'low'),
    ('case.execute.gras',            'File on GRAS portal',         'agent_tool', 'high'),
    ('case.reconcile.bank',          'Reconcile bank statement',    'agent_tool', 'med'),
    ('case.transition.collect',      'Mark document collected',     'case',       'low'),
    ('case.transition.deposit',      'Mark cheque deposited',       'case',       'med'),
    ('case.transition.register',     'Mark registered at SRO',      'case',       'med'),
    ('case.transition.deliver',      'Mark delivered to client',    'case',       'low'),
    ('case.transition.invoice',      'Issue invoice',               'case',       'high'),
    ('voice.command',                'Issue voice command',         'voice',      'low'),
    ('mobile.scan_document',         'Scan document on mobile',     'mobile',     'low'),
    ('mobile.gps_checkin',           'GPS check-in at SRO',         'mobile',     'low')
ON CONFLICT (code) DO NOTHING;
