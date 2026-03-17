'use client';

import React, { useState } from 'react';
import type { PlaylistSummary } from '@non-turn/shared';

interface PlaylistDeleteButtonProps {
  playlist: PlaylistSummary;
  onDelete: (playlistId: number) => Promise<void>;
  loading: boolean;
}

export function PlaylistDeleteButton({
  playlist,
  onDelete,
  loading,
}: PlaylistDeleteButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isDisabled = playlist.isActive || loading;

  const handleConfirm = async () => {
    setDeleting(true);
    try {
      await onDelete(playlist.id);
      setShowModal(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        disabled={isDisabled}
        title={playlist.isActive ? 'アクティブなプレイリストは削除できません' : 'プレイリストを削除'}
        style={{
          padding: '8px 16px',
          borderRadius: '8px',
          border: '1px solid',
          borderColor: isDisabled ? 'var(--border, #D1D1D6)' : '#FF3B30',
          background: 'transparent',
          color: isDisabled ? 'var(--text-tertiary, #86868B)' : '#FF3B30',
          fontSize: '14px',
          fontWeight: 500,
          letterSpacing: '-0.01em',
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s ease-out',
        }}
      >
        削除
      </button>

      {showModal && (
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
            if (e.target === e.currentTarget) setShowModal(false);
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '16px',
              padding: '28px',
              maxWidth: '400px',
              width: '100%',
              boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            }}
          >
            <h3
              style={{
                margin: '0 0 12px',
                fontSize: '18px',
                fontWeight: 700,
                color: 'var(--text-primary, #1D1D1F)',
                letterSpacing: '-0.01em',
              }}
            >
              「{playlist.name}」を削除しますか？
            </h3>
            <p
              style={{
                margin: '0 0 24px',
                fontSize: '15px',
                color: 'var(--text-secondary, #6E6E73)',
                lineHeight: 1.5,
                letterSpacing: '-0.01em',
              }}
            >
              このプレイリストと{playlist.itemCount > 0 ? `含まれる${playlist.itemCount}件のアイテムが` : 'アイテムが'}削除されます。この操作は元に戻せません。
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowModal(false)}
                disabled={deleting}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: '1px solid var(--border, #D1D1D6)',
                  background: 'transparent',
                  color: 'var(--text-secondary, #6E6E73)',
                  fontSize: '15px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                キャンセル
              </button>
              <button
                onClick={() => void handleConfirm()}
                disabled={deleting}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#FF3B30',
                  color: '#fff',
                  fontSize: '15px',
                  fontWeight: 600,
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  opacity: deleting ? 0.7 : 1,
                }}
              >
                {deleting ? '削除中...' : '削除する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
