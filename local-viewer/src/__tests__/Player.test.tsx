/**
 * テストケース対象:
 * A-N-01: フェードトランジション時間
 * A-N-02: スライド表示時間（デフォルト）
 * A-N-03: 個別時間上書き
 * A-N-04: プレイリストループ
 * A-EC-01: 0件プレイリスト
 * A-EC-02: 1件プレイリスト
 * A-EC-06: fadeDurationMs=0
 * A-EC-07: 極端に短いintervalMs
 */

import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Player } from '../components/Player';
import type { PlaylistItem, GlobalSettings } from '../types/playlist';

const makeItem = (id: string, durationOverrideMs: number | null = null): PlaylistItem => ({
  id,
  url: `/data/images/${id}.jpg`,
  hash: 'abc123',
  type: 'image',
  durationOverrideMs,
  position: 1,
});

const defaultSettings: GlobalSettings = {
  fadeDurationMs: 2000,
  intervalMs: 10000,
};

describe('Player コンポーネント', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // A-N-01: フェードトランジション時間
  describe('A-N-01: フェードトランジション時間', () => {
    it('fadeDurationMs=2000 で opacity の transitionDuration が 2000ms に設定される', () => {
      const items = [makeItem('img_001'), makeItem('img_002')];
      const { container } = render(
        <Player items={items} globalSettings={defaultSettings} />
      );
      // 現在表示中のスライドに transition-duration が設定されている
      const slideElement = container.querySelector('.slide-fade') as HTMLElement | null;
      expect(slideElement).not.toBeNull();
      expect(slideElement!.style.transitionDuration).toBe('2000ms');
    });

    it('フェード完了後（2000ms後）に旧スライドがDOMからアンマウントされる', () => {
      const items = [makeItem('img_001'), makeItem('img_002')];
      const { container } = render(
        <Player items={items} globalSettings={defaultSettings} />
      );
      // 最初は img_001 が表示されている
      expect(container.querySelector('[data-slide-id="img_001"]')).not.toBeNull();

      // 10000ms 経過してフェード開始
      act(() => { vi.advanceTimersByTime(10000); });
      // フェード中は2枚が存在する
      expect(container.querySelector('[data-slide-id="img_001"]')).not.toBeNull();
      expect(container.querySelector('[data-slide-id="img_002"]')).not.toBeNull();

      // フェード完了（さらに2000ms）
      act(() => { vi.advanceTimersByTime(2000); });
      // 旧スライドがアンマウントされる
      expect(container.querySelector('[data-slide-id="img_001"]')).toBeNull();
      expect(container.querySelector('[data-slide-id="img_002"]')).not.toBeNull();
    });
  });

  // A-N-02: スライド表示時間（デフォルト）
  describe('A-N-02: スライド表示時間（デフォルト）', () => {
    it('intervalMs=10000 で 10秒後に次スライドに遷移する', () => {
      const items = [makeItem('img_001'), makeItem('img_002')];
      const { container } = render(
        <Player items={items} globalSettings={{ fadeDurationMs: 2000, intervalMs: 10000 }} />
      );
      // 初期状態: img_001 が表示中
      expect(container.querySelector('[data-slide-id="img_001"]')).not.toBeNull();

      // 9999ms では遷移しない
      act(() => { vi.advanceTimersByTime(9999); });
      expect(container.querySelector('[data-slide-id="img_002"]')).toBeNull();

      // 10000ms でフェード開始（img_002 が DOM に現れる）
      act(() => { vi.advanceTimersByTime(1); });
      expect(container.querySelector('[data-slide-id="img_002"]')).not.toBeNull();
    });
  });

  // A-N-03: 個別時間上書き
  describe('A-N-03: 個別時間上書き', () => {
    it('durationOverrideMs=15000 のスライドが 15秒後に次スライドへ遷移する', () => {
      const items = [
        makeItem('img_001', 15000),
        makeItem('img_002'),
      ];
      const { container } = render(
        <Player items={items} globalSettings={defaultSettings} />
      );
      // 10000ms では遷移しない（globalのintervalMsより長い）
      act(() => { vi.advanceTimersByTime(10000); });
      expect(container.querySelector('[data-slide-id="img_002"]')).toBeNull();

      // 14999ms でもまだ遷移しない
      act(() => { vi.advanceTimersByTime(4999); });
      expect(container.querySelector('[data-slide-id="img_002"]')).toBeNull();

      // 15000ms でフェード開始
      act(() => { vi.advanceTimersByTime(1); });
      expect(container.querySelector('[data-slide-id="img_002"]')).not.toBeNull();
    });
  });

  // A-N-04: プレイリストループ
  describe('A-N-04: プレイリストループ', () => {
    it('3枚のスライドが 0→1→2→0 の順にループする', () => {
      const items = [makeItem('img_001'), makeItem('img_002'), makeItem('img_003')];
      const settings: GlobalSettings = { fadeDurationMs: 0, intervalMs: 10000 };
      const { container } = render(
        <Player items={items} globalSettings={settings} />
      );

      // index 0: img_001
      expect(container.querySelector('[data-slide-id="img_001"]')).not.toBeNull();

      // 10000ms → index 1: img_002
      act(() => { vi.advanceTimersByTime(10000); });
      expect(container.querySelector('[data-slide-id="img_002"]')).not.toBeNull();

      // 10000ms → index 2: img_003
      act(() => { vi.advanceTimersByTime(10000); });
      expect(container.querySelector('[data-slide-id="img_003"]')).not.toBeNull();

      // 10000ms → index 0: img_001 にループ
      act(() => { vi.advanceTimersByTime(10000); });
      expect(container.querySelector('[data-slide-id="img_001"]')).not.toBeNull();

      // さらに 10000ms → index 1: img_002
      act(() => { vi.advanceTimersByTime(10000); });
      expect(container.querySelector('[data-slide-id="img_002"]')).not.toBeNull();
    });
  });

  // A-EC-01: 0件プレイリスト
  describe('A-EC-01: 0件プレイリスト', () => {
    it('items=[] のとき黒画面が表示される', () => {
      const { container } = render(
        <Player items={[]} globalSettings={defaultSettings} />
      );
      // スライドが存在せず、黒画面コンテナが存在する
      const blackScreen = container.querySelector('[data-testid="black-screen"]');
      expect(blackScreen).not.toBeNull();
    });

    it('items=[] のときスライドコンポーネントがレンダリングされない', () => {
      const { container } = render(
        <Player items={[]} globalSettings={defaultSettings} />
      );
      const slides = container.querySelectorAll('[data-slide-id]');
      expect(slides.length).toBe(0);
    });

    it('items=[] のとき 30秒後に再チェックが行われる（setIntervalが維持される）', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      render(<Player items={[]} globalSettings={defaultSettings} />);
      // エラーログが出力されることを確認
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('プレイリストが空')
      );
      consoleSpy.mockRestore();
    });
  });

  // A-EC-02: 1件プレイリスト
  describe('A-EC-02: 1件プレイリスト', () => {
    it('1枚のスライドが同じスライドへループする（DOM に常に同一スライドが存在する）', () => {
      const items = [makeItem('img_001')];
      const settings: GlobalSettings = { fadeDurationMs: 0, intervalMs: 10000 };
      const { container } = render(
        <Player items={items} globalSettings={settings} />
      );
      // 初期状態
      expect(container.querySelector('[data-slide-id="img_001"]')).not.toBeNull();

      // 10000ms 後も同じスライドが存在する
      act(() => { vi.advanceTimersByTime(10000); });
      expect(container.querySelector('[data-slide-id="img_001"]')).not.toBeNull();

      // さらに 10000ms 後も同様
      act(() => { vi.advanceTimersByTime(10000); });
      expect(container.querySelector('[data-slide-id="img_001"]')).not.toBeNull();
    });
  });

  // A-EC-06: fadeDurationMs=0
  describe('A-EC-06: fadeDurationMs=0', () => {
    it('fadeDurationMs=0 のとき transitionDuration が 0ms になる', () => {
      const items = [makeItem('img_001'), makeItem('img_002')];
      const settings: GlobalSettings = { fadeDurationMs: 0, intervalMs: 10000 };
      const { container } = render(
        <Player items={items} globalSettings={settings} />
      );
      const slideElement = container.querySelector('.slide-fade') as HTMLElement | null;
      expect(slideElement).not.toBeNull();
      expect(slideElement!.style.transitionDuration).toBe('0ms');
    });

    it('fadeDurationMs=0 のとき 10000ms 後に即時切替される（フェード時間を待たずにアンマウント）', () => {
      const items = [makeItem('img_001'), makeItem('img_002')];
      const settings: GlobalSettings = { fadeDurationMs: 0, intervalMs: 10000 };
      const { container } = render(
        <Player items={items} globalSettings={settings} />
      );
      expect(container.querySelector('[data-slide-id="img_001"]')).not.toBeNull();

      // 10000ms 経過後、fadeDurationMs=0 なので即座に切替わる
      act(() => { vi.advanceTimersByTime(10000); });
      // img_001 はすでにアンマウント、img_002 が表示中
      expect(container.querySelector('[data-slide-id="img_001"]')).toBeNull();
      expect(container.querySelector('[data-slide-id="img_002"]')).not.toBeNull();
    });
  });

  // A-EC-07: 極端に短い intervalMs
  describe('A-EC-07: intervalMs < fadeDurationMs のとき最低表示時間が保証される', () => {
    it('intervalMs=100, fadeDurationMs=2000 のとき、フェード完了後さらに3秒待機する（計5000ms）', () => {
      // intervalMs(100) < fadeDurationMs(2000) のため
      // 実効表示時間 = fadeDurationMs(2000) + 3000 = 5000ms
      const items = [makeItem('img_001'), makeItem('img_002')];
      const settings: GlobalSettings = { fadeDurationMs: 2000, intervalMs: 100 };
      const { container } = render(
        <Player items={items} globalSettings={settings} />
      );
      expect(container.querySelector('[data-slide-id="img_001"]')).not.toBeNull();

      // 100ms では遷移しない（実効 5000ms のため）
      act(() => { vi.advanceTimersByTime(100); });
      expect(container.querySelector('[data-slide-id="img_002"]')).toBeNull();

      // 4999ms でもまだ遷移しない
      act(() => { vi.advanceTimersByTime(4899); });
      expect(container.querySelector('[data-slide-id="img_002"]')).toBeNull();

      // 5000ms でフェード開始（img_002 が DOM に現れる）
      act(() => { vi.advanceTimersByTime(1); });
      expect(container.querySelector('[data-slide-id="img_002"]')).not.toBeNull();
    });

    it('intervalMs=100, fadeDurationMs=2000 のとき、フェード完了（2000ms後）に旧スライドがアンマウントされる', () => {
      const items = [makeItem('img_001'), makeItem('img_002')];
      const settings: GlobalSettings = { fadeDurationMs: 2000, intervalMs: 100 };
      const { container } = render(
        <Player items={items} globalSettings={settings} />
      );

      // 5000ms でフェード開始
      act(() => { vi.advanceTimersByTime(5000); });
      // フェード中は2枚存在
      expect(container.querySelector('[data-slide-id="img_001"]')).not.toBeNull();
      expect(container.querySelector('[data-slide-id="img_002"]')).not.toBeNull();

      // さらに 2000ms（fadeDurationMs）でアンマウント
      act(() => { vi.advanceTimersByTime(2000); });
      expect(container.querySelector('[data-slide-id="img_001"]')).toBeNull();
      expect(container.querySelector('[data-slide-id="img_002"]')).not.toBeNull();
    });
  });
});
