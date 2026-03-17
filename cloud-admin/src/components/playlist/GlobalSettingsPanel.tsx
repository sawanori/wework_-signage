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

  const inputStyle: React.CSSProperties = {
    flex: 1,
    height: '40px',
    padding: '0 12px',
    fontSize: '14px',
    color: '#FAFAFA',
    background: '#1C1C1C',
    border: '1px solid #2A2A2A',
    borderRadius: '8px',
    outline: 'none',
    letterSpacing: '-0.01em',
    fontFamily: 'inherit',
    transition: 'border-color 0.15s ease',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '11px',
    fontWeight: 500,
    color: '#6B6B6B',
    marginBottom: '8px',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  };

  return (
    <Card>
      <h3
        style={{
          margin: '0 0 20px',
          fontSize: '11px',
          fontWeight: 500,
          color: '#6B6B6B',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}
      >
        グローバル設定
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        {/* fadeDurationMs */}
        <div>
          <label htmlFor="fade-duration" style={labelStyle}>
            フェード時間（ミリ秒）
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input
              id="fade-duration"
              type="number"
              min={0}
              max={10000}
              step={100}
              value={fadeDurationMs}
              onChange={(e) => setFadeDurationMs(Math.max(0, parseInt(e.target.value, 10) || 0))}
              style={inputStyle}
              onFocus={(e) => {
                (e.currentTarget as HTMLInputElement).style.borderColor = '#3A3A3A';
              }}
              onBlur={(e) => {
                (e.currentTarget as HTMLInputElement).style.borderColor = '#2A2A2A';
              }}
            />
            <span
              style={{
                fontSize: '12px',
                color: '#6B6B6B',
                flexShrink: 0,
                minWidth: '36px',
              }}
            >
              {(fadeDurationMs / 1000).toFixed(1)}秒
            </span>
          </div>
        </div>

        {/* intervalMs */}
        <div>
          <label htmlFor="interval" style={labelStyle}>
            表示間隔（ミリ秒）
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input
              id="interval"
              type="number"
              min={1000}
              max={300000}
              step={1000}
              value={intervalMs}
              onChange={(e) => setIntervalMs(Math.max(1000, parseInt(e.target.value, 10) || 1000))}
              style={inputStyle}
              onFocus={(e) => {
                (e.currentTarget as HTMLInputElement).style.borderColor = '#3A3A3A';
              }}
              onBlur={(e) => {
                (e.currentTarget as HTMLInputElement).style.borderColor = '#2A2A2A';
              }}
            />
            <span
              style={{
                fontSize: '12px',
                color: '#6B6B6B',
                flexShrink: 0,
                minWidth: '36px',
              }}
            >
              {(intervalMs / 1000).toFixed(1)}秒
            </span>
          </div>
        </div>

        {/* Orientation */}
        <div>
          <p style={labelStyle}>向き</p>
          <div
            style={{
              display: 'flex',
              background: '#0F0F0F',
              border: '1px solid #2A2A2A',
              borderRadius: '8px',
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
                  height: '34px',
                  border: orientation === opt ? '1px solid #3A3A3A' : '1px solid transparent',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: orientation === opt ? 500 : 400,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  background: orientation === opt ? '#1C1C1C' : 'transparent',
                  color: orientation === opt ? '#FAFAFA' : '#6B6B6B',
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
            borderTop: '1px solid #2A2A2A',
            paddingTop: '14px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span
            style={{
              fontSize: '11px',
              color: '#6B6B6B',
              fontFamily: "'SF Mono', 'Fira Code', Menlo, Monaco, monospace",
              letterSpacing: '0.02em',
            }}
          >
            {playlist.version}
          </span>
          <span
            style={{
              fontSize: '11px',
              color: '#6B6B6B',
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
          variant={saved ? 'outline' : 'primary'}
          style={{ width: '100%' }}
        >
          {saved ? '保存しました' : '設定を保存'}
        </Button>
      </div>
    </Card>
  );
}
