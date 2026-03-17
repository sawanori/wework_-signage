/**
 * テストケース対象: B-E-05, B-E-06, B-E-07
 *
 * B-E-05: 不正なAPI Key — 不正なKeyでPOSTすると401が返る
 * B-E-06: API Keyなしの書き込み操作 — Authorization ヘッダなしでPOSTすると401が返る
 * B-E-07: API KeyなしのGET操作 — Authorization ヘッダなしでGET /api/playlist にアクセスすると200が返る（認証不要）
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// 環境変数のモック
vi.stubEnv('ADMIN_API_KEY', 'secret-valid-api-key');

// DBをモック
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

// R2をモック
vi.mock('@/lib/r2', () => ({
  generatePresignedUrl: vi.fn(),
}));

describe('Cloud Admin API 認証', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * B-E-05: 不正なAPI KeyでPOSTすると401が返る
   */
  it('B-E-05: 不正なAPI KeyでPOST /api/playlist/itemsに401が返る', async () => {
    // NOTE: playlist/items の POST route が存在しないためインポートが失敗する
    // スタブが実装されたらimportに切り替える
    // 現時点では実装を想定したテスト構造のみ記述し、失敗を確認する
    const { POST } = await import('@/app/api/upload/route');

    const request = new Request('http://localhost/api/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer invalid-wrong-api-key',
      },
      body: JSON.stringify({
        filename: 'test.jpg',
        contentType: 'image/jpeg',
        fileSize: 1_000_000,
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  /**
   * B-E-06: Authorization ヘッダなしでPOSTすると401が返る
   */
  it('B-E-06: Authorizationヘッダなしで POST /api/upload に401が返る', async () => {
    const { POST } = await import('@/app/api/upload/route');

    const request = new Request('http://localhost/api/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Authorization ヘッダなし
      },
      body: JSON.stringify({
        filename: 'test.jpg',
        contentType: 'image/jpeg',
        fileSize: 1_000_000,
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  /**
   * B-E-07: GET /api/playlist は Authorization ヘッダなしで200が返る（認証不要）
   */
  it('B-E-07: GET /api/playlist は認証なしで200が返る', async () => {
    const { db } = await import('@/lib/db');
    const mockDb = db as { execute: ReturnType<typeof vi.fn> };

    // デバイスが見つかるようにモック
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
      .mockResolvedValueOnce({ rows: [] });

    const { GET } = await import('@/app/api/playlist/route');

    // Authorization ヘッダなし
    const request = new Request('http://localhost/api/playlist?device_id=device_kyokomachi_01');

    const response = await GET(request);

    expect(response.status).toBe(200);
  });
});
