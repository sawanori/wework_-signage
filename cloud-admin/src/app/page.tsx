'use client';

import React, { useState } from 'react';
import { FileUploader } from '@/components/uploader/FileUploader';
import { PlaylistEditor } from '@/components/playlist/PlaylistEditor';
import { PlaylistSelector } from '@/components/playlist/PlaylistSelector';
import { PlaylistActivateButton } from '@/components/playlist/PlaylistActivateButton';
import { PlaylistNameEditor } from '@/components/playlist/PlaylistNameEditor';
import { PlaylistDeleteButton } from '@/components/playlist/PlaylistDeleteButton';
import { PlaylistPreview } from '@/components/preview/PlaylistPreview';
import { FullscreenPreview } from '@/components/preview/FullscreenPreview';
import { Card } from '@/components/ui/Card';
import { usePlaylistEditor } from '@/hooks/usePlaylistEditor';

export default function Home() {
  const {
    state,
    addItem,
    deleteItem,
    reorderItems,
    updateSettings,
    selectPlaylist,
    createPlaylist,
    activatePlaylist,
    renamePlaylist,
    deletePlaylist,
  } = usePlaylistEditor();
  const { playlist, loading, error, playlists, selectedPlaylistId, playlistsLoading } = state;
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const handleUploadComplete = async (fileId: string, publicUrl: string, file: File) => {
    const fileType = file.type === 'application/pdf' ? 'pdf' : 'image';
    await addItem(fileId, publicUrl, fileType, file.name);
  };

  const sortedItems = playlist
    ? [...playlist.items].sort((a, b) => a.position - b.position)
    : [];

  const activePlaylist = playlists.find((p) => p.isActive);
  const selectedPlaylist = playlists.find((p) => p.id === selectedPlaylistId);

  const handleCreatePlaylist = async () => {
    const trimmed = newPlaylistName.trim();
    if (!trimmed) {
      setCreateError('名前を入力してください');
      return;
    }
    if (trimmed.length > 50) {
      setCreateError('50文字以内で入力してください');
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      await createPlaylist(trimmed);
      setShowCreateModal(false);
      setNewPlaylistName('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '作成に失敗しました';
      setCreateError(message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: '1600px',
        margin: '0 auto',
        padding: '40px 32px 80px',
      }}
    >
      {/* Page header */}
      <div
        style={{
          marginBottom: '48px',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: '24px',
          animation: 'fadeInUp 0.3s ease forwards',
        }}
      >
        <div>
          <h1
            style={{
              margin: '0 0 6px',
              fontSize: '36px',
              fontWeight: 600,
              lineHeight: 1.1,
              letterSpacing: '-0.025em',
              color: '#1A1A1A',
            }}
          >
            OG Signage
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: '14px',
              color: '#666666',
              letterSpacing: '-0.01em',
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
              background: 'transparent',
              color: '#1A1A1A',
              border: '1px solid #D5D5D5',
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: '14px',
              fontWeight: 500,
              letterSpacing: '-0.01em',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'background 0.15s ease, border-color 0.15s ease',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.04)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#BBBBBB';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#D5D5D5';
            }}
          >
            <svg
              width="14"
              height="14"
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
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '24px',
            animation: 'fadeIn 0.3s ease forwards',
          }}
        >
          <p style={{ margin: 0, fontSize: '14px', color: '#EF4444' }}>
            {error}
          </p>
        </div>
      )}

      {/* Main content: editor + mini preview */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: playlist && sortedItems.length > 0 ? '1fr 500px' : '1fr',
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
              animation: 'fadeInUp 0.3s 0.05s ease both',
            }}
          >
            <h2
              style={{
                margin: '0 0 4px',
                fontSize: '11px',
                fontWeight: 500,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                color: '#666666',
              }}
            >
              ファイルのアップロード
            </h2>
            <div style={{ marginBottom: '12px' }} />
            <Card>
              <FileUploader onUploadComplete={handleUploadComplete} />
            </Card>
          </div>

          {/* Playlist section */}
          <div
            style={{
              animation: 'fadeInUp 0.3s 0.1s ease both',
            }}
          >
            <h2
              style={{
                margin: '0 0 4px',
                fontSize: '11px',
                fontWeight: 500,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                color: '#666666',
              }}
            >
              プレイリスト管理
            </h2>
            <div style={{ marginBottom: '12px' }} />

            {/* Playlist selector tabs */}
            {!playlistsLoading && playlists.length > 0 && (
              <PlaylistSelector
                playlists={playlists}
                selectedPlaylistId={selectedPlaylistId}
                onSelect={selectPlaylist}
                onCreateNew={() => setShowCreateModal(true)}
                maxPlaylists={3}
                loading={loading}
              />
            )}

            {/* Selected playlist actions */}
            {selectedPlaylist && playlists.length > 1 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '16px',
                  flexWrap: 'wrap',
                }}
              >
                {!selectedPlaylist.isActive && (
                  <PlaylistActivateButton
                    playlist={selectedPlaylist}
                    currentActiveName={activePlaylist?.name ?? ''}
                    onActivate={activatePlaylist}
                    loading={loading}
                  />
                )}
                <PlaylistNameEditor
                  playlistId={selectedPlaylist.id}
                  currentName={selectedPlaylist.name}
                  onRename={renamePlaylist}
                  loading={loading}
                />
                <PlaylistDeleteButton
                  playlist={selectedPlaylist}
                  onDelete={deletePlaylist}
                  loading={loading}
                />
              </div>
            )}

            {loading && !playlist ? (
              <Card>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '48px',
                    gap: '12px',
                    color: '#666666',
                  }}
                >
                  <div
                    style={{
                      width: '16px',
                      height: '16px',
                      border: '1.5px solid #3B82F6',
                      borderTopColor: 'transparent',
                      borderRadius: '50%',
                      animation: 'spin 0.8s linear infinite',
                    }}
                  />
                  <span style={{ fontSize: '14px' }}>読み込み中...</span>
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
                    color: '#666666',
                  }}
                >
                  <p style={{ margin: 0, fontSize: '14px' }}>
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
              top: '72px',
              animation: 'fadeInUp 0.3s 0.15s ease both',
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
                    fontSize: '11px',
                    fontWeight: 500,
                    color: '#666666',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                  }}
                >
                  ライブプレビュー
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    color: '#666666',
                    background: '#F0F0F0',
                    border: '1px solid #D5D5D5',
                    borderRadius: '4px',
                    padding: '2px 8px',
                    letterSpacing: '0.02em',
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
                  color: '#666666',
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

      {/* Create playlist modal */}
      {showCreateModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '24px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowCreateModal(false);
              setNewPlaylistName('');
              setCreateError(null);
            }
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #D5D5D5',
              borderRadius: '12px',
              padding: '28px',
              maxWidth: '400px',
              width: '100%',
            }}
          >
            <h3
              style={{
                margin: '0 0 20px',
                fontSize: '16px',
                fontWeight: 600,
                color: '#1A1A1A',
                letterSpacing: '-0.01em',
              }}
            >
              新しいプレイリストを作成
            </h3>
            <div style={{ marginBottom: '20px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '11px',
                  fontWeight: 500,
                  color: '#666666',
                  marginBottom: '8px',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                }}
              >
                プレイリスト名
              </label>
              <input
                type="text"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleCreatePlaylist();
                  if (e.key === 'Escape') {
                    setShowCreateModal(false);
                    setNewPlaylistName('');
                    setCreateError(null);
                  }
                }}
                placeholder="例: 春メニュー"
                maxLength={50}
                autoFocus
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: `1px solid ${createError ? '#EF4444' : '#D5D5D5'}`,
                  fontSize: '14px',
                  color: '#1A1A1A',
                  background: '#F0F0F0',
                  outline: 'none',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                }}
              />
              {createError && (
                <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#EF4444' }}>{createError}</p>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewPlaylistName('');
                  setCreateError(null);
                }}
                disabled={creating}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid #D5D5D5',
                  background: 'transparent',
                  color: '#666666',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.04)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                }}
              >
                キャンセル
              </button>
              <button
                onClick={() => void handleCreatePlaylist()}
                disabled={creating || !newPlaylistName.trim()}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: creating || !newPlaylistName.trim() ? '#D5D5D5' : '#1A1A1A',
                  color: creating || !newPlaylistName.trim() ? '#999999' : '#FFFFFF',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: creating || !newPlaylistName.trim() ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  const btn = e.currentTarget as HTMLButtonElement;
                  if (!btn.disabled) btn.style.background = '#333333';
                }}
                onMouseLeave={(e) => {
                  const btn = e.currentTarget as HTMLButtonElement;
                  if (!btn.disabled) btn.style.background = '#1A1A1A';
                }}
              >
                {creating ? '作成中...' : '作成する'}
              </button>
            </div>
          </div>
        </div>
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
