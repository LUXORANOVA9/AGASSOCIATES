/// <reference types="node" />
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    'Missing required Supabase configuration: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.',
  );
}

// Initialize Supabase client with Service Role Key to bypass RLS for administrative tasks.
// Treat this client as server-only — never import from any module bundled to the browser.
export const supabase = createClient(supabaseUrl, supabaseServiceKey);

export interface CreateCaseParams {
  org_id: string;
  bank_name: 'ICICI' | 'Kotak' | 'Axis' | 'Muthoot' | 'HDFC';
  case_type: string;
  case_status: string;
  noi_status?: string;
}

export async function createCase(params: CreateCaseParams) {
  const { data, error } = await supabase
    .from('cases')
    .insert([params])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getOrganizationByBank(bankName: string) {
  // Resolve the organization ID for a bank partner. Returns null when no match
  // exists; rethrows any other Supabase error so the caller surfaces it.
  const { data, error } = await supabase
    .from('organizations')
    .select('id')
    .eq('name', bankName)
    .single();

  if (error) {
    if ((error as { code?: string }).code === 'PGRST116') return null;
    throw error;
  }
  return data.id;
}

export interface OnDutyStaff {
  id: string;
  org_id: string;
  member_id: string;
  invite_email: string;
  role: 'ADVOCATE' | 'EXECUTIVE' | 'CLERK';
  telegram_chat_id: string;
  telegram_username: string | null;
  on_duty: boolean;
  otp_bank_filter: string[] | null;
}

export async function findOnDutyStaff(
  orgId: string,
  bankId: string | null = null
): Promise<OnDutyStaff[]> {
  // Query team_members via Supabase REST. Service-role bypasses RLS so we
  // can read across orgs in case the SMS Forwarder is misconfigured and
  // didn't include org_id. Filter to staff who are ACTIVE, on_duty, and
  // have a Telegram binding. otp_bank_filter NULL = all banks.
  const { data, error } = await supabase
    .from('team_members')
    .select('id, org_id, member_id, invite_email, role, telegram_chat_id, telegram_username, on_duty, otp_bank_filter')
    .eq('org_id', orgId)
    .eq('seat_status', 'ACTIVE')
    .eq('on_duty', true)
    .not('telegram_chat_id', 'is', null);

  if (error) {
    if ((error as { code?: string }).code === 'PGRST116') return [];
    throw error;
  }

  const staff = (data ?? []) as OnDutyStaff[];
  if (bankId === null) return staff;
  return staff.filter(
    (s) => s.otp_bank_filter === null || s.otp_bank_filter.length === 0 || s.otp_bank_filter.includes(bankId)
  );
}
