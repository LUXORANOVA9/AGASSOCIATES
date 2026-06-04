
-- 001_initial_schema.sql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ROLES ENUM
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('PRINCIPAL', 'ADVOCATE', 'EXECUTIVE', 'CLERK', 'BANK_VIEWER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CASE TYPES ENUM
DO $$ BEGIN
    CREATE TYPE case_type AS ENUM (
        'TITLE_SEARCH', 'LEGAL_VETTING', 'CTC', 'PROPERTY_REGISTRATION', 
        'MORTGAGE_REGISTRATION', 'INTIMATION_MORTGAGE', 'FRANKING', 
        'BALANCE_TRANSFER', 'PUBLIC_NOTICE', 'POWER_OF_ATTORNEY', 
        'LEAVE_AND_LICENSE', 'GIFT_DEED', 'MARKET_VALUATION'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CASE STATUS ENUM
DO $$ BEGIN
    CREATE TYPE case_status AS ENUM (
        'RECEIVED', 'ASSIGNED', 'DOCUMENT_COLLECTION', 'IN_PROGRESS', 
        'PENDING_REGISTRATION', 'REGISTERED', 'QUALITY_CHECK', 
        'DELIVERED', 'INVOICED', 'CLOSED', 'ON_HOLD', 'REJECTED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- DISBURSEMENT TYPES ENUM
DO $$ BEGIN
    CREATE TYPE disbursement_type AS ENUM (
        'STAMP_DUTY', 'REGISTRATION_FEE', 'FRANKING_CHARGE', 'CTC_FEE', 
        'CHALLAN_0_3_PCT', 'MTR_FEE', 'ESBTR_FEE', 'NEWSPAPER_CHARGE', 'OTHER'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- BANKS
CREATE TABLE IF NOT EXISTS banks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    short_code TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL CHECK (type IN ('BANK', 'NBFC')),
    billing_contact TEXT,
    advance_balance NUMERIC(15, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ORGANIZATIONS (Multi-tenancy)
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- USER PROFILES
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE, -- Link to auth.users if using Supabase Auth
    org_id UUID REFERENCES organizations(id),
    bank_id UUID REFERENCES banks(id), -- Only for BANK_VIEWER
    full_name TEXT NOT NULL,
    phone TEXT,
    role user_role NOT NULL DEFAULT 'EXECUTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- CASES
CREATE TABLE IF NOT EXISTS cases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_number TEXT UNIQUE NOT NULL,
    org_id UUID REFERENCES organizations(id) NOT NULL,
    bank_id UUID REFERENCES banks(id) NOT NULL,
    case_type case_type NOT NULL,
    status case_status NOT NULL DEFAULT 'RECEIVED',
    borrower_name TEXT NOT NULL,
    loan_amount NUMERIC(15, 2),
    received_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sla_deadline TIMESTAMP WITH TIME ZONE,
    assigned_executive_id UUID REFERENCES profiles(id),
    disbursement_total NUMERIC(15, 2) DEFAULT 0,
    professional_fee NUMERIC(15, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- DISBURSEMENTS
CREATE TABLE IF NOT EXISTS disbursements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
    type disbursement_type NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    paid_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_reimbursed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- CASE TIMELINE
CREATE TABLE IF NOT EXISTS case_timeline (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
    status_from case_status,
    status_to case_status NOT NULL,
    notes TEXT,
    changed_by UUID REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- TIMESHEETS (P5: Billing Engine)
CREATE TABLE IF NOT EXISTS timesheets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES organizations(id) NOT NULL,
    case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES profiles(id) NOT NULL,
    task_description TEXT NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER,
    is_billable BOOLEAN DEFAULT TRUE,
    hourly_rate NUMERIC(10, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- TRIGGERS for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_cases_updated_at ON cases;
CREATE TRIGGER update_cases_updated_at BEFORE UPDATE ON cases FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- SEED DATA
INSERT INTO organizations (name) VALUES ('AG Associates HQs') ON CONFLICT DO NOTHING;

INSERT INTO banks (name, short_code, type) VALUES 
('HDFC Bank', 'HDFC', 'BANK'),
('ICICI Bank', 'ICICI', 'BANK'),
('State Bank of India', 'SBI', 'BANK'),
('LIC Housing Finance', 'LICHFL', 'NBFC')
ON CONFLICT (short_code) DO NOTHING;

-- Create a internal principal profile
INSERT INTO profiles (full_name, role, org_id)
SELECT 'Head Advocate', 'PRINCIPAL', id FROM organizations LIMIT 1
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 002_team_members.sql  (advocate + N-staff model)
--
-- The organizations + profiles tables give us tenancy, but lack the
-- invite-by-email flow, per-staff role within a firm, on-duty toggle, and
-- telegram_chat_id binding that all three customer-facing features need:
--
--   1. OTP pull (Feature 3): intake-api routes incoming OTPs to the staff
--      row(s) in team_members where on_duty = true and bank matches.
--   2. Excel audit (Feature 2): org-scoped conversation history is keyed
--      off team_members.org_id.
--   3. NOI automation (Feature 1): only team_members with role IN
--      ('EXECUTIVE', 'ADVOCATE') can advance case status; only the row
--      with role = 'PRINCIPAL' (the advocate) can sign off on filing.
--
-- PRINCIPAL is reserved for the org owner (one per org); the
-- invite-then-join flow is for CLERK and EXECUTIVE staff.
-- ============================================================================

CREATE TABLE IF NOT EXISTS team_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- The advocate who owns the firm (PRINCIPAL of org). When a member
    -- accepts their invite, this becomes their supervisor.
    advocate_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- The staff profile. NULL while the invite is pending (no Supabase
    -- user yet); populated on first sign-in.
    member_id UUID REFERENCES profiles(id) ON DELETE SET NULL,

    -- The invited email. Captured at invite time; not necessarily the
    -- same as the staff's eventual sign-in email (Supabase auth is
    -- the source of truth for that).
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
    invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    invite_expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
    joined_at TIMESTAMP WITH TIME ZONE,
    deactivated_at TIMESTAMP WITH TIME ZONE,

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

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Prevent duplicate active memberships.
    CONSTRAINT unique_active_member_per_org
        EXCLUDE (org_id WITH =, member_id WITH =)
        WHERE (member_id IS NOT NULL AND seat_status = 'ACTIVE')
);

CREATE INDEX IF NOT EXISTS idx_team_members_org ON team_members(org_id);
CREATE INDEX IF NOT EXISTS idx_team_members_member ON team_members(member_id) WHERE member_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_team_members_invite_token ON team_members(invite_token) WHERE invite_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_team_members_advocate ON team_members(advocate_id);
CREATE INDEX IF NOT EXISTS idx_team_members_on_duty ON team_members(org_id, on_duty) WHERE seat_status = 'ACTIVE';

-- updated_at trigger
DROP TRIGGER IF EXISTS update_team_members_updated_at ON team_members;
CREATE TRIGGER update_team_members_updated_at BEFORE UPDATE ON team_members FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- RLS
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- Advocate (PRINCIPAL) sees all team members in their org.
DROP POLICY IF EXISTS "Advocate sees org team" ON team_members;
CREATE POLICY "Advocate sees org team"
    ON team_members FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid()
              AND p.org_id = team_members.org_id
              AND p.role = 'PRINCIPAL'
        )
    );

-- Staff see their own row only.
DROP POLICY IF EXISTS "Staff sees own row" ON team_members;
CREATE POLICY "Staff sees own row"
    ON team_members FOR SELECT
    USING (member_id = auth.uid());

-- Only the advocate can insert (invite) or update (deactivate, on_duty flip).
DROP POLICY IF EXISTS "Advocate manages team" ON team_members;
CREATE POLICY "Advocate manages team"
    ON team_members FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid()
              AND p.org_id = team_members.org_id
              AND p.role = 'PRINCIPAL'
        )
    );

-- Service role bypasses RLS (intake-api and telegram-bot run with the
-- service_role key and need to read/update team_members across orgs).

-- ============================================================================
-- 003_case_article_codes.sql
--
-- Maps each of the 13 case_types in the user_role enum to its corresponding
-- Article Code under the Maharashtra Stamp Act + the IGR Portal's MTR-6
-- form. The Supervisor agent (Agent 4 in the Intake Crew) reads this table
-- to populate the IGRPortalPayload with the right Article Code per case
-- type. The Fee Agent (design.md §5) reads statutory_fee_pct to compute
-- stamp duty = consideration_amount * statutory_fee_pct / 100.
--
-- IMPORTANT: article_code values are placeholders ('TO_FILL'). The exact
-- Article Codes per the Maharashtra Stamp Act + IGR MTR-6 form must be
-- filled in by Adv. Aditya (the user/principal) who knows the current
-- statutory mapping. The structure is right; the codes are not yet real.
-- Once filled, the Supervisor agent's IGR payload generation will work
-- end-to-end without hardcoding Article Codes in agent code.
-- ============================================================================

CREATE TABLE IF NOT EXISTS case_article_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- The case_type enum value. UNIQUE so the table is a 1:1 mapping.
    case_type case_type NOT NULL UNIQUE,

    -- The Article Code as it appears on the IGR MTR-6 form.
    -- Format: typically "Article N" or "Art-N" or numeric.
    -- Marked 'TO_FILL' until Adv. Aditya provides the actual codes.
    article_code TEXT NOT NULL DEFAULT 'TO_FILL',

    -- The statutory act this Article falls under (e.g. "Indian Stamp Act",
    -- "Maharashtra Stamp Act", "Registration Act 1908"). Filled by user.
    statutory_act TEXT NOT NULL DEFAULT 'TO_FILL',

    -- The fee/charge percentage as a decimal (e.g. 0.30 for 0.3% mortgage
    -- stamp duty per design.md §4). Filled by user; the Bouncer agent
    -- uses this to validate consideration_amount * fee_pct against
    -- declared stamp_duty_paid.
    statutory_fee_pct NUMERIC(5, 3) DEFAULT 0,

    -- Human-readable description of the case type as it should appear
    -- on the MTR-6 form (e.g. "Leave and Licence Agreement" for
    -- LEAVE_AND_LICENSE). Filled by user.
    mtr6_description TEXT NOT NULL DEFAULT 'TO_FILL',

    -- Whether this case type requires a physical SRO visit.
    -- TRUE = field executive must visit the SRO counter (e.g. PROPERTY_
    -- REGISTRATION, MORTGAGE_REGISTRATION). FALSE = can be done online.
    requires_sro_visit BOOLEAN NOT NULL DEFAULT FALSE,

    -- Whether this case type requires a NoC (No Objection Certificate)
    -- from a third party (society, previous owner, bank).
    requires_noc BOOLEAN NOT NULL DEFAULT FALSE,

    -- Optional notes for the Supervisor agent (e.g. "DTD required for
    -- loans > 20L" or "Form 60 mandatory for cash > 50K").
    notes TEXT,

    -- Validation flag: TRUE only after Adv. Aditya has reviewed the
    -- article_code, statutory_act, and statutory_fee_pct for this row.
    -- The Intake Crew refuses to file a case whose case_type has
    -- validated = FALSE.
    validated_by_principal BOOLEAN NOT NULL DEFAULT FALSE,
    validated_at TIMESTAMPTZ,
    validated_by UUID REFERENCES profiles(id),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed: 13 rows for the 13 case_types, all in TO_FILL state.
INSERT INTO case_article_codes (case_type) VALUES
    ('TITLE_SEARCH'),
    ('LEGAL_VETTING'),
    ('CTC'),
    ('PROPERTY_REGISTRATION'),
    ('MORTGAGE_REGISTRATION'),
    ('INTIMATION_MORTGAGE'),
    ('FRANKING'),
    ('BALANCE_TRANSFER'),
    ('PUBLIC_NOTICE'),
    ('POWER_OF_ATTORNEY'),
    ('LEAVE_AND_LICENSE'),
    ('GIFT_DEED'),
    ('MARKET_VALUATION')
ON CONFLICT (case_type) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_case_article_codes_validated
    ON case_article_codes(validated_by_principal)
    WHERE validated_by_principal = FALSE;

DROP TRIGGER IF EXISTS update_case_article_codes_updated_at ON case_article_codes;
CREATE TRIGGER update_case_article_codes_updated_at
    BEFORE UPDATE ON case_article_codes
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
