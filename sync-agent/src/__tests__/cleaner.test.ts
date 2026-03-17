/**
 * テストケース対象: C-N-05, C-EC-01
 *
 * C-N-05: 不要ファイルクリーンアップ — プレイリストから除外されたファイルが削除される
 * C-EC-01: 0件プレイリスト — items:[]で全ファイルが削除される
 *
 * 追加テスト:
 * - プレイリストに含まれるファイルは削除されない
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { PlaylistItem } from '@non-turn/shared';

// cleanerモジュールのインポート（スタブのまま）
const cleanerModule = await import('../cleaner.js');

// テスト用一時ディレクトリ
let testDir: string;
let imagesDirPath: string;

beforeEach(() => {
  testDir = mkdtempSync(join(tmpdir(), 'cleaner-test-'));
  imagesDirPath = join(testDir, 'images');
  mkdirSync(imagesDirPath, { recursive: true });
});

afterEach(() => {
  try {
    const { rmSync } = require('fs');
    rmSync(testDir, { recursive: true, force: true });
  } catch { /* ignore */ }
});

// テスト用プレイリストアイテム生成ヘルパー
function createPlaylistItem(id: string, ext: string): PlaylistItem {
  return {
    id,
    url: `/data/images/${id}.${ext}`,
    hash: `hash_${id}`,
    type: 'image',
    durationOverrideMs: null,
    position: 1,
  };
}

describe('cleaner.ts', () => {
  /**
   * C-N-05: プレイリストから除外されたファイルが削除される
   */
  it('C-N-05: プレイリストに含まれないファイルがimages/から削除される', async () => {
    // images/にファイルを作成（img_001はプレイリストに残る、img_002は削除対象）
    const img001Path = join(imagesDirPath, 'img_001.jpg');
    const img002Path = join(imagesDirPath, 'img_002.jpg');
    writeFileSync(img001Path, Buffer.from('image 001'));
    writeFileSync(img002Path, Buffer.from('image 002 - to be deleted'));

    expect(existsSync(img001Path)).toBe(true);
    expect(existsSync(img002Path)).toBe(true);

    // 現在のプレイリスト: img_001のみ（img_002は削除された）
    const currentItems: PlaylistItem[] = [
      createPlaylistItem('img_001', 'jpg'),
    ];

    const cleanupOldFiles = (cleanerModule as {
      cleanupOldFiles?: (imagesDir: string, currentItems: PlaylistItem[]) => void
    }).cleanupOldFiles;
    expect(cleanupOldFiles).toBeDefined();

    cleanupOldFiles!(imagesDirPath, currentItems);

    // img_001は残っていること
    expect(existsSync(img001Path)).toBe(true);
    // img_002は削除されていること
    expect(existsSync(img002Path)).toBe(false);
  });

  /**
   * C-EC-01: items:[] で全ファイルが削除される
   */
  it('C-EC-01: 0件プレイリスト（items:[]）でimages/内の全ファイルが削除される', async () => {
    // images/に複数ファイルを作成
    const files = ['img_001.jpg', 'img_002.jpg', 'img_003.jpg', 'pdf_001.pdf'];
    const filePaths = files.map(f => join(imagesDirPath, f));
    filePaths.forEach(fp => writeFileSync(fp, Buffer.from('test data')));

    // すべてのファイルが存在することを確認
    filePaths.forEach(fp => expect(existsSync(fp)).toBe(true));

    // 0件プレイリスト
    const currentItems: PlaylistItem[] = [];

    const cleanupOldFiles = (cleanerModule as {
      cleanupOldFiles?: (imagesDir: string, currentItems: PlaylistItem[]) => void
    }).cleanupOldFiles;
    expect(cleanupOldFiles).toBeDefined();

    cleanupOldFiles!(imagesDirPath, currentItems);

    // 全ファイルが削除されていること
    filePaths.forEach(fp => expect(existsSync(fp)).toBe(false));
  });

  /**
   * プレイリストに含まれるファイルは削除されない
   */
  it('プレイリストに含まれるファイルは削除されない', async () => {
    const img001Path = join(imagesDirPath, 'img_001.jpg');
    const img002Path = join(imagesDirPath, 'img_002.jpg');
    const img003Path = join(imagesDirPath, 'img_003.jpg');

    writeFileSync(img001Path, Buffer.from('image 001'));
    writeFileSync(img002Path, Buffer.from('image 002'));
    writeFileSync(img003Path, Buffer.from('image 003'));

    // 全アイテムがプレイリストに含まれる
    const currentItems: PlaylistItem[] = [
      createPlaylistItem('img_001', 'jpg'),
      createPlaylistItem('img_002', 'jpg'),
      createPlaylistItem('img_003', 'jpg'),
    ];

    const cleanupOldFiles = (cleanerModule as {
      cleanupOldFiles?: (imagesDir: string, currentItems: PlaylistItem[]) => void
    }).cleanupOldFiles;
    expect(cleanupOldFiles).toBeDefined();

    cleanupOldFiles!(imagesDirPath, currentItems);

    // すべてのファイルが残っていること
    expect(existsSync(img001Path)).toBe(true);
    expect(existsSync(img002Path)).toBe(true);
    expect(existsSync(img003Path)).toBe(true);
  });

  /**
   * PDFファイルも正しくクリーンアップ対象になる
   */
  it('プレイリストから削除されたPDFファイルも削除される', async () => {
    const pdfPath = join(imagesDirPath, 'pdf_001.pdf');
    writeFileSync(pdfPath, Buffer.from('fake pdf data'));

    // 0件プレイリスト（PDFは削除対象）
    const currentItems: PlaylistItem[] = [];

    const cleanupOldFiles = (cleanerModule as {
      cleanupOldFiles?: (imagesDir: string, currentItems: PlaylistItem[]) => void
    }).cleanupOldFiles;
    expect(cleanupOldFiles).toBeDefined();

    cleanupOldFiles!(imagesDirPath, currentItems);

    expect(existsSync(pdfPath)).toBe(false);
  });

  /**
   * images/ディレクトリが空の場合はエラーを投げない
   */
  it('images/ディレクトリが空の場合はエラーを投げない', () => {
    const currentItems: PlaylistItem[] = [];

    const cleanupOldFiles = (cleanerModule as {
      cleanupOldFiles?: (imagesDir: string, currentItems: PlaylistItem[]) => void
    }).cleanupOldFiles;
    expect(cleanupOldFiles).toBeDefined();

    expect(() => cleanupOldFiles!(imagesDirPath, currentItems)).not.toThrow();
  });
});
