/**
 * テストケース対象: B-N-01, B-N-02, B-N-04, B-N-05, B-E-01, B-EC-01, B-EC-02
 *
 * B-N-01: GET /api/playlist — device_id="device_kyokomachi_01" でPlaylistResponse型のJSONが200で返る
 * B-N-02: バージョン更新 — アイテム変更後にversionが変わる
 * B-N-04: アイテム削除後プレイリスト — 削除されたアイテムがレスポンスに含まれない
 * B-N-05: 並び替え反映 — position順でitemsが返る
 * B-E-01: 不明なdevice_id — 404 + DEVICE_NOT_FOUND
 * B-EC-01: 0件プレイリスト — items:[] の有効なレスポンス
 * B-EC-02: 100件プレイリスト — 全100件が返る
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PlaylistResponse } from '@non-turn/shared';

// Tursoクライアントをモック
vi.mock('@/lib/db', () => ({
  db: {
    execute: vi.fn(),
  },
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

// ルートハンドラーのインポート（スタブのまま）
const { GET } = await import('@/app/api/playlist/route');

// モック用DB結果ビルダー
function buildDbRows(deviceId = 'device_kyokomachi_01', items: Array<{
  id: string;
  r2_url: string;
  hash: string;
  file_type: string;
  duration_override_ms: number | null;
  position: number;
}> = []) {
  return {
    playlist: {
      rows: [[
        1,                    // id
        deviceId,             // device_id
        'store_kyokomachi',   // store_id
        'v_1710678000',       // version
        'portrait',           // orientation
        2000,                 // fade_duration_ms
        10000,                // interval_ms
      ]],
    },
    items: {
      rows: items.map(item => [
        item.id,
        item.r2_url,
        item.hash,
        item.file_type,
        item.duration_override_ms,
        item.position,
      ]),
    },
  };
}

describe('GET /api/playlist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * B-N-01: device_id="device_kyokomachi_01" でPlaylistResponse型のJSONが200で返る
   */
  it('B-N-01: device_id指定でPlaylistResponse型のJSONを200で返す', async () => {
    const { db } = await import('@/lib/db');
    const mockDb = db as { execute: ReturnType<typeof vi.fn> };
    const dbRows = buildDbRows('device_kyokomachi_01', [
      {
        id: 'img_001',
        r2_url: 'https://cdn.non-turn.com/kyokomachi/interior-01.jpg',
        hash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
        file_type: 'image',
        duration_override_ms: null,
        position: 1,
      },
    ]);
    mockDb.execute
      .mockResolvedValueOnce(dbRows.playlist)
      .mockResolvedValueOnce(dbRows.items);

    const request = new Request('http://localhost/api/playlist?device_id=device_kyokomachi_01');
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);

    // PlaylistResponse型の構造を検証
    expect(body).toHaveProperty('version');
    expect(body).toHaveProperty('orientation');
    expect(body).toHaveProperty('globalSettings');
    expect(body).toHaveProperty('deviceId', 'device_kyokomachi_01');
    expect(body).toHaveProperty('storeId', 'store_kyokomachi');
    expect(body).toHaveProperty('items');
    expect(Array.isArray(body.items)).toBe(true);

    // globalSettingsの型を検証
    expect(body.globalSettings).toHaveProperty('fadeDurationMs');
    expect(body.globalSettings).toHaveProperty('intervalMs');

    // versionのフォーマット検証: "v_" + UNIXタイムスタンプ
    expect(body.version).toMatch(/^v_\d+$/);

    // orientationの値を検証
    expect(['portrait', 'landscape']).toContain(body.orientation);

    // アイテムの構造を検証
    const item = body.items[0] as PlaylistResponse['items'][0];
    expect(item).toHaveProperty('id', 'img_001');
    expect(item).toHaveProperty('url');
    expect(item).toHaveProperty('hash');
    expect(item).toHaveProperty('type');
    expect(item).toHaveProperty('durationOverrideMs');
    expect(item).toHaveProperty('position');
  });

  /**
   * B-N-02: アイテム追加後にversionが変わる
   */
  it('B-N-02: アイテム変更後にversionが以前と異なる文字列になる', async () => {
    const { db } = await import('@/lib/db');
    const mockDb = db as { execute: ReturnType<typeof vi.fn> };

    // 初回: version "v_1710678000"
    const dbRows1 = buildDbRows('device_kyokomachi_01', []);
    dbRows1.playlist.rows[0][3] = 'v_1710678000';
    mockDb.execute
      .mockResolvedValueOnce(dbRows1.playlist)
      .mockResolvedValueOnce(dbRows1.items);

    const req1 = new Request('http://localhost/api/playlist?device_id=device_kyokomachi_01');
    const res1 = await GET(req1);
    const body1 = await res1.json();
    const versionBefore = body1.version;

    // 2回目: version "v_1710678060" (更新後)
    const dbRows2 = buildDbRows('device_kyokomachi_01', [
      {
        id: 'img_002',
        r2_url: 'https://cdn.non-turn.com/kyokomachi/interior-02.jpg',
        hash: 'b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3',
        file_type: 'image',
        duration_override_ms: null,
        position: 1,
      },
    ]);
    dbRows2.playlist.rows[0][3] = 'v_1710678060';
    mockDb.execute
      .mockResolvedValueOnce(dbRows2.playlist)
      .mockResolvedValueOnce(dbRows2.items);

    const req2 = new Request('http://localhost/api/playlist?device_id=device_kyokomachi_01');
    const res2 = await GET(req2);
    const body2 = await res2.json();
    const versionAfter = body2.version;

    expect(versionAfter).not.toBe(versionBefore);
    expect(versionAfter).toMatch(/^v_\d+$/);
  });

  /**
   * B-N-04: DELETE後のGET /api/playlist に削除されたアイテムが含まれない
   */
  it('B-N-04: 削除されたアイテムがレスポンスに含まれない', async () => {
    const { db } = await import('@/lib/db');
    const mockDb = db as { execute: ReturnType<typeof vi.fn> };

    // img_001のみ存在（img_002は削除済み）
    const dbRows = buildDbRows('device_kyokomachi_01', [
      {
        id: 'img_001',
        r2_url: 'https://cdn.non-turn.com/kyokomachi/interior-01.jpg',
        hash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
        file_type: 'image',
        duration_override_ms: null,
        position: 1,
      },
    ]);
    mockDb.execute
      .mockResolvedValueOnce(dbRows.playlist)
      .mockResolvedValueOnce(dbRows.items);

    const request = new Request('http://localhost/api/playlist?device_id=device_kyokomachi_01');
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    const ids = body.items.map((item: PlaylistResponse['items'][0]) => item.id);
    expect(ids).not.toContain('img_002');
    expect(ids).toContain('img_001');
  });

  /**
   * B-N-05: position順でitemsが返る
   */
  it('B-N-05: items が position 昇順で返る', async () => {
    const { db } = await import('@/lib/db');
    const mockDb = db as { execute: ReturnType<typeof vi.fn> };

    // positionが 2, 1, 3 の順で格納されているケース
    const dbRows = buildDbRows('device_kyokomachi_01', [
      {
        id: 'img_002',
        r2_url: 'https://cdn.non-turn.com/img_002.jpg',
        hash: 'aaa',
        file_type: 'image',
        duration_override_ms: null,
        position: 2,
      },
      {
        id: 'img_001',
        r2_url: 'https://cdn.non-turn.com/img_001.jpg',
        hash: 'bbb',
        file_type: 'image',
        duration_override_ms: null,
        position: 1,
      },
      {
        id: 'img_003',
        r2_url: 'https://cdn.non-turn.com/img_003.jpg',
        hash: 'ccc',
        file_type: 'image',
        duration_override_ms: null,
        position: 3,
      },
    ]);
    mockDb.execute
      .mockResolvedValueOnce(dbRows.playlist)
      .mockResolvedValueOnce(dbRows.items);

    const request = new Request('http://localhost/api/playlist?device_id=device_kyokomachi_01');
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    const positions = body.items.map((item: PlaylistResponse['items'][0]) => item.position);
    expect(positions).toEqual([1, 2, 3]);
  });

  /**
   * B-E-01: 存在しないdevice_idでGETすると404とエラーコード"DEVICE_NOT_FOUND"が返る
   */
  it('B-E-01: 不明なdevice_idで404とDEVICE_NOT_FOUNDを返す', async () => {
    const { db } = await import('@/lib/db');
    const mockDb = db as { execute: ReturnType<typeof vi.fn> };

    // デバイスが見つからない場合: rowsが空
    mockDb.execute.mockResolvedValueOnce({ rows: [] });

    const request = new Request('http://localhost/api/playlist?device_id=unknown_device');
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toHaveProperty('code', 'DEVICE_NOT_FOUND');
  });

  /**
   * B-EC-01: items配列なしのデバイスでGETすると items:[] の有効なレスポンスが返る
   */
  it('B-EC-01: 0件プレイリストでitems:[]の有効なレスポンスが返る', async () => {
    const { db } = await import('@/lib/db');
    const mockDb = db as { execute: ReturnType<typeof vi.fn> };

    const dbRows = buildDbRows('device_kyokomachi_01', []);
    mockDb.execute
      .mockResolvedValueOnce(dbRows.playlist)
      .mockResolvedValueOnce(dbRows.items);

    const request = new Request('http://localhost/api/playlist?device_id=device_kyokomachi_01');
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveProperty('items');
    expect(body.items).toEqual([]);
    // その他のフィールドも有効であること
    expect(body).toHaveProperty('version');
    expect(body).toHaveProperty('globalSettings');
  });

  /**
   * B-EC-02: 100アイテムのプレイリストが全100件含まれる正常なレスポンスが返る
   */
  it('B-EC-02: 100件プレイリストで全100件が返る', async () => {
    const { db } = await import('@/lib/db');
    const mockDb = db as { execute: ReturnType<typeof vi.fn> };

    const items = Array.from({ length: 100 }, (_, i) => ({
      id: `img_${String(i + 1).padStart(3, '0')}`,
      r2_url: `https://cdn.non-turn.com/img_${i + 1}.jpg`,
      hash: `hash_${i + 1}`,
      file_type: 'image',
      duration_override_ms: null,
      position: i + 1,
    }));
    const dbRows = buildDbRows('device_kyokomachi_01', items);
    mockDb.execute
      .mockResolvedValueOnce(dbRows.playlist)
      .mockResolvedValueOnce(dbRows.items);

    const request = new Request('http://localhost/api/playlist?device_id=device_kyokomachi_01');
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.items).toHaveLength(100);
  });
});
