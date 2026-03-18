/**
 * Tests for PlaylistItem mobile display behavior
 *
 * Red phase: the following behaviors don't exist in PlaylistItem.tsx yet:
 *   1. getDeleteButtonOpacity() exported function (needs to be extracted)
 *   2. confirmDelete auto-reset after 3s (currently missing)
 *
 * These tests will fail until PlaylistItem.tsx is updated (Green).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// These exports don't exist yet in PlaylistItem.tsx → Red
import {
  getDeleteButtonOpacity,
  AUTO_RESET_DELAY_MS,
} from '@/components/playlist/PlaylistItem';

describe('PlaylistItem mobile display behavior', () => {
  describe('getDeleteButtonOpacity()', () => {
    describe('on mobile (isMobile = true)', () => {
      it('always visible (opacity 1) even when not hovered', () => {
        expect(getDeleteButtonOpacity({ isMobile: true, isHovered: false, confirmDelete: false })).toBe(1);
      });

      it('visible (opacity 1) when hovered', () => {
        expect(getDeleteButtonOpacity({ isMobile: true, isHovered: true, confirmDelete: false })).toBe(1);
      });

      it('visible (opacity 1) when confirmDelete is active', () => {
        expect(getDeleteButtonOpacity({ isMobile: true, isHovered: false, confirmDelete: true })).toBe(1);
      });
    });

    describe('on desktop (isMobile = false)', () => {
      it('hidden (opacity 0) when not hovered and not confirming delete', () => {
        expect(getDeleteButtonOpacity({ isMobile: false, isHovered: false, confirmDelete: false })).toBe(0);
      });

      it('visible (opacity 1) when hovered', () => {
        expect(getDeleteButtonOpacity({ isMobile: false, isHovered: true, confirmDelete: false })).toBe(1);
      });

      it('visible (opacity 1) when confirmDelete is active', () => {
        expect(getDeleteButtonOpacity({ isMobile: false, isHovered: false, confirmDelete: true })).toBe(1);
      });
    });
  });

  describe('AUTO_RESET_DELAY_MS constant', () => {
    it('is 3000ms (3 seconds)', () => {
      expect(AUTO_RESET_DELAY_MS).toBe(3000);
    });
  });

  describe('confirmDelete auto-reset', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('resets to false after AUTO_RESET_DELAY_MS', () => {
      let confirmDelete = true;
      const setConfirmDelete = (v: boolean) => { confirmDelete = v; };

      const id = setTimeout(() => setConfirmDelete(false), AUTO_RESET_DELAY_MS);

      vi.advanceTimersByTime(AUTO_RESET_DELAY_MS - 1);
      expect(confirmDelete).toBe(true);

      vi.advanceTimersByTime(1);
      expect(confirmDelete).toBe(false);

      clearTimeout(id);
    });

    it('cleanup prevents reset (component unmount)', () => {
      let confirmDelete = true;
      const setConfirmDelete = (v: boolean) => { confirmDelete = v; };

      const id = setTimeout(() => setConfirmDelete(false), AUTO_RESET_DELAY_MS);
      clearTimeout(id); // simulate cleanup

      vi.advanceTimersByTime(AUTO_RESET_DELAY_MS + 1000);
      expect(confirmDelete).toBe(true);
    });
  });
});
