'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { PlaylistItem, GlobalSettings } from '@non-turn/shared';

interface FullscreenPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  items: PlaylistItem[];
  globalSettings: GlobalSettings;
  orientation: 'portrait' | 'landscape';
}

export function FullscreenPreview({
  isOpen,
  onClose,
  items,
  globalSettings,
  orientation,
}: FullscreenPreviewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [nextIndex, setNextIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isFading, setIsFading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const total = items.length;

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === ' ') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, onClose]);

  const advanceTo = useCallback(
    (targetIndex: number) => {
      if (total === 0) return;
      setNextIndex(targetIndex);
      setIsFading(true);
      fadeTimerRef.current = setTimeout(() => {
        setCurrentIndex(targetIndex);
        setNextIndex(null);
        setIsFading(false);
      }, globalSettings.fadeDurationMs);
    },
    [total, globalSettings.fadeDurationMs]
  );

  const handleNext = useCallback(() => {
    if (total === 0) return;
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    if (timerRef.current) clearTimeout(timerRef.current);
    advanceTo((currentIndex + 1) % total);
  }, [currentIndex, total, advanceTo]);

  const handlePrev = useCallback(() => {
    if (total === 0) return;
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    if (timerRef.current) clearTimeout(timerRef.current);
    advanceTo((currentIndex - 1 + total) % total);
  }, [currentIndex, total, advanceTo]);

  // Auto-advance
  useEffect(() => {
    if (!isPlaying || !isOpen || total === 0) return;
    const item = items[currentIndex];
    if (!item) return;
    const duration = item.durationOverrideMs ?? globalSettings.intervalMs;
    timerRef.current = setTimeout(() => {
      advanceTo((currentIndex + 1) % total);
    }, duration);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentIndex, isPlaying, isOpen, total, items, globalSettings.intervalMs, advanceTo]);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(0);
      setNextIndex(null);
      setIsFading(false);
      setIsPlaying(true);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentItem = total > 0 ? items[currentIndex] : null;
  const nextItem = nextIndex !== null ? items[nextIndex] : null;
  const fadeDur = globalSettings.fadeDurationMs;
  const slideLabel = total > 0 ? `${currentIndex + 1} / ${total}` : '0 / 0';

  // Inner container dimensions to preserve aspect ratio
  const innerStyle: React.CSSProperties =
    orientation === 'portrait'
      ? { width: 'calc(100vh * 9 / 16)', maxWidth: '100vw', height: '100vh' }
      : { width: '100vw', height: 'calc(100vw * 9 / 16)', maxHeight: '100vh' };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 20000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#000',
        animation: 'fadeIn 0.2s ease-out forwards',
      }}
    >
      {/* Slide area */}
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          ...innerStyle,
        }}
      >
        {currentItem && (
          <FullscreenSlideLayer
            item={currentItem}
            opacity={isFading ? 0 : 1}
            fadeDurationMs={fadeDur}
            zIndex={1}
          />
        )}
        {nextItem && (
          <FullscreenSlideLayer
            item={nextItem}
            opacity={isFading ? 1 : 0}
            fadeDurationMs={fadeDur}
            zIndex={2}
          />
        )}

        {/* Control bar */}
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
            padding: '12px 20px',
            background: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'saturate(180%) blur(20px)',
            WebkitBackdropFilter: 'saturate(180%) blur(20px)',
            borderTop: '0.5px solid rgba(255,255,255,0.1)',
            gap: '12px',
          }}
        >
          <FSControlButton onClick={handlePrev} label="前へ" title="前のスライド (←)">
            ◀
          </FSControlButton>
          <FSControlButton
            onClick={() => setIsPlaying((p) => !p)}
            label={isPlaying ? '一時停止' : '再生'}
            title={isPlaying ? '一時停止 (Space)' : '再生 (Space)'}
          >
            {isPlaying ? '⏸' : '▶'}
          </FSControlButton>

          <span
            style={{
              flex: 1,
              textAlign: 'center',
              fontSize: '13px',
              color: 'rgba(255,255,255,0.7)',
              letterSpacing: '0.02em',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {slideLabel}
          </span>

          <FSControlButton onClick={handleNext} label="次へ" title="次のスライド (→)">
            ▶
          </FSControlButton>
          <FSControlButton onClick={onClose} label="閉じる" title="閉じる (Esc)">
            ✕
          </FSControlButton>
        </div>
      </div>
    </div>
  );
}

// ---- Internal sub-components ----

interface FullscreenSlideLayerProps {
  item: PlaylistItem;
  opacity: 0 | 1;
  fadeDurationMs: number;
  zIndex: number;
}

function FullscreenSlideLayer({
  item,
  opacity,
  fadeDurationMs,
  zIndex,
}: FullscreenSlideLayerProps) {
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
      <div
        className="preview-bg-blur"
        style={{ backgroundImage: `url('${item.url}')` }}
      />
      {item.type === 'pdf' ? (
        <div
          className="preview-fg-image"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: '12px',
            color: 'rgba(255,255,255,0.8)',
          }}
        >
          <svg
            width="64"
            height="64"
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
          <span style={{ fontSize: '15px', letterSpacing: '-0.01em' }}>PDF</span>
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

interface FSControlButtonProps {
  onClick: () => void;
  label: string;
  title: string;
  children: React.ReactNode;
}

function FSControlButton({ onClick, label, title, children }: FSControlButtonProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={label}
      style={{
        background: 'rgba(255,255,255,0.15)',
        border: 'none',
        borderRadius: '8px',
        color: 'rgba(255,255,255,0.9)',
        fontSize: '14px',
        width: '36px',
        height: '36px',
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
