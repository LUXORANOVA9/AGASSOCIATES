"use client";

import React, { useEffect, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { downloadFile, getSignedUrl } from "../../lib/storage/download";
import { FileRecord } from "../../types/storage";
import { DownloadCloud, ExternalLink, FileQuestion } from "lucide-react";

// Configure PDF worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface FilePreviewerProps {
  file: FileRecord;
}

export const FilePreviewer: React.FC<FilePreviewerProps> = ({ file }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [, setNumPages] = useState<number>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSignedUrl(file.bucket_id, file.storage_path)
      .then(setUrl)
      .catch((err: Error) => setError(err.message));
  }, [file]);

  if (error) return <div className="p-8 text-center text-red-500 bg-red-50 rounded-xl">Error loading preview: {error}</div>;
  if (!url) return <div className="p-8 text-center text-gray-500 animate-pulse bg-gray-50 rounded-xl">Generating secure URL...</div>;

  const renderContent = () => {
    if (file.content_type.includes("pdf")) {
      return (
        <div className="w-full h-[600px] overflow-auto bg-gray-100 flex items-start justify-center p-4 rounded-xl">
          <Document file={url} onLoadSuccess={({ numPages }) => setNumPages(numPages)}>
            <Page pageNumber={1} renderTextLayer={false} renderAnnotationLayer={false} className="shadow-lg rounded-sm overflow-hidden" />
          </Document>
        </div>
      );
    }
    
    if (file.content_type.startsWith("image/")) {
      return (
        <div className="relative w-full rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center min-h-[400px]">
          <img src={url} alt={file.name} className="max-w-full max-h-full object-contain" />
        </div>
      );
    }

    if (file.content_type.startsWith("video/")) {
      return (
        <video controls className="w-full rounded-xl bg-black">
          <source src={url} type={file.content_type} />
          Your browser does not support the video tag.
        </video>
      );
    }

    // Fallback unsupported type
    return (
      <div className="p-12 text-center bg-gray-50 border border-gray-100 rounded-xl flex flex-col items-center justify-center space-y-4">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
            <FileQuestion className="w-8 h-8 text-gray-400" />
        </div>
        <div>
            <p className="font-medium text-gray-900">Preview not available</p>
            <p className="text-sm text-gray-500 mt-1">This file type ({file.content_type || 'unknown'}) cannot be previewed in the browser.</p>
        </div>
        <button 
           onClick={() => downloadFile(file.bucket_id, file.storage_path, file.name)}
           className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg flex items-center gap-2 hover:bg-blue-700 transition"
        >
          <DownloadCloud className="w-4 h-4" /> Download File
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-4 w-full">
        <div className="flex items-center justify-between bg-white border border-gray-200 p-4 rounded-xl shadow-sm">
            <div>
                <h3 className="font-medium text-gray-900 truncate">{file.name}</h3>
                <p className="text-xs text-gray-500">v{file.version_number} • {(file.size_bytes / 1024 / 1024).toFixed(2)} MB</p>
            </div>
            <div className="flex gap-2">
                <a href={url} target="_blank" rel="noreferrer" className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">
                    <ExternalLink className="w-4 h-4" />
                </a>
            </div>
        </div>
        {renderContent()}
    </div>
  );
};
