
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
    'TITLE_SEARCH',
    'LEGAL_VETTING',
    'CTC',
    'PROPERTY_REGISTRATION',
    'MORTGAGE_REGISTRATION',
    'INTIMATION_MORTGAGE',
    'FRANKING',
    'BALANCE_TRANSFER',
    'PUBLIC_NOTICE',
    'POWER_OF_ATTORNEY',
    'LEAVE_AND_LICENSE',
    'GIFT_DEED',
    'MARKET_VALUATION'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Extend case_type enum with financial types (runs on existing DB too)
DO $$ BEGIN
    ALTER TYPE case_type ADD VALUE IF NOT EXISTS 'HOME_LOAN';
    ALTER TYPE case_type ADD VALUE IF NOT EXISTS 'LOAN_AGAINST_PROPERTY';
    ALTER TYPE case_type ADD VALUE IF NOT EXISTS 'MACHINERY_LOAN';
    ALTER TYPE case_type ADD VALUE IF NOT EXISTS 'PROJECT_LOAN';
EXCEPTION WHEN others THEN null;
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

-- DOCUMENTS (files linked to cases)
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID REFERENCES cases(id) ON DELETE CASCADE NOT NULL,
    org_id UUID REFERENCES organizations(id) NOT NULL,
    uploader_id UUID REFERENCES profiles(id),
    name TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    bucket_id TEXT NOT NULL DEFAULT 'case-documents',
    content_type TEXT,
    size_bytes BIGINT DEFAULT 0,
    category TEXT,
    version_number INTEGER DEFAULT 1,
    parent_file_id UUID REFERENCES documents(id),
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_case_id ON documents(case_id);
CREATE INDEX IF NOT EXISTS idx_documents_org_id ON documents(org_id);

-- FILES (Supabase mirror for storage uploads)
CREATE TABLE IF NOT EXISTS files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id),
    project_id UUID,
    uploader_id TEXT,
    name TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    bucket_id TEXT NOT NULL DEFAULT 'case-documents',
    size_bytes BIGINT DEFAULT 0,
    content_type TEXT,
    version_number INTEGER DEFAULT 1,
    parent_file_id UUID,
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
INSERT INTO organizations (id, name) VALUES ('7f45dc5f-6bef-4fae-b46a-a2306e69936d', 'AG Associates HQs') ON CONFLICT DO NOTHING;

INSERT INTO banks (id, name, short_code, type) VALUES 
('7407ac8f-0cb7-434e-994c-4329a11939a7', 'HDFC Bank', 'HDFC', 'BANK'),
('2a32c22f-e7a2-487c-b9de-2bfd51455080', 'ICICI Bank', 'ICICI', 'BANK'),
('f4bfbc33-985d-4368-9b95-85c9bb6bf77f', 'State Bank of India', 'SBI', 'BANK'),
('acb64097-628f-45e9-8d66-88c21d410dee', 'LIC Housing Finance', 'LICHFL', 'NBFC')
ON CONFLICT (short_code) DO NOTHING;

-- Create a internal principal profile (fixed ID for dev consistency)
INSERT INTO profiles (id, full_name, role, org_id) 
SELECT '28a4eb7d-162c-4161-817d-20c30ffa5f46', 'Head Advocate', 'PRINCIPAL', id FROM organizations LIMIT 1
ON CONFLICT DO NOTHING;
