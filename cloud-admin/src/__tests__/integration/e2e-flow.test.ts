/**
 * 結合テスト: E2Eフロー（Cloud Admin全体）
 * 検証内容: Cloud AdminでアップロードからLocal Viewer表示までのフロー
 *
 * テスト内容:
 * 1. POST /api/upload で署名付きURL取得（R2モック）
 * 2. POST /api/playlist/items でアイテム追加（DBモック）
 * 3. GET /api/playlist でPlaylistResponse取得
 * 4. レスポンスのitemsに追加したアイテムが含まれる
 * 5. versionが更新されている
 * 6. POST /api/playlist/reorder で並び替え
 * 7. DELETE /api/playlist/items/[id] で削除
 * 8. GET /api/playlist で削除反映確認
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PlaylistResponse } from '@non-turn/shared';

// DB (Turso) をモック
vi.mock('@/lib/db', () => ({
  db: {
    execute: vi.fn(),
    batch: vi.fn(),
  },
}));

// R2 をモック
vi.mock('@/lib/r2', () => ({
  R2_PUBLIC_URL: 'https://cdn.non-turn.com',
  generatePresignedUrl: vi.fn(),
}));

// Next.js next/server モック
vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) => ({
      status: init?.status ?? 200,
      json: async () => body,
      body,
    }),
  },
}));

// バージョン生成モック（決定的なバージョンを返す）
vi.mock('@/lib/version', () => ({
  generateVersion: vi.fn(),
}));

// ルートハンドラーをインポート
const { POST: uploadPOST } = await import('@/app/api/upload/route');
const { GET: playlistGET } = await import('@/app/api/playlist/route');
const { POST: itemsPOST } = await import('@/app/api/playlist/items/route');
const { POST: reorderPOST } = await import('@/app/api/playlist/reorder/route');
const { DELETE: itemDELETE } = await import('@/app/api/playlist/items/[id]/route');

// テスト用定数
const TEST_DEVICE_ID = 'device_kyokomachi_01';
const TEST_STORE_ID = 'store_kyokomachi';
const PLAYLIST_ID = 1;
const AUTH_HEADER = { Authorization: 'Bearer test-api-key' };

// DB行ビルダー
function buildPlaylistRow(version = 'v_1710678000', items: unknown[][] = []) {
  return {
    playlistRow: {
      rows: [[
        PLAYLIST_ID,       // id
        TEST_DEVICE_ID,    // device_id
        TEST_STORE_ID,     // store_id
        version,           // version
        'portrait',        // orientation
        2000,              // fade_duration_ms
        10000,             // interval_ms
      ]],
    },
    itemsRow: {
      rows: items,
    },
  };
}

function makeItemRow(
  id: string,
  publicUrl: string,
  position: number,
  hash = 'a1b2c3d4',
  fileType = 'image',
  durationOverrideMs: number | null = null,
) {
  return [id, publicUrl, hash, fileType, durationOverrideMs, position];
}

describe('E2Eフロー統合テスト: Cloud Admin全体', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // テスト環境でADMIN_API_KEYが未設定の場合はauth通過させる
    process.env.NODE_ENV = 'test';
    delete process.env.ADMIN_API_KEY;
  });

  /**
   * E2E テスト 1: アップロード → アイテム追加 → プレイリスト取得のフルフロー
   */
  it('INT-E2E-01: アップロード → アイテム追加 → GET /api/playlist のフロー', async () => {
    const { generatePresignedUrl } = await import('@/lib/r2');
    const { db } = await import('@/lib/db');
    const { generateVersion } = await import('@/lib/version');

    const mockDb = db as {
      execute: ReturnType<typeof vi.fn>;
      batch: ReturnType<typeof vi.fn>;
    };
    const mockGeneratePresignedUrl = generatePresignedUrl as ReturnType<typeof vi.fn>;
    const mockGenerateVersion = generateVersion as ReturnType<typeof vi.fn>;

    // Step 1: POST /api/upload — R2署名付きURL取得
    mockGeneratePresignedUrl.mockResolvedValueOnce({
      uploadUrl: 'https://r2.example.com/upload?signed=true',
      fileId: 'img_abc123',
      publicUrl: 'https://cdn.non-turn.com/img_abc123.jpg',
    });

    const uploadRequest = new Request('http://localhost/api/upload', {
      method: 'POST',
      body: JSON.stringify({
        filename: 'interior-01.jpg',
        contentType: 'image/jpeg',
        fileSize: 1024 * 1024, // 1MB
      }),
    });

    const uploadResponse = await uploadPOST(uploadRequest);
    const uploadBody = await uploadResponse.json();

    expect(uploadResponse.status).toBe(200);
    expect(uploadBody.uploadUrl).toBeTruthy();
    expect(uploadBody.fileId).toBe('img_abc123');
    expect(uploadBody.publicUrl).toBe('https://cdn.non-turn.com/img_abc123.jpg');

    // Step 2: POST /api/playlist/items — アイテム追加
    // New route.ts queries playlists and max position before addPlaylistItem
    mockDb.execute
      .mockResolvedValueOnce({ rows: [{ id: PLAYLIST_ID, store_id: TEST_STORE_ID }] })  // SELECT playlists
      .mockResolvedValueOnce({ rows: [{ next_pos: 1 }] });  // SELECT MAX(position)
    mockDb.batch.mockResolvedValueOnce([{ rowsAffected: 1 }, { rowsAffected: 1 }]);
    mockGenerateVersion.mockReturnValueOnce('v_1710679000');

    const addItemRequest = new Request('http://localhost/api/playlist/items', {
      method: 'POST',
      body: JSON.stringify({
        playlistId: PLAYLIST_ID,
        id: 'img_abc123',
        r2Url: 'https://r2.example.com/img_abc123.jpg',
        publicUrl: 'https://cdn.non-turn.com/img_abc123.jpg',
        hash: 'sha256hashvalue001',
        fileType: 'image',
        originalFilename: 'interior-01.jpg',
        fileSizeBytes: 1024 * 1024,
        durationOverrideMs: null,
        position: 1,
        storeId: TEST_STORE_ID,
        deviceId: TEST_DEVICE_ID,
      }),
    });

    const addItemResponse = await itemsPOST(addItemRequest);
    const addItemBody = await addItemResponse.json();

    expect(addItemResponse.status).toBe(201);
    expect(addItemBody.success).toBe(true);

    // Step 3: GET /api/playlist — プレイリスト取得
    const { playlistRow, itemsRow } = buildPlaylistRow('v_1710679000', [
      makeItemRow('img_abc123', 'https://cdn.non-turn.com/img_abc123.jpg', 1, 'sha256hashvalue001'),
    ]);

    mockDb.execute
      .mockResolvedValueOnce(playlistRow)
      .mockResolvedValueOnce(itemsRow);

    const getRequest = new Request(
      `http://localhost/api/playlist?device_id=${TEST_DEVICE_ID}`
    );

    const getResponse = await playlistGET(getRequest);
    const getBody = await getResponse.json() as PlaylistResponse;

    expect(getResponse.status).toBe(200);

    // Step 4: レスポンスにimg_abc123が含まれていること
    expect(getBody.items).toHaveLength(1);
    expect(getBody.items[0].id).toBe('img_abc123');
    expect(getBody.items[0].url).toContain('/api/image?key=img_abc123.jpg');
    expect(getBody.items[0].hash).toBe('sha256hashvalue001');

    // Step 5: versionが更新されていること
    expect(getBody.version).toBe('v_1710679000');
    expect(getBody.version).toMatch(/^v_\d+$/);
  });

  /**
   * E2E テスト 2: アイテム並び替えフロー
   */
  it('INT-E2E-02: アイテム追加後に並び替えが反映される', async () => {
    const { db } = await import('@/lib/db');
    const { generateVersion } = await import('@/lib/version');

    const mockDb = db as {
      execute: ReturnType<typeof vi.fn>;
      batch: ReturnType<typeof vi.fn>;
    };
    const mockGenerateVersion = generateVersion as ReturnType<typeof vi.fn>;

    // Step 6: POST /api/playlist/reorder — 並び替え
    mockDb.batch.mockResolvedValueOnce([
      { rowsAffected: 1 },
      { rowsAffected: 1 },
      { rowsAffected: 1 },
    ]);
    mockGenerateVersion.mockReturnValueOnce('v_1710680000');

    const reorderRequest = new Request('http://localhost/api/playlist/reorder', {
      method: 'POST',
      body: JSON.stringify({
        playlistId: PLAYLIST_ID,
        orderedIds: ['img_002', 'img_001'],
      }),
    });

    const reorderResponse = await reorderPOST(reorderRequest);
    const reorderBody = await reorderResponse.json();

    expect(reorderResponse.status).toBe(200);
    expect(reorderBody.success).toBe(true);

    // 並び替え後のプレイリストを取得
    const { playlistRow, itemsRow } = buildPlaylistRow('v_1710680000', [
      makeItemRow('img_002', 'https://cdn.non-turn.com/img_002.jpg', 1),
      makeItemRow('img_001', 'https://cdn.non-turn.com/img_001.jpg', 2),
    ]);

    mockDb.execute
      .mockResolvedValueOnce(playlistRow)
      .mockResolvedValueOnce(itemsRow);

    const getRequest = new Request(
      `http://localhost/api/playlist?device_id=${TEST_DEVICE_ID}`
    );
    const getResponse = await playlistGET(getRequest);
    const getBody = await getResponse.json() as PlaylistResponse;

    expect(getResponse.status).toBe(200);
    // 並び替え後: img_002が先、img_001が後
    expect(getBody.items[0].id).toBe('img_002');
    expect(getBody.items[0].position).toBe(1);
    expect(getBody.items[1].id).toBe('img_001');
    expect(getBody.items[1].position).toBe(2);
    // versionが更新されていること
    expect(getBody.version).toBe('v_1710680000');
  });

  /**
   * E2E テスト 3: アイテム削除フロー
   */
  it('INT-E2E-03: アイテム削除後にGET /api/playlistで削除が反映される', async () => {
    const { db } = await import('@/lib/db');
    const { generateVersion } = await import('@/lib/version');

    const mockDb = db as {
      execute: ReturnType<typeof vi.fn>;
      batch: ReturnType<typeof vi.fn>;
    };
    const mockGenerateVersion = generateVersion as ReturnType<typeof vi.fn>;

    // Step 7: DELETE /api/playlist/items/[id] — img_002を削除
    mockDb.batch.mockResolvedValueOnce([{ rowsAffected: 1 }, { rowsAffected: 1 }]);
    mockGenerateVersion.mockReturnValueOnce('v_1710681000');

    const deleteRequest = new Request('http://localhost/api/playlist/items/img_002', {
      method: 'DELETE',
      body: JSON.stringify({ playlistId: PLAYLIST_ID }),
    });

    const deleteResponse = await itemDELETE(deleteRequest, { params: { id: 'img_002' } });
    const deleteBody = await deleteResponse.json();

    expect(deleteResponse.status).toBe(200);
    expect(deleteBody.success).toBe(true);

    // Step 8: GET /api/playlist で削除反映確認
    const { playlistRow, itemsRow } = buildPlaylistRow('v_1710681000', [
      makeItemRow('img_001', 'https://cdn.non-turn.com/img_001.jpg', 1),
      // img_002は削除されているため含まれない
    ]);

    mockDb.execute
      .mockResolvedValueOnce(playlistRow)
      .mockResolvedValueOnce(itemsRow);

    const getRequest = new Request(
      `http://localhost/api/playlist?device_id=${TEST_DEVICE_ID}`
    );
    const getResponse = await playlistGET(getRequest);
    const getBody = await getResponse.json() as PlaylistResponse;

    expect(getResponse.status).toBe(200);
    // img_002が削除されていること
    expect(getBody.items).toHaveLength(1);
    expect(getBody.items[0].id).toBe('img_001');
    const deletedItem = getBody.items.find((item) => item.id === 'img_002');
    expect(deletedItem).toBeUndefined();
    // versionが更新されていること
    expect(getBody.version).toBe('v_1710681000');
  });

  /**
   * E2E テスト 4: 複数アイテムの追加と順序確認
   */
  it('INT-E2E-04: 複数アイテム追加後にposition昇順で返される', async () => {
    const { db } = await import('@/lib/db');
    const { generateVersion } = await import('@/lib/version');

    const mockDb = db as {
      execute: ReturnType<typeof vi.fn>;
      batch: ReturnType<typeof vi.fn>;
    };
    const mockGenerateVersion = generateVersion as ReturnType<typeof vi.fn>;

    // 3アイテムのプレイリストを取得
    const { playlistRow, itemsRow } = buildPlaylistRow('v_1710682000', [
      makeItemRow('img_001', 'https://cdn.non-turn.com/img_001.jpg', 1),
      makeItemRow('img_002', 'https://cdn.non-turn.com/img_002.jpg', 2),
      makeItemRow('img_003', 'https://cdn.non-turn.com/img_003.jpg', 3),
    ]);

    mockDb.execute
      .mockResolvedValueOnce(playlistRow)
      .mockResolvedValueOnce(itemsRow);

    const getRequest = new Request(
      `http://localhost/api/playlist?device_id=${TEST_DEVICE_ID}`
    );
    const getResponse = await playlistGET(getRequest);
    const getBody = await getResponse.json() as PlaylistResponse;

    expect(getResponse.status).toBe(200);
    expect(getBody.items).toHaveLength(3);
    // position昇順で返されること
    expect(getBody.items[0].id).toBe('img_001');
    expect(getBody.items[1].id).toBe('img_002');
    expect(getBody.items[2].id).toBe('img_003');
    expect(getBody.items[0].position).toBeLessThan(getBody.items[1].position);
    expect(getBody.items[1].position).toBeLessThan(getBody.items[2].position);
  });

  /**
   * E2E テスト 5: 未認証リクエストは401を返す
   */
  it('INT-E2E-05: ADMIN_API_KEY設定時に未認証リクエストが401を返す', async () => {
    // ADMIN_API_KEYを設定して認証を有効化
    process.env.ADMIN_API_KEY = 'valid-api-key';

    const unauthorizedRequest = new Request('http://localhost/api/playlist/items', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer wrong-key',
      },
      body: JSON.stringify({
        playlistId: PLAYLIST_ID,
        id: 'img_test',
        r2Url: 'https://r2.example.com/test.jpg',
        publicUrl: 'https://cdn.non-turn.com/test.jpg',
        hash: 'testhash',
        fileType: 'image',
        originalFilename: 'test.jpg',
        fileSizeBytes: 100,
        durationOverrideMs: null,
        position: 1,
        storeId: TEST_STORE_ID,
        deviceId: TEST_DEVICE_ID,
      }),
    });

    const response = await itemsPOST(unauthorizedRequest);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe('UNAUTHORIZED');

    // テスト後にADMIN_API_KEYをリセット
    delete process.env.ADMIN_API_KEY;
  });

  /**
   * E2E テスト 6: 存在しないdevice_idへのGETリクエストは404を返す
   */
  it('INT-E2E-06: 存在しないdevice_idへのGETリクエストは404を返す', async () => {
    const { db } = await import('@/lib/db');
    const mockDb = db as { execute: ReturnType<typeof vi.fn> };

    // デバイスが見つからない場合
    mockDb.execute.mockResolvedValueOnce({ rows: [] });

    const getRequest = new Request(
      'http://localhost/api/playlist?device_id=unknown_device'
    );
    const getResponse = await playlistGET(getRequest);
    const getBody = await getResponse.json();

    expect(getResponse.status).toBe(404);
    expect(getBody.code).toBe('DEVICE_NOT_FOUND');
  });
});
