/**
 * CORS 対応テスト（Red フェーズ）
 *
 * 対象:
 * - next.config.js の headers() が正しいCORSヘッダーを返すこと
 * - OPTIONS ハンドラーが 204 + CORSヘッダーを返すこと
 */

import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// next.config.js の headers() 設定テスト
// ---------------------------------------------------------------------------

describe('next.config.js CORS headers 設定', () => {
  it('headers() が Access-Control-Allow-Origin: * を含むこと', async () => {
    // next.config.js は CommonJS モジュールなので require で読み込む
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nextConfig = require('../../../next.config.js');

    expect(nextConfig.headers).toBeDefined();

    const headerEntries: Array<{ source: string; headers: Array<{ key: string; value: string }> }> =
      await nextConfig.headers();

    const allHeaders = headerEntries.flatMap((entry) => entry.headers);
    const allowOrigin = allHeaders.find((h) => h.key === 'Access-Control-Allow-Origin');

    expect(allowOrigin).toBeDefined();
    expect(allowOrigin?.value).toBe('*');
  });

  it('headers() が Access-Control-Allow-Methods を含むこと', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nextConfig = require('../../../next.config.js');

    const headerEntries: Array<{ source: string; headers: Array<{ key: string; value: string }> }> =
      await nextConfig.headers();

    const allHeaders = headerEntries.flatMap((entry) => entry.headers);
    const allowMethods = allHeaders.find((h) => h.key === 'Access-Control-Allow-Methods');

    expect(allowMethods).toBeDefined();
    expect(allowMethods?.value).toContain('GET');
    expect(allowMethods?.value).toContain('POST');
    expect(allowMethods?.value).toContain('OPTIONS');
  });

  it('headers() が Access-Control-Allow-Headers を含むこと', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nextConfig = require('../../../next.config.js');

    const headerEntries: Array<{ source: string; headers: Array<{ key: string; value: string }> }> =
      await nextConfig.headers();

    const allHeaders = headerEntries.flatMap((entry) => entry.headers);
    const allowHeaders = allHeaders.find((h) => h.key === 'Access-Control-Allow-Headers');

    expect(allowHeaders).toBeDefined();
    expect(allowHeaders?.value).toContain('Content-Type');
    expect(allowHeaders?.value).toContain('Authorization');
  });
});

// ---------------------------------------------------------------------------
// OPTIONS ハンドラーテスト
// ---------------------------------------------------------------------------

describe('OPTIONS /api/cors ハンドラー', () => {
  it('OPTIONS リクエストに 204 を返すこと', async () => {
    const { OPTIONS } = await import('@/app/api/cors/route');

    const request = new Request('http://localhost/api/cors', { method: 'OPTIONS' });
    const response = await OPTIONS(request);

    expect(response.status).toBe(204);
  });

  it('OPTIONS レスポンスに Access-Control-Allow-Origin ヘッダーが付くこと', async () => {
    const { OPTIONS } = await import('@/app/api/cors/route');

    const request = new Request('http://localhost/api/cors', { method: 'OPTIONS' });
    const response = await OPTIONS(request);

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('OPTIONS レスポンスに Access-Control-Allow-Methods ヘッダーが付くこと', async () => {
    const { OPTIONS } = await import('@/app/api/cors/route');

    const request = new Request('http://localhost/api/cors', { method: 'OPTIONS' });
    const response = await OPTIONS(request);

    const methods = response.headers.get('Access-Control-Allow-Methods') ?? '';
    expect(methods).toContain('GET');
    expect(methods).toContain('POST');
    expect(methods).toContain('OPTIONS');
  });
});
