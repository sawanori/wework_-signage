'use client';

import React, { useState, useEffect, useRef } from 'react';
import type { PlaylistItem, GlobalSettings } from '@non-turn/shared';

interface PlaylistPreviewProps {
  items: PlaylistItem[];
  globalSettings: GlobalSettings;
  orientation: 'portrait' | 'landscape';
  onOpenFullscreen?: () => void;
}

export function PlaylistPreview({
  items,
  globalSettings,
  orientation,
  onOpenFullscreen,
}: PlaylistPreviewProps) {
  const [index, setIndex] = useState(0);
  const [opacity, setOpacity] = useState(1);
  const [playing, setPlaying] = useState(true);
  const indexRef = useRef(0);
  const playingRef = useRef(true);
  const intervalRef = useRef<number | null>(null);

  const total = items.length;
  const fadeDur = globalSettings.fadeDurationMs;
  const showDur = globalSettings.intervalMs;

  // Keep refs in sync
  useEffect(() => { indexRef.current = index; }, [index]);
  useEffect(() => { playingRef.current = playing; }, [playing]);

  // Main slideshow loop
  useEffect(() => {
    if (total <= 1 || !playing) {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      return;
    }

    // Total cycle: showDur (visible) + fadeDur (fade out) + fadeDur (fade in)
    const cycleDur = showDur + fadeDur * 2;

    const tick = () => {
      if (!playingRef.current) return;
      // Fade out
      setOpacity(0);
      // After fade out, swap slide and fade in
      setTimeout(() => {
        const next = (indexRef.current + 1) % total;
        indexRef.current = next;
        setIndex(next);
        // Let the DOM update, then fade in
        requestAnimationFrame(() => {
          setOpacity(1);
        });
      }, fadeDur);
    };

    // First tick after showDur
    const firstTimeout = setTimeout(tick, showDur);
    // Then repeat every cycleDur
    const repeatInterval = setInterval(tick, cycleDur);

    intervalRef.current = repeatInterval as unknown as number;

    return () => {
      clearTimeout(firstTimeout);
      clearInterval(repeatInterval);
    };
  }, [total, fadeDur, showDur, playing]);

  // Reset on items change
  const itemsKey = items.map(i => i.id).join(',');
  useEffect(() => {
    setIndex(0);
    indexRef.current = 0;
    setOpacity(1);
  }, [itemsKey]);

  const handleNext = () => {
    if (total <= 1) return;
    setOpacity(0);
    setTimeout(() => {
      const next = (indexRef.current + 1) % total;
      indexRef.current = next;
      setIndex(next);
      requestAnimationFrame(() => setOpacity(1));
    }, fadeDur);
  };

  const handlePrev = () => {
    if (total <= 1) return;
    setOpacity(0);
    setTimeout(() => {
      const prev = (indexRef.current - 1 + total) % total;
      indexRef.current = prev;
      setIndex(prev);
      requestAnimationFrame(() => setOpacity(1));
    }, fadeDur);
  };

  if (total === 0) {
    return (
      <div style={{
        position: 'relative', width: '100%',
        aspectRatio: orientation === 'portrait' ? '9 / 16' : '16 / 9',
        background: '#1C1C1E', borderRadius: '12px', overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>スライドなし</span>
      </div>
    );
  }

  const item = items[index] ?? items[0];

  return (
    <div style={{
      position: 'relative', width: '100%',
      aspectRatio: orientation === 'portrait' ? '9 / 16' : '16 / 9',
      borderRadius: '12px', overflow: 'hidden', background: '#000', userSelect: 'none',
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        opacity: opacity,
        transition: `opacity ${fadeDur}ms ease-in-out`,
        zIndex: 1,
      }}>
        <div className="preview-bg-blur" style={{ backgroundImage: `url('${item.url}')` }} />
        {item.type === 'pdf' ? (
          <div className="preview-fg-image" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: '8px', color: 'rgba(255,255,255,0.8)',
          }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <span style={{ fontSize: '11px' }}>PDF</span>
          </div>
        ) : (
          <img className="preview-fg-image" src={item.url} alt="" draggable={false} />
        )}
      </div>

      {/* Controls */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px',
        background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'saturate(180%) blur(16px)',
        WebkitBackdropFilter: 'saturate(180%) blur(16px)',
        borderTop: '0.5px solid rgba(255,255,255,0.12)',
        gap: '8px',
      }}>
        <Btn onClick={handlePrev} title="前へ">◀</Btn>
        <Btn onClick={() => setPlaying(p => !p)} title={playing ? '一時停止' : '再生'}>
          {playing ? '⏸' : '▶'}
        </Btn>
        <span style={{
          flex: 1, textAlign: 'center', fontSize: '12px',
          color: 'rgba(255,255,255,0.7)', fontVariantNumeric: 'tabular-nums',
        }}>
          {index + 1} / {total}
        </span>
        <Btn onClick={handleNext} title="次へ">▶</Btn>
        {onOpenFullscreen && <Btn onClick={onOpenFullscreen} title="フルスクリーン">⛶</Btn>}
      </div>
    </div>
  );
}

function Btn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={title} aria-label={title} style={{
      background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '6px',
      color: 'rgba(255,255,255,0.9)', fontSize: '12px', width: '28px', height: '28px',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0,
    }}>{children}</button>
  );
}
