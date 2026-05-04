export interface FileRecord {
  id: string;
  organization_id: string;
  project_id: string;
  name: string;
  bucket_id: string;
  storage_path: string;
  content_type: string;
  size_bytes: number;
  version_number: number;
  created_at: string;
  updated_at: string;
  created_by: string;
  metadata?: Record<string, any>;
}

export interface UploadProgress {
  file: File;
  progress: number;
  status: "pending" | "uploading" | "completed" | "error";
  error?: string;
  id?: string;
}

export interface FileVersion {
  id: string;
  file_id: string;
  version_number: number;
  storage_path: string;
  created_at: string;
  created_by: string;
  size_bytes: number;
}
