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
        gridTemplateColumns: '1fr 320px',
        gap: '24px',
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
            marginBottom: '24px',
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: '17px',
              fontWeight: 600,
              color: 'var(--text-primary, #1D1D1F)',
              letterSpacing: '-0.02em',
            }}
          >
            プレイリスト
          </h2>
          <span
            style={{
              fontSize: '13px',
              color: 'var(--text-secondary, #6E6E73)',
              background: 'var(--bg-grouped, #F2F2F7)',
              borderRadius: '980px',
              padding: '4px 10px',
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
              color: 'var(--text-tertiary, #86868B)',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                margin: '0 auto 16px',
                background: 'var(--bg-grouped, #F2F2F7)',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg
                width="24"
                height="24"
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
            <p style={{ margin: 0, fontSize: '15px' }}>
              プレイリストにアイテムがありません
            </p>
            <p style={{ margin: '4px 0 0', fontSize: '13px' }}>
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
