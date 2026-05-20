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
  status?: string;
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
