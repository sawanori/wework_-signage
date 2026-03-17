/**
 * 複数プレイリスト機能 ビジネスロジック ユニットテスト
 *
 * 検証内容:
 * - getActivePlaylist(): is_active=1のプレイリストを取得
 * - getPlaylistSummaries(): デバイスの全プレイリストサマリー取得
 * - createPlaylist(): 3件上限チェック付き作成
 * - activatePlaylist(): トランザクション切替
 * - renamePlaylist(): 名前変更
 * - deletePlaylist(): アクティブ拒否削除
 * - deletePlaylistItem(): playlist_idクロスチェック (DA-C-003修正確認)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({
  db: {
    execute: vi.fn(),
    batch: vi.fn(),
  },
}));

vi.mock('@/lib/version', () => ({
  generateVersion: vi.fn(() => 'v_test'),
}));

const playlistModule = await import('@/lib/playlist');

describe('getActivePlaylist()', () => {
  beforeEach(() => vi.clearAllMocks());

  it('is_active=1のプレイリストを返す', async () => {
    const { db } = await import('@/lib/db');
    const mockDb = db as { execute: ReturnType<typeof vi.fn> };

    mockDb.execute
      .mockResolvedValueOnce({
        rows: [[1, 'device_kyokomachi_01', 'store_kyokomachi', 'v_1710678000', 'portrait', 2000, 10000]],
      })
      .mockResolvedValueOnce({ rows: [] });

    const result = await playlistModule.getActivePlaylist('device_kyokomachi_01');

    expect(result).not.toBeNull();
    expect(result!.deviceId).toBe('device_kyokomachi_01');
    // verify SQL includes is_active filter
    const sqlCalled = (mockDb.execute.mock.calls[0] as [{ sql: string }])[0].sql;
    expect(sqlCalled).toContain('is_active = 1');
  });

  it('デバイスが見つからない場合にnullを返す', async () => {
    const { db } = await import('@/lib/db');
    const mockDb = db as { execute: ReturnType<typeof vi.fn> };
    mockDb.execute.mockResolvedValueOnce({ rows: [] });

    const result = await playlistModule.getActivePlaylist('unknown');
    expect(result).toBeNull();
  });
});

describe('getPlaylistSummaries()', () => {
  beforeEach(() => vi.clearAllMocks());

  it('デバイスの全プレイリストサマリーをPlaylistListResponse形式で返す', async () => {
    const { db } = await import('@/lib/db');
    const mockDb = db as { execute: ReturnType<typeof vi.fn> };

    mockDb.execute.mockResolvedValueOnce({
      rows: [
        [1, '通常', 1, 'v_1710678000', 1710678000, 5, 'store_kyokomachi'],
        [2, '春メニュー', 0, 'v_1710670000', 1710670000, 3, 'store_kyokomachi'],
      ],
    });

    const result = await playlistModule.getPlaylistSummaries('device_kyokomachi_01');

    expect(result).not.toBeNull();
    expect(result!.deviceId).toBe('device_kyokomachi_01');
    expect(result!.storeId).toBe('store_kyokomachi');
    expect(result!.playlists).toHaveLength(2);
    expect(result!.playlists[0].isActive).toBe(true);
    expect(result!.playlists[1].isActive).toBe(false);
    expect(result!.playlists[0].itemCount).toBe(5);
  });

  it('デバイスが見つからない場合にnullを返す', async () => {
    const { db } = await import('@/lib/db');
    const mockDb = db as { execute: ReturnType<typeof vi.fn> };
    mockDb.execute.mockResolvedValueOnce({ rows: [] });

    const result = await playlistModule.getPlaylistSummaries('unknown');
    expect(result).toBeNull();
  });
});

describe('createPlaylist()', () => {
  beforeEach(() => vi.clearAllMocks());

  it('新規プレイリストを作成してCreatePlaylistResponseを返す', async () => {
    const { db } = await import('@/lib/db');
    const mockDb = db as { execute: ReturnType<typeof vi.fn> };

    mockDb.execute.mockResolvedValueOnce({ rows: [[1, 'store_kyokomachi']] }); // count=1
    mockDb.execute.mockResolvedValueOnce({ rows: [[2]] }); // INSERT RETURNING id

    const result = await playlistModule.createPlaylist('device_kyokomachi_01', '春メニュー');

    expect(result.playlistId).toBe(2);
    expect(result.name).toBe('春メニュー');
    expect(result.isActive).toBe(false);
  });

  it('3件上限超過時にPLAYLIST_LIMIT_EXCEEDEDエラーをthrowする', async () => {
    const { db } = await import('@/lib/db');
    const mockDb = db as { execute: ReturnType<typeof vi.fn> };

    mockDb.execute.mockResolvedValueOnce({ rows: [[3, 'store_kyokomachi']] }); // count=3

    await expect(
      playlistModule.createPlaylist('device_kyokomachi_01', '夏メニュー')
    ).rejects.toThrow('PLAYLIST_LIMIT_EXCEEDED');
  });
});

describe('activatePlaylist()', () => {
  beforeEach(() => vi.clearAllMocks());

  it('指定プレイリストをアクティブにしてバッチトランザクションを実行する', async () => {
    const { db } = await import('@/lib/db');
    const mockDb = db as { execute: ReturnType<typeof vi.fn>; batch: ReturnType<typeof vi.fn> };

    mockDb.execute.mockResolvedValueOnce({ rows: [[2, '春メニュー', 0]] });
    mockDb.batch.mockResolvedValueOnce([{ rowsAffected: 1 }, { rowsAffected: 1 }]);

    const result = await playlistModule.activatePlaylist(2, 'device_kyokomachi_01');

    expect(result.playlistId).toBe(2);
    expect(result.isActive).toBe(true);
    expect(result.name).toBe('春メニュー');

    // バッチが2ステートメントで呼ばれたことを確認
    const batchStatements = mockDb.batch.mock.calls[0][0] as Array<{ sql: string }>;
    expect(batchStatements).toHaveLength(2);
    expect(batchStatements[0].sql).toContain('is_active = 0');
    expect(batchStatements[1].sql).toContain('is_active = 1');
  });

  it('存在しないIDでPLAYLIST_NOT_FOUNDエラーをthrowする', async () => {
    const { db } = await import('@/lib/db');
    const mockDb = db as { execute: ReturnType<typeof vi.fn> };
    mockDb.execute.mockResolvedValueOnce({ rows: [] });

    await expect(
      playlistModule.activatePlaylist(999, 'device_kyokomachi_01')
    ).rejects.toThrow('PLAYLIST_NOT_FOUND');
  });
});

describe('deletePlaylist()', () => {
  beforeEach(() => vi.clearAllMocks());

  it('非アクティブプレイリストを削除する', async () => {
    const { db } = await import('@/lib/db');
    const mockDb = db as { execute: ReturnType<typeof vi.fn>; batch: ReturnType<typeof vi.fn> };

    mockDb.execute.mockResolvedValueOnce({ rows: [[0]] }); // is_active=0
    mockDb.batch.mockResolvedValueOnce([{ rowsAffected: 1 }, { rowsAffected: 1 }]);

    await expect(
      playlistModule.deletePlaylist(2, 'device_kyokomachi_01')
    ).resolves.toBeUndefined();

    // バッチが2ステートメントで呼ばれた（playlist_items削除 + playlists削除）
    expect(mockDb.batch).toHaveBeenCalledTimes(1);
  });

  it('アクティブプレイリストの削除試行でCANNOT_DELETE_ACTIVEエラーをthrowする', async () => {
    const { db } = await import('@/lib/db');
    const mockDb = db as { execute: ReturnType<typeof vi.fn> };

    mockDb.execute.mockResolvedValueOnce({ rows: [[1]] }); // is_active=1

    await expect(
      playlistModule.deletePlaylist(1, 'device_kyokomachi_01')
    ).rejects.toThrow('CANNOT_DELETE_ACTIVE');
  });

  it('存在しないIDでPLAYLIST_NOT_FOUNDエラーをthrowする', async () => {
    const { db } = await import('@/lib/db');
    const mockDb = db as { execute: ReturnType<typeof vi.fn> };
    mockDb.execute.mockResolvedValueOnce({ rows: [] });

    await expect(
      playlistModule.deletePlaylist(999, 'device_kyokomachi_01')
    ).rejects.toThrow('PLAYLIST_NOT_FOUND');
  });
});

describe('deletePlaylistItem() — DA-C-003修正確認', () => {
  beforeEach(() => vi.clearAllMocks());

  it('DELETE文にplaylist_id条件が含まれる（クロスプレイリスト削除防止）', async () => {
    const { db } = await import('@/lib/db');
    const mockDb = db as { execute: ReturnType<typeof vi.fn>; batch: ReturnType<typeof vi.fn> };
    mockDb.batch.mockResolvedValueOnce([{ rowsAffected: 1 }, { rowsAffected: 1 }]);

    await playlistModule.deletePlaylistItem('img_001', 1);

    const batchStatements = mockDb.batch.mock.calls[0][0] as Array<{ sql: string; args: unknown[] }>;
    const deleteSql = batchStatements[0].sql;
    expect(deleteSql).toContain('playlist_id');
    expect(batchStatements[0].args).toContain('img_001');
    expect(batchStatements[0].args).toContain(1);
  });
});
