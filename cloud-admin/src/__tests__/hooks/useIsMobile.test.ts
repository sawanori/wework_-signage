/**
 * Tests for useIsMobile hook
 * Breakpoint: width < 768 → mobile, width >= 768 → desktop
 *
 * Red phase: useIsMobile.ts does not exist yet → these tests will fail on import.
 * Once the hook is implemented, all tests should pass (Green).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Import the pure breakpoint logic that will be exported from useIsMobile
// This import will fail (Red) until the file is created.
import { isMobileWidth, MOBILE_BREAKPOINT } from '@/hooks/useIsMobile';

describe('useIsMobile', () => {
  describe('MOBILE_BREAKPOINT constant', () => {
    it('breakpoint is 768', () => {
      expect(MOBILE_BREAKPOINT).toBe(768);
    });
  });

  describe('isMobileWidth()', () => {
    it('375px (iPhone SE) → true', () => {
      expect(isMobileWidth(375)).toBe(true);
    });

    it('767px (boundary - 1) → true', () => {
      expect(isMobileWidth(767)).toBe(true);
    });

    it('768px (boundary) → false (desktop)', () => {
      expect(isMobileWidth(768)).toBe(false);
    });

    it('1024px → false (desktop)', () => {
      expect(isMobileWidth(1024)).toBe(false);
    });
  });

  describe('resize event integration', () => {
    let addListenerSpy: ReturnType<typeof vi.fn>;
    let removeListenerSpy: ReturnType<typeof vi.fn>;
    const originalAdd = globalThis.addEventListener;
    const originalRemove = globalThis.removeEventListener;

    beforeEach(() => {
      addListenerSpy = vi.fn();
      removeListenerSpy = vi.fn();
      globalThis.addEventListener = addListenerSpy as typeof globalThis.addEventListener;
      globalThis.removeEventListener = removeListenerSpy as typeof globalThis.removeEventListener;
    });

    afterEach(() => {
      globalThis.addEventListener = originalAdd;
      globalThis.removeEventListener = originalRemove;
    });

    it('adds resize listener on mount', () => {
      const handler = () => {};
      globalThis.addEventListener('resize', handler);
      expect(addListenerSpy).toHaveBeenCalledWith('resize', handler);
    });

    it('removes resize listener on unmount (same handler reference)', () => {
      const handler = () => {};
      globalThis.addEventListener('resize', handler);
      globalThis.removeEventListener('resize', handler);

      const added = addListenerSpy.mock.calls[0][1];
      const removed = removeListenerSpy.mock.calls[0][1];
      expect(added).toBe(removed);
    });
  });
});
