/// <reference types="node" />
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const localPgMode = process.env.USE_LOCAL_PG === '1';

// Skip the Supabase client init entirely in local-PG mode. The Supabase
// realtime client requires Node 22+ for native WebSocket support; on
// Node 18 it crashes on `new SupabaseClient()`. When USE_LOCAL_PG=1
// (smoke tests, dev without a Supabase project), every function in this
// file that previously called `supabase` now routes through localPool.
if (!localPgMode && (!supabaseUrl || !supabaseServiceKey)) {
  throw new Error(
    'Missing required Supabase configuration: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set. ' +
      'Or set USE_LOCAL_PG=1 to run with a local Postgres instance (no Supabase project required).',
  );
}

// Initialize Supabase client with Service Role Key to bypass RLS for administrative tasks.
// Treat this client as server-only — never import from any module bundled to the browser.
export const supabase: SupabaseClient | null = localPgMode
  ? null
  : createClient(supabaseUrl!, supabaseServiceKey!);

export interface CreateCaseParams {
  org_id: string;
  bank_name: 'ICICI' | 'Kotak' | 'Axis' | 'Muthoot' | 'HDFC';
  case_type: string;
  case_status: string;
  noi_status?: string;
}

export async function createCase(params: CreateCaseParams) {
  if (!supabase) throw new Error('createCase requires Supabase; set USE_LOCAL_PG=0 or unset it.');
  const { data, error } = await supabase
    .from('cases')
    .insert([params])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getOrganizationByBank(bankName: string) {
  if (!supabase) throw new Error('getOrganizationByBank requires Supabase; set USE_LOCAL_PG=0 or unset it.');
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
  // When USE_LOCAL_PG=1 is set (e.g. local smoke tests, dev environments
  // without a Supabase project), query team_members via direct Postgres
  // instead of Supabase REST. RLS is bypassed intentionally — the
  // service-role JWT does the same in prod. The schema and row format
  // are identical to what Supabase REST returns.
  if (process.env.USE_LOCAL_PG === '1') {
    return findOnDutyStaffLocal(orgId, bankId);
  }

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

// ── local Postgres fallback (USE_LOCAL_PG=1) ───────────────────
const localPool = new Pool({
  connectionString: process.env.DATABASE_URL
    ?? (process.env.DB_POSTGRESDB_HOST
      ? `postgres://${process.env.DB_POSTGRESDB_USER ?? 'postgres'}:${process.env.DB_POSTGRESDB_PASSWORD ?? 'postgres'}@${process.env.DB_POSTGRESDB_HOST}/${process.env.DB_POSTGRESDB_DATABASE ?? 'postgres'}`
      : 'postgres://postgres:Luxoranova%409@127.0.0.1:5432/postgres'),
  ssl: false,
});

async function findOnDutyStaffLocal(
  orgId: string,
  bankId: string | null,
): Promise<OnDutyStaff[]> {
  const { rows } = await localPool.query<OnDutyStaff>(
    `SELECT id, org_id, member_id, invite_email, role, telegram_chat_id, telegram_username, on_duty, otp_bank_filter
       FROM team_members
      WHERE org_id = $1
        AND seat_status = 'ACTIVE'
        AND on_duty = true
        AND telegram_chat_id IS NOT NULL`,
    [orgId],
  );
  if (bankId === null) return rows;
  return rows.filter(
    (s) => s.otp_bank_filter === null || s.otp_bank_filter.length === 0 || s.otp_bank_filter.includes(bankId),
  );
}
