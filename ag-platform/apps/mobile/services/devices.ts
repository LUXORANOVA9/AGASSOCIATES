import { supabase } from '../lib/supabase';
import type { DevicePushTokenInsert } from '@ag/types';

// Upsert keyed on (user_id, device_id) — see UNIQUE constraint in the
// migration. Same device re-registers cleanly across app reinstalls.
export async function upsertPushToken(
    payload: DevicePushTokenInsert,
): Promise<void> {
    const { error } = await supabase
        .from('device_push_tokens')
        .upsert(payload, { onConflict: 'user_id,device_id' });
    if (error) throw error;
}

export async function revokePushToken(deviceId: string): Promise<void> {
    const { error } = await supabase
        .from('device_push_tokens')
        .update({ revoked_at: new Date().toISOString() })
        .eq('device_id', deviceId);
    if (error) throw error;
}
