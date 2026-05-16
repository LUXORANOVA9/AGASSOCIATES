-- Enable pgvector extension for Document Intelligence Flywheel
CREATE EXTENSION IF NOT EXISTS vector;

-- Enums
CREATE TYPE bank_partner AS ENUM ('ICICI', 'KOTAK', 'AXIS', 'KARUR_VYSYA', 'MUTHOOT', 'CHOLAMANDALAM');
CREATE TYPE case_status AS ENUM ('PENDING_INTAKE', 'NEEDS_REVIEW', 'OCR_COMPLETED', 'DRAFTED', 'EXECUTED_GRAS', 'PAID', 'CRITICAL_ERROR');

-- Organizations Table (Multi-Tenancy Root)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Core Cases Table (Strict Multi-Tenancy & Bank Isolation)
CREATE TABLE cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    bank_name bank_partner NOT NULL,
    client_name VARCHAR(255),
    pan_number VARCHAR(10),
    consideration_amount NUMERIC(15, 2),
    stamp_duty_paid NUMERIC(15, 2),
    status case_status DEFAULT 'PENDING_INTAKE',
    document_embedding vector(384), -- Powering the RAG/pgvector search
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_cases_org_id ON cases(org_id);
CREATE INDEX IF NOT EXISTS idx_cases_bank_name ON cases(bank_name);
CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_org_status ON cases(org_id, status);

-- Enable Row-Level Security
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Internal Staff (Can see/modify everything within their org_id).
-- WITH CHECK mirrors USING so INSERT/UPDATE can't insert rows into another org.
CREATE POLICY "Internal Staff Org Isolation" ON cases
    FOR ALL
    USING (
        auth.uid() IN (
            SELECT user_id FROM user_roles WHERE role = 'STAFF' AND org_id = cases.org_id
        )
    )
    WITH CHECK (
        auth.uid() IN (
            SELECT user_id FROM user_roles WHERE role = 'STAFF' AND org_id = cases.org_id
        )
    );

-- RLS Policy: BANK_VIEWER (Can ONLY see cases belonging to their specific bank partner)
CREATE POLICY "Bank Viewer Isolation" ON cases
    FOR SELECT
    USING (
        auth.uid() IN (
            SELECT user_id FROM user_roles WHERE role = 'BANK_VIEWER' 
            AND org_id = cases.org_id 
            AND bank_access = cases.bank_name::text
        )
    );
