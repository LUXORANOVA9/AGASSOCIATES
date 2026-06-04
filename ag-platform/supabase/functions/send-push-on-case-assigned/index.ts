// Supabase Edge Function: send-push-on-case-assigned
//
// Invoked by the `cases_after_insert_or_assign` database trigger
// (see migration 20260519000000_push_trigger.sql) whenever a row in
// public.cases is INSERTED or UPDATED with an executive_id transition
// from NULL → non-NULL.
//
// Looks up active Expo push tokens for that executive, then forwards a
// notification batch to the Expo Push API. Failures are logged but never
// thrown — push is best-effort and must not roll back the underlying
// case write.
//
// Deno runtime. Service role key is provided by the platform via
// SUPABASE_SERVICE_ROLE_KEY — DO NOT add fallbacks that ship it
// elsewhere.

// @ts-expect-error — Deno-hosted Edge Function; types resolved at deploy time
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
// @ts-expect-error
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.40.0';

interface CaseAssignedPayload {
    case_id: string;
    executive_id: string;
    bank_name: string;
    case_type: string;
}

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

serve(async (req: Request) => {
    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    let body: CaseAssignedPayload;
    try {
        body = await req.json();
    } catch {
        return new Response('Bad Request', { status: 400 });
    }

    // @ts-expect-error — Deno globals
    const url = Deno.env.get('SUPABASE_URL');
    // @ts-expect-error
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !serviceKey) {
        return new Response('Misconfigured', { status: 500 });
    }

    const supabase = createClient(url, serviceKey, {
        auth: { persistSession: false },
    });

    const { data: tokens, error } = await supabase
        .from('device_push_tokens')
        .select('expo_push_token')
        .eq('user_id', body.executive_id)
        .is('revoked_at', null);

    if (error) {
        return new Response(`db error: ${error.message}`, { status: 500 });
    }
    if (!tokens || tokens.length === 0) {
        return new Response('no tokens', { status: 200 });
    }

    const messages = tokens.map((t: { expo_push_token: string }) => ({
        to: t.expo_push_token,
        title: 'New case assigned',
        body: `${body.bank_name} · ${body.case_type}`,
        data: { caseId: body.case_id },
        sound: 'default',
        priority: 'high',
    }));

    try {
        const res = await fetch(EXPO_PUSH_ENDPOINT, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Accept-Encoding': 'gzip, deflate',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(messages),
        });
        if (!res.ok) {
            const text = await res.text();
            console.error('Expo push API error', res.status, text);
            return new Response('push api error', { status: 502 });
        }
    } catch (e) {
        console.error('Expo push fetch failed', e);
        return new Response('push fetch failed', { status: 502 });
    }

    return new Response(JSON.stringify({ delivered: messages.length }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
});
