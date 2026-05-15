import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder_key';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Generates a signed URL for a specific file to be downloaded or previewed.
 */
export async function getSignedUrl(
  bucketId: string,
  storagePath: string,
  expiresInSeconds: number = 3600 // 1 hour default
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(bucketId)
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error || !data?.signedUrl) {
    throw new Error(`Failed to generate signed URL: ${error?.message}`);
  }

  return data.signedUrl;
}

/**
 * Fallback to direct client download
 */
export async function downloadFile(bucketId: string, storagePath: string, fileName: string) {
  const { data, error } = await supabase.storage
    .from(bucketId)
    .download(storagePath);
  
  if (error || !data) {
      throw new Error(`Download failed: ${error?.message}`);
  }
  
  const blobUrl = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
}
