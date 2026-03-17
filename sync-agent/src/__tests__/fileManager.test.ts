/**
 * テストケース対象: C-N-03, C-N-04, C-E-04, C-E-06
 *
 * C-N-03: 新規画像追加 — tmp→imagesへのアトミック移動（renameSync）を検証
 * C-N-04: アトミック完了確認 — playlist.jsonのアトミック書き込み（tmp→rename）を検証
 * C-E-04: ダウンロード中断 — tmpクリーンアップを検証
 * C-E-06: ディスク容量不足（ENOSPC） — エラーハンドリングを検証
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { PlaylistResponse } from '@non-turn/shared';

// fileManagerモジュールのインポート（スタブのまま）
const fileManagerModule = await import('../fileManager.js');

// テスト用一時ディレクトリの作成
let testDir: string;
let tmpDirPath: string;
let imagesDirPath: string;

beforeEach(() => {
  testDir = mkdtempSync(join(tmpdir(), 'file-manager-test-'));
  tmpDirPath = join(testDir, 'tmp');
  imagesDirPath = join(testDir, 'images');
  mkdirSync(tmpDirPath, { recursive: true });
  mkdirSync(imagesDirPath, { recursive: true });
});

afterEach(() => {
  // テスト後のクリーンアップ
  try {
    const { rmSync } = require('fs');
    rmSync(testDir, { recursive: true, force: true });
  } catch { /* ignore */ }
});

describe('fileManager.ts', () => {
  /**
   * C-N-03: tmp→imagesへのアトミック移動（renameSync）が正しく行われる
   */
  it('C-N-03: tmpファイルをimagesディレクトリにrenameSyncでアトミック移動する', async () => {
    // tmpディレクトリに一時ファイルを作成
    const tmpFilePath = join(tmpDirPath, 'img_001.jpg.tmp');
    const destFilePath = join(imagesDirPath, 'img_001.jpg');
    writeFileSync(tmpFilePath, Buffer.from('fake image data'));

    expect(existsSync(tmpFilePath)).toBe(true);
    expect(existsSync(destFilePath)).toBe(false);

    const moveFile = (fileManagerModule as {
      moveFile?: (src: string, dest: string) => void
    }).moveFile;
    expect(moveFile).toBeDefined();

    moveFile!(tmpFilePath, destFilePath);

    // 移動後: tmpにはファイルが存在しない
    expect(existsSync(tmpFilePath)).toBe(false);
    // 移動後: imagesに正しく配置されている
    expect(existsSync(destFilePath)).toBe(true);
  });

  /**
   * C-N-04: playlist.jsonのアトミック書き込み（tmp→rename）
   */
  it('C-N-04: playlist.jsonをtmpに書き込んだ後renameで原子的に置換する', async () => {
    const playlistJsonPath = join(testDir, 'playlist.json');
    const playlistTmpPath = join(tmpDirPath, 'playlist.json.tmp');

    const playlistData: PlaylistResponse = {
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
          url: '/data/images/img_001.jpg',
          hash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
          type: 'image',
          durationOverrideMs: null,
          position: 1,
        },
      ],
    };

    const writePlaylistJson = (fileManagerModule as {
      writePlaylistJson?: (
        playlistData: PlaylistResponse,
        playlistJsonPath: string,
        tmpPath: string
      ) => void
    }).writePlaylistJson;
    expect(writePlaylistJson).toBeDefined();

    writePlaylistJson!(playlistData, playlistJsonPath, playlistTmpPath);

    // 書き込み後: playlist.jsonが存在すること
    expect(existsSync(playlistJsonPath)).toBe(true);
    // tmpファイルは残っていないこと（アトミック置換されたため）
    expect(existsSync(playlistTmpPath)).toBe(false);

    // playlist.jsonの内容が正しいこと
    const written = JSON.parse(readFileSync(playlistJsonPath, 'utf-8'));
    expect(written.version).toBe('v_1710678000');
    expect(written.items).toHaveLength(1);
    expect(written.items[0].id).toBe('img_001');
  });

  /**
   * C-E-04: ダウンロード中断時のtmpクリーンアップ
   */
  it('C-E-04: ダウンロード中断時にtmpファイルがクリーンアップされる', async () => {
    const tmpFilePath = join(tmpDirPath, 'img_001.jpg.tmp');
    writeFileSync(tmpFilePath, Buffer.from('partial download data'));

    expect(existsSync(tmpFilePath)).toBe(true);

    const cleanupTmpFile = (fileManagerModule as {
      cleanupTmpFile?: (tmpFilePath: string) => void
    }).cleanupTmpFile;
    expect(cleanupTmpFile).toBeDefined();

    cleanupTmpFile!(tmpFilePath);

    // クリーンアップ後: tmpファイルが削除されていること
    expect(existsSync(tmpFilePath)).toBe(false);
  });

  /**
   * C-E-04: 存在しないtmpファイルのクリーンアップはエラーを投げない
   */
  it('C-E-04: 存在しないtmpファイルのクリーンアップはエラーを投げない', () => {
    const nonExistentPath = join(tmpDirPath, 'non-existent.tmp');

    const cleanupTmpFile = (fileManagerModule as {
      cleanupTmpFile?: (tmpFilePath: string) => void
    }).cleanupTmpFile;
    expect(cleanupTmpFile).toBeDefined();

    // エラーを投げないこと
    expect(() => cleanupTmpFile!(nonExistentPath)).not.toThrow();
  });

  /**
   * C-E-06: ディスク容量不足（ENOSPC）エラーのハンドリング
   * writePlaylistJson が ENOSPC エラーを受け取った場合に適切に処理する
   */
  it('C-E-06: ENOSPC エラー時に処理を中断してエラーをスローする', async () => {
    // ディスク容量不足をシミュレートするため、読み取り専用のパスに書き込みを試みる
    // fileManager は ENOSPC エラーを受けた場合にエラーをスロー or ログを出力することを検証
    const writePlaylistJson = (fileManagerModule as {
      writePlaylistJson?: (
        playlistData: PlaylistResponse,
        playlistJsonPath: string,
        tmpPath: string
      ) => void
    }).writePlaylistJson;
    expect(writePlaylistJson).toBeDefined();

    const playlistData: PlaylistResponse = {
      version: 'v_1710678000',
      orientation: 'portrait',
      deviceId: 'device_kyokomachi_01',
      storeId: 'store_kyokomachi',
      globalSettings: { fadeDurationMs: 2000, intervalMs: 10000 },
      items: [],
    };

    // 書き込み不可能なパス（rootのみ書き込み可能）を指定してENOSPC/EPERMをシミュレート
    const unwritablePath = '/proc/non-existent-playlist.json';
    const unwritableTmp = '/proc/non-existent-playlist.json.tmp';

    // 書き込みエラーが発生すること（スローまたは適切なハンドリング）
    expect(() => {
      writePlaylistJson!(playlistData, unwritablePath, unwritableTmp);
    }).toThrow();
  });

  /**
   * C-E-06: ENOSPC エラー時にアラートログが出力される
   * writePlaylistJsonWithEnosp はENOSPCエラーを引数として受け取り適切にハンドリングする
   */
  it('C-E-06: ENOSPC エラーハンドラーがアラートレベルのログを出力する', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // handleWriteError が export されている場合のテスト
    const handleWriteError = (fileManagerModule as {
      handleWriteError?: (error: NodeJS.ErrnoException, tmpPath: string) => void
    }).handleWriteError;
    expect(handleWriteError).toBeDefined();

    const enospcError = new Error('ENOSPC: no space left on device') as NodeJS.ErrnoException;
    enospcError.code = 'ENOSPC';

    const tmpFilePath = join(tmpDirPath, 'test.tmp');

    handleWriteError!(enospcError, tmpFilePath);

    // エラーログ（アラートレベル）が出力されること
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});
