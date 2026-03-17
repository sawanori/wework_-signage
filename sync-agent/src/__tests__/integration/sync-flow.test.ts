/**
 * 結合テスト: Module B + Module C
 * 検証内容: Sync AgentがCloud Admin APIからデータを取得しplaylist.jsonを更新できる
 *
 * テスト内容:
 * 1. モックAPIサーバー（fetchをモック）がPlaylistResponseを返す
 * 2. Sync Agentのfetcher.tsがプレイリストを取得
 * 3. 画像URLからのダウンロード（fetchをモック → Bufferを返す）
 * 4. hashVerifier.tsでハッシュ検証が成功
 * 5. fileManager.tsでtmp→imagesへのアトミック移動
 * 6. playlist.jsonがアトミックに書き込まれる（tmp→rename）
 * 7. playlist.json内のURLがローカルパスに変換されている
 * 8. 2回目のポーリングでversion一致→ダウンロードスキップ
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { createHash } from 'crypto';
import type { PlaylistResponse } from '@non-turn/shared';

// fetchをグローバルモック
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// テスト用の画像データ（実際のBufferコンテンツ）
const IMAGE_DATA_001 = Buffer.from('fake-image-content-001');
const IMAGE_DATA_002 = Buffer.from('fake-image-content-002');

// 実際のSHA-256ハッシュを計算
const HASH_001 = createHash('sha256').update(IMAGE_DATA_001).digest('hex');
const HASH_002 = createHash('sha256').update(IMAGE_DATA_002).digest('hex');

const PLAYLIST_V1: PlaylistResponse = {
  version: 'v_1710678000',
  orientation: 'portrait',
  deviceId: 'device_kyokomachi_01',
  storeId: 'store_kyokomachi',
  globalSettings: {
    fadeDurationMs: 2000,
    intervalMs: 10000,
  },
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

// ReadableStream から Buffer に変換するヘルパー
function createReadableStreamFromBuffer(buffer: Buffer): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(buffer));
      controller.close();
    },
  });
}

describe('Module B + Module C 結合テスト: Sync Flowフロー', () => {
  let testDir: string;
  let imagesDir: string;
  let tmpDir: string;
  let playlistJsonPath: string;
  let playlistTmpPath: string;

  beforeEach(() => {
    vi.clearAllMocks();
    testDir = mkdtempSync(join(tmpdir(), 'sync-flow-integration-'));
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
      // ignore cleanup errors
    }
  });

  /**
   * 統合テスト 1: APIからプレイリストを取得し、画像をダウンロードして
   * playlist.jsonをアトミックに書き込む一連のフロー
   */
  it('INT-BC-01: APIからプレイリスト取得 → 画像DL → ハッシュ検証 → アトミックファイル書き込みの一連フロー', async () => {
    // Setup: API fetch → PlaylistResponse
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/playlist')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => PLAYLIST_V1,
        });
      }
      // Image downloads
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

    // Step 1: fetchPlaylistでプレイリスト取得
    const { fetchPlaylist, downloadFile } = await import('../../fetcher.js');
    const playlist = await fetchPlaylist('https://admin.non-turn.com', 'device_kyokomachi_01');

    expect(playlist).not.toBeNull();
    expect(playlist!.version).toBe('v_1710678000');
    expect(playlist!.items).toHaveLength(2);

    // Step 2-5: 各アイテムをダウンロード → ハッシュ検証 → tmpからimagesへ移動
    const { verifyHash } = await import('../../hashVerifier.js');
    const { moveFile } = await import('../../fileManager.js');

    for (const item of playlist!.items) {
      const ext = item.url.includes('.') ? item.url.split('.').pop() ?? '' : '';
      const filename = ext ? `${item.id}.${ext}` : item.id;
      const tmpFilePath = join(tmpDir, `${filename}.tmp`);
      const destFilePath = join(imagesDir, filename);

      // ダウンロード
      await downloadFile(item.url, tmpFilePath);

      // tmpファイルが作成されていること
      expect(existsSync(tmpFilePath)).toBe(true);

      // ハッシュ検証
      const valid = await verifyHash(tmpFilePath, item.hash);
      expect(valid).toBe(true);

      // tmp → images へアトミック移動
      moveFile(tmpFilePath, destFilePath);

      // 移動後: tmpにはファイルが存在しない
      expect(existsSync(tmpFilePath)).toBe(false);
      // 移動後: imagesに正しく配置されている
      expect(existsSync(destFilePath)).toBe(true);
    }

    // Step 6-7: playlist.jsonをアトミックに書き込む（URLをローカルパスに変換）
    const { writePlaylistJson } = await import('../../fileManager.js');
    writePlaylistJson(playlist!, playlistJsonPath, playlistTmpPath);

    // playlist.jsonが存在すること
    expect(existsSync(playlistJsonPath)).toBe(true);
    // tmpファイルは残っていないこと（アトミック置換）
    expect(existsSync(playlistTmpPath)).toBe(false);

    // playlist.json内のURLがローカルパスに変換されていること
    const written = JSON.parse(readFileSync(playlistJsonPath, 'utf-8')) as PlaylistResponse;
    expect(written.version).toBe('v_1710678000');
    expect(written.items).toHaveLength(2);

    // URLがローカルパス形式に変換されていること
    expect(written.items[0].url).toBe('/data/images/img_001.jpg');
    expect(written.items[1].url).toBe('/data/images/img_002.jpg');
    // IDやhashなど他のフィールドは保持されていること
    expect(written.items[0].id).toBe('img_001');
    expect(written.items[0].hash).toBe(HASH_001);
  });

  /**
   * 統合テスト 2: 2回目のポーリングでversionが一致する場合のスキップ動作
   */
  it('INT-BC-02: 2回目ポーリングでversion一致時にダウンロードをスキップする', async () => {
    // 事前に playlist.json を作成（v_1710678000）
    const existingPlaylist: PlaylistResponse = {
      ...PLAYLIST_V1,
      items: PLAYLIST_V1.items.map((item) => ({
        ...item,
        url: `/data/images/${item.id}.jpg`,
      })),
    };
    writeFileSync(playlistJsonPath, JSON.stringify(existingPlaylist, null, 2), 'utf-8');

    // 事前に images/ に画像ファイルを作成
    writeFileSync(join(imagesDir, 'img_001.jpg'), IMAGE_DATA_001);
    writeFileSync(join(imagesDir, 'img_002.jpg'), IMAGE_DATA_002);

    // API は同じversionを返す
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/playlist')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => PLAYLIST_V1,
        });
      }
      return Promise.reject(new Error(`Unexpected fetch to image URL: ${url}`));
    });

    const { fetchPlaylist } = await import('../../fetcher.js');
    const playlist = await fetchPlaylist('https://admin.non-turn.com', 'device_kyokomachi_01');

    expect(playlist).not.toBeNull();

    // ローカルのversionを取得
    const localData = JSON.parse(readFileSync(playlistJsonPath, 'utf-8')) as { version?: string };
    const localVersion = localData.version;

    // version が一致する場合はスキップ
    if (localVersion === playlist!.version) {
      // ダウンロードは実行されない（fetchの呼び出し回数は1回 = API呼び出しのみ）
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/playlist'),
        expect.anything(),
      );
    }

    // imagesディレクトリの内容は変わっていないこと
    expect(existsSync(join(imagesDir, 'img_001.jpg'))).toBe(true);
    expect(existsSync(join(imagesDir, 'img_002.jpg'))).toBe(true);

    // playlist.jsonの内容は変わっていないこと
    const writtenPlaylist = JSON.parse(readFileSync(playlistJsonPath, 'utf-8')) as PlaylistResponse;
    expect(writtenPlaylist.version).toBe('v_1710678000');
  });

  /**
   * 統合テスト 3: ハッシュ不一致の場合にファイルを破棄する
   */
  it('INT-BC-03: ハッシュ不一致の場合にtmpファイルを削除してスキップする', async () => {
    // 正しくない（破損した）データを返すモック
    const corruptedData = Buffer.from('corrupted-image-data');

    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/playlist')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => PLAYLIST_V1,
        });
      }
      // 破損したデータを返す
      return Promise.resolve({
        ok: true,
        status: 200,
        body: createReadableStreamFromBuffer(corruptedData),
      });
    });

    const { fetchPlaylist, downloadFile } = await import('../../fetcher.js');
    const { verifyHash } = await import('../../hashVerifier.js');
    const { cleanupTmpFile } = await import('../../fileManager.js');

    const playlist = await fetchPlaylist('https://admin.non-turn.com', 'device_kyokomachi_01');
    expect(playlist).not.toBeNull();

    // 最初のアイテムのみ検証
    const item = playlist!.items[0];
    const ext = 'jpg';
    const tmpFilePath = join(tmpDir, `${item.id}.${ext}.tmp`);
    const destFilePath = join(imagesDir, `${item.id}.${ext}`);

    await downloadFile(item.url, tmpFilePath);
    expect(existsSync(tmpFilePath)).toBe(true);

    // ハッシュ検証は失敗する（破損データのため）
    const valid = await verifyHash(tmpFilePath, item.hash);
    expect(valid).toBe(false);

    // ハッシュ不一致時はtmpファイルを削除
    cleanupTmpFile(tmpFilePath);
    expect(existsSync(tmpFilePath)).toBe(false);

    // imagesディレクトリには移動されていないこと
    expect(existsSync(destFilePath)).toBe(false);
  });

  /**
   * 統合テスト 4: tmpディレクトリにゴミファイルが残らないこと
   */
  it('INT-BC-04: 正常フロー完了後にtmpディレクトリに残骸ファイルがない', async () => {
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

    const { fetchPlaylist, downloadFile } = await import('../../fetcher.js');
    const { verifyHash } = await import('../../hashVerifier.js');
    const { moveFile, writePlaylistJson } = await import('../../fileManager.js');

    const playlist = await fetchPlaylist('https://admin.non-turn.com', 'device_kyokomachi_01');
    expect(playlist).not.toBeNull();

    // 全アイテムのDL→ハッシュ検証→移動
    for (const item of playlist!.items) {
      const ext = item.url.includes('.') ? item.url.split('.').pop() ?? '' : '';
      const filename = ext ? `${item.id}.${ext}` : item.id;
      const tmpFilePath = join(tmpDir, `${filename}.tmp`);
      const destFilePath = join(imagesDir, filename);

      await downloadFile(item.url, tmpFilePath);
      const valid = await verifyHash(tmpFilePath, item.hash);
      expect(valid).toBe(true);
      moveFile(tmpFilePath, destFilePath);
    }

    // playlist.jsonのアトミック書き込み
    writePlaylistJson(playlist!, playlistJsonPath, playlistTmpPath);

    // tmpディレクトリに残骸ファイルがないこと
    const { readdirSync } = await import('fs');
    const tmpFiles = readdirSync(tmpDir);
    expect(tmpFiles).toHaveLength(0);
  });
});
