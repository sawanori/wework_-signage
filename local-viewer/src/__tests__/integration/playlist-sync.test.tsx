/**
 * 結合テスト: Module C + Module A
 * 検証内容: playlist.json更新がLocal Viewerに反映される
 *
 * テスト内容:
 * 1. ダミーplaylist.jsonを作成（version: "v_1"）
 * 2. usePlaylistがplaylist.jsonを読み込む
 * 3. playlist.jsonをversion: "v_2"に更新（items追加）
 * 4. 30秒後にusePlaylistが新しいversionを検知して更新
 * 5. Playerが新しいitemsで再生を開始
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, render, screen, act } from '@testing-library/react';
import { usePlaylist } from '../../hooks/usePlaylist';
import { Player } from '../../components/Player';
import type { PlaylistResponse, GlobalSettings, PlaylistItem } from '../../types/playlist';
import React from 'react';

const MOCK_PLAYLIST_V1: PlaylistResponse = {
  version: 'v_1',
  orientation: 'portrait',
  deviceId: 'device_test_01',
  storeId: 'store_test',
  globalSettings: {
    fadeDurationMs: 2000,
    intervalMs: 10000,
  },
  items: [
    {
      id: 'img_001',
      url: '/data/images/img_001.jpg',
      hash: 'abc001',
      type: 'image',
      durationOverrideMs: null,
      position: 1,
    },
  ],
};

const MOCK_PLAYLIST_V2: PlaylistResponse = {
  version: 'v_2',
  orientation: 'portrait',
  deviceId: 'device_test_01',
  storeId: 'store_test',
  globalSettings: {
    fadeDurationMs: 2000,
    intervalMs: 10000,
  },
  items: [
    {
      id: 'img_001',
      url: '/data/images/img_001.jpg',
      hash: 'abc001',
      type: 'image',
      durationOverrideMs: null,
      position: 1,
    },
    {
      id: 'img_002',
      url: '/data/images/img_002.jpg',
      hash: 'abc002',
      type: 'image',
      durationOverrideMs: null,
      position: 2,
    },
  ],
};

describe('Module C + Module A 結合テスト: playlist.json更新がLocal Viewerに反映される', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  /**
   * 統合テスト 1: usePlaylistがplaylist.jsonを読み込み、30秒後に更新を検知する
   */
  it('INT-CA-01: 初回読み込み(v_1) → 30秒後にv_2を検知してitemsが更新される', async () => {
    // fetch をモック: 最初はv_1、次の呼び出しではv_2を返す
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => MOCK_PLAYLIST_V1,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => MOCK_PLAYLIST_V2,
      } as Response);

    const { result } = renderHook(() => usePlaylist());

    // マウント時に即座にfetchが呼ばれる
    await act(async () => {
      await Promise.resolve();
    });

    // Step 2: usePlaylistがv_1を読み込む
    expect(result.current.version).toBe('v_1');
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].id).toBe('img_001');

    // Step 3-4: 30秒経過後にv_2が検知される
    await act(async () => {
      vi.advanceTimersByTime(30000);
      await Promise.resolve();
    });

    // Step 4: 新しいversionに更新されている
    expect(result.current.version).toBe('v_2');
    expect(result.current.items).toHaveLength(2);
    expect(result.current.items[1].id).toBe('img_002');
  });

  /**
   * 統合テスト 2: Playerが初期のitemsで再生を開始し、更新後も継続する
   */
  it('INT-CA-02: v_1のitemsでPlayerが初期表示し、v_2更新後に新しいitemsが反映される', async () => {
    // まず fetch をv_1で返す
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => MOCK_PLAYLIST_V1,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => MOCK_PLAYLIST_V2,
      } as Response);

    const { result } = renderHook(() => usePlaylist());

    await act(async () => {
      await Promise.resolve();
    });

    // Step 2: v_1のitemsでPlayerがレンダリングされる
    const { rerender } = render(
      <Player items={result.current.items} globalSettings={result.current.globalSettings} />
    );

    // img_001のスライドが表示されていること
    const slideElement = document.querySelector('[data-slide-id="img_001"]');
    expect(slideElement).not.toBeNull();

    // img_002のスライドはまだ表示されていないこと
    const slideElement2 = document.querySelector('[data-slide-id="img_002"]');
    expect(slideElement2).toBeNull();

    // Step 3-4: 30秒後にv_2が検知される
    await act(async () => {
      vi.advanceTimersByTime(30000);
      await Promise.resolve();
    });

    // Step 5: Playerを新しいitemsで再レンダリング
    await act(async () => {
      rerender(
        <Player items={result.current.items} globalSettings={result.current.globalSettings} />
      );
    });

    // 新しいitemsでPlayerが更新されていること
    expect(result.current.items).toHaveLength(2);
    expect(result.current.version).toBe('v_2');
  });

  /**
   * 統合テスト 3: 30秒間隔で複数回のポーリングが行われる
   */
  it('INT-CA-03: 30秒間隔で定期的にfetchが呼ばれる', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => MOCK_PLAYLIST_V1,
    } as Response);

    const { result } = renderHook(() => usePlaylist());

    // マウント時の1回目
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // 30秒後に2回目
    await act(async () => {
      vi.advanceTimersByTime(30000);
      await Promise.resolve();
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    // さらに30秒後に3回目
    await act(async () => {
      vi.advanceTimersByTime(30000);
      await Promise.resolve();
    });
    expect(fetchSpy).toHaveBeenCalledTimes(3);

    // versionが同じならitemsは更新されない（再レンダリングなし）
    expect(result.current.version).toBe('v_1');
    expect(result.current.items).toHaveLength(1);
  });

  /**
   * 統合テスト 4: fetchエラー時は前のplaylist状態が維持される
   */
  it('INT-CA-04: fetchエラー時は前回のプレイリストを維持する（オフライン継続再生）', async () => {
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => MOCK_PLAYLIST_V1,
      } as Response)
      .mockRejectedValueOnce(new TypeError('Network error'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => MOCK_PLAYLIST_V2,
      } as Response);

    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { result } = renderHook(() => usePlaylist());

    await act(async () => {
      await Promise.resolve();
    });

    // v_1が読み込まれている
    expect(result.current.version).toBe('v_1');

    // 30秒後: ネットワークエラー
    await act(async () => {
      vi.advanceTimersByTime(30000);
      await Promise.resolve();
    });

    // エラー後も前回のプレイリストを維持
    expect(result.current.version).toBe('v_1');
    expect(result.current.items).toHaveLength(1);
    expect(consoleWarnSpy).toHaveBeenCalled();

    // さらに30秒後: 正常に復帰してv_2が取得される
    await act(async () => {
      vi.advanceTimersByTime(30000);
      await Promise.resolve();
    });

    expect(result.current.version).toBe('v_2');
    expect(result.current.items).toHaveLength(2);

    consoleWarnSpy.mockRestore();
  });

  /**
   * 統合テスト 5: versionが変わらない場合はPlaylistのitemsが更新されない
   */
  it('INT-CA-05: versionが同じならitemsは更新されない（不要な再レンダリングなし）', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => MOCK_PLAYLIST_V1,
    } as Response);

    const { result } = renderHook(() => usePlaylist());

    await act(async () => {
      await Promise.resolve();
    });

    const itemsBeforeRef = result.current.items;

    // 30秒後: 同じversionが返ってくる
    await act(async () => {
      vi.advanceTimersByTime(30000);
      await Promise.resolve();
    });

    // versionが同じ場合、itemsの参照は変わらない（setState が呼ばれていない）
    expect(result.current.items).toEqual(itemsBeforeRef);
    expect(result.current.version).toBe('v_1');
  });

  /**
   * 統合テスト 6: Player が空のプレイリストで黒画面を表示する
   */
  it('INT-CA-06: 空のitemsでPlayerが黒画面を表示する', async () => {
    const emptySettings: GlobalSettings = { fadeDurationMs: 2000, intervalMs: 10000 };
    const emptyItems: PlaylistItem[] = [];

    render(<Player items={emptyItems} globalSettings={emptySettings} />);

    // 黒画面が表示されていること
    const blackScreen = screen.getByTestId('black-screen');
    expect(blackScreen).not.toBeNull();
  });
});
