'use client';

import { useState, useCallback } from 'react';

export type UploadStatus = 'idle' | 'requesting' | 'uploading' | 'success' | 'error';

export interface UploadState {
  status: UploadStatus;
  progress: number; // 0-100
  error: string | null;
  fileId: string | null;
  publicUrl: string | null;
}

export interface UploadResult {
  fileId: string;
  publicUrl: string;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_FILE_SIZE = 30 * 1024 * 1024; // 30MB

export function useUpload() {
  const [state, setState] = useState<UploadState>({
    status: 'idle',
    progress: 0,
    error: null,
    fileId: null,
    publicUrl: null,
  });

  const reset = useCallback(() => {
    setState({
      status: 'idle',
      progress: 0,
      error: null,
      fileId: null,
      publicUrl: null,
    });
  }, []);

  const upload = useCallback(async (file: File): Promise<UploadResult | null> => {
    // Client-side validation
    if (!ALLOWED_TYPES.includes(file.type)) {
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: `対応していないファイル形式です。JPEG, PNG, WebP, PDFのみアップロード可能です。`,
      }));
      return null;
    }

    if (file.size > MAX_FILE_SIZE) {
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: `ファイルサイズが30MBを超えています（${(file.size / 1024 / 1024).toFixed(1)}MB）。`,
      }));
      return null;
    }

    try {
      // Step 1: Get presigned URL from API
      setState({ status: 'requesting', progress: 0, error: null, fileId: null, publicUrl: null });

      const uploadMeta = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY ?? ''}`,
        },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          fileSize: file.size,
        }),
      });

      if (!uploadMeta.ok) {
        const data = await uploadMeta.json().catch(() => ({}));
        throw new Error(
          (data as { error?: string }).error ?? `Upload request failed (${uploadMeta.status})`
        );
      }

      const { uploadUrl, fileId, publicUrl } = (await uploadMeta.json()) as {
        uploadUrl: string;
        fileId: string;
        publicUrl: string;
      };

      // Step 2: Upload file directly to R2 using presigned URL with progress tracking
      setState((prev) => ({ ...prev, status: 'uploading', progress: 0 }));

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            setState((prev) => ({ ...prev, progress: percent }));
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`R2 upload failed (${xhr.status})`));
          }
        };

        xhr.onerror = () => reject(new Error('ネットワークエラーが発生しました。'));
        xhr.onabort = () => reject(new Error('アップロードがキャンセルされました。'));

        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
      });

      setState({ status: 'success', progress: 100, error: null, fileId, publicUrl });
      return { fileId, publicUrl };

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'アップロードに失敗しました。';
      setState((prev) => ({ ...prev, status: 'error', error: message }));
      return null;
    }
  }, []);

  return { state, upload, reset };
}
