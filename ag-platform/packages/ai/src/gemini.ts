import { google } from '@ai-sdk/google';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export function createGeminiModel(modelId = 'gemini-2.0-flash') {
  return google(modelId);
}

export function createEmbeddingModel(modelId = 'text-embedding-004') {
  return google.textEmbeddingModel(modelId);
}

let _supabase: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!_supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '';
    const key =
      process.env.SUPABASE_SERVICE_ROLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      process.env.VITE_SUPABASE_ANON_KEY ??
      '';
    _supabase = createClient(url, key);
  }
  return _supabase;
}

export async function checkOrgTokenQuota(orgId: string, supabase: SupabaseClient): Promise<void> {
  if (!orgId) return;
  const { data: org, error } = await supabase
    .from('organizations')
    .select('ai_tokens_used, ai_tokens_limit')
    .eq('id', orgId)
    .single();
  if (error || !org) return;
  if (org.ai_tokens_used >= org.ai_tokens_limit) {
    throw new Error('AI Quota Exceeded');
  }
}
