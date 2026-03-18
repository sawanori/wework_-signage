import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { PlaylistResponse, PlaylistItem, PlaylistDetailResponse } from '@non-turn/shared';

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const deviceId = url.searchParams.get('device_id');
  const playlistIdParam = url.searchParams.get('playlist_id');

  if (!deviceId) {
    return NextResponse.json(
      { error: 'device_id is required', code: 'MISSING_DEVICE_ID' },
      { status: 400 },
    );
  }

  try {
    // If playlist_id specified: return PlaylistDetailResponse for that specific playlist
    if (playlistIdParam !== null) {
      const playlistId = parseInt(playlistIdParam, 10);
      if (isNaN(playlistId)) {
        return NextResponse.json(
          { error: 'playlist_id must be a number', code: 'INVALID_PLAYLIST_ID' },
          { status: 400 },
        );
      }

      const playlistResult = await db.execute({
        sql: `SELECT id, device_id, store_id, name, is_active, version, orientation, fade_duration_ms, interval_ms
              FROM playlists WHERE id = ? AND device_id = ?`,
        args: [playlistId, deviceId],
      });

      if (playlistResult.rows.length === 0) {
        return NextResponse.json(
          { error: 'Playlist not found', code: 'PLAYLIST_NOT_FOUND' },
          { status: 404 },
        );
      }

      const row = playlistResult.rows[0] as unknown as unknown[];
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

      const baseUrl = new URL(request.url).origin;
      const items: PlaylistItem[] = (itemsResult.rows as unknown as unknown[][]).map((itemRow) => {
        const publicUrl = itemRow[1] as string;
        const key = publicUrl.split('/').pop() ?? '';
        return {
          id: itemRow[0] as string,
          url: `${baseUrl}/api/image?key=${encodeURIComponent(key)}`,
          hash: itemRow[2] as string,
          type: itemRow[3] as 'image' | 'pdf',
          durationOverrideMs: itemRow[4] as number | null,
          position: itemRow[5] as number,
        };
      });

      items.sort((a, b) => a.position - b.position);

      const response: PlaylistDetailResponse = {
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

      return NextResponse.json(response);
    }

    // Default: return active playlist (backward compatible for Sync Agent)
    const playlistResult = await db.execute({
      sql: `SELECT id, device_id, store_id, version, orientation, fade_duration_ms, interval_ms
            FROM playlists WHERE device_id = ? AND is_active = 1`,
      args: [deviceId],
    });

    if (playlistResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'device not found', code: 'DEVICE_NOT_FOUND' },
        { status: 404 },
      );
    }

    const row = playlistResult.rows[0] as unknown as unknown[];
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

    const baseUrl = new URL(request.url).origin;
    const items: PlaylistItem[] = (itemsResult.rows as unknown as unknown[][]).map((itemRow) => {
      const publicUrl = itemRow[1] as string;
      // Extract the R2 key from the URL for the image proxy
      const key = publicUrl.split('/').pop() ?? '';
      return {
        id: itemRow[0] as string,
        url: `${baseUrl}/api/image?key=${encodeURIComponent(key)}`,
        hash: itemRow[2] as string,
        type: itemRow[3] as 'image' | 'pdf',
        durationOverrideMs: itemRow[4] as number | null,
        position: itemRow[5] as number,
      };
    });

    // Sort by position ascending
    items.sort((a, b) => a.position - b.position);

    const response: PlaylistResponse = {
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

    return NextResponse.json(response);
  } catch (error) {
    console.error('DB error:', error);
    return NextResponse.json(
      { error: 'database error', code: 'DB_ERROR' },
      { status: 500 },
    );
  }
}
