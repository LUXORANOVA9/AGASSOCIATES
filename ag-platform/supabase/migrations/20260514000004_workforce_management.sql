-- Workforce Management System
-- Unified table for Human and Agentic staff

DO $$ BEGIN
    CREATE TYPE workforce_type AS ENUM ('human', 'agent');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE task_priority AS ENUM ('low', 'med', 'high', 'critical');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'completed', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 1. Workforce Members Table
CREATE TABLE IF NOT EXISTS public.workforce (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Null for agents
    name VARCHAR(255) NOT NULL,
    type workforce_type NOT NULL,
    role VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'active', -- active, busy, offline, maintenance
    avatar_url TEXT,
    load_score INTEGER DEFAULT 0, -- 0-100 for agents, active task count for humans
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Unified Tasks Table
CREATE TABLE IF NOT EXISTS public.workforce_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE,
    assigned_to UUID REFERENCES public.workforce(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    priority task_priority DEFAULT 'low',
    status task_status DEFAULT 'todo',
    output JSONB,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Brainstorm Hub Messages
CREATE TABLE IF NOT EXISTS public.brainstorm_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.workforce(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed Initial AI Agents into Workforce
INSERT INTO public.workforce (org_id, name, type, role, status)
SELECT 
    id, 
    'Vyasa Agent', 'agent', 'Legal Research & Strategy', 'active'
FROM public.organizations
WHERE name = 'AG Associates'
ON CONFLICT DO NOTHING;

INSERT INTO public.workforce (org_id, name, type, role, status)
SELECT 
    id, 
    'Executor Agent', 'agent', 'RPA & Execution', 'active'
FROM public.organizations
WHERE name = 'AG Associates'
ON CONFLICT DO NOTHING;

INSERT INTO public.workforce (org_id, name, type, role, status)
SELECT 
    id, 
    'Accountant Agent', 'agent', 'Financial Reconciliation', 'active'
FROM public.organizations
WHERE name = 'AG Associates'
ON CONFLICT DO NOTHING;

-- Enable RLS
ALTER TABLE public.workforce ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workforce_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brainstorm_messages ENABLE ROW LEVEL SECURITY;

-- Policies (Simplified for Phase 1)
CREATE POLICY "Workforce visibility" ON public.workforce FOR SELECT USING (true);
CREATE POLICY "Task visibility" ON public.workforce_tasks FOR SELECT USING (true);
CREATE POLICY "Brainstorm visibility" ON public.brainstorm_messages FOR SELECT USING (true);
