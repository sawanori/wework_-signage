/**
 * テストケース:
 * - 画像URLが正常にプリロードされることを検証（Imageオブジェクトのモック）
 * - 存在しない画像URLでエラーが発生することを検証
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { preloadImage } from '../lib/imagePreloader';

describe('imagePreloader', () => {
  let mockImageInstances: Array<{
    src: string;
    onload: (() => void) | null;
    onerror: ((err: ErrorEvent) => void) | null;
  }>;

  beforeEach(() => {
    mockImageInstances = [];

    // Image コンストラクタのモック
    vi.stubGlobal('Image', class MockImage {
      src = '';
      onload: (() => void) | null = null;
      onerror: ((err: ErrorEvent) => void) | null = null;

      constructor() {
        const self = this;
        mockImageInstances.push(self as unknown as typeof mockImageInstances[0]);
      }

      set srcProp(value: string) {
        this.src = value;
      }
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('正常系: 画像URLのプリロード', () => {
    it('有効なURLで preloadImage を呼ぶと Promise が resolve する', async () => {
      const url = '/data/images/img_001.jpg';
      const promise = preloadImage(url);

      // Image インスタンスが生成されている
      expect(mockImageInstances).toHaveLength(1);

      // src に URL が設定されている
      const imgInstance = mockImageInstances[0];
      expect(imgInstance.src).toBe(url);

      // onload を呼んで resolve させる
      imgInstance.onload?.();

      await expect(promise).resolves.toBeUndefined();
    });

    it('プリロード時に Image の src に正しいURLが設定される', async () => {
      const url = 'http://localhost/data/images/photo.jpg';
      const promise = preloadImage(url);

      const imgInstance = mockImageInstances[0];
      expect(imgInstance.src).toBe(url);

      imgInstance.onload?.();
      await expect(promise).resolves.toBeUndefined();
    });

    it('複数の画像URLを並行してプリロードできる', async () => {
      const urls = [
        '/data/images/img_001.jpg',
        '/data/images/img_002.jpg',
        '/data/images/img_003.jpg',
      ];

      const promises = urls.map((url) => preloadImage(url));

      expect(mockImageInstances).toHaveLength(3);

      // 全てのonloadを発火
      mockImageInstances.forEach((inst) => inst.onload?.());

      await expect(Promise.all(promises)).resolves.toBeDefined();
    });
  });

  describe('異常系: 存在しない画像URL', () => {
    it('存在しないURLで preloadImage を呼ぶと Promise が reject する', async () => {
      const url = '/data/images/not_found.jpg';
      const promise = preloadImage(url);

      const imgInstance = mockImageInstances[0];
      expect(imgInstance.src).toBe(url);

      // onerror を呼んで reject させる
      imgInstance.onerror?.(new ErrorEvent('error', { message: 'Image load failed' }));

      await expect(promise).rejects.toThrow();
    });

    it('画像ロード失敗時にエラーオブジェクトが reject される', async () => {
      const url = '/data/images/broken.jpg';
      const promise = preloadImage(url);

      const imgInstance = mockImageInstances[0];
      imgInstance.onerror?.(new ErrorEvent('error', { message: 'Network error' }));

      await expect(promise).rejects.toBeDefined();
    });

    it('一部の画像が失敗しても他の画像のプリロードには影響しない', async () => {
      const successUrl = '/data/images/ok.jpg';
      const failUrl = '/data/images/fail.jpg';

      const successPromise = preloadImage(successUrl);
      const failPromise = preloadImage(failUrl);

      const [successInst, failInst] = mockImageInstances;

      // 成功
      successInst.onload?.();
      // 失敗
      failInst.onerror?.(new ErrorEvent('error'));

      await expect(successPromise).resolves.toBeUndefined();
      await expect(failPromise).rejects.toBeDefined();
    });
  });
});
