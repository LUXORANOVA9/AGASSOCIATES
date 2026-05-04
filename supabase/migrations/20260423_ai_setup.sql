-- Set up vector extension and AI-related tables

CREATE EXTENSION IF NOT EXISTS vector;

-- Project embeddings for semantic search
CREATE TABLE IF NOT EXISTS public.project_embeddings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding vector(768), -- Gemini uses 768 dimensions
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Note: Depending on existing projects table schema, this links back to them.
-- If projects does not exist, let's create it for safety since this is an isolated script check
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Match function for pgvector
CREATE OR REPLACE FUNCTION match_projects(
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  org_id UUID
)
RETURNS TABLE (
  project_id UUID,
  content TEXT,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pe.project_id,
    pe.content,
    1 - (pe.embedding <=> query_embedding) AS similarity
  FROM project_embeddings pe
  INNER JOIN projects p ON p.id = pe.project_id
  WHERE p.organization_id = org_id
    AND 1 - (pe.embedding <=> query_embedding) > match_threshold
  ORDER BY pe.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- AI Credits tracking logic
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS ai_tokens_used BIGINT DEFAULT 0;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS ai_tokens_limit BIGINT DEFAULT 100000; -- 100k starting limit
