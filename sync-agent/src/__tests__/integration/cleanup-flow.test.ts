/**
 * 結合テスト: Sync Agent クリーンアップ統合テスト
 * 検証内容: 2回の同期サイクルで不要なファイルが削除されることを確認
 *
 * テスト内容:
 * 1. 初回同期: items=[img_001, img_002] → images/に2ファイル作成
 * 2. 2回目同期: items=[img_001]（img_002削除）→ img_002がimages/から削除される
 * 3. playlist.jsonがアトミックに更新されている
 * 4. tmpディレクトリに残骸ファイルがない
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, rmSync, readdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { createHash } from 'crypto';
import type { PlaylistResponse } from '@non-turn/shared';

// fetchをグローバルモック
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// テスト用画像データ
const IMAGE_DATA_001 = Buffer.from('fake-image-content-for-img001');
const IMAGE_DATA_002 = Buffer.from('fake-image-content-for-img002');

const HASH_001 = createHash('sha256').update(IMAGE_DATA_001).digest('hex');
const HASH_002 = createHash('sha256').update(IMAGE_DATA_002).digest('hex');

function createReadableStreamFromBuffer(buffer: Buffer): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(buffer));
      controller.close();
    },
  });
}

// 2アイテムのプレイリスト（初回）
const PLAYLIST_V1: PlaylistResponse = {
  version: 'v_1710678000',
  orientation: 'portrait',
  deviceId: 'device_kyokomachi_01',
  storeId: 'store_kyokomachi',
  globalSettings: { fadeDurationMs: 2000, intervalMs: 10000 },
  items: [
    {
      id: 'img_001',
      url: 'https://cdn.non-turn.com/kyokomachi/interior-01.jpg',
      hash: HASH_001,
      type: 'image',
      durationOverrideMs: null,
      position: 1,
    },
    {
      id: 'img_002',
      url: 'https://cdn.non-turn.com/kyokomachi/interior-02.jpg',
      hash: HASH_002,
      type: 'image',
      durationOverrideMs: null,
      position: 2,
    },
  ],
};

// 1アイテムのプレイリスト（2回目: img_002が削除）
const PLAYLIST_V2: PlaylistResponse = {
  version: 'v_1710679000',
  orientation: 'portrait',
  deviceId: 'device_kyokomachi_01',
  storeId: 'store_kyokomachi',
  globalSettings: { fadeDurationMs: 2000, intervalMs: 10000 },
  items: [
    {
      id: 'img_001',
      url: 'https://cdn.non-turn.com/kyokomachi/interior-01.jpg',
      hash: HASH_001,
      type: 'image',
      durationOverrideMs: null,
      position: 1,
    },
  ],
};

describe('Sync Agent クリーンアップ統合テスト', () => {
  let testDir: string;
  let imagesDir: string;
  let tmpDir: string;
  let playlistJsonPath: string;
  let playlistTmpPath: string;

  beforeEach(() => {
    vi.clearAllMocks();
    testDir = mkdtempSync(join(tmpdir(), 'cleanup-flow-integration-'));
    imagesDir = join(testDir, 'images');
    tmpDir = join(testDir, 'tmp');
    playlistJsonPath = join(testDir, 'playlist.json');
    playlistTmpPath = join(tmpDir, 'playlist.json.tmp');
    mkdirSync(imagesDir, { recursive: true });
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  /**
   * クリーンアップ統合テスト 1:
   * 初回同期で2ファイルが作成され、2回目同期でimg_002が削除される
   */
  it('INT-CL-01: 初回同期(img_001,img_002) → 2回目同期(img_001のみ) → img_002が削除される', async () => {
    const { fetchPlaylist, downloadFile } = await import('../../fetcher.js');
    const { verifyHash } = await import('../../hashVerifier.js');
    const { moveFile, writePlaylistJson } = await import('../../fileManager.js');
    const { cleanupOldFiles } = await import('../../cleaner.js');

    // ===== 初回同期: v_1710678000 (img_001, img_002) =====
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/playlist')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => PLAYLIST_V1,
        });
      }
      if (url.includes('interior-01.jpg')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          body: createReadableStreamFromBuffer(IMAGE_DATA_001),
        });
      }
      if (url.includes('interior-02.jpg')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          body: createReadableStreamFromBuffer(IMAGE_DATA_002),
        });
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });

    const playlist1 = await fetchPlaylist('https://admin.non-turn.com', 'device_kyokomachi_01');
    expect(playlist1).not.toBeNull();

    // 初回同期: 全アイテムをDL→ハッシュ検証→移動
    for (const item of playlist1!.items) {
      const ext = item.url.includes('.') ? item.url.split('.').pop() ?? '' : '';
      const filename = ext ? `${item.id}.${ext}` : item.id;
      const tmpFilePath = join(tmpDir, `${filename}.tmp`);
      const destFilePath = join(imagesDir, filename);

      await downloadFile(item.url, tmpFilePath);
      const valid = await verifyHash(tmpFilePath, item.hash);
      expect(valid).toBe(true);
      moveFile(tmpFilePath, destFilePath);
    }

    // playlist.jsonを書き込む（URLをローカルパスに変換）
    writePlaylistJson(playlist1!, playlistJsonPath, playlistTmpPath);

    // 初回同期後: 2ファイルが存在することを確認
    expect(existsSync(join(imagesDir, 'img_001.jpg'))).toBe(true);
    expect(existsSync(join(imagesDir, 'img_002.jpg'))).toBe(true);

    // クリーンアップ: 初回はitems=[img_001, img_002]なので削除なし
    // cleanupOldFilesはローカルパスのurlを使ってクリーンアップするため、
    // writePlaylistJsonで変換後のitemsを渡す
    const localPlaylist1 = JSON.parse(readFileSync(playlistJsonPath, 'utf-8')) as PlaylistResponse;
    cleanupOldFiles(imagesDir, localPlaylist1.items);

    // まだ2ファイルとも存在する
    expect(existsSync(join(imagesDir, 'img_001.jpg'))).toBe(true);
    expect(existsSync(join(imagesDir, 'img_002.jpg'))).toBe(true);

    // tmpに残骸がない
    expect(readdirSync(tmpDir)).toHaveLength(0);

    // ===== 2回目同期: v_1710679000 (img_001のみ) =====
    vi.clearAllMocks();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/playlist')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => PLAYLIST_V2,
        });
      }
      // img_001は既に有効なファイルが存在するためDLスキップ
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });

    const playlist2 = await fetchPlaylist('https://admin.non-turn.com', 'device_kyokomachi_01');
    expect(playlist2).not.toBeNull();
    expect(playlist2!.version).toBe('v_1710679000');
    expect(playlist2!.items).toHaveLength(1);

    // 2回目同期: img_001はすでにimagesに存在しハッシュ一致するのでスキップ
    for (const item of playlist2!.items) {
      const ext = item.url.includes('.') ? item.url.split('.').pop() ?? '' : '';
      const filename = ext ? `${item.id}.${ext}` : item.id;
      const destFilePath = join(imagesDir, filename);

      // 既存ファイルの検証
      if (existsSync(destFilePath)) {
        const alreadyValid = await verifyHash(destFilePath, item.hash);
        if (alreadyValid) {
          // スキップ（DL不要）
          continue;
        }
      }

      // DL必要な場合のみダウンロード
      const tmpFilePath = join(tmpDir, `${filename}.tmp`);
      await downloadFile(item.url, tmpFilePath);
      const valid = await verifyHash(tmpFilePath, item.hash);
      expect(valid).toBe(true);
      moveFile(tmpFilePath, destFilePath);
    }

    // playlist.jsonをアトミックに更新
    writePlaylistJson(playlist2!, playlistJsonPath, playlistTmpPath);

    // クリーンアップ: items=[img_001]のみ → img_002が削除される
    const localPlaylist2 = JSON.parse(readFileSync(playlistJsonPath, 'utf-8')) as PlaylistResponse;
    cleanupOldFiles(imagesDir, localPlaylist2.items);

    // 2回目同期後の検証
    // img_001 は存在する
    expect(existsSync(join(imagesDir, 'img_001.jpg'))).toBe(true);
    // img_002 は削除されている
    expect(existsSync(join(imagesDir, 'img_002.jpg'))).toBe(false);

    // playlist.jsonがアトミックに更新されていること
    const finalPlaylist = JSON.parse(readFileSync(playlistJsonPath, 'utf-8')) as PlaylistResponse;
    expect(finalPlaylist.version).toBe('v_1710679000');
    expect(finalPlaylist.items).toHaveLength(1);
    expect(finalPlaylist.items[0].id).toBe('img_001');
    // URLがローカルパスに変換されていること
    expect(finalPlaylist.items[0].url).toBe('/data/images/img_001.jpg');

    // tmpに残骸がない
    expect(readdirSync(tmpDir)).toHaveLength(0);
  });

  /**
   * クリーンアップ統合テスト 2:
   * imagesディレクトリに既存ファイルがある状態で、新しいプレイリストに含まれないファイルが削除される
   */
  it('INT-CL-02: imagesに余分なファイルがある場合にクリーンアップで削除される', async () => {
    const { writePlaylistJson } = await import('../../fileManager.js');
    const { cleanupOldFiles } = await import('../../cleaner.js');

    // imagesディレクトリに余分なファイルを事前作成
    writeFileSync(join(imagesDir, 'img_001.jpg'), IMAGE_DATA_001);
    writeFileSync(join(imagesDir, 'img_002.jpg'), IMAGE_DATA_002);
    writeFileSync(join(imagesDir, 'old_file.jpg'), Buffer.from('old file to be deleted'));

    // PLAYLIST_V2 (img_001のみ) を書き込む
    writePlaylistJson(PLAYLIST_V2, playlistJsonPath, playlistTmpPath);

    const localPlaylist = JSON.parse(readFileSync(playlistJsonPath, 'utf-8')) as PlaylistResponse;

    // クリーンアップ実行
    cleanupOldFiles(imagesDir, localPlaylist.items);

    // img_001 は存在する
    expect(existsSync(join(imagesDir, 'img_001.jpg'))).toBe(true);
    // img_002 と old_file は削除されている
    expect(existsSync(join(imagesDir, 'img_002.jpg'))).toBe(false);
    expect(existsSync(join(imagesDir, 'old_file.jpg'))).toBe(false);
  });

  /**
   * クリーンアップ統合テスト 3:
   * playlist.jsonのアトミック書き込みが保証されていること（tmp→renameパターン）
   */
  it('INT-CL-03: playlist.jsonがアトミックに書き込まれる（tmpが残存しない）', async () => {
    const { writePlaylistJson } = await import('../../fileManager.js');

    // 既存のplaylist.json（v1）
    const existingData: PlaylistResponse = {
      ...PLAYLIST_V1,
      items: PLAYLIST_V1.items.map((item) => ({
        ...item,
        url: `/data/images/${item.id}.jpg`,
      })),
    };
    writeFileSync(playlistJsonPath, JSON.stringify(existingData, null, 2), 'utf-8');

    // v2のplaylist.jsonをアトミックに書き込む
    writePlaylistJson(PLAYLIST_V2, playlistJsonPath, playlistTmpPath);

    // tmpファイルは残存しないこと
    expect(existsSync(playlistTmpPath)).toBe(false);

    // playlist.jsonが正しく更新されていること
    const written = JSON.parse(readFileSync(playlistJsonPath, 'utf-8')) as PlaylistResponse;
    expect(written.version).toBe('v_1710679000');
    expect(written.items).toHaveLength(1);
    expect(written.items[0].url).toBe('/data/images/img_001.jpg');
  });
});
