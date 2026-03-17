/**
 * テストケース対象:
 * A-N-06: playlist.json更新検知（30秒間隔でfetchが呼ばれる）
 * A-E-01: playlist.json読み込みエラー（fetchエラー時に前回のプレイリストを維持）
 * A-E-02: 破損したplaylist.json（JSONパースエラー時に前回のプレイリストを維持）
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { usePlaylist } from '../hooks/usePlaylist';
import type { PlaylistResponse } from '../types/playlist';

const mockPlaylistV1: PlaylistResponse = {
  version: 'v_1710678000',
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
      hash: 'a1b2c3d4',
      type: 'image',
      durationOverrideMs: null,
      position: 1,
    },
  ],
};

const mockPlaylistV2: PlaylistResponse = {
  ...mockPlaylistV1,
  version: 'v_1710679000',
  items: [
    ...mockPlaylistV1.items,
    {
      id: 'img_002',
      url: '/data/images/img_002.jpg',
      hash: 'e5f6a7b8',
      type: 'image',
      durationOverrideMs: null,
      position: 2,
    },
  ],
};

describe('usePlaylist フック', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockPlaylistV1,
      text: async () => JSON.stringify(mockPlaylistV1),
    } as Response);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // A-N-06: 30秒間隔でfetchが呼ばれる
  describe('A-N-06: playlist.json定期監視', () => {
    it('マウント時に即座に fetch が呼ばれる', async () => {
      const { result } = renderHook(() => usePlaylist());
      await act(async () => { await Promise.resolve(); });
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/data/playlist.json')
      );
    });

    it('30秒間隔で fetch が呼ばれる', async () => {
      const { result } = renderHook(() => usePlaylist());
      await act(async () => { await Promise.resolve(); });
      expect(fetch).toHaveBeenCalledTimes(1);

      // 29999ms では2回目はまだ呼ばれない
      await act(async () => { vi.advanceTimersByTime(29999); });
      expect(fetch).toHaveBeenCalledTimes(1);

      // 30000ms で2回目が呼ばれる
      await act(async () => { vi.advanceTimersByTime(1); });
      expect(fetch).toHaveBeenCalledTimes(2);

      // さらに 30000ms で3回目
      await act(async () => { vi.advanceTimersByTime(30000); });
      expect(fetch).toHaveBeenCalledTimes(3);
    });

    it('fetch URL にキャッシュバスタークエリが含まれる', async () => {
      const { result } = renderHook(() => usePlaylist());
      await act(async () => { await Promise.resolve(); });
      const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(calledUrl).toMatch(/[?&]t=\d+/);
    });

    it('version が変化したとき items が更新される', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockPlaylistV1,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockPlaylistV2,
        } as Response);

      const { result } = renderHook(() => usePlaylist());
      await act(async () => { await Promise.resolve(); });

      // 初回: v1 が適用されている
      expect(result.current.version).toBe('v_1710678000');
      expect(result.current.items).toHaveLength(1);

      // 30秒後: v2 に更新
      await act(async () => {
        vi.advanceTimersByTime(30000);
        await Promise.resolve();
      });
      expect(result.current.version).toBe('v_1710679000');
      expect(result.current.items).toHaveLength(2);
    });

    it('version が同じとき items は更新されない（fetch は呼ばれるが状態は変わらない）', async () => {
      vi.mocked(fetch)
        .mockResolvedValue({
          ok: true,
          json: async () => mockPlaylistV1,
        } as Response);

      const { result } = renderHook(() => usePlaylist());
      await act(async () => { await Promise.resolve(); });
      const initialItems = result.current.items;

      await act(async () => {
        vi.advanceTimersByTime(30000);
        await Promise.resolve();
      });
      // 同じオブジェクト参照か同等の値を保持
      expect(result.current.items).toEqual(initialItems);
    });
  });

  // A-E-01: fetchエラー時に前回のプレイリストを維持
  describe('A-E-01: playlist.json読み込みエラー', () => {
    it('fetchがネットワークエラーを返した場合、現在のプレイリストを継続使用する', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockPlaylistV1,
        } as Response)
        .mockRejectedValueOnce(new Error('Network error'));

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { result } = renderHook(() => usePlaylist());
      await act(async () => { await Promise.resolve(); });

      // 初回正常取得
      expect(result.current.items).toHaveLength(1);
      expect(result.current.version).toBe('v_1710678000');

      // 30秒後: fetchがエラー
      await act(async () => {
        vi.advanceTimersByTime(30000);
        await Promise.resolve();
      });

      // 前回のプレイリストが維持されている
      expect(result.current.items).toHaveLength(1);
      expect(result.current.version).toBe('v_1710678000');

      // console.warn が呼ばれている
      expect(consoleWarnSpy).toHaveBeenCalled();
      consoleWarnSpy.mockRestore();
    });

    it('fetchエラー後もタイマーが継続して次の30秒でリトライする', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce({ ok: true, json: async () => mockPlaylistV1 } as Response)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ ok: true, json: async () => mockPlaylistV2 } as Response);

      const { result } = renderHook(() => usePlaylist());
      await act(async () => { await Promise.resolve(); });

      // 1回目エラー
      await act(async () => {
        vi.advanceTimersByTime(30000);
        await Promise.resolve();
      });
      expect(result.current.version).toBe('v_1710678000');

      // 2回目は正常取得
      await act(async () => {
        vi.advanceTimersByTime(30000);
        await Promise.resolve();
      });
      expect(result.current.version).toBe('v_1710679000');
    });
  });

  // A-E-02: JSONパースエラー時に前回のプレイリストを維持
  describe('A-E-02: 破損したplaylist.json', () => {
    it('JSONパースエラーが発生した場合、現在のプレイリストを継続使用する', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockPlaylistV1,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => { throw new SyntaxError('Unexpected token < in JSON'); },
        } as unknown as Response);

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => usePlaylist());
      await act(async () => { await Promise.resolve(); });
      expect(result.current.version).toBe('v_1710678000');

      // 30秒後: JSONパースエラー
      await act(async () => {
        vi.advanceTimersByTime(30000);
        await Promise.resolve();
      });

      // 前回のプレイリストが維持されている
      expect(result.current.items).toHaveLength(1);
      expect(result.current.version).toBe('v_1710678000');

      // console.error が呼ばれている
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  // アンマウント時のクリーンアップ
  describe('クリーンアップ', () => {
    it('アンマウント後はfetchが呼ばれなくなる', async () => {
      const { result, unmount } = renderHook(() => usePlaylist());
      await act(async () => { await Promise.resolve(); });
      expect(fetch).toHaveBeenCalledTimes(1);

      unmount();

      // アンマウント後の30秒タイマー
      await act(async () => {
        vi.advanceTimersByTime(30000);
        await Promise.resolve();
      });
      // fetchは1回のみ（マウント時の初回のみ）
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });
});
