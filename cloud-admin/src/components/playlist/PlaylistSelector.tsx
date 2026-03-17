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
        gap: '4px',
        padding: '4px',
        background: '#0F0F0F',
        border: '1px solid #2A2A2A',
        borderRadius: '10px',
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
              gap: '8px',
              padding: '7px 14px',
              borderRadius: '7px',
              border: isSelected ? '1px solid #3A3A3A' : '1px solid transparent',
              background: isSelected ? '#1C1C1C' : 'transparent',
              color: isSelected ? '#FAFAFA' : '#6B6B6B',
              fontSize: '14px',
              fontWeight: isSelected ? 500 : 400,
              letterSpacing: '-0.01em',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
              flexShrink: 0,
              fontFamily: 'inherit',
            }}
            onMouseEnter={(e) => {
              if (!isSelected && !loading) {
                (e.currentTarget as HTMLButtonElement).style.color = '#A1A1A1';
              }
            }}
            onMouseLeave={(e) => {
              if (!isSelected) {
                (e.currentTarget as HTMLButtonElement).style.color = '#6B6B6B';
              }
            }}
          >
            <span>{playlist.name}</span>
            {playlist.isActive && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 6px',
                  background: 'rgba(34, 197, 94, 0.12)',
                  color: '#22C55E',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  lineHeight: 1.4,
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: '5px',
                    height: '5px',
                    borderRadius: '50%',
                    background: '#22C55E',
                    flexShrink: 0,
                  }}
                />
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
          padding: '7px 12px',
          borderRadius: '7px',
          border: '1px solid transparent',
          background: 'transparent',
          color: canCreate && !loading ? '#6B6B6B' : '#3A3A3A',
          fontSize: '13px',
          fontWeight: 500,
          cursor: canCreate && !loading ? 'pointer' : 'not-allowed',
          transition: 'color 0.15s ease',
          flexShrink: 0,
          fontFamily: 'inherit',
        }}
        onMouseEnter={(e) => {
          if (canCreate && !loading) {
            (e.currentTarget as HTMLButtonElement).style.color = '#A1A1A1';
          }
        }}
        onMouseLeave={(e) => {
          if (canCreate && !loading) {
            (e.currentTarget as HTMLButtonElement).style.color = '#6B6B6B';
          }
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
        </svg>
        新規
      </button>
    </div>
  );
}
