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
  const [displayIndex, setDisplayIndex] = useState(0);
  const [fadePhase, setFadePhase] = useState<'visible' | 'fading-out' | 'fading-in'>('visible');
  const [isPlaying, setIsPlaying] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const total = items.length;
  const fadeDur = globalSettings.fadeDurationMs;
  const intervalMs = globalSettings.intervalMs;

  const clearTimers = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (fadeTimerRef.current) { clearTimeout(fadeTimerRef.current); fadeTimerRef.current = null; }
  }, []);

  const transitionTo = useCallback((targetIndex: number) => {
    clearTimers();
    setFadePhase('fading-out');
    fadeTimerRef.current = setTimeout(() => {
      setDisplayIndex(targetIndex);
      setCurrentIndex(targetIndex);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setFadePhase('fading-in');
          fadeTimerRef.current = setTimeout(() => {
            setFadePhase('visible');
          }, fadeDur);
        });
      });
    }, fadeDur);
  }, [fadeDur, clearTimers]);

  const handleNext = useCallback(() => {
    if (total <= 1) return;
    transitionTo((currentIndex + 1) % total);
  }, [currentIndex, total, transitionTo]);

  const handlePrev = useCallback(() => {
    if (total <= 1) return;
    transitionTo((currentIndex - 1 + total) % total);
  }, [currentIndex, total, transitionTo]);

  // Keyboard controls
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
  }, [isOpen, onClose, handleNext, handlePrev]);

  // Auto-advance
  useEffect(() => {
    if (!isPlaying || !isOpen || total <= 1 || fadePhase !== 'visible') return;
    const item = itemsRef.current[currentIndex];
    if (!item) return;
    const duration = item.durationOverrideMs ?? intervalMs;
    timerRef.current = setTimeout(() => {
      transitionTo((currentIndex + 1) % total);
    }, duration);
    return () => {
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    };
  }, [currentIndex, isPlaying, isOpen, total, intervalMs, fadePhase, transitionTo]);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(0);
      setDisplayIndex(0);
      setFadePhase('visible');
      setIsPlaying(true);
      clearTimers();
    }
  }, [isOpen, clearTimers]);

  if (!isOpen) return null;

  const displayItem = total > 0 ? (items[displayIndex] ?? items[0]) : null;
  const slideLabel = total > 0 ? `${currentIndex + 1} / ${total}` : '0 / 0';

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
      <div style={{ position: 'relative', overflow: 'hidden', ...innerStyle }}>
        {displayItem && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              opacity: fadePhase === 'fading-out' ? 0 : 1,
              transition: `opacity ${fadeDur}ms ease-in-out`,
              zIndex: 1,
            }}
          >
            <div
              className="preview-bg-blur"
              style={{ backgroundImage: `url('${displayItem.url}')` }}
            />
            {displayItem.type === 'pdf' ? (
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
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <span style={{ fontSize: '15px' }}>PDF</span>
              </div>
            ) : (
              <img className="preview-fg-image" src={displayItem.url} alt="" draggable={false} />
            )}
          </div>
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
          <FSControlButton onClick={handlePrev} label="前へ" title="前のスライド (←)">◀</FSControlButton>
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
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {slideLabel}
          </span>
          <FSControlButton onClick={handleNext} label="次へ" title="次のスライド (→)">▶</FSControlButton>
          <FSControlButton onClick={onClose} label="閉じる" title="閉じる (Esc)">✕</FSControlButton>
        </div>
      </div>
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
      onMouseEnter={(e) => { (e.currentTarget).style.background = 'rgba(255,255,255,0.25)'; }}
      onMouseLeave={(e) => { (e.currentTarget).style.background = 'rgba(255,255,255,0.15)'; }}
      onMouseDown={(e) => { (e.currentTarget).style.transform = 'scale(0.9)'; }}
      onMouseUp={(e) => { (e.currentTarget).style.transform = 'scale(1)'; }}
    >
      {children}
    </button>
  );
}
