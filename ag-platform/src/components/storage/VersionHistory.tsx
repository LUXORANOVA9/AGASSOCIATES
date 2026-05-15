"use client";

import React, { useState } from "react";
import { format } from "date-fns";
import { FileRecord } from "../../types/storage";
import { UploadCloud, Clock, CheckCircle } from "lucide-react";
import { FileUploader } from "./FileUploader";

interface VersionHistoryProps {
  currentFile: FileRecord;
  history: FileRecord[];
  onRestored: (file: FileRecord) => void;
}

export const VersionHistory: React.FC<VersionHistoryProps> = ({ currentFile, history, onRestored }) => {
  const [isUploadingNew, setIsUploadingNew] = useState(false);

  const sortedHistory = [...history].sort((a, b) => b.version_number - a.version_number);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 flex-wrap gap-4">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-500"/> Version History
        </h3>
        <button 
           onClick={() => setIsUploadingNew(!isUploadingNew)}
           className="px-3 py-1.5 text-sm bg-black text-white rounded-md font-medium flex items-center gap-2 hover:bg-gray-800"
        >
          <UploadCloud className="w-4 h-4" /> Upload New Version
        </button>
      </div>

      {isUploadingNew && (
        <div className="p-4 bg-blue-50/30 border-b border-gray-100">
           <FileUploader 
              organizationId={currentFile.organization_id}
              projectId={currentFile.project_id}
              bucketId={currentFile.bucket_id as any}
              onUploadComplete={(file) => {
                  setIsUploadingNew(false);
                  onRestored(file);
              }}
           />
        </div>
      )}

      <ul className="divide-y divide-gray-100">
        <li className="p-4 flex items-center justify-between hover:bg-gray-50 relative">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-500 rounded-r-md"></div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-bold">
                v{currentFile.version_number}
              </span>
              <p className="text-sm font-medium text-gray-900">Current active version</p>
            </div>
            <p className="text-xs text-gray-500 mt-1">Uploaded {format(new Date(currentFile.created_at), 'MMM d, yyyy h:mm a')} • {(currentFile.size_bytes / 1024).toFixed(1)} KB</p>
          </div>
          <CheckCircle className="w-5 h-5 text-green-500" />
        </li>

        {sortedHistory.map((version) => (
          <li key={version.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full font-bold">
                  v{version.version_number}
                </span>
                <p className="text-sm text-gray-700">{version.name}</p>
              </div>
              <p className="text-xs text-gray-500 mt-1">Uploaded {format(new Date(version.created_at), 'MMM d, yyyy h:mm a')} • {(version.size_bytes / 1024).toFixed(1)} KB</p>
            </div>
            <button 
                onClick={() => onRestored(version)}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium px-3 py-1.5 hover:bg-blue-50 rounded-md transition"
            >
                Restore
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};
