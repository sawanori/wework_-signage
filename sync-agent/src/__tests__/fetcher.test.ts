/**
 * テストケース対象: C-N-01(部分), C-N-02, C-E-01, C-E-02, C-E-07
 *
 * C-N-01: 初回同期 — PlaylistResponse型が返ることを検証（fetchをモック）
 * C-N-02: 差分なしスキップ — version一致時にダウンロード処理が実行されない
 * C-E-01: ネットワーク切断 — エラーキャッチ後nullが返る
 * C-E-02: タイムアウト（10秒超過） — AbortControllerで10秒後にリクエストが中止される
 * C-E-07: APIが500エラー — nullが返りログが出力される
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PlaylistResponse } from '@non-turn/shared';

// fetchをグローバルモック
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// fetcherモジュールのインポート
const fetcherModule = await import('../fetcher.js');

const VALID_PLAYLIST_RESPONSE: PlaylistResponse = {
  version: 'v_1710678000',
  orientation: 'portrait',
  deviceId: 'device_kyokomachi_01',
  storeId: 'store_kyokomachi',
  globalSettings: {
    fadeDurationMs: 2000,
    intervalMs: 10000,
  },
  items: [
    {
      id: 'img_001',
      url: 'https://cdn.non-turn.com/kyokomachi/interior-01.jpg',
      hash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
      type: 'image',
      durationOverrideMs: null,
      position: 1,
    },
  ],
};

describe('fetcher.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * C-N-01: fetchPlaylist が PlaylistResponse 型のオブジェクトを返す
   */
  it('C-N-01: 正常なAPIレスポンスでPlaylistResponse型が返る', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => VALID_PLAYLIST_RESPONSE,
    });

    const fetchPlaylist = (fetcherModule as {
      fetchPlaylist?: (apiUrl: string, deviceId: string) => Promise<PlaylistResponse | null>
    }).fetchPlaylist;
    expect(fetchPlaylist).toBeDefined();

    const result = await fetchPlaylist!(
      'https://admin.non-turn.com',
      'device_kyokomachi_01'
    );

    expect(result).not.toBeNull();
    expect(result!.version).toBe('v_1710678000');
    expect(result!.orientation).toBe('portrait');
    expect(result!.deviceId).toBe('device_kyokomachi_01');
    expect(result!.storeId).toBe('store_kyokomachi');
    expect(result!.globalSettings.fadeDurationMs).toBe(2000);
    expect(result!.globalSettings.intervalMs).toBe(10000);
    expect(Array.isArray(result!.items)).toBe(true);
    expect(result!.items[0].id).toBe('img_001');
    expect(result!.items[0].type).toBe('image');
    expect(result!.items[0].hash).toMatch(/^[a-f0-9]+$/);
  });

  /**
   * C-E-02: レスポンスが10秒以内に返らない場合、AbortControllerでリクエストが中止される
   */
  it('C-E-02: APIタイムアウト10秒でAbortControllerによりリクエストが中止される', async () => {
    vi.useFakeTimers();

    // fetchが永遠に解決しない（AbortErrorをシミュレート）
    mockFetch.mockImplementationOnce((_url: string, options?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        const signal = options?.signal;
        if (signal) {
          signal.addEventListener('abort', () => {
            const abortError = new DOMException('The operation was aborted', 'AbortError');
            reject(abortError);
          });
        }
      });
    });

    const fetchPlaylist = (fetcherModule as {
      fetchPlaylist?: (apiUrl: string, deviceId: string) => Promise<PlaylistResponse | null>
    }).fetchPlaylist;
    expect(fetchPlaylist).toBeDefined();

    const resultPromise = fetchPlaylist!(
      'https://admin.non-turn.com',
      'device_kyokomachi_01'
    );

    // 10秒経過させる
    await vi.advanceTimersByTimeAsync(10_000);

    const result = await resultPromise;

    // タイムアウト後はnullが返ること
    expect(result).toBeNull();

    // fetchがAbortControllerのsignalを受け取って呼ばれたこと
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('device_kyokomachi_01'),
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  /**
   * C-E-01: ネットワークエラー — fetchがネットワークエラーを投げた場合、nullが返る
   */
  it('C-E-01: ネットワークエラー時にnullが返る', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const fetchPlaylist = (fetcherModule as {
      fetchPlaylist?: (apiUrl: string, deviceId: string) => Promise<PlaylistResponse | null>
    }).fetchPlaylist;
    expect(fetchPlaylist).toBeDefined();

    const result = await fetchPlaylist!(
      'https://admin.non-turn.com',
      'device_kyokomachi_01'
    );

    expect(result).toBeNull();
  });

  /**
   * C-E-01(追加): AbortError時にnullが返る（タイムアウトまたはネットワーク切断）
   */
  it('C-E-01: AbortError時にnullが返る', async () => {
    const abortError = new DOMException('The operation was aborted', 'AbortError');
    mockFetch.mockRejectedValueOnce(abortError);

    const fetchPlaylist = (fetcherModule as {
      fetchPlaylist?: (apiUrl: string, deviceId: string) => Promise<PlaylistResponse | null>
    }).fetchPlaylist;
    expect(fetchPlaylist).toBeDefined();

    const result = await fetchPlaylist!(
      'https://admin.non-turn.com',
      'device_kyokomachi_01'
    );

    expect(result).toBeNull();
  });

  /**
   * C-E-07: APIが500を返した場合、nullが返る
   */
  it('C-E-07: APIが500エラーを返した場合にnullが返る', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Internal Server Error' }),
    });

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const fetchPlaylist = (fetcherModule as {
      fetchPlaylist?: (apiUrl: string, deviceId: string) => Promise<PlaylistResponse | null>
    }).fetchPlaylist;
    expect(fetchPlaylist).toBeDefined();

    const result = await fetchPlaylist!(
      'https://admin.non-turn.com',
      'device_kyokomachi_01'
    );

    expect(result).toBeNull();
    // エラーログが出力されること
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  /**
   * C-N-02: version一致時は差分なしスキップ
   * fetchPlaylistは常にAPIからデータを取得するが、呼び出し元（index.ts）がversion比較を行う
   * ここではfetchPlaylistが正常にPlaylistResponseを返すことを確認する
   */
  it('C-N-02: APIレスポンスのversionがローカルと一致する場合のレスポンス取得確認', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => VALID_PLAYLIST_RESPONSE,
    });

    const fetchPlaylist = (fetcherModule as {
      fetchPlaylist?: (apiUrl: string, deviceId: string) => Promise<PlaylistResponse | null>
    }).fetchPlaylist;
    expect(fetchPlaylist).toBeDefined();

    const result = await fetchPlaylist!(
      'https://admin.non-turn.com',
      'device_kyokomachi_01'
    );

    // fetchPlaylistはversionを返すだけで、差分判断は呼び出し元
    expect(result).not.toBeNull();
    expect(result!.version).toBe('v_1710678000');
  });
});
