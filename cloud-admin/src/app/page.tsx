'use client';

import React from 'react';
import { FileUploader } from '@/components/uploader/FileUploader';
import { PlaylistEditor } from '@/components/playlist/PlaylistEditor';
import { Card } from '@/components/ui/Card';
import { usePlaylistEditor } from '@/hooks/usePlaylistEditor';

export default function Home() {
  const { state, addItem, deleteItem, reorderItems, updateSettings } = usePlaylistEditor();
  const { playlist, loading, error } = state;

  const handleUploadComplete = async (fileId: string, publicUrl: string, file: File) => {
    const fileType = file.type === 'application/pdf' ? 'pdf' : 'image';
    await addItem(fileId, publicUrl, fileType, file.name);
  };

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
          animation: 'fadeInUp 0.6s cubic-bezier(0, 0, 0.58, 1) forwards',
        }}
      >
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

      {/* Keyframe for spin animation in this component */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
