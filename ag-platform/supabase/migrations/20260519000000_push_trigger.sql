-- Push notification trigger.
--
-- Fires the `send-push-on-case-assigned` Edge Function whenever a case
-- transitions from "no executive" to "executive assigned". Uses Supabase's
-- pg_net extension to invoke the function over HTTP without blocking the
-- DB transaction (case insert/update commits whether or not push succeeds).
--
-- Prereqs:
--   1. pg_net extension enabled (typically pre-enabled on Supabase projects)
--   2. The vault key `edge_function_secret` set in Supabase dashboard,
--      matching the Edge Function's authorization expectations
--   3. Edge Function deployed: `supabase functions deploy send-push-on-case-assigned`

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.notify_case_assigned()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    edge_url TEXT;
    edge_secret TEXT;
BEGIN
    -- Skip if nothing relevant changed
    IF (TG_OP = 'UPDATE') AND (OLD.executive_id IS NOT DISTINCT FROM NEW.executive_id) THEN
        RETURN NEW;
    END IF;
    IF NEW.executive_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Read function URL + auth from vault (set via Supabase dashboard)
    SELECT decrypted_secret INTO edge_url FROM vault.decrypted_secrets
        WHERE name = 'edge_send_push_url';
    SELECT decrypted_secret INTO edge_secret FROM vault.decrypted_secrets
        WHERE name = 'edge_function_secret';

    IF edge_url IS NULL THEN
        -- Not configured yet; this is acceptable in dev/test. The case
        -- insert/update still succeeds; no push is sent.
        RETURN NEW;
    END IF;

    PERFORM net.http_post(
        url := edge_url,
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || COALESCE(edge_secret, '')
        ),
        body := jsonb_build_object(
            'case_id', NEW.id::text,
            'executive_id', NEW.executive_id::text,
            'bank_name', NEW.bank_name::text,
            'case_type', NEW.case_type::text
        )
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cases_after_insert_or_assign ON public.cases;
CREATE TRIGGER cases_after_insert_or_assign
    AFTER INSERT OR UPDATE OF executive_id ON public.cases
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_case_assigned();
