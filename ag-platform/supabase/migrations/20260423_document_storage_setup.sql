-- Supabase Storage & File Management Setup

-- 1. Create Buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('org-assets', 'org-assets', true, 104857600, ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml']),
  ('project-files', 'project-files', false, 104857600, ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'image/png', 'image/jpeg', 'video/mp4']),
  ('invoice-pdfs', 'invoice-pdfs', false, 104857600, ARRAY['application/pdf']),
  ('profile-avatars', 'profile-avatars', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET 
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Create Files Metadata & Versioning Table
CREATE TABLE IF NOT EXISTS public.files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  uploader_id UUID NOT NULL REFERENCES auth.users(id),
  name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  bucket_id TEXT NOT NULL,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  content_type TEXT,
  version_number INT DEFAULT 1,
  parent_file_id UUID REFERENCES public.files(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_archived BOOLEAN DEFAULT FALSE
);

-- 3. Storage Quota System
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS storage_used_bytes BIGINT DEFAULT 0;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS storage_quota_bytes BIGINT DEFAULT 5368709120; -- 5GB default

CREATE OR REPLACE FUNCTION update_storage_quota()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.organizations SET storage_used_bytes = storage_used_bytes + NEW.size_bytes WHERE id = NEW.organization_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.organizations SET storage_used_bytes = storage_used_bytes - OLD.size_bytes WHERE id = OLD.organization_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_file_change ON public.files;
CREATE TRIGGER on_file_change
AFTER INSERT OR DELETE ON public.files
FOR EACH ROW EXECUTE FUNCTION update_storage_quota();

-- 4. Storage RLS Policies (Assuming folders are 'organization_id/filename')

-- Helper to fetch user's org role
CREATE OR REPLACE FUNCTION get_org_role(user_uid UUID, org_id UUID)
RETURNS TEXT AS $$
  SELECT role FROM public.organization_members WHERE user_id = user_uid AND organization_id = org_id LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- project-files rules
CREATE POLICY "Users can access their org's project files" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'project-files' AND get_org_role(auth.uid(), (storage.foldername(name))[1]::uuid) IS NOT NULL);

CREATE POLICY "Associates and Admins can upload project files" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'project-files' 
  AND get_org_role(auth.uid(), (storage.foldername(name))[1]::uuid) IN ('admin', 'associate')
);

CREATE POLICY "Admins can delete project files" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'project-files' AND get_org_role(auth.uid(), (storage.foldername(name))[1]::uuid) = 'admin');

-- org-assets rules (Public Read, Auth Write)
CREATE POLICY "Public read for org-assets" ON storage.objects FOR SELECT USING (bucket_id = 'org-assets');

CREATE POLICY "Admins can upload org-assets" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'org-assets' 
  AND get_org_role(auth.uid(), (storage.foldername(name))[1]::uuid) = 'admin'
);

-- invoice-pdfs rules
CREATE POLICY "Users can access their org's invoices" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'invoice-pdfs' AND get_org_role(auth.uid(), (storage.foldername(name))[1]::uuid) IS NOT NULL);

-- Metadata RLS
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Select own org files metadata" ON public.files FOR SELECT TO authenticated
USING (get_org_role(auth.uid(), organization_id) IS NOT NULL);

CREATE POLICY "Insert own org files metadata" ON public.files FOR INSERT TO authenticated
WITH CHECK (get_org_role(auth.uid(), organization_id) IN ('admin', 'associate'));
