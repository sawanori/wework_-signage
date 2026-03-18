'use client';

import React, { useCallback, useRef, useState } from 'react';
import { useUpload } from '@/hooks/useUpload';
import { UploadProgress } from './UploadProgress';
import { useIsMobile } from '@/hooks/useIsMobile';

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
  const isMobile = useIsMobile();
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
          pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
          border: `1px dashed ${isDragging ? '#3B82F6' : '#CCCCCC'}`,
          borderRadius: '10px',
          padding: isMobile ? '28px 16px' : '40px 32px',
          textAlign: 'center',
          cursor: isUploading ? 'default' : 'pointer',
          background: isDragging ? 'rgba(59, 130, 246, 0.04)' : 'transparent',
          transition: 'border-color 0.15s ease, background 0.15s ease',
          outline: 'none',
        }}
        onMouseEnter={(e) => {
          if (!isDragging && !isUploading) {
            (e.currentTarget as HTMLDivElement).style.borderColor = '#BBBBBB';
          }
        }}
        onMouseLeave={(e) => {
          if (!isDragging) {
            (e.currentTarget as HTMLDivElement).style.borderColor = '#CCCCCC';
          }
        }}
      >
        {/* Upload icon */}
        <div
          style={{
            width: '48px',
            height: '48px',
            margin: '0 auto 14px',
            background: isDragging ? 'rgba(59, 130, 246, 0.1)' : '#F0F0F0',
            border: `1px solid ${isDragging ? 'rgba(59,130,246,0.3)' : '#D5D5D5'}`,
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease',
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke={isDragging ? '#3B82F6' : '#888888'}
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
            margin: '0 0 6px',
            fontSize: '14px',
            fontWeight: 500,
            color: isDragging ? '#3B82F6' : '#1A1A1A',
            letterSpacing: '-0.01em',
            transition: 'color 0.15s ease',
          }}
        >
          {isDragging ? 'ここにドロップ' : isMobile ? 'タップしてファイルを選択' : 'ファイルをドロップ、またはクリックして選択'}
        </p>
        <p
          style={{
            margin: 0,
            fontSize: '12px',
            color: '#888888',
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
            background: 'rgba(249, 115, 22, 0.08)',
            border: '1px solid rgba(249, 115, 22, 0.2)',
            borderRadius: '8px',
            padding: '10px 14px',
            animation: 'fadeIn 0.3s ease forwards',
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: '12px',
              color: '#F97316',
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
        <p style={{ margin: 0, fontSize: '12px', color: '#888888' }}>
          {currentFile.name} — {formatFileSize(currentFile.size)}
        </p>
      )}
    </div>
  );
}
