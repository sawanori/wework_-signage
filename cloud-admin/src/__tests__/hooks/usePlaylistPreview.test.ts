/**
 * Tests for usePlaylistPreview logic
 * Preview logic: slide cycling, orientation aspect ratio, playback state
 */

import { describe, it, expect } from 'vitest';
import type { PlaylistItem, GlobalSettings } from '@non-turn/shared';

// ---- Pure logic extracted from usePlaylistPreview ----

function getAspectRatio(orientation: 'portrait' | 'landscape'): { width: number; height: number } {
  return orientation === 'portrait' ? { width: 9, height: 16 } : { width: 16, height: 9 };
}

function nextSlideIndex(current: number, total: number): number {
  if (total === 0) return 0;
  return (current + 1) % total;
}

function prevSlideIndex(current: number, total: number): number {
  if (total === 0) return 0;
  return (current - 1 + total) % total;
}

function getSlideLabel(current: number, total: number): string {
  if (total === 0) return '0 / 0';
  return `${current + 1} / ${total}`;
}

function getEffectiveDuration(item: PlaylistItem, settings: GlobalSettings): number {
  return item.durationOverrideMs ?? settings.intervalMs;
}

// ---- Tests ----

const mockSettings: GlobalSettings = {
  fadeDurationMs: 2000,
  intervalMs: 10000,
};

const mockItems: PlaylistItem[] = [
  { id: 'item1', url: 'https://example.com/img1.jpg', hash: 'abc', type: 'image', durationOverrideMs: null, position: 0 },
  { id: 'item2', url: 'https://example.com/img2.jpg', hash: 'def', type: 'image', durationOverrideMs: 5000, position: 1 },
  { id: 'item3', url: 'https://example.com/doc.pdf', hash: 'ghi', type: 'pdf', durationOverrideMs: null, position: 2 },
];

describe('usePlaylistPreview logic', () => {
  describe('orientation aspect ratio', () => {
    it('portrait → 9:16', () => {
      const { width, height } = getAspectRatio('portrait');
      expect(width).toBe(9);
      expect(height).toBe(16);
    });

    it('landscape → 16:9', () => {
      const { width, height } = getAspectRatio('landscape');
      expect(width).toBe(16);
      expect(height).toBe(9);
    });
  });

  describe('slide navigation', () => {
    it('next: 0 → 1 → 2 → 0 (wrap around)', () => {
      expect(nextSlideIndex(0, 3)).toBe(1);
      expect(nextSlideIndex(1, 3)).toBe(2);
      expect(nextSlideIndex(2, 3)).toBe(0);
    });

    it('prev: 0 → 2 (wrap around)', () => {
      expect(prevSlideIndex(0, 3)).toBe(2);
      expect(prevSlideIndex(1, 3)).toBe(0);
      expect(prevSlideIndex(2, 3)).toBe(1);
    });

    it('empty playlist returns 0', () => {
      expect(nextSlideIndex(0, 0)).toBe(0);
      expect(prevSlideIndex(0, 0)).toBe(0);
    });
  });

  describe('slide label', () => {
    it('displays "1 / 3" for first slide of 3', () => {
      expect(getSlideLabel(0, 3)).toBe('1 / 3');
    });

    it('displays "3 / 3" for last slide of 3', () => {
      expect(getSlideLabel(2, 3)).toBe('3 / 3');
    });

    it('displays "0 / 0" for empty playlist', () => {
      expect(getSlideLabel(0, 0)).toBe('0 / 0');
    });
  });

  describe('effective duration', () => {
    it('uses globalSettings.intervalMs when durationOverrideMs is null', () => {
      expect(getEffectiveDuration(mockItems[0], mockSettings)).toBe(10000);
    });

    it('uses durationOverrideMs when set', () => {
      expect(getEffectiveDuration(mockItems[1], mockSettings)).toBe(5000);
    });

    it('pdf also respects durationOverrideMs=null → fallback to intervalMs', () => {
      expect(getEffectiveDuration(mockItems[2], mockSettings)).toBe(10000);
    });
  });
});
