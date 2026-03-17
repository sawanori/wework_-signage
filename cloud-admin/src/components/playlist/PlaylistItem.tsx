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
        gap: '12px',
        background: isDragging ? '#1C1C1C' : isHovered ? '#181818' : '#141414',
        borderRadius: '10px',
        padding: '10px 14px',
        border: isDragging
          ? '1px solid #3A3A3A'
          : '1px solid #2A2A2A',
        opacity: isDragging ? 0.95 : 1,
        transform: isDragging ? 'scale(1.01)' : 'scale(1)',
        transition: isDragging ? 'none' : 'background 0.15s ease, border-color 0.15s ease',
        cursor: isDragging ? 'grabbing' : 'default',
      }}
    >
      {/* Drag handle */}
      <div
        {...dragHandleProps}
        style={{
          cursor: 'grab',
          color: '#3A3A3A',
          display: 'flex',
          flexDirection: 'column',
          gap: '3px',
          padding: '4px',
          flexShrink: 0,
          userSelect: 'none',
          ...(dragHandleProps?.style as React.CSSProperties),
        }}
      >
        <span style={{ display: 'block', width: '14px', height: '1.5px', background: 'currentColor', borderRadius: '1px' }} />
        <span style={{ display: 'block', width: '14px', height: '1.5px', background: 'currentColor', borderRadius: '1px' }} />
        <span style={{ display: 'block', width: '14px', height: '1.5px', background: 'currentColor', borderRadius: '1px' }} />
      </div>

      {/* Thumbnail */}
      <div
        style={{
          width: '64px',
          height: '64px',
          borderRadius: '8px',
          overflow: 'hidden',
          flexShrink: 0,
          background: '#1C1C1C',
          border: '1px solid #2A2A2A',
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
              gap: '3px',
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="9" y1="15" x2="15" y2="15" />
              <line x1="9" y1="11" x2="15" y2="11" />
            </svg>
            <span style={{ fontSize: '9px', fontWeight: 600, color: '#EF4444', letterSpacing: '0.05em' }}>PDF</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            margin: '0 0 3px',
            fontSize: '14px',
            fontWeight: 500,
            color: '#FAFAFA',
            letterSpacing: '-0.01em',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {item.id}
        </p>
        <p
          style={{
            margin: '0 0 2px',
            fontSize: '12px',
            color: '#A1A1A1',
          }}
        >
          {item.type === 'pdf' ? 'PDF（20秒/ページ固定）' : `表示時間: ${formatDuration(item.durationOverrideMs)}`}
        </p>
        <p
          style={{
            margin: 0,
            fontSize: '11px',
            color: '#6B6B6B',
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
          background: confirmDelete ? '#EF4444' : 'transparent',
          color: confirmDelete ? 'white' : '#EF4444',
          border: confirmDelete ? 'none' : '1px solid rgba(239,68,68,0.3)',
          borderRadius: '6px',
          padding: '5px 10px',
          fontSize: '12px',
          fontWeight: 500,
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          flexShrink: 0,
          opacity: isHovered || confirmDelete ? 1 : 0,
          fontFamily: 'inherit',
        }}
      >
        {confirmDelete ? '削除する' : '削除'}
      </button>
    </div>
  );
}
