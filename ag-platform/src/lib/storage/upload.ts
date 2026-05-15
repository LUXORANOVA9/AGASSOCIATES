import { createClient } from "@supabase/supabase-js";
import * as tus from "tus-js-client";
import { type FileRecord } from "../../types/storage";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder_key';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function uploadFileResumable(
  file: File,
  bucketId: string,
  organizationId: string,
  projectId: string | undefined,
  parentFileId: string | undefined, // For versioning
  onProgress: (bytesUploaded: number, bytesTotal: number) => void
): Promise<FileRecord> {
  const { data: session } = await supabase.auth.getSession();
  if (!session?.session?.access_token) throw new Error("Unauthorized");
  if (!supabaseUrl) throw new Error("Missing Supabase URL");

  // 1. Check Quota locally before upload (Optional enhancement, assuming standard size limits applied)
  if (file.size > 100 * 1024 * 1024) throw new Error("File exceeds 100MB limit.");

  const fileName = `${Date.now()}-${file.name}`;
  const filePath = `${organizationId}/${fileName}`;

  return new Promise((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: `${supabaseUrl}/storage/v1/upload/resumable`,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        Authorization: `Bearer ${session.session.access_token}`,
        "x-upsert": "true",
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: bucketId,
        objectName: filePath,
        contentType: file.type,
      },
      chunkSize: 6 * 1024 * 1024, // 6MB chunks
      onError: function (error) {
        console.error("Upload Error:", error);
        reject(error);
      },
      onProgress: function (bytesUploaded, bytesTotal) {
        onProgress(bytesUploaded, bytesTotal);
      },
      onSuccess: async function () {
        try {
          // 2. Trigger Virus Scan web hook (Placeholder)
          await fetch("/api/webhooks/virus-scan", {
            method: "POST",
            body: JSON.stringify({ bucketId, filePath }),
          }).catch(() => console.log("Virus scan webhook failed/ignored"));

          // 3. Generate Thumbnail (Placeholder, handled asynchronously by edge func usually)

          // 4. Create DB Reference & Handle Versioning
          let version = 1;
          if (parentFileId) {
             const { data: parent } = await supabase.from('files').select('version_number').eq('id', parentFileId).single();
             if (parent) version = parent.version_number + 1;
          }

          const { data: fileRecord, error: dbError } = await supabase.from('files').insert({
            organization_id: organizationId,
            project_id: projectId,
            uploader_id: session.session.user.id,
            name: file.name,
            storage_path: filePath,
            bucket_id: bucketId,
            size_bytes: file.size,
            content_type: file.type,
            version_number: version,
            parent_file_id: parentFileId || null
          }).select('*').single();

          if (dbError) throw dbError;
          resolve(fileRecord as FileRecord);

        } catch (postError) {
          reject(postError);
        }
      },
    });

    // Check if there are any previous uploads to continue.
    upload.findPreviousUploads().then((previousUploads) => {
      if (previousUploads.length) {
        upload.resumeFromPreviousUpload(previousUploads[0]);
      } else {
        upload.start();
      }
    });
  });
}
