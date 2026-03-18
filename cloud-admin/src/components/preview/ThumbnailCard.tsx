'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/Card';

interface ThumbnailCardProps {
  url: string;
  filename: string;
  fileSize?: number;
  fileType: 'image' | 'pdf';
  className?: string;
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function ImageThumbnail({ url, alt }: { url: string; alt: string }) {
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div
        style={{
          width: '100%',
          height: '180px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-grouped, #F2F2F7)',
          borderRadius: '12px',
          color: 'var(--text-tertiary, #86868B)',
          gap: '8px',
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
        <span style={{ fontSize: '12px' }}>画像を読み込めません</span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      onError={() => setError(true)}
      style={{
        width: '100%',
        height: '180px',
        objectFit: 'cover',
        borderRadius: '12px',
        display: 'block',
      }}
    />
  );
}

function PdfThumbnail({ url }: { url: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function renderFirstPage() {
      if (!canvasRef.current) return;
      try {
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

        const pdf = await pdfjsLib.getDocument(url).promise;
        if (cancelled) return;

        const page = await pdf.getPage(1);
        if (cancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const viewport = page.getViewport({ scale: 1 });
        const containerWidth = canvas.parentElement?.clientWidth ?? 300;
        const scale = containerWidth / viewport.width;
        const scaledViewport = page.getViewport({ scale });

        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;

        const context = canvas.getContext('2d');
        if (!context) return;

        await page.render({
          canvasContext: context,
          viewport: scaledViewport,
        }).promise;

        if (!cancelled) setLoading(false);
      } catch {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    }

    void renderFirstPage();

    return () => {
      cancelled = true;
    };
  }, [url]);

  if (error) {
    return (
      <div
        style={{
          width: '100%',
          height: '180px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(255, 59, 48, 0.06)',
          borderRadius: '12px',
          color: '#FF3B30',
          gap: '8px',
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
        <span style={{ fontSize: '12px' }}>PDFを読み込めません</span>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'relative',
        borderRadius: '12px',
        overflow: 'hidden',
        background: 'var(--bg-grouped, #F2F2F7)',
      }}
    >
      {loading && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-grouped, #F2F2F7)',
            height: '180px',
          }}
        >
          <div
            style={{
              width: '20px',
              height: '20px',
              border: '2px solid #007AFF',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
        </div>
      )}
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
          maxHeight: '180px',
          objectFit: 'contain',
          opacity: loading ? 0 : 1,
          transition: 'opacity 0.3s',
        }}
      />
    </div>
  );
}

export function ThumbnailCard({
  url,
  filename,
  fileSize,
  fileType,
  className,
}: ThumbnailCardProps) {
  return (
    <Card
      className={className}
      hoverable
      padding="16px"
      style={{ animation: 'fadeInUp 0.4s cubic-bezier(0, 0, 0.58, 1) forwards' }}
    >
      {/* Thumbnail */}
      <div style={{ marginBottom: '12px' }}>
        {fileType === 'image' ? (
          <ImageThumbnail url={url} alt={filename} />
        ) : (
          <PdfThumbnail url={url} />
        )}
      </div>

      {/* Metadata */}
      <div>
        <p
          style={{
            margin: '0 0 4px',
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--text-primary, #1D1D1F)',
            letterSpacing: '-0.01em',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={filename}
        >
          {filename}
        </p>
        <div
          style={{
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
          }}
        >
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: fileType === 'pdf' ? '#FF3B30' : '#007AFF',
              background: fileType === 'pdf' ? 'rgba(255, 59, 48, 0.08)' : 'rgba(0, 122, 255, 0.08)',
              borderRadius: '4px',
              padding: '2px 6px',
              textTransform: 'uppercase',
            }}
          >
            {fileType === 'pdf' ? 'PDF' : 'IMAGE'}
          </span>
          {fileSize && (
            <span style={{ fontSize: '12px', color: 'var(--text-tertiary, #86868B)' }}>
              {formatFileSize(fileSize)}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
