'use client';

import React from 'react';
import type { UploadStatus } from '@/hooks/useUpload';

interface UploadProgressProps {
  filename: string;
  progress: number; // 0-100
  status: UploadStatus;
  error: string | null;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export function UploadProgress({
  filename,
  progress,
  status,
  error,
  onRetry,
  onDismiss,
}: UploadProgressProps) {
  if (status === 'idle') return null;

  return (
    <div
      style={{
        background: '#FFFFFF',
        borderRadius: '12px',
        padding: '16px',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.06)',
        animation: 'fadeInUp 0.3s cubic-bezier(0, 0, 0.58, 1) forwards',
      }}
    >
      {/* Filename */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
          gap: '16px',
        }}
      >
        <span
          style={{
            fontSize: '15px',
            color: 'var(--text-primary, #1D1D1F)',
            letterSpacing: '-0.02em',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}
        >
          {filename}
        </span>

        {/* Status icon */}
        {status === 'success' && (
          <span style={{ color: '#34C759', fontSize: '18px', flexShrink: 0 }}>
            ✓
          </span>
        )}
        {status === 'error' && (
          <span style={{ color: '#FF3B30', fontSize: '18px', flexShrink: 0 }}>
            ✕
          </span>
        )}
        {(status === 'uploading' || status === 'requesting') && (
          <span
            style={{
              fontSize: '12px',
              color: 'var(--text-secondary, #6E6E73)',
              flexShrink: 0,
            }}
          >
            {progress}%
          </span>
        )}
      </div>

      {/* Progress bar */}
      {(status === 'uploading' || status === 'requesting' || status === 'success') && (
        <div
          style={{
            height: '4px',
            background: 'var(--gray-5, #E5E5EA)',
            borderRadius: '2px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${status === 'success' ? 100 : progress}%`,
              background: status === 'success' ? '#34C759' : '#007AFF',
              borderRadius: '2px',
              transition: 'width 0.3s cubic-bezier(0, 0, 0.58, 1)',
            }}
          />
        </div>
      )}

      {/* Status text */}
      {status === 'requesting' && (
        <p style={{ margin: '8px 0 0', fontSize: '13px', color: 'var(--text-secondary, #6E6E73)' }}>
          アップロードを準備中...
        </p>
      )}
      {status === 'uploading' && (
        <p style={{ margin: '8px 0 0', fontSize: '13px', color: 'var(--text-secondary, #6E6E73)' }}>
          アップロード中...
        </p>
      )}
      {status === 'success' && (
        <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#34C759' }}>
          アップロード完了
        </p>
      )}

      {/* Error message */}
      {status === 'error' && error && (
        <div style={{ marginTop: '8px' }}>
          <p
            style={{
              margin: '0 0 8px',
              fontSize: '13px',
              color: '#FF3B30',
              letterSpacing: '-0.01em',
            }}
          >
            {error}
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            {onRetry && (
              <button
                onClick={onRetry}
                style={{
                  background: '#007AFF',
                  color: 'white',
                  border: 'none',
                  borderRadius: '980px',
                  padding: '6px 14px',
                  fontSize: '13px',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                再試行
              </button>
            )}
            {onDismiss && (
              <button
                onClick={onDismiss}
                style={{
                  background: 'transparent',
                  color: 'var(--text-secondary, #6E6E73)',
                  border: '1px solid var(--gray-4, #D1D1D6)',
                  borderRadius: '980px',
                  padding: '6px 14px',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                閉じる
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
