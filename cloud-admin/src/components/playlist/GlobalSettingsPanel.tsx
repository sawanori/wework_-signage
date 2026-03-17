'use client';

import React, { useState, useEffect } from 'react';
import type { PlaylistResponse } from '@non-turn/shared';
import { Card } from '@/components/ui/Card';
import { Toggle } from '@/components/ui/Toggle';
import { Button } from '@/components/ui/Button';

interface GlobalSettingsPanelProps {
  playlist: PlaylistResponse;
  onSave: (settings: {
    fadeDurationMs: number;
    intervalMs: number;
    orientation: 'portrait' | 'landscape';
  }) => Promise<void>;
  loading?: boolean;
}

export function GlobalSettingsPanel({
  playlist,
  onSave,
  loading = false,
}: GlobalSettingsPanelProps) {
  const [fadeDurationMs, setFadeDurationMs] = useState(playlist.globalSettings.fadeDurationMs);
  const [intervalMs, setIntervalMs] = useState(playlist.globalSettings.intervalMs);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>(playlist.orientation);
  const [saved, setSaved] = useState(false);

  // Sync with external changes
  useEffect(() => {
    setFadeDurationMs(playlist.globalSettings.fadeDurationMs);
    setIntervalMs(playlist.globalSettings.intervalMs);
    setOrientation(playlist.orientation);
  }, [playlist]);

  const handleSave = async () => {
    await onSave({ fadeDurationMs, intervalMs, orientation });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const isDirty =
    fadeDurationMs !== playlist.globalSettings.fadeDurationMs ||
    intervalMs !== playlist.globalSettings.intervalMs ||
    orientation !== playlist.orientation;

  return (
    <Card>
      <h3
        style={{
          margin: '0 0 24px',
          fontSize: '17px',
          fontWeight: 600,
          color: 'var(--text-primary, #1D1D1F)',
          letterSpacing: '-0.02em',
        }}
      >
        グローバル設定
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* fadeDurationMs */}
        <div>
          <label
            htmlFor="fade-duration"
            style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--text-secondary, #6E6E73)',
              marginBottom: '8px',
              letterSpacing: '-0.01em',
            }}
          >
            フェード時間（ミリ秒）
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <input
              id="fade-duration"
              type="number"
              min={0}
              max={10000}
              step={100}
              value={fadeDurationMs}
              onChange={(e) => setFadeDurationMs(Math.max(0, parseInt(e.target.value, 10) || 0))}
              style={{
                flex: 1,
                height: '44px',
                padding: '0 16px',
                fontSize: '17px',
                color: 'var(--text-primary, #1D1D1F)',
                background: 'var(--bg-grouped, #F2F2F7)',
                border: '0.5px solid var(--gray-4, #D1D1D6)',
                borderRadius: '10px',
                outline: 'none',
                letterSpacing: '-0.02em',
                fontFamily: 'inherit',
              }}
            />
            <span
              style={{
                fontSize: '13px',
                color: 'var(--text-tertiary, #86868B)',
                flexShrink: 0,
              }}
            >
              {(fadeDurationMs / 1000).toFixed(1)}秒
            </span>
          </div>
        </div>

        {/* intervalMs */}
        <div>
          <label
            htmlFor="interval"
            style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--text-secondary, #6E6E73)',
              marginBottom: '8px',
              letterSpacing: '-0.01em',
            }}
          >
            表示間隔（ミリ秒）
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <input
              id="interval"
              type="number"
              min={1000}
              max={300000}
              step={1000}
              value={intervalMs}
              onChange={(e) => setIntervalMs(Math.max(1000, parseInt(e.target.value, 10) || 1000))}
              style={{
                flex: 1,
                height: '44px',
                padding: '0 16px',
                fontSize: '17px',
                color: 'var(--text-primary, #1D1D1F)',
                background: 'var(--bg-grouped, #F2F2F7)',
                border: '0.5px solid var(--gray-4, #D1D1D6)',
                borderRadius: '10px',
                outline: 'none',
                letterSpacing: '-0.02em',
                fontFamily: 'inherit',
              }}
            />
            <span
              style={{
                fontSize: '13px',
                color: 'var(--text-tertiary, #86868B)',
                flexShrink: 0,
              }}
            >
              {(intervalMs / 1000).toFixed(1)}秒
            </span>
          </div>
        </div>

        {/* Orientation */}
        <div>
          <p
            style={{
              margin: '0 0 12px',
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--text-secondary, #6E6E73)',
              letterSpacing: '-0.01em',
            }}
          >
            向き
          </p>
          <div
            style={{
              display: 'flex',
              background: 'var(--bg-grouped, #F2F2F7)',
              borderRadius: '10px',
              padding: '3px',
              gap: '3px',
            }}
          >
            {(['portrait', 'landscape'] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => setOrientation(opt)}
                style={{
                  flex: 1,
                  height: '36px',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: orientation === opt ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0, 0, 0.58, 1)',
                  background: orientation === opt ? '#FFFFFF' : 'transparent',
                  color: orientation === opt
                    ? 'var(--text-primary, #1D1D1F)'
                    : 'var(--text-secondary, #6E6E73)',
                  boxShadow: orientation === opt ? '0 1px 4px rgba(0, 0, 0, 0.08)' : 'none',
                  fontFamily: 'inherit',
                  letterSpacing: '-0.01em',
                }}
              >
                {opt === 'portrait' ? '縦（Portrait）' : '横（Landscape）'}
              </button>
            ))}
          </div>
        </div>

        {/* Version info */}
        <div
          style={{
            borderTop: '0.5px solid var(--gray-5, #E5E5EA)',
            paddingTop: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span
            style={{
              fontSize: '12px',
              color: 'var(--text-tertiary, #86868B)',
              fontFamily: "'SF Mono', Menlo, Monaco, monospace",
            }}
          >
            {playlist.version}
          </span>
          <span
            style={{
              fontSize: '12px',
              color: 'var(--text-tertiary, #86868B)',
            }}
          >
            {playlist.items.length} アイテム
          </span>
        </div>

        {/* Save button */}
        <Button
          onClick={handleSave}
          disabled={!isDirty || loading}
          loading={loading}
          variant={saved ? 'secondary' : 'primary'}
          style={{ width: '100%' }}
        >
          {saved ? '保存しました' : '設定を保存'}
        </Button>
      </div>
    </Card>
  );
}
