'use client';

import React from 'react';
import type { PlaylistResponse, PlaylistItem } from '@non-turn/shared';
import { Card } from '@/components/ui/Card';
import { SortableList } from './SortableList';
import { GlobalSettingsPanel } from './GlobalSettingsPanel';

interface PlaylistEditorProps {
  playlist: PlaylistResponse;
  onDelete: (id: string) => void;
  onReorder: (items: PlaylistItem[]) => void;
  onSaveSettings: (settings: {
    fadeDurationMs: number;
    intervalMs: number;
    orientation: 'portrait' | 'landscape';
  }) => Promise<void>;
  loading?: boolean;
}

export function PlaylistEditor({
  playlist,
  onDelete,
  onReorder,
  onSaveSettings,
  loading = false,
}: PlaylistEditorProps) {
  const sortedItems = [...playlist.items].sort((a, b) => a.position - b.position);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 300px',
        gap: '20px',
        alignItems: 'start',
      }}
    >
      {/* Left: Playlist items */}
      <Card>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: '14px',
              fontWeight: 500,
              color: '#1A1A1A',
              letterSpacing: '-0.01em',
            }}
          >
            プレイリスト
          </h2>
          <span
            style={{
              fontSize: '11px',
              color: '#666666',
              background: '#F0F0F0',
              border: '1px solid #D5D5D5',
              borderRadius: '4px',
              padding: '3px 8px',
              letterSpacing: '0.02em',
            }}
          >
            {playlist.items.length} 件
          </span>
        </div>

        {sortedItems.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '48px 24px',
              color: '#666666',
            }}
          >
            <div
              style={{
                width: '44px',
                height: '44px',
                margin: '0 auto 14px',
                background: '#F0F0F0',
                border: '1px solid #D5D5D5',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <rect x="3" y="3" width="18" height="18" rx="3" />
                <path d="M3 9h18" />
                <path d="M9 21V9" />
              </svg>
            </div>
            <p style={{ margin: 0, fontSize: '14px', color: '#666666' }}>
              プレイリストにアイテムがありません
            </p>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#666666' }}>
              上のアップローダーからファイルを追加してください
            </p>
          </div>
        ) : (
          <SortableList
            items={sortedItems}
            onReorder={onReorder}
            onDelete={onDelete}
          />
        )}
      </Card>

      {/* Right: Settings panel */}
      <GlobalSettingsPanel
        playlist={playlist}
        onSave={onSaveSettings}
        loading={loading}
      />
    </div>
  );
}
