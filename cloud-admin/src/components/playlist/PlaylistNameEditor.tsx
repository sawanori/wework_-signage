'use client';

import React, { useState } from 'react';

interface PlaylistNameEditorProps {
  playlistId: number;
  currentName: string;
  onRename: (playlistId: number, name: string) => Promise<void>;
  loading: boolean;
}

export function PlaylistNameEditor({
  playlistId,
  currentName,
  onRename,
  loading,
}: PlaylistNameEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('名前を入力してください');
      return;
    }
    if (trimmed.length > 50) {
      setError('50文字以内で入力してください');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onRename(playlistId, trimmed);
      setIsEditing(false);
    } catch {
      setError('名前の変更に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setName(currentName);
    setError(null);
    setIsEditing(false);
  };

  if (!isEditing) {
    return (
      <button
        onClick={() => setIsEditing(true)}
        disabled={loading}
        style={{
          padding: '8px 16px',
          borderRadius: '8px',
          border: '1px solid var(--border, #D1D1D6)',
          background: 'transparent',
          color: 'var(--text-secondary, #6E6E73)',
          fontSize: '14px',
          fontWeight: 500,
          letterSpacing: '-0.01em',
          cursor: loading ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s ease-out',
        }}
      >
        名前を変更
      </button>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
      <div>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleSave();
            if (e.key === 'Escape') handleCancel();
          }}
          maxLength={50}
          autoFocus
          style={{
            padding: '8px 12px',
            borderRadius: '8px',
            border: `1px solid ${error ? '#FF3B30' : '#007AFF'}`,
            fontSize: '14px',
            color: 'var(--text-primary, #1D1D1F)',
            outline: 'none',
            width: '160px',
          }}
        />
        {error && (
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#FF3B30' }}>{error}</p>
        )}
      </div>
      <button
        onClick={() => void handleSave()}
        disabled={saving}
        style={{
          padding: '8px 14px',
          borderRadius: '8px',
          border: 'none',
          background: '#007AFF',
          color: '#fff',
          fontSize: '14px',
          fontWeight: 500,
          cursor: saving ? 'not-allowed' : 'pointer',
          opacity: saving ? 0.7 : 1,
        }}
      >
        {saving ? '...' : '保存'}
      </button>
      <button
        onClick={handleCancel}
        disabled={saving}
        style={{
          padding: '8px 14px',
          borderRadius: '8px',
          border: '1px solid var(--border, #D1D1D6)',
          background: 'transparent',
          color: 'var(--text-secondary, #6E6E73)',
          fontSize: '14px',
          cursor: 'pointer',
        }}
      >
        キャンセル
      </button>
    </div>
  );
}
