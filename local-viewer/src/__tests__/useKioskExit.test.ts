/**
 * テストケース対象:
 * A-E-05: フェイルセーフ発動（Escapeキー3回連続でshowPrompt=true）
 * A-E-06: フェイルセーフキャンセル（NキーでshowPrompt=false）
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useKioskExit } from '../hooks/useKioskExit';

const fireKeydown = (key: string) => {
  const event = new KeyboardEvent('keydown', { key, bubbles: true });
  window.dispatchEvent(event);
};

describe('useKioskExit フック', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // A-E-05: Escapeキー3回連続（1秒以内）でshowPrompt=true
  describe('A-E-05: フェイルセーフ発動', () => {
    it('Escapeキーを1秒以内に3回押下するとshowPromptがtrueになる', () => {
      const { result } = renderHook(() => useKioskExit());
      expect(result.current.showPrompt).toBe(false);

      act(() => { fireKeydown('Escape'); });
      expect(result.current.showPrompt).toBe(false);

      act(() => {
        vi.advanceTimersByTime(300);
        fireKeydown('Escape');
      });
      expect(result.current.showPrompt).toBe(false);

      act(() => {
        vi.advanceTimersByTime(300);
        fireKeydown('Escape');
      });
      // 3回目でshowPromptがtrue
      expect(result.current.showPrompt).toBe(true);
    });

    it('Escapeキーを2回しか押していない場合はshowPromptがfalseのまま', () => {
      const { result } = renderHook(() => useKioskExit());

      act(() => { fireKeydown('Escape'); });
      act(() => {
        vi.advanceTimersByTime(300);
        fireKeydown('Escape');
      });

      expect(result.current.showPrompt).toBe(false);
    });

    it('Escapeキー2回押した後1秒以上経過すると、カウントがリセットされ3回目でもshowPromptがtrueにならない', () => {
      const { result } = renderHook(() => useKioskExit());

      act(() => { fireKeydown('Escape'); });
      act(() => {
        vi.advanceTimersByTime(300);
        fireKeydown('Escape');
      });

      // 1秒以上経過（リセット）
      act(() => { vi.advanceTimersByTime(1100); });

      act(() => { fireKeydown('Escape'); });
      // リセット後の1回目なのでshowPromptはfalse
      expect(result.current.showPrompt).toBe(false);
    });

    it('3回目のEscape押下が1秒を超えた場合はshowPromptがtrueにならない', () => {
      const { result } = renderHook(() => useKioskExit());

      act(() => { fireKeydown('Escape'); });
      act(() => {
        vi.advanceTimersByTime(400);
        fireKeydown('Escape');
      });
      // 2回は1秒内だが、3回目は1秒超
      act(() => {
        vi.advanceTimersByTime(700); // 累計1100ms超え
        fireKeydown('Escape');
      });

      expect(result.current.showPrompt).toBe(false);
    });

    it('Escape以外のキーはカウントに影響しない', () => {
      const { result } = renderHook(() => useKioskExit());

      act(() => { fireKeydown('Enter'); });
      act(() => { fireKeydown('Enter'); });
      act(() => { fireKeydown('Enter'); });

      expect(result.current.showPrompt).toBe(false);
    });
  });

  // A-E-06: フェイルセーフキャンセル
  describe('A-E-06: フェイルセーフキャンセル', () => {
    it('プロンプト表示中にNキーでshowPromptがfalseに戻る', () => {
      const { result } = renderHook(() => useKioskExit());

      // Escapeキー3回でshowPromptをtrue
      act(() => { fireKeydown('Escape'); });
      act(() => {
        vi.advanceTimersByTime(300);
        fireKeydown('Escape');
      });
      act(() => {
        vi.advanceTimersByTime(300);
        fireKeydown('Escape');
      });
      expect(result.current.showPrompt).toBe(true);

      // Nキーでキャンセル
      act(() => { fireKeydown('n'); });
      expect(result.current.showPrompt).toBe(false);
    });

    it('プロンプト表示中に大文字NキーでもshowPromptがfalseに戻る', () => {
      const { result } = renderHook(() => useKioskExit());

      act(() => { fireKeydown('Escape'); });
      act(() => {
        vi.advanceTimersByTime(300);
        fireKeydown('Escape');
      });
      act(() => {
        vi.advanceTimersByTime(300);
        fireKeydown('Escape');
      });
      expect(result.current.showPrompt).toBe(true);

      act(() => { fireKeydown('N'); });
      expect(result.current.showPrompt).toBe(false);
    });

    it('handleCancel() を呼ぶとshowPromptがfalseに戻る', () => {
      const { result } = renderHook(() => useKioskExit());

      act(() => { fireKeydown('Escape'); });
      act(() => {
        vi.advanceTimersByTime(300);
        fireKeydown('Escape');
      });
      act(() => {
        vi.advanceTimersByTime(300);
        fireKeydown('Escape');
      });
      expect(result.current.showPrompt).toBe(true);

      act(() => { result.current.handleCancel(); });
      expect(result.current.showPrompt).toBe(false);
    });

    it('プロンプト表示中にYキーでwindow.closeが呼ばれる', () => {
      const closespy = vi.spyOn(window, 'close').mockImplementation(() => {});
      const { result } = renderHook(() => useKioskExit());

      act(() => { fireKeydown('Escape'); });
      act(() => {
        vi.advanceTimersByTime(300);
        fireKeydown('Escape');
      });
      act(() => {
        vi.advanceTimersByTime(300);
        fireKeydown('Escape');
      });
      expect(result.current.showPrompt).toBe(true);

      act(() => { fireKeydown('y'); });
      expect(closespy).toHaveBeenCalledTimes(1);
      closespy.mockRestore();
    });

    it('プロンプト表示中に大文字YキーでもwindowCloseが呼ばれる', () => {
      const closeSpy = vi.spyOn(window, 'close').mockImplementation(() => {});
      const { result } = renderHook(() => useKioskExit());

      act(() => { fireKeydown('Escape'); });
      act(() => {
        vi.advanceTimersByTime(300);
        fireKeydown('Escape');
      });
      act(() => {
        vi.advanceTimersByTime(300);
        fireKeydown('Escape');
      });
      expect(result.current.showPrompt).toBe(true);

      act(() => { fireKeydown('Y'); });
      expect(closeSpy).toHaveBeenCalledTimes(1);
      closeSpy.mockRestore();
    });

    it('handleConfirm() を呼ぶとwindow.closeが呼ばれる', () => {
      const closeSpy = vi.spyOn(window, 'close').mockImplementation(() => {});
      const { result } = renderHook(() => useKioskExit());

      act(() => { fireKeydown('Escape'); });
      act(() => {
        vi.advanceTimersByTime(300);
        fireKeydown('Escape');
      });
      act(() => {
        vi.advanceTimersByTime(300);
        fireKeydown('Escape');
      });
      expect(result.current.showPrompt).toBe(true);

      act(() => { result.current.handleConfirm(); });
      expect(closeSpy).toHaveBeenCalledTimes(1);
      closeSpy.mockRestore();
    });
  });

  // クリーンアップ
  describe('クリーンアップ', () => {
    it('アンマウント後はキー入力を受け付けなくなる', () => {
      const { result, unmount } = renderHook(() => useKioskExit());

      unmount();

      // アンマウント後にEscapeを3回押してもshowPromptは変化しない
      act(() => { fireKeydown('Escape'); });
      act(() => {
        vi.advanceTimersByTime(300);
        fireKeydown('Escape');
      });
      act(() => {
        vi.advanceTimersByTime(300);
        fireKeydown('Escape');
      });

      expect(result.current.showPrompt).toBe(false);
    });
  });
});
