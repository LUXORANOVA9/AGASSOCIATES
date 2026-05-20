import * as FileSystem from 'expo-file-system';
import * as tus from 'tus-js-client';
import { supabase } from '../lib/supabase';
import { env } from '../lib/env';
import type { DocumentInsert } from '@ag/types';
import type { DocumentUploadMutation, DrainResult } from '../lib/queue/types';

const BUCKET = 'documents';
const PG_UNIQUE_VIOLATION = '23505';

// Two-step upload:
//   1. tus resumable PUT to Supabase Storage (resumes across network blips
//      and app restarts — survives the cache between attempts).
//   2. Insert a row into public.documents keyed on client_event_id.
//      UNIQUE constraint means a successful retry returns 23505, which we
//      treat as already-persisted.
export async function applyDocumentUpload(
    m: DocumentUploadMutation,
): Promise<DrainResult> {
    const { caseId, orgId, uploaderId, localUri, contentType } = m.payload;

    // Confirm the staged file still exists. App may have been killed and
    // cache dir cleared by the OS between enqueue and drain.
    const info = await FileSystem.getInfoAsync(localUri);
    if (!info.exists) {
        return {
            ok: false,
            error: 'Local file no longer exists',
            retriable: false,
        };
    }

    const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();
    if (sessionError || !sessionData.session) {
        return {
            ok: false,
            error: 'Not authenticated',
            retriable: true,
        };
    }

    const storagePath = `${orgId}/${caseId}/${m.eventId}.jpg`;
    const fileSize = info.size ?? 0;

    try {
        await uploadViaTus({
            uri: localUri,
            storagePath,
            contentType,
            accessToken: sessionData.session.access_token,
        });
    } catch (e) {
        return {
            ok: false,
            error: e instanceof Error ? e.message : 'Upload failed',
            retriable: true,
        };
    }

    const row: DocumentInsert = {
        client_event_id: m.eventId,
        case_id: caseId,
        org_id: orgId,
        uploader_id: uploaderId,
        storage_path: storagePath,
        bucket_id: BUCKET,
        size_bytes: fileSize,
        content_type: contentType,
        captured_at: m.payload.capturedAt ?? null,
        captured_lat: m.payload.capturedLat ?? null,
        captured_lon: m.payload.capturedLon ?? null,
    };
    const insert = await supabase.from('documents').insert(row);
    if (insert.error) {
        const code = (insert.error as { code?: string }).code;
        if (code === PG_UNIQUE_VIOLATION) return { ok: true };
        return {
            ok: false,
            error: insert.error.message,
            retriable: true,
        };
    }

    // Best-effort cleanup of the staged file. Failure here doesn't matter —
    // the upload is already persisted server-side.
    await FileSystem.deleteAsync(localUri, { idempotent: true }).catch(() => {});
    return { ok: true };
}

interface TusArgs {
    uri: string;
    storagePath: string;
    contentType: string;
    accessToken: string;
}

async function uploadViaTus({
    uri,
    storagePath,
    contentType,
    accessToken,
}: TusArgs): Promise<void> {
    // tus-js-client expects a Blob/File; in RN we go through fetch to get a
    // Blob from the file:// URI.
    const response = await fetch(uri);
    const blob = await response.blob();

    await new Promise<void>((resolve, reject) => {
        const upload = new tus.Upload(blob as unknown as File, {
            endpoint: `${env.SUPABASE_URL}/storage/v1/upload/resumable`,
            retryDelays: [0, 2000, 5000, 10_000, 20_000],
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'x-upsert': 'true',
            },
            uploadDataDuringCreation: true,
            removeFingerprintOnSuccess: true,
            metadata: {
                bucketName: BUCKET,
                objectName: storagePath,
                contentType,
            },
            chunkSize: 6 * 1024 * 1024,
            onError: (err) => reject(err),
            onSuccess: () => resolve(),
        });
        upload.start();
    });
}
