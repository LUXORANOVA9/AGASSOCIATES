import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { DocumentRow } from '@ag/types';
import type { CaseRow } from './useCases';

const CASE_COLS =
    'id, org_id, bank_name, case_type, status, executive_id, assigned_at, created_at, updated_at';
const DOC_COLS =
    'id, case_id, org_id, uploader_id, storage_path, bucket_id, received_status, size_bytes, content_type, captured_at, created_at';

async function fetchCase(caseId: string): Promise<CaseRow> {
    const { data, error } = await supabase
        .from('cases')
        .select(CASE_COLS)
        .eq('id', caseId)
        .single();
    if (error) throw error;
    return data as CaseRow;
}

async function fetchCaseDocuments(caseId: string): Promise<DocumentRow[]> {
    const { data, error } = await supabase
        .from('documents')
        .select(DOC_COLS)
        .eq('case_id', caseId)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as DocumentRow[];
}

export function useCase(caseId: string | undefined) {
    return useQuery({
        queryKey: ['case', caseId],
        queryFn: () => fetchCase(caseId!),
        enabled: Boolean(caseId),
    });
}

export function useCaseDocuments(caseId: string | undefined) {
    return useQuery({
        queryKey: ['case-documents', caseId],
        queryFn: () => fetchCaseDocuments(caseId!),
        enabled: Boolean(caseId),
    });
}
