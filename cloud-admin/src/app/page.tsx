'use client';

import React, { useState } from 'react';
import { FileUploader } from '@/components/uploader/FileUploader';
import { PlaylistEditor } from '@/components/playlist/PlaylistEditor';
import { PlaylistPreview } from '@/components/preview/PlaylistPreview';
import { FullscreenPreview } from '@/components/preview/FullscreenPreview';
import { Card } from '@/components/ui/Card';
import { usePlaylistEditor } from '@/hooks/usePlaylistEditor';

export default function Home() {
  const { state, addItem, deleteItem, reorderItems, updateSettings } = usePlaylistEditor();
  const { playlist, loading, error } = state;
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);

  const handleUploadComplete = async (fileId: string, publicUrl: string, file: File) => {
    const fileType = file.type === 'application/pdf' ? 'pdf' : 'image';
    await addItem(fileId, publicUrl, fileType, file.name);
  };

  const sortedItems = playlist
    ? [...playlist.items].sort((a, b) => a.position - b.position)
    : [];

  return (
    <div
      style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '40px 24px 80px',
      }}
    >
      {/* Page header */}
      <div
        style={{
          marginBottom: '40px',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: '24px',
          animation: 'fadeInUp 0.6s cubic-bezier(0, 0, 0.58, 1) forwards',
        }}
      >
        <div>
          <h1
            style={{
              margin: '0 0 8px',
              fontSize: '34px',
              fontWeight: 700,
              lineHeight: 1.06,
              letterSpacing: '-0.01em',
              color: 'var(--text-primary, #1D1D1F)',
            }}
          >
            Non-Turn Signage
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: '17px',
              color: 'var(--text-secondary, #6E6E73)',
              letterSpacing: '-0.02em',
            }}
          >
            サイネージコンテンツの管理・配信
          </p>
        </div>

        {/* Preview button — shown when playlist has items */}
        {playlist && sortedItems.length > 0 && (
          <button
            onClick={() => setIsFullscreenOpen(true)}
            style={{
              background: '#007AFF',
              color: '#fff',
              border: 'none',
              borderRadius: '980px',
              padding: '10px 20px',
              fontSize: '15px',
              fontWeight: 500,
              letterSpacing: '-0.01em',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'background 0.2s ease-out, transform 0.2s ease-out',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = '#0071E3';
              (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.02)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = '#007AFF';
              (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
            }}
            onMouseDown={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.98)';
            }}
            onMouseUp={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            プレビュー
          </button>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div
          style={{
            background: 'rgba(255, 59, 48, 0.08)',
            border: '1px solid rgba(255, 59, 48, 0.2)',
            borderRadius: '12px',
            padding: '12px 16px',
            marginBottom: '24px',
            animation: 'fadeIn 0.3s cubic-bezier(0, 0, 0.58, 1) forwards',
          }}
        >
          <p style={{ margin: 0, fontSize: '15px', color: '#FF3B30' }}>
            {error}
          </p>
        </div>
      )}

      {/* Main content: editor + mini preview */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: playlist && sortedItems.length > 0 ? '1fr 280px' : '1fr',
          gap: '32px',
          alignItems: 'start',
        }}
      >
        {/* Left column: upload + playlist editor */}
        <div>
          {/* Upload section */}
          <div
            style={{
              marginBottom: '32px',
              animation: 'fadeInUp 0.6s 0.1s cubic-bezier(0, 0, 0.58, 1) both',
            }}
          >
            <h2
              style={{
                margin: '0 0 16px',
                fontSize: '22px',
                fontWeight: 700,
                letterSpacing: '-0.01em',
                color: 'var(--text-primary, #1D1D1F)',
              }}
            >
              ファイルのアップロード
            </h2>
            <Card>
              <FileUploader onUploadComplete={handleUploadComplete} />
            </Card>
          </div>

          {/* Playlist section */}
          <div
            style={{
              animation: 'fadeInUp 0.6s 0.2s cubic-bezier(0, 0, 0.58, 1) both',
            }}
          >
            <h2
              style={{
                margin: '0 0 16px',
                fontSize: '22px',
                fontWeight: 700,
                letterSpacing: '-0.01em',
                color: 'var(--text-primary, #1D1D1F)',
              }}
            >
              プレイリスト管理
            </h2>

            {loading && !playlist ? (
              <Card>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '48px',
                    gap: '12px',
                    color: 'var(--text-secondary, #6E6E73)',
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
                  <span style={{ fontSize: '15px' }}>読み込み中...</span>
                </div>
              </Card>
            ) : playlist ? (
              <PlaylistEditor
                playlist={playlist}
                onDelete={deleteItem}
                onReorder={reorderItems}
                onSaveSettings={updateSettings}
                loading={loading}
              />
            ) : (
              <Card>
                <div
                  style={{
                    textAlign: 'center',
                    padding: '48px',
                    color: 'var(--text-tertiary, #86868B)',
                  }}
                >
                  <p style={{ margin: 0, fontSize: '15px' }}>
                    プレイリストを読み込めませんでした
                  </p>
                </div>
              </Card>
            )}
          </div>
        </div>

        {/* Right column: mini preview panel */}
        {playlist && sortedItems.length > 0 && (
          <div
            style={{
              position: 'sticky',
              top: '24px',
              animation: 'fadeInUp 0.6s 0.3s cubic-bezier(0, 0, 0.58, 1) both',
            }}
          >
            <Card padding="16px">
              {/* Panel header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '12px',
                }}
              >
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--text-secondary, #6E6E73)',
                    letterSpacing: '0.02em',
                    textTransform: 'uppercase',
                  }}
                >
                  ライブプレビュー
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    color: 'var(--text-tertiary, #86868B)',
                    background: 'var(--bg-grouped, #F2F2F7)',
                    borderRadius: '980px',
                    padding: '2px 8px',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {playlist.orientation === 'portrait' ? '縦 9:16' : '横 16:9'}
                </span>
              </div>

              {/* Mini preview */}
              <PlaylistPreview
                items={sortedItems}
                globalSettings={playlist.globalSettings}
                orientation={playlist.orientation}
                onOpenFullscreen={() => setIsFullscreenOpen(true)}
              />

              {/* Hint text */}
              <p
                style={{
                  margin: '10px 0 0',
                  fontSize: '12px',
                  color: 'var(--text-tertiary, #86868B)',
                  textAlign: 'center',
                  letterSpacing: '-0.01em',
                }}
              >
                ⛶ でフルスクリーン表示
              </p>
            </Card>
          </div>
        )}
      </div>

      {/* Fullscreen preview modal */}
      {playlist && (
        <FullscreenPreview
          isOpen={isFullscreenOpen}
          onClose={() => setIsFullscreenOpen(false)}
          items={sortedItems}
          globalSettings={playlist.globalSettings}
          orientation={playlist.orientation}
        />
      )}

      {/* Keyframe for spin animation */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
