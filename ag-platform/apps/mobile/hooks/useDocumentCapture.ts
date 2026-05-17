import { useCallback, useState } from 'react';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../lib/stores/useAuthStore';
import { useQueueStore } from '../lib/stores/useQueueStore';
import type { DocumentUploadMutation } from '../lib/queue/types';

interface CaptureArgs {
    caseId: string;
    gps?: { lat: number; lon: number };
}

interface CaptureState {
    capture: (args: CaptureArgs) => Promise<string | null>;
    busy: boolean;
    lastError: string | null;
}

// Open the native camera, copy the resulting image into the app's persistent
// cache dir (the picker's URI is volatile), then enqueue a document_upload
// mutation. Returns the event id of the enqueued mutation, or null if the
// user cancelled.
export function useDocumentCapture(): CaptureState {
    const enqueue = useQueueStore((s) => s.enqueue);
    const orgId = useAuthStore((s) => s.orgId);
    const uploaderId = useAuthStore((s) => s.user?.id);
    const [busy, setBusy] = useState(false);
    const [lastError, setLastError] = useState<string | null>(null);

    const capture = useCallback(
        async ({ caseId, gps }: CaptureArgs): Promise<string | null> => {
            if (!orgId || !uploaderId) {
                setLastError('Not signed in');
                return null;
            }
            setBusy(true);
            setLastError(null);
            try {
                const perm = await ImagePicker.requestCameraPermissionsAsync();
                if (!perm.granted) {
                    setLastError('Camera permission required');
                    return null;
                }
                const result = await ImagePicker.launchCameraAsync({
                    mediaTypes: ImagePicker.MediaTypeOptions.Images,
                    quality: 0.85,
                    exif: false,
                });
                if (result.canceled || !result.assets[0]) return null;
                const asset = result.assets[0];

                const eventId = Crypto.randomUUID();
                const persistedDir = `${FileSystem.cacheDirectory}pending/`;
                await FileSystem.makeDirectoryAsync(persistedDir, {
                    intermediates: true,
                }).catch(() => {});
                const persistedUri = `${persistedDir}${eventId}.jpg`;
                await FileSystem.copyAsync({
                    from: asset.uri,
                    to: persistedUri,
                });

                const now = new Date().toISOString();
                const mutation: DocumentUploadMutation = {
                    eventId,
                    intent: 'document_upload',
                    createdAt: now,
                    attempts: 0,
                    status: 'pending',
                    payload: {
                        caseId,
                        orgId,
                        uploaderId,
                        localUri: persistedUri,
                        contentType: asset.mimeType ?? 'image/jpeg',
                        sizeBytes: asset.fileSize ?? undefined,
                        capturedAt: now,
                        capturedLat: gps?.lat,
                        capturedLon: gps?.lon,
                    },
                };
                enqueue(mutation);
                return eventId;
            } catch (e) {
                setLastError(e instanceof Error ? e.message : 'Capture failed');
                return null;
            } finally {
                setBusy(false);
            }
        },
        [orgId, uploaderId, enqueue],
    );

    return { capture, busy, lastError };
}
