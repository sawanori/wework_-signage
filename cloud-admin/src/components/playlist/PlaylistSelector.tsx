'use client';

import React from 'react';
import type { PlaylistSummary } from '@non-turn/shared';

interface PlaylistSelectorProps {
  playlists: PlaylistSummary[];
  selectedPlaylistId: number | null;
  onSelect: (playlistId: number) => void;
  onCreateNew: () => void;
  maxPlaylists: number;
  loading: boolean;
}

export function PlaylistSelector({
  playlists,
  selectedPlaylistId,
  onSelect,
  onCreateNew,
  maxPlaylists,
  loading,
}: PlaylistSelectorProps) {
  const canCreate = playlists.length < maxPlaylists;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '4px',
        background: 'var(--bg-grouped, #F2F2F7)',
        borderRadius: '12px',
        marginBottom: '16px',
        flexWrap: 'wrap',
      }}
    >
      {playlists.map((playlist) => {
        const isSelected = playlist.id === selectedPlaylistId;
        return (
          <button
            key={playlist.id}
            onClick={() => onSelect(playlist.id)}
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              background: isSelected ? '#fff' : 'transparent',
              boxShadow: isSelected ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              color: isSelected ? 'var(--text-primary, #1D1D1F)' : 'var(--text-secondary, #6E6E73)',
              fontSize: '15px',
              fontWeight: isSelected ? 600 : 400,
              letterSpacing: '-0.01em',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease-out',
              flexShrink: 0,
            }}
          >
            <span>{playlist.name}</span>
            {playlist.isActive && (
              <span
                style={{
                  display: 'inline-block',
                  padding: '1px 6px',
                  background: '#34C759',
                  color: '#fff',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.02em',
                  lineHeight: 1.4,
                }}
              >
                LIVE
              </span>
            )}
          </button>
        );
      })}

      {/* New playlist button */}
      <button
        onClick={onCreateNew}
        disabled={!canCreate || loading}
        title={!canCreate ? `最大${maxPlaylists}件まで作成できます` : '新しいプレイリストを作成'}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '8px 12px',
          borderRadius: '8px',
          border: 'none',
          background: 'transparent',
          color: canCreate && !loading ? '#007AFF' : 'var(--text-tertiary, #86868B)',
          fontSize: '15px',
          fontWeight: 500,
          cursor: canCreate && !loading ? 'pointer' : 'not-allowed',
          transition: 'color 0.2s ease-out',
          flexShrink: 0,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
        </svg>
        新規
      </button>
    </div>
  );
}
