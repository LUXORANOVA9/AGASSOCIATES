-- Supabase Auth Hook (or equivalent PostgreSQL trigger logic)
-- This function gets executed upon successful user login/creation to inject custom claims into the JWT.

-- Assumption: We have a table mapping users to organizations, e.g., user_organizations(user_id, org_id)

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    claims jsonb;
    user_id uuid;
    assigned_org_id uuid;
BEGIN
    -- Extract the user ID from the event payload
    user_id := (event->>'user_id')::uuid;

    -- Query the user's assigned organization
    -- Example assumes a users or user_organizations table exists
    -- SELECT org_id INTO assigned_org_id FROM public.users WHERE id = user_id;
    -- For demonstration, let's assume we find their org_id.
    
    -- In a real scenario, you handle if the user has no org assigned.
    assigned_org_id := '00000000-0000-0000-0000-000000000000'::uuid; 

    claims := event->'claims';
    IF claims IS NULL THEN
        claims := '{}'::jsonb;
    END IF;

    -- Check if app_metadata exists, if not initialize it
    IF claims->'app_metadata' IS NULL THEN
        claims := jsonb_set(claims, '{app_metadata}', '{}'::jsonb);
    END IF;

    -- Inject app_org_id into app_metadata
    claims := jsonb_set(claims, '{app_metadata, app_org_id}', to_jsonb(assigned_org_id));
    
    -- Inject bank_allowed_access flag (example: could be true for bank partners)
    claims := jsonb_set(claims, '{app_metadata, bank_allowed_access}', 'true'::jsonb);

    -- Update the event payload with the new claims
    event := jsonb_set(event, '{claims}', claims);

    RETURN event;
END;
$$;

-- Note: To fully enable this in Supabase, you must configure the Auth Hook via the Supabase Dashboard 
-- or CLI, pointing the "Custom Access Token" hook to this `public.custom_access_token_hook` function.
