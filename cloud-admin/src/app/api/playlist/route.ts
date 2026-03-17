import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { PlaylistResponse, PlaylistItem } from '@non-turn/shared';

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const deviceId = url.searchParams.get('device_id');

  if (!deviceId) {
    return NextResponse.json(
      { error: 'device_id is required', code: 'MISSING_DEVICE_ID' },
      { status: 400 },
    );
  }

  try {
    const playlistResult = await db.execute({
      sql: `SELECT id, device_id, store_id, version, orientation, fade_duration_ms, interval_ms
            FROM playlists WHERE device_id = ?`,
      args: [deviceId],
    });

    if (playlistResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'device not found', code: 'DEVICE_NOT_FOUND' },
        { status: 404 },
      );
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

    const baseUrl = new URL(request.url).origin;
    const items: PlaylistItem[] = (itemsResult.rows as unknown[][]).map((itemRow) => {
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
