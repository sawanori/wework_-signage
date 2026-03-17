/**
 * テストケース対象: C-N-04(部分), C-E-03
 *
 * C-N-04: アトミック完了確認 — ハッシュ検証が正しいSHA-256で true を返す
 * C-E-03: ハッシュ値不一致 — 不正なハッシュで false を返す
 *
 * 追加テスト:
 * - 空ファイルのハッシュが正しく計算される
 */

import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';

// hashVerifierモジュールのインポート（スタブのまま）
const hashVerifierModule = await import('../hashVerifier.js');

describe('hashVerifier.ts', () => {
  /**
   * C-N-04: 正しいSHA-256ハッシュで true を返す
   */
  it('C-N-04: 正しいSHA-256ハッシュでtrueを返す', async () => {
    // テスト用コンテンツとその正しいSHA-256ハッシュ
    const content = Buffer.from('Hello, Non-Turn Signage!');
    const expectedHash = createHash('sha256').update(content).digest('hex');

    const verifyHash = (hashVerifierModule as {
      verifyHash?: (filePath: string, expectedHash: string) => Promise<boolean>
    }).verifyHash;
    expect(verifyHash).toBeDefined();

    // 実際のファイルの代わりにtmpファイルを使う
    const { writeFileSync, unlinkSync, mkdtempSync } = await import('fs');
    const { join } = await import('path');
    const { tmpdir } = await import('os');

    const tmpDir = mkdtempSync(join(tmpdir(), 'hash-test-'));
    const tmpFile = join(tmpDir, 'test-file.bin');

    try {
      writeFileSync(tmpFile, content);

      const result = await verifyHash!(tmpFile, expectedHash);
      expect(result).toBe(true);
    } finally {
      try { unlinkSync(tmpFile); } catch { /* ignore */ }
      try {
        const { rmdirSync } = await import('fs');
        rmdirSync(tmpDir);
      } catch { /* ignore */ }
    }
  });

  /**
   * C-E-03: 不正なハッシュで false を返す
   */
  it('C-E-03: 不正なハッシュでfalseを返す', async () => {
    const content = Buffer.from('Hello, Non-Turn Signage!');
    const wrongHash = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

    const verifyHash = (hashVerifierModule as {
      verifyHash?: (filePath: string, expectedHash: string) => Promise<boolean>
    }).verifyHash;
    expect(verifyHash).toBeDefined();

    const { writeFileSync, unlinkSync, mkdtempSync } = await import('fs');
    const { join } = await import('path');
    const { tmpdir } = await import('os');

    const tmpDir = mkdtempSync(join(tmpdir(), 'hash-test-'));
    const tmpFile = join(tmpDir, 'test-file.bin');

    try {
      writeFileSync(tmpFile, content);

      const result = await verifyHash!(tmpFile, wrongHash);
      expect(result).toBe(false);
    } finally {
      try { unlinkSync(tmpFile); } catch { /* ignore */ }
      try {
        const { rmdirSync } = await import('fs');
        rmdirSync(tmpDir);
      } catch { /* ignore */ }
    }
  });

  /**
   * 空ファイルのハッシュが正しく計算される
   */
  it('空ファイルのSHA-256ハッシュが正しく計算される', async () => {
    // SHA-256 of empty input: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
    const emptyHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

    const verifyHash = (hashVerifierModule as {
      verifyHash?: (filePath: string, expectedHash: string) => Promise<boolean>
    }).verifyHash;
    expect(verifyHash).toBeDefined();

    const { writeFileSync, unlinkSync, mkdtempSync } = await import('fs');
    const { join } = await import('path');
    const { tmpdir } = await import('os');

    const tmpDir = mkdtempSync(join(tmpdir(), 'hash-test-'));
    const tmpFile = join(tmpDir, 'empty-file.bin');

    try {
      writeFileSync(tmpFile, Buffer.alloc(0)); // 空ファイル

      const result = await verifyHash!(tmpFile, emptyHash);
      expect(result).toBe(true);
    } finally {
      try { unlinkSync(tmpFile); } catch { /* ignore */ }
      try {
        const { rmdirSync } = await import('fs');
        rmdirSync(tmpDir);
      } catch { /* ignore */ }
    }
  });

  /**
   * ハッシュ比較はlowercase hexで行われる
   */
  it('ハッシュ比較はlowercase hexで行われる（大文字を渡してもfalseにならない場合も許容）', async () => {
    const content = Buffer.from('test content');
    const correctHash = createHash('sha256').update(content).digest('hex');

    const verifyHash = (hashVerifierModule as {
      verifyHash?: (filePath: string, expectedHash: string) => Promise<boolean>
    }).verifyHash;
    expect(verifyHash).toBeDefined();

    const { writeFileSync, unlinkSync, mkdtempSync } = await import('fs');
    const { join } = await import('path');
    const { tmpdir } = await import('os');

    const tmpDir = mkdtempSync(join(tmpdir(), 'hash-test-'));
    const tmpFile = join(tmpDir, 'test-file.bin');

    try {
      writeFileSync(tmpFile, content);

      // lowercase hexで正しく一致すること
      const result = await verifyHash!(tmpFile, correctHash);
      expect(result).toBe(true);

      // 正しいハッシュはlowercaseであること
      expect(correctHash).toBe(correctHash.toLowerCase());
    } finally {
      try { unlinkSync(tmpFile); } catch { /* ignore */ }
      try {
        const { rmdirSync } = await import('fs');
        rmdirSync(tmpDir);
      } catch { /* ignore */ }
    }
  });
});
