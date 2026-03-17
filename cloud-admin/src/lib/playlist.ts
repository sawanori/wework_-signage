import type { PlaylistResponse, PlaylistItem, PlaylistDetailResponse, PlaylistListResponse, PlaylistSummary, CreatePlaylistResponse } from '@non-turn/shared';
import { db } from './db';
import { generateVersion } from './version';

const MAX_PLAYLISTS = 3;

/**
 * アクティブなプレイリストを取得する（後方互換: Sync Agent向け）
 */
export async function getActivePlaylist(deviceId: string): Promise<PlaylistResponse | null> {
  const playlistResult = await db.execute({
    sql: `SELECT id, device_id, store_id, version, orientation, fade_duration_ms, interval_ms
          FROM playlists WHERE device_id = ? AND is_active = 1`,
    args: [deviceId],
  });

  if (playlistResult.rows.length === 0) {
    return null;
  }

  const row = playlistResult.rows[0] as unknown[];
  const playlistId = row[0] as number;
  const devId = row[1] as string;
  const storeId = row[2] as string;
  const version = row[3] as string;
  const orientation = row[4] as 'portrait' | 'landscape';
  const fadeDurationMs = row[5] as number;
  const intervalMs = row[6] as number;

  const itemsResult = await db.execute({
    sql: `SELECT id, public_url, hash, file_type, duration_override_ms, position
          FROM playlist_items WHERE playlist_id = ? ORDER BY position ASC`,
    args: [playlistId],
  });

  const items: PlaylistItem[] = (itemsResult.rows as unknown[][]).map((itemRow) => ({
    id: itemRow[0] as string,
    url: itemRow[1] as string,
    hash: itemRow[2] as string,
    type: itemRow[3] as 'image' | 'pdf',
    durationOverrideMs: itemRow[4] as number | null,
    position: itemRow[5] as number,
  }));

  return {
    version,
    orientation,
    globalSettings: {
      fadeDurationMs,
      intervalMs,
    },
    deviceId: devId,
    storeId,
    items,
  };
}

/**
 * 後方互換のエイリアス（既存のgetPlaylist呼び出しを維持）
 */
export async function getPlaylist(deviceId: string): Promise<PlaylistResponse | null> {
  return getActivePlaylist(deviceId);
}

/**
 * 特定プレイリストを取得する（管理画面の編集用）
 */
export async function getPlaylistById(playlistId: number, deviceId: string): Promise<PlaylistDetailResponse | null> {
  const playlistResult = await db.execute({
    sql: `SELECT id, device_id, store_id, name, is_active, version, orientation, fade_duration_ms, interval_ms
          FROM playlists WHERE id = ? AND device_id = ?`,
    args: [playlistId, deviceId],
  });

  if (playlistResult.rows.length === 0) {
    return null;
  }

  const row = playlistResult.rows[0] as unknown[];
  const pid = row[0] as number;
  const devId = row[1] as string;
  const storeId = row[2] as string;
  const name = row[3] as string;
  const isActive = (row[4] as number) === 1;
  const version = row[5] as string;
  const orientation = row[6] as 'portrait' | 'landscape';
  const fadeDurationMs = row[7] as number;
  const intervalMs = row[8] as number;

  const itemsResult = await db.execute({
    sql: `SELECT id, public_url, hash, file_type, duration_override_ms, position
          FROM playlist_items WHERE playlist_id = ? ORDER BY position ASC`,
    args: [pid],
  });

  const items: PlaylistItem[] = (itemsResult.rows as unknown[][]).map((itemRow) => ({
    id: itemRow[0] as string,
    url: itemRow[1] as string,
    hash: itemRow[2] as string,
    type: itemRow[3] as 'image' | 'pdf',
    durationOverrideMs: itemRow[4] as number | null,
    position: itemRow[5] as number,
  }));

  return {
    playlistId: pid,
    playlistName: name,
    isActive,
    version,
    orientation,
    globalSettings: {
      fadeDurationMs,
      intervalMs,
    },
    deviceId: devId,
    storeId,
    items,
  };
}

/**
 * デバイスの全プレイリストサマリーを取得する
 */
export async function getPlaylistSummaries(deviceId: string): Promise<PlaylistListResponse | null> {
  const result = await db.execute({
    sql: `SELECT p.id, p.name, p.is_active, p.version, p.updated_at,
                 COUNT(pi.id) as item_count,
                 p.store_id
          FROM playlists p
          LEFT JOIN playlist_items pi ON pi.playlist_id = p.id
          WHERE p.device_id = ?
          GROUP BY p.id
          ORDER BY p.id ASC`,
    args: [deviceId],
  });

  if (result.rows.length === 0) {
    return null;
  }

  const storeId = (result.rows[0] as unknown[])[6] as string;

  const playlists: PlaylistSummary[] = (result.rows as unknown[][]).map((row) => ({
    id: row[0] as number,
    name: row[1] as string,
    isActive: (row[2] as number) === 1,
    version: row[3] as string,
    updatedAt: row[4] as number,
    itemCount: row[5] as number,
  }));

  return {
    deviceId,
    storeId,
    playlists,
  };
}

/**
 * 新規プレイリストを作成する（3件上限チェック付き）
 */
export async function createPlaylist(deviceId: string, name: string): Promise<CreatePlaylistResponse> {
  // 既存プレイリスト数とstore_idを取得
  const countResult = await db.execute({
    sql: `SELECT COUNT(*) as cnt, MAX(store_id) as store_id FROM playlists WHERE device_id = ?`,
    args: [deviceId],
  });

  const countRow = countResult.rows[0] as unknown[];
  const count = countRow[0] as number;
  const storeId = countRow[1] as string;

  if (count >= MAX_PLAYLISTS) {
    throw new Error('PLAYLIST_LIMIT_EXCEEDED');
  }

  if (!storeId) {
    throw new Error('DEVICE_NOT_FOUND');
  }

  const insertResult = await db.execute({
    sql: `INSERT INTO playlists (device_id, store_id, name, is_active, version, updated_at)
          VALUES (?, ?, ?, 0, ?, unixepoch())
          RETURNING id`,
    args: [deviceId, storeId, name, generateVersion()],
  });

  const newId = ((insertResult.rows[0] as unknown[])[0]) as number;

  return {
    playlistId: newId,
    name,
    isActive: false,
  };
}

/**
 * プレイリストをアクティブに切り替える（トランザクション）
 */
export async function activatePlaylist(playlistId: number, deviceId: string): Promise<{ playlistId: number; name: string; isActive: boolean }> {
  // 対象プレイリストの存在確認
  const checkResult = await db.execute({
    sql: `SELECT id, name, is_active FROM playlists WHERE id = ? AND device_id = ?`,
    args: [playlistId, deviceId],
  });

  if (checkResult.rows.length === 0) {
    throw new Error('PLAYLIST_NOT_FOUND');
  }

  const row = checkResult.rows[0] as unknown[];
  const name = row[1] as string;

  // バッチトランザクション: 全部非アクティブ → 指定IDをアクティブ + version更新
  await db.batch([
    {
      sql: `UPDATE playlists SET is_active = 0 WHERE device_id = ?`,
      args: [deviceId],
    },
    {
      sql: `UPDATE playlists SET is_active = 1, version = ?, updated_at = unixepoch() WHERE id = ?`,
      args: [generateVersion(), playlistId],
    },
  ]);

  return {
    playlistId,
    name,
    isActive: true,
  };
}

/**
 * プレイリスト名を変更する
 */
export async function renamePlaylist(playlistId: number, name: string): Promise<{ playlistId: number; name: string }> {
  const result = await db.execute({
    sql: `UPDATE playlists SET name = ?, updated_at = unixepoch() WHERE id = ? RETURNING id`,
    args: [name, playlistId],
  });

  if (result.rows.length === 0) {
    throw new Error('PLAYLIST_NOT_FOUND');
  }

  return { playlistId, name };
}

/**
 * プレイリストを削除する（アクティブは拒否）
 */
export async function deletePlaylist(playlistId: number, deviceId: string): Promise<void> {
  const checkResult = await db.execute({
    sql: `SELECT is_active FROM playlists WHERE id = ? AND device_id = ?`,
    args: [playlistId, deviceId],
  });

  if (checkResult.rows.length === 0) {
    throw new Error('PLAYLIST_NOT_FOUND');
  }

  const isActive = ((checkResult.rows[0] as unknown[])[0] as number) === 1;
  if (isActive) {
    throw new Error('CANNOT_DELETE_ACTIVE');
  }

  // 明示的に関連アイテムを削除してからプレイリストを削除（CASCADE非依存）
  await db.batch([
    {
      sql: `DELETE FROM playlist_items WHERE playlist_id = ?`,
      args: [playlistId],
    },
    {
      sql: `DELETE FROM playlists WHERE id = ? AND device_id = ?`,
      args: [playlistId, deviceId],
    },
  ]);
}

export async function addPlaylistItem(params: {
  playlistId: number;
  id: string;
  r2Url: string;
  publicUrl: string;
  hash: string;
  fileType: string;
  originalFilename: string;
  fileSizeBytes: number;
  durationOverrideMs: number | null;
  position: number;
  storeId: string;
  deviceId: string;
}): Promise<void> {
  await db.batch([
    {
      sql: `INSERT INTO playlist_items
            (id, playlist_id, store_id, device_id, r2_url, public_url, hash, file_type,
             original_filename, file_size_bytes, duration_override_ms, position)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        params.id,
        params.playlistId,
        params.storeId,
        params.deviceId,
        params.r2Url,
        params.publicUrl,
        params.hash,
        params.fileType,
        params.originalFilename,
        params.fileSizeBytes,
        params.durationOverrideMs,
        params.position,
      ],
    },
    {
      sql: `UPDATE playlists SET version = ?, updated_at = unixepoch() WHERE id = ?`,
      args: [generateVersion(), params.playlistId],
    },
  ]);
}

export async function deletePlaylistItem(itemId: string, playlistId: number): Promise<void> {
  await db.batch([
    {
      sql: `DELETE FROM playlist_items WHERE id = ? AND playlist_id = ?`,
      args: [itemId, playlistId],
    },
    {
      sql: `UPDATE playlists SET version = ?, updated_at = unixepoch() WHERE id = ?`,
      args: [generateVersion(), playlistId],
    },
  ]);
}

export async function reorderPlaylistItems(
  playlistId: number,
  orderedIds: string[],
): Promise<void> {
  const statements = orderedIds.map((id, i) => ({
    sql: `UPDATE playlist_items SET position = ? WHERE id = ? AND playlist_id = ?`,
    args: [i + 1, id, playlistId] as (number | string)[],
  }));

  statements.push({
    sql: `UPDATE playlists SET version = ?, updated_at = unixepoch() WHERE id = ?`,
    args: [generateVersion(), playlistId],
  });

  await db.batch(statements);
}
