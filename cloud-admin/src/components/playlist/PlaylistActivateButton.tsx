'use client';

import React, { useState } from 'react';
import type { PlaylistSummary } from '@non-turn/shared';

interface PlaylistActivateButtonProps {
  playlist: PlaylistSummary;
  currentActiveName: string;
  onActivate: (playlistId: number) => Promise<void>;
  loading: boolean;
}

export function PlaylistActivateButton({
  playlist,
  currentActiveName,
  onActivate,
  loading,
}: PlaylistActivateButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [confirming, setConfirming] = useState(false);

  if (playlist.isActive) {
    return null;
  }

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await onActivate(playlist.id);
      setShowModal(false);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        disabled={loading}
        style={{
          padding: '8px 16px',
          borderRadius: '8px',
          border: '1px solid #007AFF',
          background: 'transparent',
          color: '#007AFF',
          fontSize: '14px',
          fontWeight: 500,
          letterSpacing: '-0.01em',
          cursor: loading ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s ease-out',
        }}
      >
        アクティブにする
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
              「{playlist.name}」をアクティブにしますか？
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
              現在の「{currentActiveName}」の配信が停止し、「{playlist.name}」の配信が開始されます。反映には最大2分程度かかります。
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowModal(false)}
                disabled={confirming}
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
                disabled={confirming}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#007AFF',
                  color: '#fff',
                  fontSize: '15px',
                  fontWeight: 600,
                  cursor: confirming ? 'not-allowed' : 'pointer',
                  opacity: confirming ? 0.7 : 1,
                }}
              >
                {confirming ? '処理中...' : 'アクティブにする'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
