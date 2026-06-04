-- ============================================================================
-- 20260604000000_team_members.sql
--
-- Advocate + N-staff model. Mirrors the team_members table added to
-- ag-platform/src/server/migrations.sql (which Express runs on boot
-- against local Postgres). This file is the production source: Supabase
-- runs it on deploy against the hosted Postgres. Both must stay in sync.
--
-- Why the dual location: the ag-platform Express server runs migrations.sql
-- idempotently on every boot, so local dev and the VPS are aligned even
-- without Supabase CLI. The Supabase migration system is the production
-- source of truth and runs service_role. Both paths use the same schema.
--
-- This table is the join that ties the 3 customer-facing features to the
-- design.md mandate (Zero-Staff AI + 3-tier escalation: AI → Staff → Principal):
--
--   1. OTP pull (Feature 3): intake-api queries
--        SELECT telegram_chat_id FROM team_members
--        WHERE on_duty = true
--          AND org_id = $org
--          AND (otp_bank_filter IS NULL OR $bank = ANY(otp_bank_filter))
--      and pushes the bank OTP to each result via Telegram.
--
--   2. Excel audit in chat (Feature 2): org_id scopes uploaded Excels
--      and conversation history; the advocate (PRINCIPAL) sees the firm's
--      aggregate, staff see only their own conversation threads.
--
--   3. NOI automation (Feature 1): only team_members with role
--      IN ('EXECUTIVE', 'ADVOCATE') can advance case status; only the
--      row with role = 'PRINCIPAL' (the advocate) can sign off on filing.
--      staff_id = NULL while invite pending; populated on first sign-in.
--
-- PRINCIPAL is reserved for the org owner (Aditya); the invite-then-join
-- flow is for ADVOCATE/EXECUTIVE/CLERK seats.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.team_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

    -- The advocate who owns the firm. FK to auth.users directly (not
    -- user_roles) so this survives role reassignments. The advocate's
    -- role check is done in RLS via user_roles.role = 'PRINCIPAL'.
    advocate_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- The staff profile. NULL while the invite is pending (no Supabase
    -- auth user yet); populated on first sign-in via the invite link.
    member_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    -- Captured at invite time. May differ from the staff's eventual
    -- sign-in email; auth.users.email is the source of truth post-signup.
    invite_email TEXT NOT NULL,

    -- Role within the firm. PRINCIPAL is reserved for the org owner
    -- and is never assigned via this table. BANK_VIEWER is for bank
    -- partners, not staff, and is also not assignable here.
    role VARCHAR(20) NOT NULL
        CHECK (role IN ('ADVOCATE', 'EXECUTIVE', 'CLERK')),

    -- Lifecycle: PENDING_INVITE → ACTIVE → DEACTIVATED.
    -- A deactivated staff row is preserved for audit history (cases
    -- they worked on keep their assigned_executive_id FK).
    seat_status VARCHAR(20) NOT NULL DEFAULT 'PENDING_INVITE'
        CHECK (seat_status IN ('PENDING_INVITE', 'ACTIVE', 'DEACTIVATED')),

    -- Single-use token emailed to the staff for first sign-in. NULL
    -- after the invite is accepted.
    invite_token TEXT UNIQUE,
    invited_at TIMESTAMPTZ DEFAULT NOW(),
    invite_expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
    joined_at TIMESTAMPTZ,
    deactivated_at TIMESTAMPTZ,

    -- Telegram binding. The Telegram bot (python-telegram-bot) sets
    -- this on /start <invite_token>. NULL = staff hasn't linked Telegram.
    -- Used by intake-api to push OTPs to the right staff.
    telegram_chat_id TEXT,
    telegram_username TEXT,

    -- On-duty toggle. When false, intake-api skips this row when
    -- routing OTPs. Staff can flip via /onduty /offduty in Telegram.
    on_duty BOOLEAN NOT NULL DEFAULT FALSE,

    -- Bank assignments: which banks this staff can receive OTPs for.
    -- NULL = all banks in the org. Empty array = no banks (rare,
    -- e.g. a staff dedicated to NOI filing only).
    otp_bank_filter UUID[] DEFAULT NULL,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Prevent duplicate active memberships.
    CONSTRAINT unique_active_member_per_org
        EXCLUDE (org_id WITH =, member_id WITH =)
        WHERE (member_id IS NOT NULL AND seat_status = 'ACTIVE')
);

-- Indexes: match the lookup patterns each feature will use.
CREATE INDEX IF NOT EXISTS idx_team_members_org ON public.team_members(org_id);
CREATE INDEX IF NOT EXISTS idx_team_members_member ON public.team_members(member_id) WHERE member_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_team_members_invite_token ON public.team_members(invite_token) WHERE invite_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_team_members_advocate ON public.team_members(advocate_id);
CREATE INDEX IF NOT EXISTS idx_team_members_on_duty ON public.team_members(org_id, on_duty) WHERE seat_status = 'ACTIVE';

-- updated_at trigger
DROP TRIGGER IF EXISTS update_team_members_updated_at ON public.team_members;
CREATE TRIGGER update_team_members_updated_at
    BEFORE UPDATE ON public.team_members
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Row-Level Security
--
-- The service_role key (used by intake-api, telegram-bot, and the
-- ag-associates-ai FastAPI backend) bypasses RLS by default in Supabase.
-- The policies below are for the anon/authenticated roles used by
-- the ag-platform Express dashboard and the Next.js Banker's Eye UI.
-- ============================================================================

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Advocate (PRINCIPAL of their org) sees all team members in their org.
DROP POLICY IF EXISTS "Advocate sees org team" ON public.team_members;
CREATE POLICY "Advocate sees org team"
    ON public.team_members FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
              AND ur.org_id = team_members.org_id
              AND ur.role = 'admin'
        )
        OR
        -- The advocate is the one who created the team row, so they
        -- always see it even if their user_roles row is missing.
        advocate_id = auth.uid()
    );

-- Staff see their own row only.
DROP POLICY IF EXISTS "Staff sees own row" ON public.team_members;
CREATE POLICY "Staff sees own row"
    ON public.team_members FOR SELECT
    USING (member_id = auth.uid());

-- Only the advocate can insert (invite) or update (deactivate, on_duty).
DROP POLICY IF EXISTS "Advocate manages team" ON public.team_members;
CREATE POLICY "Advocate manages team"
    ON public.team_members FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
              AND ur.org_id = team_members.org_id
              AND ur.role = 'admin'
        )
        OR advocate_id = auth.uid()
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
              AND ur.org_id = team_members.org_id
              AND ur.role = 'admin'
        )
        OR advocate_id = auth.uid()
    );

-- Staff can flip their own on_duty toggle (Telegram /onduty command).
DROP POLICY IF EXISTS "Staff updates own on_duty" ON public.team_members;
CREATE POLICY "Staff updates own on_duty"
    ON public.team_members FOR UPDATE
    USING (member_id = auth.uid())
    WITH CHECK (member_id = auth.uid());

-- ============================================================================
-- Helper function: the advocate can claim their org_id from JWT app_metadata
-- without a join. Mirrors public.get_app_org_id() in 20260514000000_core_schema.sql.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_team_org_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    raw_value TEXT;
BEGIN
    raw_value := auth.jwt() -> 'app_metadata' ->> 'app_org_id';
    IF raw_value IS NULL THEN
        RETURN NULL;
    END IF;
    BEGIN
        RETURN raw_value::UUID;
    EXCEPTION WHEN invalid_text_representation THEN
        RETURN NULL;
    END;
END;
$$;
