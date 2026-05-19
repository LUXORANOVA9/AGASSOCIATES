import { useCallback, useState } from 'react';
import { useAuthStore } from '../lib/stores/useAuthStore';
import { supabase } from '../lib/supabase';

export function useAuth() {
    return useAuthStore((s) => ({
        user: s.user,
        session: s.session,
        role: s.role,
        orgId: s.orgId,
        initialised: s.initialised,
        signOut: s.signOut,
    }));
}

interface SendMagicLinkArgs {
    email: string;
    redirectTo: string;
}

export function useSendMagicLink() {
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sent, setSent] = useState(false);

    const send = useCallback(async ({ email, redirectTo }: SendMagicLinkArgs) => {
        setSending(true);
        setError(null);
        try {
            const { error: err } = await supabase.auth.signInWithOtp({
                email,
                options: { emailRedirectTo: redirectTo },
            });
            if (err) throw err;
            setSent(true);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to send magic link');
        } finally {
            setSending(false);
        }
    }, []);

    return { send, sending, sent, error };
}
