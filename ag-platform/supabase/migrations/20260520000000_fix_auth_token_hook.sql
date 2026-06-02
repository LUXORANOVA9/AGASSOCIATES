-- Fix custom_access_token_hook stub.
--
-- The hook in 20260514000001_auth_hooks.sql hardcoded:
--     assigned_org_id := '00000000-0000-0000-0000-000000000000'::uuid;
--
-- Result: every signed-in user got the same fake org_id baked into their
-- JWT's app_metadata.app_org_id claim. Every RLS policy that calls
-- get_app_org_id() therefore filters on a UUID that never matches a real
-- organization row, so authenticated reads return zero rows. Authoring
-- this fix is a prereq for the field-app rollout (mobile dashboard reads
-- 'cases' WHERE org_id = get_app_org_id()).
--
-- This migration:
--   1. Adds user_roles.org_id (nullable — existing rows survive)
--   2. Adds an admin-managed RLS policy for assigning org_id
--   3. Rewrites custom_access_token_hook to look the value up and
--      omit the claim entirely when org_id IS NULL (so RLS returns no
--      rows instead of stale ones from a fake UUID)
--   4. Also injects role into app_metadata so the mobile auth store
--      can stop falling back to 'applicant' when role is missing

-- 1. Add org_id column
ALTER TABLE public.user_roles
    ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_user_roles_org_id ON public.user_roles(org_id);

-- 2. Allow admins to update any user_roles row (they need to assign org_id)
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
CREATE POLICY "Admins can update roles"
    ON public.user_roles
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- 3. Rewrite the auth hook with real lookup
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    claims          jsonb;
    user_uuid       uuid;
    assigned_org_id uuid;
    assigned_role   text;
BEGIN
    user_uuid := (event->>'user_id')::uuid;

    -- Look up the user's org assignment + role. UNIQUE(user_id) on
    -- user_roles means at most one row.
    SELECT org_id, role
        INTO assigned_org_id, assigned_role
        FROM public.user_roles
        WHERE user_id = user_uuid;

    claims := COALESCE(event->'claims', '{}'::jsonb);
    IF claims->'app_metadata' IS NULL THEN
        claims := jsonb_set(claims, '{app_metadata}', '{}'::jsonb);
    END IF;

    -- Only inject app_org_id when we have a real assignment. The previous
    -- stub injected a zero UUID; RLS predicates would then silently
    -- filter on a fake org and return nothing. With this change,
    -- get_app_org_id() returns NULL and policies fail safely (no rows)
    -- rather than appearing to succeed against bad data.
    IF assigned_org_id IS NOT NULL THEN
        claims := jsonb_set(
            claims,
            '{app_metadata, app_org_id}',
            to_jsonb(assigned_org_id::text)
        );
    ELSE
        -- Explicitly remove any stale claim so re-issued tokens don't
        -- carry a previous org assignment forward.
        claims := claims #- '{app_metadata, app_org_id}';
    END IF;

    -- Mobile + web auth stores read this to pick up the user's role at
    -- session-init time. Falls back to NULL on unassigned users so the
    -- client renders an "awaiting access" state instead of guessing.
    IF assigned_role IS NOT NULL THEN
        claims := jsonb_set(
            claims,
            '{app_metadata, role}',
            to_jsonb(assigned_role)
        );
    ELSE
        claims := claims #- '{app_metadata, role}';
    END IF;

    event := jsonb_set(event, '{claims}', claims);
    RETURN event;
END;
$$;

-- The bank_allowed_access flag from the original stub was unused and
-- always true; dropped silently. If/when a real bank-viewer flow needs
-- a flag, derive it from the role at the call site.
