/**
 * テストケース対象: 複数プレイリスト機能 (MP-N-*, MP-E-*, MP-EC-*)
 *
 * MP-N-01: GET /api/playlists — PlaylistListResponse型が200で返る
 * MP-N-04: POST /api/playlists — 新規作成で201が返り、playlistIdが含まれる
 * MP-N-05: PUT /api/playlists/[id]/activate — アクティブ切替で200が返る
 * MP-N-06: PUT /api/playlists/[id] — 名前変更で200が返る
 * MP-N-07: DELETE /api/playlists/[id] — 非アクティブ削除で200が返る
 * MP-E-01: POST 3件上限超過 — 422とPLAYLIST_LIMIT_EXCEEDEDが返る
 * MP-E-02: DELETE アクティブ削除試行 — 409とCANNOT_DELETE_ACTIVEが返る
 * MP-E-03: PUT activate 存在しないID — 404が返る
 * MP-E-05: POST 認証なし — 401が返る
 * MP-E-06: POST 名前が空文字 — 400が返る
 * MP-E-07: POST 名前が51文字以上 — 400が返る
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Tursoクライアントをモック
vi.mock('@/lib/db', () => ({
  db: {
    execute: vi.fn(),
    batch: vi.fn(),
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

// バージョンをモック
vi.mock('@/lib/version', () => ({
  generateVersion: vi.fn(() => 'v_1710678000'),
}));

const { GET: playlistsGET, POST: playlistsPOST } = await import('@/app/api/playlists/route');
const { PUT: activatePUT } = await import('@/app/api/playlists/[id]/activate/route');
const { PUT: playlistPUT, DELETE: playlistDELETE } = await import('@/app/api/playlists/[id]/route');

const DEVICE_ID = 'device_kyokomachi_01';
const STORE_ID = 'store_kyokomachi';

describe('GET /api/playlists', () => {
  beforeEach(() => vi.clearAllMocks());

  it('MP-N-01: device_idでPlaylistListResponse型のJSONを200で返す', async () => {
    const { db } = await import('@/lib/db');
    const mockDb = db as { execute: ReturnType<typeof vi.fn> };

    mockDb.execute.mockResolvedValueOnce({
      rows: [
        [1, '通常', 1, 'v_1710678000', 1710678000, 5, STORE_ID],
        [2, '春メニュー', 0, 'v_1710670000', 1710670000, 3, STORE_ID],
      ],
    });

    const req = new Request(`http://localhost/api/playlists?device_id=${DEVICE_ID}`);
    const res = await playlistsGET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveProperty('deviceId', DEVICE_ID);
    expect(body).toHaveProperty('storeId', STORE_ID);
    expect(body.playlists).toHaveLength(2);
    expect(body.playlists[0]).toHaveProperty('id', 1);
    expect(body.playlists[0]).toHaveProperty('name', '通常');
    expect(body.playlists[0]).toHaveProperty('isActive', true);
    expect(body.playlists[0]).toHaveProperty('itemCount', 5);
    expect(body.playlists[1]).toHaveProperty('isActive', false);
  });

  it('device_idなしで400が返る', async () => {
    const req = new Request('http://localhost/api/playlists');
    const res = await playlistsGET(req);
    expect(res.status).toBe(400);
  });

  it('デバイスが見つからない場合に404が返る', async () => {
    const { db } = await import('@/lib/db');
    const mockDb = db as { execute: ReturnType<typeof vi.fn> };
    mockDb.execute.mockResolvedValueOnce({ rows: [] });

    const req = new Request(`http://localhost/api/playlists?device_id=unknown`);
    const res = await playlistsGET(req);
    expect(res.status).toBe(404);
  });
});

describe('POST /api/playlists', () => {
  beforeEach(() => vi.clearAllMocks());

  it('MP-N-04: 新規プレイリスト作成で201とplaylistIdが返る', async () => {
    const { db } = await import('@/lib/db');
    const mockDb = db as { execute: ReturnType<typeof vi.fn> };

    // Count check: 1件存在 → 上限未達
    mockDb.execute.mockResolvedValueOnce({
      rows: [[1, STORE_ID]],
    });
    // INSERT RETURNING id
    mockDb.execute.mockResolvedValueOnce({
      rows: [[2]],
    });

    const req = new Request('http://localhost/api/playlists', {
      method: 'POST',
      body: JSON.stringify({ deviceId: DEVICE_ID, name: '春メニュー' }),
    });
    const res = await playlistsPOST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body).toHaveProperty('playlistId', 2);
    expect(body).toHaveProperty('name', '春メニュー');
    expect(body).toHaveProperty('isActive', false);
  });

  it('MP-E-01: 3件上限超過で422とPLAYLIST_LIMIT_EXCEEDEDが返る', async () => {
    const { db } = await import('@/lib/db');
    const mockDb = db as { execute: ReturnType<typeof vi.fn> };

    // Count check: 3件存在 → 上限超過
    mockDb.execute.mockResolvedValueOnce({
      rows: [[3, STORE_ID]],
    });

    const req = new Request('http://localhost/api/playlists', {
      method: 'POST',
      body: JSON.stringify({ deviceId: DEVICE_ID, name: '夏メニュー' }),
    });
    const res = await playlistsPOST(req);
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body).toHaveProperty('code', 'PLAYLIST_LIMIT_EXCEEDED');
  });

  it('MP-E-05: 認証なしで401が返る', async () => {
    process.env.ADMIN_API_KEY = 'valid-key';
    const req = new Request('http://localhost/api/playlists', {
      method: 'POST',
      headers: { Authorization: 'Bearer wrong-key' },
      body: JSON.stringify({ deviceId: DEVICE_ID, name: '春メニュー' }),
    });
    const res = await playlistsPOST(req);
    expect(res.status).toBe(401);
    delete process.env.ADMIN_API_KEY;
  });

  it('MP-E-06: 名前が空文字で400が返る', async () => {
    const req = new Request('http://localhost/api/playlists', {
      method: 'POST',
      body: JSON.stringify({ deviceId: DEVICE_ID, name: '' }),
    });
    const res = await playlistsPOST(req);
    expect(res.status).toBe(400);
  });

  it('MP-E-07: 名前が51文字以上で400が返る', async () => {
    const req = new Request('http://localhost/api/playlists', {
      method: 'POST',
      body: JSON.stringify({ deviceId: DEVICE_ID, name: 'a'.repeat(51) }),
    });
    const res = await playlistsPOST(req);
    expect(res.status).toBe(400);
  });

  it('空白のみの名前で400が返る', async () => {
    const req = new Request('http://localhost/api/playlists', {
      method: 'POST',
      body: JSON.stringify({ deviceId: DEVICE_ID, name: '   ' }),
    });
    const res = await playlistsPOST(req);
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/playlists/[id]/activate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('MP-N-05: アクティブ切替で200とisActive:trueが返る', async () => {
    const { db } = await import('@/lib/db');
    const mockDb = db as { execute: ReturnType<typeof vi.fn>; batch: ReturnType<typeof vi.fn> };

    mockDb.execute.mockResolvedValueOnce({
      rows: [[2, '春メニュー', 0]],
    });
    mockDb.batch.mockResolvedValueOnce([{ rowsAffected: 1 }, { rowsAffected: 1 }]);

    const req = new Request('http://localhost/api/playlists/2/activate', {
      method: 'PUT',
      body: JSON.stringify({ deviceId: DEVICE_ID }),
    });
    const res = await activatePUT(req, { params: { id: '2' } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveProperty('playlistId', 2);
    expect(body).toHaveProperty('isActive', true);
    expect(body).toHaveProperty('name', '春メニュー');
  });

  it('MP-E-03: 存在しないIDで404が返る', async () => {
    const { db } = await import('@/lib/db');
    const mockDb = db as { execute: ReturnType<typeof vi.fn> };

    mockDb.execute.mockResolvedValueOnce({ rows: [] });

    const req = new Request('http://localhost/api/playlists/999/activate', {
      method: 'PUT',
      body: JSON.stringify({ deviceId: DEVICE_ID }),
    });
    const res = await activatePUT(req, { params: { id: '999' } });
    expect(res.status).toBe(404);
  });

  it('deviceIdなしで400が返る', async () => {
    const req = new Request('http://localhost/api/playlists/2/activate', {
      method: 'PUT',
      body: JSON.stringify({}),
    });
    const res = await activatePUT(req, { params: { id: '2' } });
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/playlists/[id]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('MP-N-06: 名前変更で200が返る', async () => {
    const { db } = await import('@/lib/db');
    const mockDb = db as { execute: ReturnType<typeof vi.fn> };

    mockDb.execute.mockResolvedValueOnce({ rows: [[2]] });

    const req = new Request('http://localhost/api/playlists/2', {
      method: 'PUT',
      body: JSON.stringify({ name: '夏メニュー' }),
    });
    const res = await playlistPUT(req, { params: { id: '2' } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveProperty('playlistId', 2);
    expect(body).toHaveProperty('name', '夏メニュー');
  });

  it('存在しないIDで404が返る', async () => {
    const { db } = await import('@/lib/db');
    const mockDb = db as { execute: ReturnType<typeof vi.fn> };

    mockDb.execute.mockResolvedValueOnce({ rows: [] });

    const req = new Request('http://localhost/api/playlists/999', {
      method: 'PUT',
      body: JSON.stringify({ name: '夏メニュー' }),
    });
    const res = await playlistPUT(req, { params: { id: '999' } });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/playlists/[id]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('MP-N-07: 非アクティブプレイリスト削除で200が返る', async () => {
    const { db } = await import('@/lib/db');
    const mockDb = db as { execute: ReturnType<typeof vi.fn>; batch: ReturnType<typeof vi.fn> };

    mockDb.execute.mockResolvedValueOnce({ rows: [[0]] }); // is_active = 0
    mockDb.batch.mockResolvedValueOnce([{ rowsAffected: 2 }, { rowsAffected: 1 }]);

    const req = new Request(`http://localhost/api/playlists/2?device_id=${DEVICE_ID}`, {
      method: 'DELETE',
    });
    const res = await playlistDELETE(req, { params: { id: '2' } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveProperty('success', true);
  });

  it('MP-E-02: アクティブプレイリスト削除試行で409とCANNOT_DELETE_ACTIVEが返る', async () => {
    const { db } = await import('@/lib/db');
    const mockDb = db as { execute: ReturnType<typeof vi.fn> };

    mockDb.execute.mockResolvedValueOnce({ rows: [[1]] }); // is_active = 1

    const req = new Request(`http://localhost/api/playlists/1?device_id=${DEVICE_ID}`, {
      method: 'DELETE',
    });
    const res = await playlistDELETE(req, { params: { id: '1' } });
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body).toHaveProperty('code', 'CANNOT_DELETE_ACTIVE');
  });

  it('device_idなしで400が返る', async () => {
    const req = new Request('http://localhost/api/playlists/2', {
      method: 'DELETE',
    });
    const res = await playlistDELETE(req, { params: { id: '2' } });
    expect(res.status).toBe(400);
  });
});
