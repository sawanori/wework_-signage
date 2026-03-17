/**
 * プレイリストビジネスロジック ユニットテスト
 *
 * 検証内容:
 * - getPlaylist(): device_idでプレイリスト取得（Tursoクライアントをモック）
 * - addPlaylistItem(): アイテム追加ロジック
 * - deletePlaylistItem(): アイテム削除ロジック
 * - reorderPlaylistItems(): 並び替えロジック
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PlaylistResponse } from '@non-turn/shared';

// Tursoクライアントをモック
vi.mock('@/lib/db', () => ({
  db: {
    execute: vi.fn(),
    batch: vi.fn(),
  },
}));

// versionをモック（テストで固定値を使えるように）
vi.mock('@/lib/version', () => ({
  generateVersion: vi.fn(() => 'v_1710678000'),
}));

// playlist.tsのインポート（スタブのまま）
// NOTE: 現時点では playlist.ts は TODO のみのスタブ。
// テストはスタブに対して実行されるため失敗（Red）する。
const playlistModule = await import('@/lib/playlist');

describe('playlist.ts ビジネスロジック', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * getPlaylist(): device_idでTursoから取得してPlaylistResponseを返す
   */
  describe('getPlaylist()', () => {
    it('device_idを指定するとPlaylistResponse型のオブジェクトを返す', async () => {
      const { db } = await import('@/lib/db');
      const mockDb = db as { execute: ReturnType<typeof vi.fn>; batch: ReturnType<typeof vi.fn> };

      mockDb.execute
        .mockResolvedValueOnce({
          rows: [[
            1,
            'device_kyokomachi_01',
            'store_kyokomachi',
            'v_1710678000',
            'portrait',
            2000,
            10000,
          ]],
        })
        .mockResolvedValueOnce({
          rows: [[
            'img_001',
            'https://cdn.non-turn.com/kyokomachi/interior-01.jpg',
            'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
            'image',
            null,
            1,
          ]],
        });

      // getPlaylist が export されているか確認
      expect(playlistModule).toHaveProperty('getPlaylist');

      const getPlaylist = (playlistModule as { getPlaylist?: (deviceId: string) => Promise<PlaylistResponse | null> }).getPlaylist;
      expect(getPlaylist).toBeDefined();

      const result = await getPlaylist!('device_kyokomachi_01');

      expect(result).not.toBeNull();
      expect(result!.deviceId).toBe('device_kyokomachi_01');
      expect(result!.storeId).toBe('store_kyokomachi');
      expect(result!.version).toBe('v_1710678000');
      expect(result!.orientation).toBe('portrait');
      expect(result!.globalSettings.fadeDurationMs).toBe(2000);
      expect(result!.globalSettings.intervalMs).toBe(10000);
      expect(result!.items).toHaveLength(1);
      expect(result!.items[0].id).toBe('img_001');
    });

    it('device_idが存在しない場合はnullを返す', async () => {
      const { db } = await import('@/lib/db');
      const mockDb = db as { execute: ReturnType<typeof vi.fn> };
      mockDb.execute.mockResolvedValueOnce({ rows: [] });

      const getPlaylist = (playlistModule as { getPlaylist?: (deviceId: string) => Promise<PlaylistResponse | null> }).getPlaylist;
      expect(getPlaylist).toBeDefined();

      const result = await getPlaylist!('unknown_device');

      expect(result).toBeNull();
    });
  });

  /**
   * addPlaylistItem(): アイテム追加後にversionが更新される
   */
  describe('addPlaylistItem()', () => {
    it('アイテムを追加するとDBにINSERTしてversionを更新する', async () => {
      const { db } = await import('@/lib/db');
      const mockDb = db as { execute: ReturnType<typeof vi.fn>; batch: ReturnType<typeof vi.fn> };
      mockDb.execute.mockResolvedValue({ rows: [] });
      mockDb.batch.mockResolvedValue([]);

      const addPlaylistItem = (playlistModule as {
        addPlaylistItem?: (params: {
          playlistId: number;
          id: string;
          r2Url: string;
          publicUrl: string;
          hash: string;
          fileType: string;
          originalFilename: string;
          fileSizeBytes: number;
          durationOverrideMs: number | null;
          position: number;
          storeId: string;
          deviceId: string;
        }) => Promise<void>
      }).addPlaylistItem;
      expect(addPlaylistItem).toBeDefined();

      await addPlaylistItem!({
        playlistId: 1,
        id: 'img_001',
        r2Url: 'https://cdn.non-turn.com/img_001.jpg',
        publicUrl: 'https://cdn.non-turn.com/img_001.jpg',
        hash: 'abc123',
        fileType: 'image',
        originalFilename: 'interior-01.jpg',
        fileSizeBytes: 8_500_000,
        durationOverrideMs: null,
        position: 1,
        storeId: 'store_kyokomachi',
        deviceId: 'device_kyokomachi_01',
      });

      // DBのbatchが呼ばれたこと（INSERT + version UPDATE をトランザクションで実行）
      const wasCalled = mockDb.execute.mock.calls.length > 0 || mockDb.batch.mock.calls.length > 0;
      expect(wasCalled).toBe(true);
    });
  });

  /**
   * deletePlaylistItem(): アイテム削除後にversionが更新される
   */
  describe('deletePlaylistItem()', () => {
    it('アイテムを削除するとDBからDELETEしてversionを更新する', async () => {
      const { db } = await import('@/lib/db');
      const mockDb = db as { execute: ReturnType<typeof vi.fn>; batch: ReturnType<typeof vi.fn> };
      mockDb.execute.mockResolvedValue({ rows: [] });
      mockDb.batch.mockResolvedValue([]);

      const deletePlaylistItem = (playlistModule as {
        deletePlaylistItem?: (itemId: string, playlistId: number) => Promise<void>
      }).deletePlaylistItem;
      expect(deletePlaylistItem).toBeDefined();

      await deletePlaylistItem!('img_001', 1);

      // DBのbatchが呼ばれたこと（DELETE + version UPDATE をトランザクションで実行）
      const wasCalled = mockDb.execute.mock.calls.length > 0 || mockDb.batch.mock.calls.length > 0;
      expect(wasCalled).toBe(true);
    });
  });

  /**
   * reorderPlaylistItems(): 並び替えでpositionが更新される
   */
  describe('reorderPlaylistItems()', () => {
    it('並び替えリクエストでpositionを更新する', async () => {
      const { db } = await import('@/lib/db');
      const mockDb = db as { execute: ReturnType<typeof vi.fn>; batch: ReturnType<typeof vi.fn> };
      mockDb.execute.mockResolvedValue({ rows: [] });
      mockDb.batch?.mockResolvedValue([]);

      const reorderPlaylistItems = (playlistModule as {
        reorderPlaylistItems?: (
          playlistId: number,
          orderedIds: string[]
        ) => Promise<void>
      }).reorderPlaylistItems;
      expect(reorderPlaylistItems).toBeDefined();

      await reorderPlaylistItems!(1, ['img_003', 'img_001', 'img_002']);

      // DBのexecuteまたはbatchが呼ばれたこと
      const wasCalled = mockDb.execute.mock.calls.length > 0 || (mockDb.batch?.mock.calls.length ?? 0) > 0;
      expect(wasCalled).toBe(true);
    });
  });
});
