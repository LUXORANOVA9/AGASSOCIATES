-- NOI Pipeline — Case Management Tables
-- Part of Phase A: case management, task orchestration, challan generation

-- 1. NOI Cases
CREATE TABLE IF NOT EXISTS noi_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) NOT NULL,
  client_name TEXT NOT NULL,
  client_contact TEXT,
  property_details JSONB DEFAULT '{}'::jsonb,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'intake',
  telegram_group_id BIGINT,
  assigned_staff TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE noi_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can CRUD their org cases"
  ON noi_cases
  FOR ALL
  TO authenticated
  USING (org_id = get_app_org_id());

CREATE INDEX idx_noi_cases_org_status ON noi_cases(org_id, status);
CREATE INDEX idx_noi_cases_assigned ON noi_cases(assigned_staff) WHERE assigned_staff IS NOT NULL;

-- 2. NOI Tasks
CREATE TABLE IF NOT EXISTS noi_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES noi_cases(id) ON DELETE CASCADE NOT NULL,
  agent TEXT NOT NULL,
  task_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payload JSONB DEFAULT '{}'::jsonb,
  result JSONB DEFAULT '{}'::jsonb,
  depends_on UUID[] DEFAULT ARRAY[]::UUID[],
  created_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE noi_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can CRUD tasks via case org"
  ON noi_tasks
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM noi_cases c
      WHERE c.id = noi_tasks.case_id
      AND c.org_id = get_app_org_id()
    )
  );

CREATE INDEX idx_noi_tasks_case ON noi_tasks(case_id);
CREATE INDEX idx_noi_tasks_status ON noi_tasks(status);

-- 3. Challans
CREATE TABLE IF NOT EXISTS challans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES noi_cases(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  description TEXT,
  pdf_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  approved_by TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE challans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can CRUD challans via case org"
  ON challans
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM noi_cases c
      WHERE c.id = challans.case_id
      AND c.org_id = get_app_org_id()
    )
  );

CREATE INDEX idx_challans_case ON challans(case_id);
CREATE INDEX idx_challans_status ON challans(status);

-- 4. Updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_noi_cases_updated_at
  BEFORE UPDATE ON noi_cases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_noi_tasks_updated_at
  BEFORE UPDATE ON noi_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_challans_updated_at
  BEFORE UPDATE ON challans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 5. Status enum constraint (soft enum via check)
ALTER TABLE noi_cases DROP CONSTRAINT IF EXISTS check_noi_case_status;
ALTER TABLE noi_cases ADD CONSTRAINT check_noi_case_status
  CHECK (status IN ('intake', 'documents', 'challan', 'otp_collection', 'portal_submission', 'verification', 'completed', 'cancelled'));

ALTER TABLE noi_tasks DROP CONSTRAINT IF EXISTS check_noi_task_status;
ALTER TABLE noi_tasks ADD CONSTRAINT check_noi_task_status
  CHECK (status IN ('pending', 'running', 'awaiting_otp', 'completed', 'failed'));

ALTER TABLE challans DROP CONSTRAINT IF EXISTS check_challan_status;
ALTER TABLE challans ADD CONSTRAINT check_challan_status
  CHECK (status IN ('pending', 'approved', 'paid', 'cancelled'));
