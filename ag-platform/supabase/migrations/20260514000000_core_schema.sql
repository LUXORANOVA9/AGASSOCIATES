-- Extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create Enums
CREATE TYPE bank_partner AS ENUM ('ICICI', 'Kotak', 'Axis', 'Muthoot', 'HDFC');
CREATE TYPE case_type_enum AS ENUM (
  'NOI', 'CTC', 'Title Search', 'Legal Vetting', 'Mortgage Registration',
  'Document Execution', 'Property Valuation', 'Stamp Duty Calculation',
  'Disbursement Memo', 'Query Resolution', 'Post Disbursement Document',
  'CERSAI Registration', 'Closure'
);
CREATE TYPE case_status AS ENUM (
  'Pending Intake', 'Under Review', 'In Progress', 'Action Required', 'Completed'
);

-- 2. Organizations Table (for Multi-tenancy)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Cases Table
CREATE TABLE cases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    bank_name bank_partner NOT NULL,
    case_type case_type_enum NOT NULL,
    status case_status NOT NULL DEFAULT 'Pending Intake',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Updated At Trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_cases_updated_at
    BEFORE UPDATE ON cases
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 5. Performance: index org_id since RLS predicates always filter on it.
CREATE INDEX IF NOT EXISTS idx_cases_org_id ON cases(org_id);

-- 6. Safe UUID extractor — returns NULL instead of erroring on malformed JWT values.
CREATE OR REPLACE FUNCTION public.get_app_org_id()
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

-- 7. Row-Level Security (RLS) Configuration
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;

-- 8. RLS Policy: Users can only SELECT rows matching their JWT's org_id
-- We assume the JWT contains `app_metadata` with `app_org_id`
CREATE POLICY "Bank Viewer can read their own organization's cases"
ON cases
FOR SELECT
USING (
  org_id = public.get_app_org_id()
);

-- Note: Similar policies should be added for INSERT/UPDATE/DELETE 
-- depending on the user's role (e.g., 'Bank Viewer' might only have SELECT access).
