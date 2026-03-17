'use client';

import React from 'react';
import type { PlaylistItem as PlaylistItemType } from '@non-turn/shared';

interface PlaylistItemProps {
  item: PlaylistItemType;
  onDelete: (id: string) => void;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  isDragging?: boolean;
}

function formatDuration(ms: number | null): string {
  if (ms === null) return 'デフォルト';
  return `${(ms / 1000).toFixed(1)}秒`;
}

export function PlaylistItemCard({
  item,
  onDelete,
  dragHandleProps,
  isDragging = false,
}: PlaylistItemProps) {
  const [isHovered, setIsHovered] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  const handleDeleteClick = () => {
    if (confirmDelete) {
      onDelete(item.id);
    } else {
      setConfirmDelete(true);
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setConfirmDelete(false);
  };

  const isImage = item.type === 'image';

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        background: '#FFFFFF',
        borderRadius: '14px',
        padding: '12px 16px',
        boxShadow: isDragging
          ? '0 12px 36px rgba(0, 0, 0, 0.15)'
          : '0 2px 8px rgba(0, 0, 0, 0.04)',
        opacity: isDragging ? 0.9 : 1,
        transform: isDragging ? 'scale(1.02)' : 'scale(1)',
        transition: isDragging ? 'none' : 'all 0.2s cubic-bezier(0, 0, 0.58, 1)',
        cursor: isDragging ? 'grabbing' : 'default',
        animation: 'fadeInUp 0.3s cubic-bezier(0, 0, 0.58, 1) forwards',
      }}
    >
      {/* Drag handle */}
      <div
        {...dragHandleProps}
        style={{
          cursor: 'grab',
          color: 'var(--gray-3, #C7C7CC)',
          display: 'flex',
          flexDirection: 'column',
          gap: '3px',
          padding: '4px',
          flexShrink: 0,
          userSelect: 'none',
          ...(dragHandleProps?.style as React.CSSProperties),
        }}
      >
        <span style={{ display: 'block', width: '16px', height: '1.5px', background: 'currentColor', borderRadius: '1px' }} />
        <span style={{ display: 'block', width: '16px', height: '1.5px', background: 'currentColor', borderRadius: '1px' }} />
        <span style={{ display: 'block', width: '16px', height: '1.5px', background: 'currentColor', borderRadius: '1px' }} />
      </div>

      {/* Thumbnail */}
      <div
        style={{
          width: '80px',
          height: '80px',
          borderRadius: '10px',
          overflow: 'hidden',
          flexShrink: 0,
          background: 'var(--gray-6, #F2F2F7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.url}
            alt={item.id}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
            loading="lazy"
          />
        ) : (
          /* PDF icon */
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="9" y1="15" x2="15" y2="15" />
              <line x1="9" y1="11" x2="15" y2="11" />
            </svg>
            <span style={{ fontSize: '10px', fontWeight: 600, color: '#FF3B30' }}>PDF</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            margin: '0 0 4px',
            fontSize: '15px',
            fontWeight: 600,
            color: 'var(--text-primary, #1D1D1F)',
            letterSpacing: '-0.02em',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {item.id}
        </p>
        <p
          style={{
            margin: '0 0 4px',
            fontSize: '13px',
            color: 'var(--text-secondary, #6E6E73)',
          }}
        >
          {item.type === 'pdf' ? 'PDF（20秒/ページ固定）' : `表示時間: ${formatDuration(item.durationOverrideMs)}`}
        </p>
        <p
          style={{
            margin: 0,
            fontSize: '12px',
            color: 'var(--text-tertiary, #86868B)',
          }}
        >
          位置: {item.position}
        </p>
      </div>

      {/* Delete button */}
      <button
        onClick={handleDeleteClick}
        aria-label={confirmDelete ? `${item.id}を削除` : '削除'}
        style={{
          background: confirmDelete ? '#FF3B30' : isHovered ? 'rgba(255, 59, 48, 0.08)' : 'transparent',
          color: confirmDelete ? 'white' : '#FF3B30',
          border: 'none',
          borderRadius: '980px',
          padding: '6px 12px',
          fontSize: '13px',
          fontWeight: 500,
          cursor: 'pointer',
          transition: 'all 0.2s cubic-bezier(0, 0, 0.58, 1)',
          flexShrink: 0,
          opacity: isHovered || confirmDelete ? 1 : 0,
        }}
      >
        {confirmDelete ? '削除する' : '削除'}
      </button>
    </div>
  );
}
