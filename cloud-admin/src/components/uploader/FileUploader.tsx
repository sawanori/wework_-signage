'use client';

import React, { useCallback, useRef, useState } from 'react';
import { useUpload } from '@/hooks/useUpload';
import { UploadProgress } from './UploadProgress';

interface FileUploaderProps {
  onUploadComplete?: (fileId: string, publicUrl: string, file: File) => void;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const ALLOWED_EXTENSIONS = '.jpg,.jpeg,.png,.webp,.pdf';
const MAX_FILE_SIZE = 30 * 1024 * 1024; // 30MB
const PDF_PAGE_LIMIT = 20;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function FileUploader({ onUploadComplete }: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [pdfPageWarning, setPdfPageWarning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { state, upload, reset } = useUpload();

  const handleFile = useCallback(
    async (file: File) => {
      if (!ALLOWED_TYPES.includes(file.type)) {
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        return;
      }

      setCurrentFile(file);
      setPdfPageWarning(false);

      // Check PDF page count warning
      if (file.type === 'application/pdf') {
        try {
          const pdfjsLib = await import('pdfjs-dist');
          pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
            'pdfjs-dist/build/pdf.worker.mjs',
            import.meta.url
          ).toString();
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          if (pdf.numPages > PDF_PAGE_LIMIT) {
            setPdfPageWarning(true);
          }
        } catch {
          // Non-fatal — proceed without warning
        }
      }

      const result = await upload(file);
      if (result) {
        onUploadComplete?.(result.fileId, result.publicUrl, file);
      }
    },
    [upload, onUploadComplete]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) void handleFile(file);
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void handleFile(file);
      // Reset input value to allow re-uploading same file
      e.target.value = '';
    },
    [handleFile]
  );

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleRetry = () => {
    if (currentFile) void handleFile(currentFile);
  };

  const handleDismiss = () => {
    reset();
    setCurrentFile(null);
    setPdfPageWarning(false);
  };

  const isUploading = state.status === 'uploading' || state.status === 'requesting';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Drop zone */}
      <div
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        role="button"
        tabIndex={0}
        aria-label="ファイルをアップロード"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') handleClick();
        }}
        style={{
          border: `2px dashed ${isDragging ? '#007AFF' : 'var(--gray-4, #D1D1D6)'}`,
          borderRadius: '18px',
          padding: '48px 32px',
          textAlign: 'center',
          cursor: isUploading ? 'default' : 'pointer',
          background: isDragging ? 'rgba(0, 122, 255, 0.04)' : 'transparent',
          transition: 'all 0.2s cubic-bezier(0, 0, 0.58, 1)',
          outline: 'none',
          animation: 'fadeInUp 0.4s cubic-bezier(0, 0, 0.58, 1) forwards',
        }}
      >
        {/* Upload icon */}
        <div
          style={{
            width: '56px',
            height: '56px',
            margin: '0 auto 16px',
            background: isDragging ? 'rgba(0, 122, 255, 0.12)' : 'var(--gray-6, #F2F2F7)',
            borderRadius: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.2s',
          }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke={isDragging ? '#007AFF' : '#8E8E93'}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>

        <p
          style={{
            margin: '0 0 8px',
            fontSize: '17px',
            fontWeight: 600,
            color: isDragging ? '#007AFF' : 'var(--text-primary, #1D1D1F)',
            letterSpacing: '-0.02em',
          }}
        >
          {isDragging ? 'ここにドロップ' : 'ファイルをドロップ、またはクリックして選択'}
        </p>
        <p
          style={{
            margin: 0,
            fontSize: '13px',
            color: 'var(--text-secondary, #6E6E73)',
            letterSpacing: '-0.01em',
          }}
        >
          JPEG, PNG, WebP, PDF（最大30MB）
        </p>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_EXTENSIONS}
        onChange={handleInputChange}
        style={{ display: 'none' }}
        disabled={isUploading}
      />

      {/* PDF page limit warning */}
      {pdfPageWarning && (
        <div
          style={{
            background: 'rgba(255, 149, 0, 0.08)',
            border: '1px solid rgba(255, 149, 0, 0.3)',
            borderRadius: '12px',
            padding: '12px 16px',
            animation: 'fadeIn 0.3s cubic-bezier(0, 0, 0.58, 1) forwards',
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: '13px',
              color: '#FF9500',
              letterSpacing: '-0.01em',
            }}
          >
            PDFが{PDF_PAGE_LIMIT}ページを超えています。最初の{PDF_PAGE_LIMIT}ページのみ表示されます。
          </p>
        </div>
      )}

      {/* Upload progress */}
      {state.status !== 'idle' && currentFile && (
        <UploadProgress
          filename={currentFile.name}
          progress={state.progress}
          status={state.status}
          error={state.error}
          onRetry={state.status === 'error' ? handleRetry : undefined}
          onDismiss={state.status === 'error' || state.status === 'success' ? handleDismiss : undefined}
        />
      )}

      {/* File size info for selected file */}
      {currentFile && state.status === 'idle' && (
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary, #6E6E73)' }}>
          {currentFile.name} — {formatFileSize(currentFile.size)}
        </p>
      )}
    </div>
  );
}
