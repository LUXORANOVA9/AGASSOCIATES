
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
    user_id UUID UNIQUE,
    org_id UUID REFERENCES organizations(id),
    bank_id UUID REFERENCES banks(id),
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

-- TRIGGERS for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_cases_updated_at BEFORE UPDATE ON cases FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- SEED DATA
INSERT INTO organizations (name) VALUES ('AG Associates HQs') ON CONFLICT DO NOTHING;

INSERT INTO banks (name, short_code, type) VALUES
('HDFC Bank', 'HDFC', 'BANK'),
('ICICI Bank', 'ICICI', 'BANK'),
('State Bank of India', 'SBI', 'BANK'),
('LIC Housing Finance', 'LICHFL', 'NBFC')
ON CONFLICT (short_code) DO NOTHING;

INSERT INTO profiles (full_name, role, org_id)
SELECT 'Head Advocate', 'PRINCIPAL', id FROM organizations LIMIT 1
ON CONFLICT DO NOTHING;
