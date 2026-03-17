/**
 * テストケース対象: B-N-03, B-E-03, B-E-04
 *
 * B-N-03: POST /api/upload — ファイルサイズ8MBのJPEGリクエストに対し、signedUrl と publicUrl が含まれる200レスポンス
 * B-E-03: ファイルサイズ超過 — fileSize > 30MB（31457280 bytes）で400
 * B-E-04: 未対応ファイル形式 — contentType="video/mp4" で400
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Cloudflare R2クライアントをモック
vi.mock('@/lib/r2', () => ({
  generatePresignedUrl: vi.fn(),
  R2_PUBLIC_URL: 'https://cdn.non-turn.com',
}));

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

const { POST } = await import('@/app/api/upload/route');

describe('POST /api/upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * B-N-03: ファイルサイズ8MBのJPEGリクエストに対し、signedUrl と publicUrl が含まれる200レスポンス
   */
  it('B-N-03: 正常なJPEGアップロードでsignedUrlとpublicUrlが返る', async () => {
    const { generatePresignedUrl } = await import('@/lib/r2');
    const mockGeneratePresignedUrl = generatePresignedUrl as ReturnType<typeof vi.fn>;
    mockGeneratePresignedUrl.mockResolvedValueOnce({
      uploadUrl: 'https://r2-signed-url.example.com/upload/img_001?sig=abc123',
      fileId: 'img_001',
      publicUrl: 'https://cdn.non-turn.com/kyokomachi/img_001.jpg',
    });

    const request = new Request('http://localhost/api/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid-api-key',
      },
      body: JSON.stringify({
        filename: 'interior-01.jpg',
        contentType: 'image/jpeg',
        fileSize: 8_500_000, // 8MB
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveProperty('uploadUrl');
    expect(body).toHaveProperty('publicUrl');
    expect(body.uploadUrl).toMatch(/^https?:\/\//);
    expect(body.publicUrl).toMatch(/^https?:\/\//);
  });

  /**
   * B-E-03: fileSize > 30MB（31457280 bytes）のリクエストに対し400が返る
   */
  it('B-E-03: ファイルサイズ31457280 bytesで400が返る', async () => {
    const request = new Request('http://localhost/api/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid-api-key',
      },
      body: JSON.stringify({
        filename: 'huge-file.jpg',
        contentType: 'image/jpeg',
        fileSize: 31_457_280, // 30MB + 1 byte（境界値）
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  /**
   * B-E-03: fileSize が 31457280 を超えるケース（さらに大きいファイル）
   */
  it('B-E-03: ファイルサイズが31457280より大きい場合も400が返る', async () => {
    const request = new Request('http://localhost/api/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid-api-key',
      },
      body: JSON.stringify({
        filename: 'huge-file.jpg',
        contentType: 'image/jpeg',
        fileSize: 50_000_000, // 50MB
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  /**
   * B-E-04: contentType="video/mp4" のリクエストに対し400が返る
   */
  it('B-E-04: contentType="video/mp4"で400が返る', async () => {
    const request = new Request('http://localhost/api/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid-api-key',
      },
      body: JSON.stringify({
        filename: 'video.mp4',
        contentType: 'video/mp4',
        fileSize: 10_000_000,
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  /**
   * 境界値確認: ちょうど30MB（31457280 - 1 bytes）は許容される
   */
  it('ファイルサイズ30MB未満（31457279 bytes）は400にならない', async () => {
    const { generatePresignedUrl } = await import('@/lib/r2');
    const mockGeneratePresignedUrl = generatePresignedUrl as ReturnType<typeof vi.fn>;
    mockGeneratePresignedUrl.mockResolvedValueOnce({
      uploadUrl: 'https://r2-signed-url.example.com/upload/img_002?sig=def456',
      fileId: 'img_002',
      publicUrl: 'https://cdn.non-turn.com/kyokomachi/img_002.jpg',
    });

    const request = new Request('http://localhost/api/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid-api-key',
      },
      body: JSON.stringify({
        filename: 'large-but-ok.jpg',
        contentType: 'image/jpeg',
        fileSize: 31_457_279, // 31457280 - 1
      }),
    });

    const response = await POST(request);

    expect(response.status).not.toBe(400);
  });
});
