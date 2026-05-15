"use client";

import React, { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud, File, FileText, Image as ImageIcon, Video, XCircle, RefreshCw } from "lucide-react";
import { uploadFileResumable } from "../../lib/storage/upload";
import { UploadProgress } from "../../types/storage";

interface FileUploaderProps {
  organizationId: string;
  projectId?: string;
  bucketId: "org-assets" | "project-files";
  onUploadComplete?: (fileData: any) => void;
}

const getFileIcon = (type: string) => {
  if (type.includes("pdf")) return <FileText className="w-6 h-6 text-red-500" />;
  if (type.includes("image")) return <ImageIcon className="w-6 h-6 text-blue-500" />;
  if (type.includes("video")) return <Video className="w-6 h-6 text-purple-500" />;
  return <File className="w-6 h-6 text-gray-400" />;
};

export const FileUploader: React.FC<FileUploaderProps> = ({ organizationId, projectId, bucketId, onUploadComplete }) => {
  const [uploads, setUploads] = useState<Record<string, UploadProgress>>({});

  const onDrop = useCallback((acceptedFiles: File[]) => {
    acceptedFiles.forEach((file) => {
      const uploadId = `${file.name}-${Date.now()}`;
      setUploads((prev) => ({
        ...prev,
        [uploadId]: { file, progress: 0, status: "pending" },
      }));

      startUpload(file, uploadId);
    });
  }, [organizationId, projectId, bucketId]);

  const startUpload = async (file: File, uploadId: string) => {
    setUploads((prev) => ({ ...prev, [uploadId]: { ...prev[uploadId], status: "uploading" } }));
    
    try {
      const record = await uploadFileResumable(
        file,
        bucketId,
        organizationId,
        projectId,
        undefined, // no parent logic defaults to initial version
        (bytesUploaded: number, bytesTotal: number) => {
          const progress = Math.round((bytesUploaded / bytesTotal) * 100);
          setUploads((prev) => ({ ...prev, [uploadId]: { ...prev[uploadId], progress } }));
        }
      );
      
      setUploads((prev) => ({ ...prev, [uploadId]: { ...prev[uploadId], status: "completed", progress: 100, id: record.id } }));
      if (onUploadComplete) onUploadComplete(record);
    } catch (err: any) {
      setUploads((prev) => ({ ...prev, [uploadId]: { ...prev[uploadId], status: "error", error: err.message } }));
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize: 100 * 1024 * 1024, // 100MB
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'video/mp4': ['.mp4']
    }
  });

  return (
    <div className="w-full max-w-3xl mx-auto space-y-4">
      <div 
        {...getRootProps()} 
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${isDragActive ? "border-blue-500 bg-blue-50/50" : "border-gray-300 hover:border-gray-400"}`}
      >
        <input {...getInputProps()} />
        <UploadCloud className={`mx-auto w-12 h-12 ${isDragActive ? 'text-blue-500' : 'text-gray-400'} mb-4`} />
        <p className="text-sm font-medium text-gray-700">Drag & drop files here, or click to select</p>
        <p className="text-xs text-gray-500 mt-2">Supports PDF, DOCX, PNG, JPG, MP4 (Max 100MB)</p>
      </div>

      {Object.values(uploads).length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y divide-gray-100">
          {Object.entries(uploads).map(([id, upload]) => (
            <div key={id} className="p-4 flex items-center gap-4">
              {getFileIcon(upload.file.type)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{upload.file.name}</p>
                  <span className="text-xs font-mono text-gray-500">{(upload.file.size / 1024 / 1024).toFixed(2)} MB</span>
                </div>
                {upload.status === 'uploading' && (
                  <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-blue-600 h-1.5 transition-all duration-300" style={{ width: `${upload.progress}%` }} />
                  </div>
                )}
                {upload.status === 'completed' && <p className="text-xs text-green-600 font-medium">Upload complete</p>}
                {upload.status === 'error' && <p className="text-xs text-red-600 font-medium">{upload.error}</p>}
              </div>
              <div>
                {upload.status === 'error' && (
                  <button onClick={() => startUpload(upload.file, id)} className="p-1 hover:bg-gray-100 rounded-md">
                    <RefreshCw className="w-4 h-4 text-gray-500" />
                  </button>
                )}
                {['uploading', 'pending'].includes(upload.status) && (
                   <button className="p-1 hover:bg-red-50 text-red-500 rounded-md">
                   <XCircle className="w-4 h-4" />
                 </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
