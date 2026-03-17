'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { PlaylistItem, GlobalSettings } from '@non-turn/shared';

interface PlaylistPreviewProps {
  items: PlaylistItem[];
  globalSettings: GlobalSettings;
  orientation: 'portrait' | 'landscape';
  onOpenFullscreen?: () => void;
}

function getAspectStyle(orientation: 'portrait' | 'landscape'): React.CSSProperties {
  if (orientation === 'portrait') {
    // 9:16 — fix width, let height scale
    return { aspectRatio: '9 / 16' };
  }
  // 16:9
  return { aspectRatio: '16 / 9' };
}

export function PlaylistPreview({
  items,
  globalSettings,
  orientation,
  onOpenFullscreen,
}: PlaylistPreviewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [nextIndex, setNextIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isFading, setIsFading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const total = items.length;

  const getEffectiveDuration = useCallback(
    (item: PlaylistItem) => item.durationOverrideMs ?? globalSettings.intervalMs,
    [globalSettings.intervalMs]
  );

  const advanceTo = useCallback(
    (targetIndex: number) => {
      if (total === 0) return;
      setNextIndex(targetIndex);
      setIsFading(true);
      const fadeDur = globalSettings.fadeDurationMs;
      fadeTimerRef.current = setTimeout(() => {
        setCurrentIndex(targetIndex);
        setNextIndex(null);
        setIsFading(false);
      }, fadeDur);
    },
    [total, globalSettings.fadeDurationMs]
  );

  const handleNext = useCallback(() => {
    if (total === 0) return;
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    if (timerRef.current) clearTimeout(timerRef.current);
    const target = (currentIndex + 1) % total;
    advanceTo(target);
  }, [currentIndex, total, advanceTo]);

  const handlePrev = useCallback(() => {
    if (total === 0) return;
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    if (timerRef.current) clearTimeout(timerRef.current);
    const target = (currentIndex - 1 + total) % total;
    advanceTo(target);
  }, [currentIndex, total, advanceTo]);

  // Auto-advance timer
  useEffect(() => {
    if (!isPlaying || total === 0) return;
    const item = items[currentIndex];
    if (!item) return;
    const duration = getEffectiveDuration(item);
    timerRef.current = setTimeout(() => {
      const target = (currentIndex + 1) % total;
      advanceTo(target);
    }, duration);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentIndex, isPlaying, total, items, getEffectiveDuration, advanceTo]);

  // Reset to first slide when items change
  useEffect(() => {
    setCurrentIndex(0);
    setNextIndex(null);
    setIsFading(false);
  }, [items]);

  if (total === 0) {
    return (
      <div
        style={{
          position: 'relative',
          width: '100%',
          ...getAspectStyle(orientation),
          background: '#1C1C1E',
          borderRadius: '12px',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            fontSize: '13px',
            color: 'rgba(255,255,255,0.4)',
            letterSpacing: '-0.01em',
          }}
        >
          スライドなし
        </span>
      </div>
    );
  }

  const currentItem = items[currentIndex];
  const nextItem = nextIndex !== null ? items[nextIndex] : null;
  const fadeDur = globalSettings.fadeDurationMs;
  const slideLabel = `${currentIndex + 1} / ${total}`;

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        ...getAspectStyle(orientation),
        borderRadius: '12px',
        overflow: 'hidden',
        background: '#000',
        userSelect: 'none',
      }}
    >
      {/* Current slide */}
      <SlideLayer
        item={currentItem}
        opacity={isFading ? 0 : 1}
        fadeDurationMs={fadeDur}
        zIndex={1}
      />

      {/* Next slide (fading in) */}
      {nextItem && (
        <SlideLayer
          item={nextItem}
          opacity={isFading ? 1 : 0}
          fadeDurationMs={fadeDur}
          zIndex={2}
        />
      )}

      {/* Control bar (glassmorphism, bottom) */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          background: 'rgba(0, 0, 0, 0.45)',
          backdropFilter: 'saturate(180%) blur(16px)',
          WebkitBackdropFilter: 'saturate(180%) blur(16px)',
          borderTop: '0.5px solid rgba(255, 255, 255, 0.12)',
          gap: '8px',
        }}
      >
        {/* Prev */}
        <ControlButton onClick={handlePrev} label="前へ" title="前のスライド">
          ◀
        </ControlButton>

        {/* Play / Pause */}
        <ControlButton
          onClick={() => setIsPlaying((p) => !p)}
          label={isPlaying ? '一時停止' : '再生'}
          title={isPlaying ? '一時停止' : '再生'}
        >
          {isPlaying ? '⏸' : '▶'}
        </ControlButton>

        {/* Slide number */}
        <span
          style={{
            flex: 1,
            textAlign: 'center',
            fontSize: '12px',
            color: 'rgba(255,255,255,0.7)',
            letterSpacing: '0.02em',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {slideLabel}
        </span>

        {/* Next */}
        <ControlButton onClick={handleNext} label="次へ" title="次のスライド">
          ▶
        </ControlButton>

        {/* Fullscreen */}
        {onOpenFullscreen && (
          <ControlButton onClick={onOpenFullscreen} label="フルスクリーン" title="フルスクリーンで表示">
            ⛶
          </ControlButton>
        )}
      </div>
    </div>
  );
}

// ---- Internal sub-components ----

interface SlideLayerProps {
  item: PlaylistItem;
  opacity: 0 | 1;
  fadeDurationMs: number;
  zIndex: number;
}

function SlideLayer({ item, opacity, fadeDurationMs, zIndex }: SlideLayerProps) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        opacity,
        transition: `opacity ${fadeDurationMs}ms ease-out`,
        zIndex,
      }}
    >
      {/* bg-blur layer */}
      <div
        className="preview-bg-blur"
        style={{ backgroundImage: `url('${item.url}')` }}
      />
      {/* fg-image layer */}
      {item.type === 'pdf' ? (
        // PDF: show a placeholder icon (thumbnail generation is complex)
        <div
          className="preview-fg-image"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: '8px',
            color: 'rgba(255,255,255,0.8)',
          }}
        >
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          <span style={{ fontSize: '11px', letterSpacing: '-0.01em' }}>PDF</span>
        </div>
      ) : (
        <img
          className="preview-fg-image"
          src={item.url}
          alt=""
          draggable={false}
        />
      )}
    </div>
  );
}

interface ControlButtonProps {
  onClick: () => void;
  label: string;
  title: string;
  children: React.ReactNode;
}

function ControlButton({ onClick, label, title, children }: ControlButtonProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={label}
      style={{
        background: 'rgba(255,255,255,0.15)',
        border: 'none',
        borderRadius: '6px',
        color: 'rgba(255,255,255,0.9)',
        fontSize: '12px',
        width: '28px',
        height: '28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'background 0.2s ease-out, transform 0.2s ease-out',
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.25)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.15)';
      }}
      onMouseDown={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.9)';
      }}
      onMouseUp={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
      }}
    >
      {children}
    </button>
  );
}
