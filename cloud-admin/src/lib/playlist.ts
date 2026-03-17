import type { PlaylistResponse, PlaylistItem } from '@non-turn/shared';
import { db } from './db';
import { generateVersion } from './version';

export async function getPlaylist(deviceId: string): Promise<PlaylistResponse | null> {
  const playlistResult = await db.execute({
    sql: `SELECT id, device_id, store_id, version, orientation, fade_duration_ms, interval_ms
          FROM playlists WHERE device_id = ?`,
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
      sql: `DELETE FROM playlist_items WHERE id = ?`,
      args: [itemId],
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
